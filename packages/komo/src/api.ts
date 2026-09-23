import type { CommentsOptions, Identity, Thread } from "./types.js";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
/**
 * Cloudflare preview hosts under one owner: `alias-worker.ACCOUNT.workers.dev`
 * and `hash.PROJECT.pages.dev`. Sharing the session cookie on that parent
 * signs a reviewer in once for every preview of the same account/project.
 */
export function previewSessionDomain(hostname: string): string {
  return hostname.match(/^[^.]+\.([^.]+\.(?:workers|pages)\.dev)$/)?.[1] ?? "";
}
// Validate persisted/network data before it reaches rendering code.
function identity(value: Identity): boolean {
  return (
    !!value &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.verified === "boolean" &&
    [value.avatarUrl, value.accentColor].every(
      (v) => v === undefined || typeof v === "string",
    )
  );
}
function anchorContext(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const limits: Record<string, number> = {
    tag: 32,
    role: 80,
    label: 160,
    nearby: 160,
    classes: 200,
    selectedText: 200,
    styles: 500,
    scope: 2000,
  };
  return Object.entries(value).every(
    ([key, text]) =>
      typeof limits[key] === "number" &&
      typeof text === "string" &&
      text.length <= limits[key],
  );
}
function threadList(value: unknown): value is Thread[] {
  return (
    Array.isArray(value) &&
    value.every(
      (t: Thread) =>
        t &&
        typeof t.id === "string" &&
        typeof t.page === "string" &&
        typeof t.resolved === "boolean" &&
        Number.isFinite(t.createdAt) &&
        Number.isFinite(t.updatedAt) &&
        (t.resolvedBy === null || identity(t.resolvedBy)) &&
        t.anchor &&
        (!("context" in t.anchor) || anchorContext(t.anchor.context)) &&
        typeof t.anchor.selector === "string" &&
        typeof t.anchor.text === "string" &&
        [
          t.anchor.x,
          t.anchor.y,
          t.anchor.width,
          t.anchor.height,
          t.anchor.pageX,
          t.anchor.pageY,
          t.anchor.viewportWidth,
        ].every(Number.isFinite) &&
        Array.isArray(t.comments) &&
        t.comments.every(
          (c) =>
            c &&
            typeof c.id === "string" &&
            typeof c.body === "string" &&
            identity(c.author) &&
            Number.isFinite(c.createdAt) &&
            (c.editedAt === null || Number.isFinite(c.editedAt)) &&
            c.reactions &&
            typeof c.reactions === "object" &&
            !Array.isArray(c.reactions) &&
            Object.values(c.reactions).every(
              (ids) =>
                Array.isArray(ids) && ids.every((id) => typeof id === "string"),
            ),
        ),
    )
  );
}
function invalidResponse() {
  return new ApiError(
    0,
    "Could not read comments. Try again.",
    "invalid_response",
  );
}
export class CommentsApi {
  token: string | null = null;
  user: Identity | null = null;
  private revision: number | undefined;
  private cachedThreads: Thread[] = [];
  private key: string;
  private cookieName: string;
  private cookieDomain: string;
  constructor(private options: CommentsOptions) {
    this.cookieName = `bc-session-${encodeURIComponent(options.project)}`;
    const domain = options.sessionDomain?.replace(/^\./, "") ?? "";
    this.cookieDomain =
      domain &&
      (location.hostname === domain || location.hostname.endsWith(`.${domain}`))
        ? domain
        : previewSessionDomain(location.hostname);
    this.key = `branch-comments:${options.endpoint}:${options.project}`;
    try {
      this.token =
        document.cookie
          .split("; ")
          .find((cookie) => cookie.startsWith(`${this.cookieName}=`))
          ?.slice(this.cookieName.length + 1) || localStorage.getItem(this.key);
      // Last known account, shown at once; restore() confirms it with /me.
      const known = JSON.parse(localStorage.getItem(this.userKey) ?? "null");
      if (this.token && known?.token === this.token && identity(known.user))
        this.user = known.user;
    } catch {
      /* Private browsers can disable storage. */
    }
  }
  private get userKey() {
    return `${this.key}:user`;
  }
  private rememberUser() {
    try {
      if (this.token && this.user)
        localStorage.setItem(
          this.userKey,
          JSON.stringify({ token: this.token, user: this.user }),
        );
      else localStorage.removeItem(this.userKey);
    } catch {
      /* The account reloads from the server next time. */
    }
  }
  async request<T>(path: string, method = "GET", data?: unknown): Promise<T> {
    const url = new URL(path, this.options.endpoint.replace(/\/?$/, "/"));
    url.searchParams.set("project", this.options.project);
    url.searchParams.set("repo", this.options.repo);
    url.searchParams.set("branch", this.options.branch);
    const headers: Record<string, string> = {};
    const token = this.token;
    if (token) headers.Authorization = `Bearer ${token}`;
    if (data !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(url, {
      method,
      headers,
      body: data === undefined ? undefined : JSON.stringify(data),
      credentials: "omit",
      signal: AbortSignal.timeout(15000),
    }).catch((error: unknown) => {
      // Browsers hide why a request failed; offline is the one case we can tell.
      if (error instanceof TypeError)
        throw navigator.onLine === false
          ? new ApiError(0, "You’re offline.", "offline")
          : new ApiError(0, "Can’t connect to comments.", "unreachable");
      throw error;
    });
    const result = await response.json().catch(() => {
      if (response.ok) throw invalidResponse();
      return {};
    });
    if (
      response.ok &&
      (!result || typeof result !== "object" || Array.isArray(result))
    )
      throw invalidResponse();
    if (!response.ok) {
      if (response.status === 401 && this.token === token) this.clear();
      if (result?.code === "site_not_approved")
        throw new ApiError(
          response.status,
          "Comments aren’t turned on for this site yet.",
          result?.code,
        );
      throw new ApiError(
        response.status,
        result?.error ?? "Could not load comments.",
        result?.code,
      );
    }
    return result as T;
  }
  // ponytail: last list lives in localStorage so the next page load paints at
  // once and asks the server "notModified?" instead of refetching every page.
  // Quota overflow just skips the cache; IndexedDB if projects outgrow ~5MB.
  private get listKey() {
    return `${this.key}:${this.options.repo}:${this.options.branch}:threads`;
  }
  cached(): Thread[] | null {
    try {
      const stored = JSON.parse(localStorage.getItem(this.listKey) ?? "null");
      if (
        stored?.token !== (this.token ?? "") ||
        !threadList(stored.threads) ||
        (stored.revision !== undefined &&
          (!Number.isSafeInteger(stored.revision) || stored.revision < 0))
      )
        return null;
      this.revision = stored.revision;
      this.cachedThreads = stored.threads;
      return stored.threads;
    } catch {
      return null;
    }
  }
  private persist() {
    try {
      localStorage.setItem(
        this.listKey,
        JSON.stringify({
          token: this.token ?? "",
          revision: this.revision,
          threads: this.cachedThreads,
        }),
      );
    } catch {
      /* Storage full or blocked; the next load fetches normally. */
    }
  }
  async list(): Promise<Thread[]> {
    const token = this.token;
    const threads: Thread[] = [];
    let offset: number | null = 0;
    let revision: number | undefined;
    while (offset !== null) {
      type ListResponse = {
        threads?: Thread[];
        next?: number | null;
        revision?: number;
        notModified?: boolean;
      };
      const result: ListResponse = await this.request<ListResponse>(
        `threads?offset=${offset}${offset === 0 && this.revision !== undefined ? `&revision=${this.revision}` : ""}`,
      ).catch((error: unknown) => {
        if (
          error instanceof ApiError &&
          error.status === 403 &&
          this.token === token
        ) {
          this.revision = undefined;
          this.cachedThreads = [];
          this.persist();
        }
        throw error;
      });
      // Never apply or persist a response requested by a previous account.
      if (this.token !== token) return this.list();
      if (
        result.notModified === true &&
        offset === 0 &&
        this.revision !== undefined
      )
        return this.cachedThreads;
      if (
        !threadList(result.threads) ||
        (result.revision !== undefined &&
          (!Number.isSafeInteger(result.revision) || result.revision < 0)) ||
        (result.next != null &&
          (!Number.isSafeInteger(result.next) || result.next <= offset))
      )
        throw invalidResponse();
      if (offset === 0) revision = result.revision;
      threads.push(...(result.threads ?? []));
      offset = result.next ?? null;
    }
    this.revision = revision;
    this.cachedThreads = threads;
    this.persist();
    return threads;
  }
  save(data: { token: string; user: Identity }) {
    if (data.token !== this.token) {
      this.revision = undefined;
      this.cachedThreads = [];
    }
    this.token = data.token;
    this.user = data.user;
    this.rememberUser();
    try {
      localStorage.setItem(this.key, data.token);
      // Browsers cap cookie Max-Age at 400 days; the service session lasts far
      // longer and localStorage keeps the token beyond the cookie's lifetime.
      this.writeCookie(data.token, 400 * 86400);
    } catch {
      /* Session remains usable for this tab. */
    }
  }
  private writeCookie(value: string, maxAge: number) {
    const attributes = `Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    try {
      // A host-only cookie from before sharing would shadow the shared one.
      if (this.cookieDomain)
        document.cookie = `${this.cookieName}=; Max-Age=0; ${attributes}`;
      document.cookie = `${this.cookieName}=${value}; Max-Age=${maxAge}; ${attributes}${this.cookieDomain ? `; Domain=${this.cookieDomain}` : ""}`;
    } catch {
      /* Storage may be unavailable in this browser. */
    }
  }
  clear() {
    try {
      localStorage.removeItem(this.listKey);
    } catch {
      /* Nothing cached. */
    }
    this.revision = undefined;
    this.cachedThreads = [];
    this.token = null;
    this.user = null;
    this.rememberUser();
    this.writeCookie("", 0);
    try {
      localStorage.removeItem(this.key);
    } catch {
      /* No persistent session. */
    }
  }
  async restore() {
    if (!this.token) return;
    const token = this.token;
    const result = await this.request<{ user: Identity }>("me");
    if (this.token !== token) return;
    if (!identity(result.user)) throw invalidResponse();
    this.user = result.user;
    this.rememberUser();
  }
  async guest(name: string) {
    this.save(await this.request("auth/guest", "POST", { name }));
  }
  async logout() {
    const token = this.token;
    const user = this.user;
    const request = this.request("me", "DELETE");
    this.clear();
    try {
      await request;
    } catch (error) {
      if (
        !this.token &&
        token &&
        user &&
        !(error instanceof ApiError && error.status === 401)
      )
        this.save({ token, user });
      throw error;
    }
  }
}
