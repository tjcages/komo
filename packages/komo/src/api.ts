import type { CommentsOptions, Identity, Thread } from "./types.js";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
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
        : "";
    this.key = `branch-comments:${options.endpoint}:${options.project}`;
    try {
      this.token =
        document.cookie
          .split("; ")
          .find((cookie) => cookie.startsWith(`${this.cookieName}=`))
          ?.slice(this.cookieName.length + 1) || localStorage.getItem(this.key);
    } catch {
      /* Private browsers can disable storage. */
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
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && this.token === token) this.clear();
      if (result.code === "site_not_approved")
        throw new ApiError(
          response.status,
          "Comments aren’t turned on for this site yet.",
          result.code
        );
      throw new ApiError(
        response.status,
        result.error ?? "Could not load comments.",
        result.code
      );
    }
    return result as T;
  }
  async list(): Promise<Thread[]> {
    const threads: Thread[] = [];
    let offset: number | null = 0;
    let revision: number | undefined;
    while (offset !== null) {
      const result: {
        threads?: Thread[];
        next?: number | null;
        revision?: number;
        notModified?: boolean;
      } = await this.request(
        `threads?offset=${offset}${offset === 0 && this.revision !== undefined ? `&revision=${this.revision}` : ""}`
      );
      if (result.notModified) return this.cachedThreads;
      if (offset === 0) revision = result.revision;
      threads.push(...(result.threads ?? []));
      offset = result.next ?? null;
    }
    this.revision = revision;
    this.cachedThreads = threads;
    return threads;
  }
  save(data: { token: string; user: Identity }) {
    this.token = data.token;
    this.user = data.user;
    try {
      localStorage.setItem(this.key, data.token);
      this.writeCookie(data.token, 30 * 86400);
    } catch {
      /* Session remains usable for this tab. */
    }
  }
  private writeCookie(value: string, maxAge: number) {
    try {
      document.cookie = `${this.cookieName}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}${this.cookieDomain ? `; Domain=${this.cookieDomain}` : ""}`;
    } catch {
      /* Storage may be unavailable in this browser. */
    }
  }
  clear() {
    this.token = null;
    this.user = null;
    this.writeCookie("", 0);
    try {
      localStorage.removeItem(this.key);
    } catch {
      /* No persistent session. */
    }
  }
  async restore() {
    if (!this.token) return;
    const result = await this.request<{ user: Identity }>("me");
    this.user = result.user;
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
