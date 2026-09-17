import { resolveConfig, type KomoConfig } from "./config.js";
export type { KomoConfig } from "./config.js";
import { pinDirection } from "./pin-direction.js";
import { pinStacks } from "./pin-stacks.js";
import { OptimisticQueue } from "./optimistic.js";
import { accountUsage } from "./account-usage.js";
import { onboardingPanel } from "./onboarding.js";
import { agentPrompt } from "./agent-prompt.js";
import { accentPicker } from "./lazy-accent-picker.js";
import { applyAccent, DEFAULT_ACCENT } from "./accent.js";
import { cardMotion } from "./card-motion.js";
import { drawerPresence } from "./drawer-presence.js";
import { floatingDrag, constrain, type Placement } from "./floating-drag.js";
import { recordEmoji } from "./emoji-history.js";
import { reactionPicker } from "./reaction-picker.js";
import { animate } from "motion";
import { actionMenu, selectionMenu } from "./action-menu.js";
import {
  isCompactReview,
  mobileComposerPosition,
  reviewLayout,
} from "./review-layout.js";
import { createElement } from "react";
import { createToolbar } from "./lazy-toolbar.js";
import type { MenuItem } from "./MorphingMenu.js";
import { canonicalPage } from "./page.js";
import { ApiError, CommentsApi } from "./api.js";
import { captureAnchor, locateAnchor as measureAnchor } from "./anchors.js";
import {
  age,
  avatar,
  button,
  el,
  googleLogo,
  icon,
  icons,
  initials,
} from "./dom.js";
import { styles } from "./styles.js";
import type {
  Anchor,
  Comment,
  CommentsController,
  CommentsOptions,
  Thread,
} from "./types.js";
export type * from "./types.js";

const instances = new WeakMap<Document, CommentsController>();

/** Initialize from inline public project settings. */
export function initKomo(config: KomoConfig): CommentsController {
  return initComments(resolveConfig(config));
}

/** Mount once on the client. The returned destroy() restores the host page. */
export function initComments(options: CommentsOptions): CommentsController {
  const noop: CommentsController = {
    destroy() {},
    open() {},
    close() {},
    comment() {},
    async refresh() {},
  };
  if (typeof document === "undefined" || options.enabled === false) return noop;
  if (!options.endpoint || !options.repo || !options.branch || !options.project)
    throw new Error("Comments require endpoint, repo, branch, and project.");
  const endpoint = new URL(options.endpoint);
  if (
    endpoint.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)
  )
    throw new Error("The comments endpoint must use HTTPS.");
  if (instances.has(document)) return instances.get(document)!;
  const api = new CommentsApi(options);
  const abort = new AbortController();
  let destroyed = false,
    expanded = !!options.onboarding,
    mode = false,
    hidden = false,
    account = !!options.onboarding,
    pending = false,
    refreshing = false;
  let threads: Thread[] = [],
    selected: string | null = null,
    draft: Anchor | null = null;
  const optimistic = new OptimisticQueue<Thread[]>(
    [],
    (next) => {
      if (destroyed) return;
      if (selected) {
        const id = optimistic.id(selected);
        if (id !== selected) {
          if (replies.has(selected)) {
            replies.set(id, replies.get(selected)!);
            replies.delete(selected);
          }
          if (dialogKey === selected) dialogKey = id;
          selected = id;
        }
      }
      if (editing) editing = optimistic.id(editing);
      threads = next;
      pinSnapshot = "";
      renderPins();
      renderList();
      renderToolbar();
      if (!account) renderDialog();
    },
    (next, id) =>
      next.map((thread) => ({
        ...thread,
        id: id(thread.id),
        comments: thread.comments.map((comment) => ({
          ...comment,
          id: id(comment.id),
        })),
      }))
  );
  function changeThread(id: string, change: (thread: Thread) => Thread | null) {
    return (items: Thread[], resolve: (id: string) => string) =>
      items.flatMap((thread) => {
        if (thread.id !== resolve(id)) return [thread];
        const next = change(thread);
        return next ? [next] : [];
      });
  }
  async function saveOptimistic(
    change: Parameters<typeof optimistic.submit>[0],
    save: Parameters<typeof optimistic.submit>[1],
    rollback?: () => void
  ) {
    const token = api.token;
    try {
      await optimistic.submit(change, async (resolve) => {
        if (api.token !== token)
          throw new Error("Your account changed. Try again.");
        return save(resolve);
      });
    } catch (reason) {
      rollback?.();
      render();
      throw new Error(
        `Couldn't save. Your change was reverted. ${reason instanceof Error ? reason.message : "Try again."}`,
        { cause: reason }
      );
    }
    if (!optimistic.busy) run(refresh);
  }
  let filter: "open" | "resolved" | "all" = "open",
    allPages = true,
    search = "",
    connection = "Connecting",
    error = "";
  let profileDraft: {
    name: string;
    avatarUrl: string;
    accentColor: string;
  } | null = null;
  let disposeAccentPicker: (() => void) | undefined;
  let profileSaveTimer = 0;
  let profileRevision = 0;
  let confirmedProfile: import("./types.js").Identity | null = null;
  let profileSaveQueue = Promise.resolve();
  let queuedProfile: {
    name: string;
    avatarUrl: string;
    accentColor: string;
    token: string;
    revision: number;
  } | null = null;
  function saveProfile() {
    clearTimeout(profileSaveTimer);
    const next = queuedProfile;
    queuedProfile = null;
    if (!next) return profileSaveQueue;
    profileSaveQueue = profileSaveQueue
      .catch(() => {})
      .then(async () => {
        if (api.token !== next.token) return;
        try {
          const result = await api.request<{
            user: import("./types.js").Identity;
          }>("me", "PATCH", {
            name: next.name,
            avatarUrl: next.avatarUrl,
            accentColor: next.accentColor,
          });
          if (api.token !== next.token) return;
          confirmedProfile = result.user;
          if (profileRevision === next.revision)
            api.save({ token: next.token, user: result.user });
          if (!destroyed) {
            renderToolbar();
            run(refresh);
          }
        } catch (error) {
          if (api.token === next.token && profileRevision === next.revision) {
            api.user = confirmedProfile;
            profileDraft = null;
            render();
          }
          throw new Error(
            `Couldn't save your profile. ${error instanceof Error ? error.message : "Try again."}`,
            { cause: error }
          );
        }
      });
    return profileSaveQueue;
  }
  function queueProfileSave(
    profile: { name: string; avatarUrl: string; accentColor: string },
    immediate = false
  ) {
    if (!api.token || !profile.name.trim()) return;
    if (!confirmedProfile || confirmedProfile.id !== api.user?.id)
      confirmedProfile = api.user ? { ...api.user } : null;
    queuedProfile = {
      ...profile,
      name: profile.name.trim(),
      token: api.token,
      revision: ++profileRevision,
    };
    if (api.user)
      api.user = { ...api.user, ...profile, name: profile.name.trim() };
    renderToolbar();
    clearTimeout(profileSaveTimer);
    if (immediate) run(saveProfile);
    else profileSaveTimer = window.setTimeout(() => run(saveProfile), 500);
  }
  function googleSignIn() {
    const control = button(
      "Continue with Google",
      () => run(() => githubLogin("google")),
      "google-signin secondary"
    );
    control.prepend(googleLogo());
    return control;
  }
  let accessError = "";
  let google = false;
  let movingThread: string | null = null;
  let github = false,
    guests = !options.onboarding,
    guestResolve = true;
  let parkedDraft: { anchor: Anchor; text: string } | null = null;
  const recoveredDrafts: { anchor: Anchor; text: string }[] = [];
  let dialogKey: string | null = null;
  const cardPlacements = new Map<string, Placement>();
  const cardFollow = cardMotion(() => positionNotice());
  let draggedPin: { id: string; x: number; y: number } | null = null;
  let toolbarPlacement: Placement | undefined;
  const placementKey = `branch-comments:drawer:${options.project}:${options.repo}`;
  let savedToolbarPlacement: Placement | undefined;
  try {
    const stored = JSON.parse(localStorage.getItem(placementKey) ?? "null");
    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
      savedToolbarPlacement = {
        x: stored.x,
        y: stored.y,
        edgeX: ["left", "right"].includes(stored.edgeX)
          ? stored.edgeX
          : undefined,
        edgeY: ["top", "bottom"].includes(stored.edgeY)
          ? stored.edgeY
          : undefined,
      };
      toolbarPlacement = savedToolbarPlacement;
    }
  } catch {
    /* Storage may be unavailable on embedded previews. */
  }
  const exitingDialogs = new Map<HTMLElement, (() => void) | undefined>();
  let draftText = "",
    guestName = "",
    editing: string | null = null,
    editText = "";
  let closePicker: ((immediate?: boolean) => void) | undefined;
  let submitAfterIdentity: (() => Promise<void>) | null = null;
  let lastPage = page(),
    toastTimer = 0,
    listScrollTimer = 0,
    frame = 0,
    githubTimer = 0;
  const replies = new Map<string, string>();
  const host = el("div");
  host.dataset.branchComments = "";
  Object.assign(host.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "2147483647",
    isolation: "isolate",
  });
  const shadow = host.attachShadow({ mode: "open" });
  const style = el("style");
  style.textContent = styles;
  const catcher = el("div", "catch");
  catcher.hidden = true;
  const pins = el("div", "pins"),
    dialogs = el("div"),
    toolbar = el("div", "toolbar"),
    sidebar = el("div"),
    hints = el("div");
  Object.assign(pins.style, { position: "fixed", inset: "0" });
  const pinPreview = el("div", "pin-preview");
  pinPreview.hidden = true;
  let previewTimer = 0;
  let previewSuppressed = false;
  let previewClosing = false;
  let previewThread: string | null = null;
  let previewMotion: Animation | null = null;
  let openingPreview: DOMRect | null = null;
  const hidePreview = (immediate = false) => {
    window.clearTimeout(previewTimer);
    if (pinPreview.hidden || (previewClosing && !immediate)) return;
    previewClosing = true;
    previewMotion?.cancel();
    if (immediate || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      pinPreview.hidden = true;
      previewThread = null;
      return;
    }
    const motion = pinPreview.animate(
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "translateY(3px) scale(.99)" },
      ],
      { duration: 150, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" }
    );
    previewMotion = motion;
    void motion.finished
      .then(() => {
        if (previewMotion === motion) {
          pinPreview.hidden = true;
          previewThread = null;
        }
      })
      .catch(() => {});
  };
  pinPreview.addEventListener("pointerenter", () => {
    if (previewSuppressed || movingThread || draggedPin) return;
    previewClosing = false;
    window.clearTimeout(previewTimer);
    previewMotion?.cancel();
  });
  pinPreview.addEventListener("pointerleave", () => hidePreview());
  const hoverOutline = el("div", "component-hover");
  hoverOutline.setAttribute("aria-hidden", "true");
  let hoverTarget: Element | null = null;
  let hoverPoint: { x: number; y: number } | null = null;
  let hoverFrame = 0;
  const live = el("div", "sr-only");
  live.setAttribute("aria-live", "polite");
  const toolbarRoot = createToolbar(toolbar, (id) => {
    if (id === "account") {
      if (!api.user) return icon("person");
      const portrait = avatar(api.user);
      portrait.className = "review-avatar";
      return portrait;
    }
    return icon(
      id === "browse" ? "pointer" : id === "comment" ? "comment" : "expand"
    );
  });
  shadow.append(
    style,
    catcher,
    hoverOutline,
    pins,
    sidebar,
    dialogs,
    pinPreview,
    hints,
    toolbar,
    live
  );
  document.body.append(host);
  let pageRoot = options.pageRoot;
  let ownsWrapper = false;
  if (!pageRoot) {
    pageRoot = el("div");
    pageRoot.dataset.commentsPage = "";
    ownsWrapper = true;
    const children = [...document.body.childNodes].filter(
      (child) => child !== host
    );
    document.body.insertBefore(pageRoot, host);
    pageRoot.append(...children);
  }
  const surface = pageRoot;
  const draftScrollSpace = el("div");
  draftScrollSpace.setAttribute("aria-hidden", "true");
  draftScrollSpace.style.pointerEvents = "none";
  const pagePaddingBottom = getComputedStyle(surface).paddingBottom;
  const savedStyle = {
    width: surface.style.width,
    zoom: surface.style.zoom,
    transformOrigin: surface.style.transformOrigin,
    transform: surface.style.transform,
    position: surface.style.position,
    left: surface.style.left,
    top: surface.style.top,
    height: surface.style.height,
    paddingBottom: surface.style.paddingBottom,
    overflow: surface.style.overflow,
    borderRadius: surface.style.borderRadius,
    background: surface.style.background,
  };
  const savedBody = {
    overflow: document.body.style.overflow,
    background: document.body.style.background,
  };
  const savedHtmlOverflow = document.documentElement.style.overflow;
  const fixedHeaders = new Map<
    HTMLElement,
    { position: string; marginBottom: string }
  >();
  const savedHtmlBackground = document.documentElement.style.background;
  const bodyBackground = getComputedStyle(document.body).backgroundColor;
  const htmlBackground = getComputedStyle(
    document.documentElement
  ).backgroundColor;
  const pageBackground =
    [bodyBackground, htmlBackground].find(
      (color) => color !== "rgba(0, 0, 0, 0)"
    ) ?? "#fff";
  let framed = false;
  let nativeReviewScroll = false;
  let accountOpenTimer = 0;
  let framedAccount = false;
  let pageMotion: ReturnType<typeof animate> | undefined;
  let keyboardAction = false;
  let searchOpen = false;
  let dockMotion: ReturnType<typeof animate> | undefined;
  let dockCenter: number | undefined;
  let drawerContainerCenter: number | undefined;
  let pageTransitioning = false;

  function placeToolbar(p: Placement) {
    // React mounts the drawer after its host; retain the saved coordinates until it has a size.
    if (!toolbar.offsetWidth || !toolbar.offsetHeight) return;
    toolbarPlacement = constrain(
      p,
      toolbar.offsetWidth,
      toolbar.offsetHeight,
      document.documentElement.clientWidth,
      window.innerHeight
    );
    toolbar.style.left = `${toolbarPlacement.x + toolbar.offsetWidth / 2}px`;
    toolbar.style.top = `${toolbarPlacement.y}px`;
    toolbar.style.bottom = "auto";
  }
  const presence = drawerPresence(
    toolbar,
    () => expanded || mode || account || !!draft || !!selected,
    abort.signal,
    options.autoHideDrawer
  );
  floatingDrag(
    toolbar,
    toolbar,
    placeToolbar,
    abort.signal,
    () => {
      presence.show();
      dockMotion?.stop();
      toolbar.style.translate = "0px 0px";
    },
    () => {
      savedToolbarPlacement = toolbarPlacement;
      try {
        localStorage.setItem(
          placementKey,
          JSON.stringify(savedToolbarPlacement)
        );
      } catch {
        /* Keep the placement in memory when storage is blocked. */
      }
      renderToolbar();
      presence.update();
    },
    () => !expanded
  );

  const toolbarSize = new ResizeObserver(() => {
    if (toolbarPlacement) placeToolbar(toolbarPlacement);
    else if (options.drawerContainer) renderToolbar();
  });
  toolbarSize.observe(toolbar);
  if (options.drawerContainer) toolbarSize.observe(options.drawerContainer);

  const htmlZoom = () =>
    (document.documentElement as HTMLElement & { currentCSSZoom?: number })
      .currentCSSZoom ?? 1;
  function page() {
    return canonicalPage(options.page?.() ?? location.pathname);
  }
  type NoticePosition = {
    cardKey: string | null;
    left: number;
    top: number;
    anchor?: Anchor;
    offsetX: number;
    offsetY: number;
    scrollX: number;
    scrollY: number;
  };
  const noticePositions = new WeakMap<HTMLElement, NoticePosition>();
  let activeNotice: HTMLElement | null = null;
  let noticeFrame = 0;
  const noticeMoves = new WeakMap<
    HTMLElement,
    { animation: Animation; left: number; top: number }
  >();
  function followNotices() {
    cancelAnimationFrame(noticeFrame);
    if (destroyed || !shadow.querySelector(".floating-notice")) return;
    positionNotice();
    noticeFrame = requestAnimationFrame(followNotices);
  }
  function captureNoticePosition(
    anchor = draft ?? threads.find((t) => t.id === selected)?.anchor
  ): NoticePosition | undefined {
    const rect = dialogs.firstElementChild?.getBoundingClientRect();
    if (!rect || account) return;
    const target = anchor ? locateAnchor(anchor) : null;
    return {
      cardKey: dialogKey,
      left: rect.left,
      top: rect.top,
      anchor,
      offsetX: rect.left - (target?.x ?? 0),
      offsetY: rect.top - (target?.y ?? 0),
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
  }
  function dismissNotice(toast: HTMLElement) {
    if (toast.dataset.closing) return;
    toast.dataset.closing = "true";
    toast.inert = true;
    toast.setAttribute("aria-hidden", "true");
    if (activeNotice === toast) {
      activeNotice = null;
      clearTimeout(toastTimer);
    }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      toast.remove();
      return;
    }
    const exit = toast.animate(
      [
        {
          opacity: getComputedStyle(toast).opacity,
          translate: "0px 0px",
          scale: 1,
        },
        {
          opacity: 0,
          translate:
            toast.dataset.attached === "true"
              ? `0px ${(toast.dataset.placement === "above" ? 1 : -1) * (toast.offsetHeight / 2 + 10)}px`
              : "0px 3px",
          scale: toast.dataset.attached === "true" ? 0.94 : 0.99,
        },
      ],
      { duration: 150, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" }
    );
    void exit.finished.catch(() => {}).finally(() => toast.remove());
  }
  function notify(
    text: string,
    action?: { label: string; run: () => void },
    position = captureNoticePosition()
  ) {
    live.textContent = text;
    if (activeNotice) dismissNotice(activeNotice);
    const toast = el("div", "toast floating-notice");
    activeNotice = toast;
    if (position) noticePositions.set(toast, position);
    toast.setAttribute("role", action ? "alertdialog" : "status");
    toast.setAttribute("aria-label", text);
    toast.append(icon("info"), el("span", "", text));
    if (action)
      toast.append(
        button(
          action.label,
          () => {
            dismissNotice(toast);
            action.run();
          },
          "notice-action"
        )
      );
    toast.append(
      button("Dismiss notice", () => dismissNotice(toast), "icon", "close")
    );
    shadow.append(toast);
    positionNotice();
    followNotices();
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      toast.animate(
        [
          {
            opacity: 0,
            translate:
              toast.dataset.attached === "true"
                ? `0px ${(toast.dataset.placement === "above" ? 1 : -1) * (toast.offsetHeight / 2 + 10)}px`
                : "0px 6px",
            scale: toast.dataset.attached === "true" ? 0.94 : 0.97,
          },
          { opacity: 1, translate: "0px 0px", scale: 1 },
        ],
        { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" }
      );
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => dismissNotice(toast), 5000);
  }
  function positionNotice() {
    for (const toast of shadow.querySelectorAll<HTMLElement>(
      ".floating-notice"
    )) {
      const p = noticePositions.get(toast);
      if (!p) continue;
      const target = p.anchor ? locateAnchor(p.anchor) : null;
      const card =
        !account && dialogKey === p.cardKey ? dialogs.firstElementChild : null;
      const rect = card?.getBoundingClientRect();
      if (rect) {
        toast.style.maxWidth = `${Math.min(360, rect.width, innerWidth - 24)}px`;
        p.left = rect.left;
        p.top = rect.top;
        p.offsetX = rect.left - (target?.x ?? 0);
        p.offsetY = rect.top - (target?.y ?? 0);
        p.scrollX = window.scrollX;
        p.scrollY = window.scrollY;
      }
      const left = rect
        ? rect.left + (rect.width - toast.offsetWidth) / 2
        : target
          ? target.x + p.offsetX
          : p.left + p.scrollX - window.scrollX;
      const above =
        !!rect && rect.bottom + 10 + toast.offsetHeight > innerHeight - 12;
      toast.dataset.placement = above ? "above" : "below";
      const top = rect
        ? above
          ? rect.top - toast.offsetHeight - 10
          : rect.bottom + 10
        : target
          ? target.y + p.offsetY
          : p.top + p.scrollY - window.scrollY;
      const attached = String(!!rect);
      const changed =
        toast.dataset.attached !== undefined &&
        toast.dataset.attached !== attached;
      const previous = changed ? toast.getBoundingClientRect() : null;
      const move = noticeMoves.get(toast);
      if (
        move &&
        (changed ||
          Math.abs(move.left - left) > 0.5 ||
          Math.abs(move.top - top) > 0.5)
      ) {
        move.animation.cancel();
        noticeMoves.delete(toast);
      }
      toast.dataset.attached = attached;
      Object.assign(toast.style, {
        left: `${left}px`,
        top: `${top}px`,
        bottom: "auto",
        transform: "none",
        transformOrigin: rect ? (above ? "50% 100%" : "50% 0%") : "0% 0%",
      });
      if (
        previous &&
        !toast.dataset.closing &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        const animation = toast.animate(
          [
            { left: `${previous.left}px`, top: `${previous.top}px` },
            { left: `${left}px`, top: `${top}px` },
          ],
          { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" }
        );
        noticeMoves.set(toast, { animation, left, top });
      }
    }
  }
  function fail(reason: unknown) {
    error =
      reason instanceof Error
        ? reason.message
        : "Something went wrong. Try again.";
    notify(error);
  }
  function run(action: () => Promise<void>) {
    void action().catch(fail);
  }
  async function mutate(action: () => Promise<void>) {
    if (pending) return;
    pending = true;
    error = "";
    renderDialog();
    try {
      await action();
      while (refreshing && !destroyed)
        await new Promise((resolve) => setTimeout(resolve, 20));
      await refresh();
    } finally {
      pending = false;
      render();
    }
  }
  let lastRefresh: Thread[] | undefined;
  let lastRefreshRevision = -1;
  async function refresh() {
    if (destroyed || refreshing || optimistic.busy || options.onboarding)
      return;
    const revision = optimistic.revision;
    refreshing = true;
    try {
      const response = await api.list();
      if (destroyed || optimistic.busy || revision !== optimistic.revision)
        return;
      if (
        response === lastRefresh &&
        revision === lastRefreshRevision &&
        connection === "Live"
      )
        return;
      lastRefresh = response;
      lastRefreshRevision = revision;
      const next = response
        .map((thread) => ({
          ...thread,
          comments: thread.comments.filter(
            (comment) => comment.body !== "[Comment deleted]"
          ),
        }))
        .filter((thread) => thread.comments.length > 0);
      if (destroyed || optimistic.busy || revision !== optimistic.revision)
        return;
      const changed = JSON.stringify(next) !== JSON.stringify(threads);
      const recovered = connection !== "Live";
      accessError = "";
      connection = "Live";
      if (selected && !next.some((thread) => thread.id === selected))
        selected = null;
      if (changed) optimistic.replace(next, revision);
      else if (recovered) {
        renderList();
        renderToolbar();
      }
    } catch (reason) {
      if (
        reason instanceof ApiError &&
        (reason.status === 401 || reason.status === 403)
      ) {
        accessError = reason.message;
        selected = null;
        lastRefresh = undefined;
        optimistic.replace([], revision);
      }
      connection = "Offline";
      renderList();
      renderToolbar();
      throw reason;
    } finally {
      refreshing = false;
    }
  }
  function setMode(value: boolean) {
    if (options.onboarding) return;
    if (expanded) toggleExpanded(false);
    const restore = value ? (parkedDraft ?? recoveredDrafts.shift()) : null;
    if (restore) {
      draft = restore.anchor;
      draftText = restore.text;
      parkedDraft = null;
      selected = null;
      account = false;
      mode = false;
      render();
      dialogs.querySelector<HTMLTextAreaElement>("textarea")?.focus();
      return;
    }
    mode = value;
    hidden = false;
    account = false;
    if (value) {
      selected = null;
      draft = null;
    }
    render();
  }
  let appliedScale = 1;
  let appliedViewport = "";
  function scalePage() {
    const zoom = htmlZoom();
    const viewportHeight = isCompactReview(
      window.innerWidth,
      window.innerHeight
    )
      ? Math.min(
          window.innerHeight,
          window.visualViewport?.height ?? window.innerHeight
        )
      : window.innerHeight;
    const viewportKey = `${window.innerWidth}:${window.innerHeight}:${viewportHeight}:${zoom}:${expanded}:${account}:${window.visualViewport?.offsetTop ?? 0}`;
    if (appliedViewport === viewportKey) return;
    appliedViewport = viewportKey;
    const scroll =
      framed && !nativeReviewScroll
        ? surface.scrollTop
        : window.scrollY / (zoom * appliedScale);
    const wasFramed = framed;
    const accountChanged = framedAccount !== account;
    const before = framed
      ? pageFrameBounds()
      : { left: 0, top: 0, width: window.innerWidth };
    pageMotion?.stop();
    pageTransitioning = false;
    pins.style.opacity = "1";
    const layout = reviewLayout(
      window.innerWidth,
      viewportHeight,
      expanded,
      window.innerHeight,
      account
    );
    const useFrame = layout.framed;
    host.style.setProperty("--review-sheet-top", `${layout.sheetTop}px`);
    host.style.setProperty("--review-viewport-height", `${viewportHeight}px`);
    host.style.zoom = String(1 / zoom);
    host.style.width = `${window.innerWidth}px`;
    host.style.height = `${viewportHeight}px`;
    host.style.top = layout.mobile
      ? `${window.visualViewport?.offsetTop ?? 0}px`
      : "";
    host.classList.toggle("review-open", expanded);
    const useWindowScroll = useFrame && layout.mobile;
    if (useFrame) {
      appliedScale = layout.scale;
      const effective = appliedScale * zoom;
      Object.assign(surface.style, {
        position: useWindowScroll ? "relative" : "fixed",
        transform: "translate(0, 0)",
        transformOrigin: "top left",
        left: `${layout.left / effective}px`,
        top: `${layout.top / effective}px`,
        width: `${window.innerWidth / zoom}px`,
        height: useWindowScroll ? "auto" : `${layout.height / effective}px`,
        paddingBottom: useWindowScroll
          ? `calc(${pagePaddingBottom} + ${Math.max(0, viewportHeight - layout.height) / effective}px)`
          : savedStyle.paddingBottom,
        zoom: String(appliedScale),
        overflow: useWindowScroll ? "visible" : "hidden auto",
        borderRadius: `${12 / effective}px`,
        background: pageBackground,
      });
      for (const header of surface.querySelectorAll<HTMLElement>("header")) {
        if (
          !fixedHeaders.has(header) &&
          getComputedStyle(header).position === "fixed"
        ) {
          fixedHeaders.set(header, {
            position: header.style.position,
            marginBottom: header.style.marginBottom,
          });
          header.style.position = "sticky";
          header.style.marginBottom = `-${header.offsetHeight}px`;
        }
      }
      document.documentElement.style.overflow = useWindowScroll
        ? savedHtmlOverflow
        : "hidden";
      document.body.style.overflow = useWindowScroll
        ? savedBody.overflow
        : "hidden";
      document.body.style.background = "#080808";
      document.documentElement.style.background = "#080808";
      if (useWindowScroll) {
        if (!wasFramed || !nativeReviewScroll)
          window.scrollTo({ top: scroll * effective, behavior: "instant" });
      } else surface.scrollTop = scroll;
    } else {
      for (const [header, styles] of fixedHeaders)
        Object.assign(header.style, styles);
      fixedHeaders.clear();
      document.documentElement.style.overflow = savedHtmlOverflow;
      Object.assign(surface.style, savedStyle);
      Object.assign(document.body.style, savedBody);
      document.documentElement.style.background = savedHtmlBackground;
      if (framed) window.scrollTo({ top: scroll * zoom, behavior: "instant" });
      appliedScale = 1;
    }
    framed = useFrame;
    nativeReviewScroll = useWindowScroll;
    framedAccount = account;
    if (!useFrame && options.drawerContainer?.isConnected) {
      const rect = options.drawerContainer.getBoundingClientRect();
      drawerContainerCenter = rect.width
        ? rect.left + rect.width / 2
        : undefined;
    }
    if (
      (useFrame !== wasFramed || (layout.mobile && accountChanged)) &&
      !keyboardAction &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const after = useFrame
        ? pageFrameBounds()
        : { left: 0, top: 0, width: window.innerWidth };
      const effective = appliedScale * zoom;
      const start = `translate(${(before.left - after.left) / effective}px, ${(before.top - after.top) / effective}px) scale(${before.width / after.width})`;
      surface.style.transformOrigin = useFrame ? "top left" : `0 ${scroll}px`;
      if (!useFrame) {
        document.body.style.background = "#080808";
        document.documentElement.style.background = "#080808";
        surface.style.background = pageBackground;
      }
      pins.style.opacity = "0";
      pageTransitioning = true;
      pageMotion = animate(
        surface,
        {
          transform: [start, "translate(0px, 0px) scale(1)"],
        },
        { duration: 0.25, ease: [0.32, 0.72, 0, 1] }
      );
      const currentMotion = pageMotion;
      void currentMotion.finished.then(() => {
        if (destroyed || pageMotion !== currentMotion) return;
        pageTransitioning = false;
        if (!framed) {
          surface.style.transformOrigin = savedStyle.transformOrigin;
          surface.style.transform = savedStyle.transform;
          surface.style.background = savedStyle.background;
          document.body.style.background = savedBody.background;
          document.documentElement.style.background = savedHtmlBackground;
        }
        pins.style.opacity = "1";
        geometry();
      });
    }
    pins.style.clipPath = useFrame
      ? `inset(${layout.visibleTop}px ${layout.right}px ${layout.bottom}px ${layout.visibleLeft}px)`
      : "";
    Object.assign(
      catcher.style,
      useFrame
        ? {
            left: `${layout.visibleLeft}px`,
            top: `${layout.visibleTop}px`,
            width: `${layout.visibleWidth}px`,
            height: `${layout.visibleHeight}px`,
          }
        : { left: "", top: "", width: "", height: "" }
    );
  }
  function pageFrameBounds() {
    const rect = surface.getBoundingClientRect();
    return nativeReviewScroll
      ? { left: rect.left, top: rect.top + window.scrollY, width: rect.width }
      : rect;
  }
  function toggleExpanded(value: boolean) {
    expanded = value;
    if (value) mode = false;
    if (!value) {
      clearTimeout(accountOpenTimer);
      accountOpenTimer = 0;
      account = false;
    }
    const before = toolbar.getBoundingClientRect();
    toolbarPlacement = value ? undefined : savedToolbarPlacement;
    dockCenter = undefined;
    hidden = false;
    scalePage();
    render();
    dockMotion?.stop();
    toolbar.style.translate = "0px 0px";
    const after = toolbar.getBoundingClientRect();
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dockMotion = animate(
        toolbar,
        {
          translate: [
            `${before.left - after.left}px ${before.top - after.top}px`,
            "0px 0px",
          ],
        },
        { type: "spring", stiffness: 680, damping: 32, mass: 0.55 }
      );
    }
    presence.show();
    presence.update();
  }
  function dismiss() {
    clearTimeout(accountOpenTimer);
    accountOpenTimer = 0;
    if (account) {
      run(saveProfile);
      submitAfterIdentity = null;
      account = false;
      render();
      return;
    }
    selected = null;
    draft = null;
    account = false;
    editing = null;
    error = "";
    mode = false;
    render();
  }
  function selectThread(thread: Thread) {
    clearTimeout(accountOpenTimer);
    accountOpenTimer = 0;
    if (thread.page !== page()) {
      const url = new URL(thread.page, location.origin);
      url.searchParams.set("comment", thread.id);
      location.assign(url);
      return;
    }
    openingPreview =
      previewThread === thread.id && !pinPreview.hidden
        ? pinPreview.getBoundingClientRect()
        : null;
    if (openingPreview) hidePreview(true);
    selected = thread.id;
    draft = null;
    account = false;
    editing = null;
    error = "";
    mode = false;
    const rect = locateAnchor(thread.anchor);
    if (!openingPreview)
      (framed && !nativeReviewScroll ? surface : window).scrollBy({
        top:
          (rect.y - window.innerHeight * 0.35) /
          (framed && !nativeReviewScroll ? appliedScale * htmlZoom() : 1),
        behavior: "instant",
      });
    render();
  }
  function filtered() {
    return threads
      .filter(
        (t) =>
          (allPages || t.page === page()) &&
          (filter === "all" || t.resolved === (filter === "resolved")) &&
          (!search ||
            t.comments.some((c) =>
              `${c.body} ${c.author.name}`
                .toLowerCase()
                .includes(search.toLowerCase())
            ) ||
            t.page.toLowerCase().includes(search.toLowerCase()))
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
  function renderToolbar() {
    presence.update();
    const { dockCenter: viewportCenter } = reviewLayout(
      window.innerWidth,
      window.innerHeight,
      expanded
    );
    const container =
      !expanded && options.drawerContainer?.isConnected
        ? options.drawerContainer.getBoundingClientRect()
        : undefined;
    if (container?.width && !pageTransitioning)
      drawerContainerCenter = container.left + container.width / 2;
    const halfWidth = toolbar.offsetWidth / 2;
    const nextCenter =
      container?.width && drawerContainerCenter !== undefined
        ? Math.max(
            16 + halfWidth,
            Math.min(window.innerWidth - 16 - halfWidth, drawerContainerCenter)
          )
        : viewportCenter;
    if (toolbarPlacement) placeToolbar(toolbarPlacement);
    else if (nextCenter !== dockCenter) {
      const rect = toolbar.getBoundingClientRect();
      const previousCenter = rect.left + rect.width / 2;
      dockMotion?.stop();
      toolbar.style.top = "";
      toolbar.style.bottom = "";
      toolbar.style.left = `${nextCenter}px`;
      toolbar.style.translate = "0px 0px";
      if (
        dockCenter !== undefined &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        dockMotion = animate(
          toolbar,
          {
            translate: [
              `${previousCenter - nextCenter}px ${rect.top - toolbar.getBoundingClientRect().top}px`,
              "0px 0px",
            ],
          },
          { type: "spring", stiffness: 680, damping: 32, mass: 0.55 }
        );
      }
      dockCenter = nextCenter;
    }
    const glyph = (name: keyof typeof icons) =>
      createElement(icons[name], { "aria-hidden": true });
    const items: MenuItem[] = [
      {
        id: "browse",
        label: "Browse website · V",
        icon: glyph("pointer"),
        onSelect: () => setMode(false),
      },
      {
        id: "comment",
        label: "Add comment · C",
        icon: glyph("comment"),
        onSelect: () => setMode(!mode),
      },
      {
        id: "comments",
        label: options.onboarding
          ? expanded
            ? "Close project sidebar"
            : "Project settings"
          : expanded
            ? "Close comment sidebar"
            : `View all comments · ${threads.filter((t) => !t.resolved).length} open`,
        icon: glyph("expand"),
        onSelect: () => toggleExpanded(!expanded),
      },
      {
        id: "account",
        expandedOrder: -1,
        label: api.user ? `${api.user.name} · Account` : "Enter your name",
        icon: createElement(
          "span",
          { className: "review-avatar" },
          api.user?.avatarUrl
            ? createElement("img", {
                src: api.user.avatarUrl,
                alt: "",
                referrerPolicy: "no-referrer",
              })
            : api.user
              ? initials(api.user.name)
              : glyph("person")
        ),
        onSelect: () => {
          if (account || accountOpenTimer) {
            clearTimeout(accountOpenTimer);
            accountOpenTimer = 0;
            account = false;
            render();
          } else openAccount();
        },
      },
      {
        id: "copy-prompts",
        keepOpenOnSelect: true,
        label:
          copiedPrompt === "all"
            ? "Copied prompt"
            : "Copy all comments for agent",
        icon: glyph(copiedPrompt === "all" ? "check" : "copy"),
        showInBar: false,
        onSelect: () => run(() => copyPrompt("all")),
      },
      {
        id: "visibility",
        label: hidden ? "Show comment pins" : "Hide comment pins",
        icon: glyph("comment"),
        showInBar: false,
        onSelect: () => {
          hidden = !hidden;
          renderPins();
          renderToolbar();
        },
      },
    ];
    if (connection === "Offline")
      items.push({
        id: "retry",
        label: "Offline · Retry connection",
        icon: glyph("branch"),
        showInBar: false,
        onSelect: () => run(refresh),
      });
    toolbarRoot.render({
      items: options.onboarding
        ? items.filter(
            (item) => item.id === "account" || item.id === "comments"
          )
        : items,
      alignEnd:
        !!toolbarPlacement && toolbarPlacement.y > window.innerHeight / 2,
      edge:
        toolbarPlacement?.edgeX ??
        toolbarPlacement?.edgeY ??
        (toolbarPlacement && toolbarPlacement.y < window.innerHeight / 2
          ? "top"
          : "bottom"),
      activeId: account
        ? "account"
        : mode
          ? "comment"
          : expanded
            ? "comments"
            : "browse",
      label: "Website review",
      moreLabel: "More review tools",
    });
  }

  let pinSnapshot = "";
  let pinsScrolling = false;
  let pinScrollTimer = 0;
  const scrollSamples = new WeakMap<
    EventTarget,
    { x: number; y: number; time: number }
  >();
  function renderPins(force = false) {
    if (movingThread || (pinsScrolling && !force)) return;
    if (hidden) {
      pinSnapshot = "";
      hidePreview();
      pins.replaceChildren();
      return;
    }
    const currentPage = page();
    const visible = threads.filter(
      (t) => t.page === currentPage && !t.resolved
    );
    const stacks = pinStacks(visible, (thread) => anchorElement(thread.anchor));
    const positions = visible.map((thread) => {
      const rect = locateAnchor(thread.anchor);
      if (rect.y < -rect.height - 40 || rect.y > window.innerHeight + 40)
        return { thread, rect, blocked: false };
      const target = anchorElement(thread.anchor);
      const hit = siteElementAt(rect.x + 8, rect.y - 10);
      const blocked = !!(
        target &&
        hit &&
        !target.contains(hit) &&
        !hit.contains(target)
      );
      return { thread, rect, blocked };
    });
    const snapshot = JSON.stringify([
      selected,
      draft && locateAnchor(draft),
      positions.map(({ thread, rect, blocked }) => [
        thread.id,
        rect,
        blocked,
        pinDirection(rect, window.innerWidth),
      ]),
    ]);
    if (snapshot === pinSnapshot) return;
    pinSnapshot = snapshot;
    hidePreview();
    const scrollOffsets = new Map(
      Array.from(pins.querySelectorAll<HTMLElement>(".pin-stack"), (stack) => [
        stack.dataset.stack,
        stack.scrollLeft,
      ])
    );
    pins.replaceChildren();
    const stackElements = new Map<string, HTMLElement>();
    const measured = new Map(
      positions.map((position) => [position.thread.id, position])
    );
    for (const { thread, rect, blocked } of positions) {
      const group = rect.attached ? stacks.get(thread.id) : undefined;
      const leader = group && measured.get(group[0].id);
      const placement = leader?.rect.attached ? leader : { rect, blocked };
      if (
        placement.rect.y < -placement.rect.height - 40 ||
        placement.rect.y > window.innerHeight + 40
      )
        continue;
      if (placement.blocked) continue;
      const number = threads.indexOf(thread) + 1;
      if (rect.width && rect.height) {
        const area = el("div", "area");
        Object.assign(area.style, {
          left: `${rect.x}px`,
          top: `${rect.y}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          opacity: thread.id === selected ? "1" : ".45",
        });
        pins.append(area);
      }
      const pin = button(
        `Comment ${number}: ${thread.comments[0]?.body.slice(0, 100) ?? ""}`,
        () => selectThread(thread),
        `pin${thread.id === selected ? " active" : ""}${thread.resolved ? " resolved" : ""}${rect.attached ? "" : " detached"}`
      );
      pin.textContent = "";
      if (thread.comments[0]) {
        const author = thread.comments[0].author;
        applyAccent(pin, author.accentColor);
        pin.append(avatar(author));
        const photo = pin.querySelector("img");
        if (photo) photo.draggable = false;
      }
      enablePinDrag(pin, thread, rect);
      if (thread.resolved) {
        const resolved = el("span", "pin-check");
        resolved.append(icon("check"));
        pin.append(resolved);
      }
      const showPreview = () => {
        if (
          selected ||
          draft ||
          mode ||
          movingThread ||
          draggedPin ||
          previewSuppressed
        )
          return;
        previewClosing = false;
        window.clearTimeout(previewTimer);
        const wasHidden = pinPreview.hidden || previewThread !== thread.id;
        previewMotion?.cancel();
        previewThread = thread.id;
        pinPreview.replaceChildren();
        const message = thread.comments[0];
        if (!message) return;
        const open = button(
          "Open comment",
          () => selectThread(thread),
          "pin-preview-open"
        );
        open.textContent = "";
        open.append(authorRow(message), el("p", "hover-message", message.body));
        pinPreview.append(open);
        pinPreview.hidden = false;
        const point = indicatorPoint(pin, rect);
        const right =
          expanded && !isCompactReview(window.innerWidth, window.innerHeight)
            ? 396
            : 12;
        const left =
          point.x + 20 + 320 > window.innerWidth - right
            ? point.x - 340
            : point.x + 20;
        Object.assign(pinPreview.style, {
          left: `${Math.max(12, left)}px`,
          transformOrigin:
            point.x < Math.max(12, left) + 160 ? "top left" : "top right",
          top: `${Math.max(12, Math.min(point.y - 28, window.innerHeight - pinPreview.offsetHeight - 92))}px`,
        });
        if (
          wasHidden &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          previewMotion = pinPreview.animate(
            [
              { opacity: 0, transform: "translateY(6px) scale(.97)" },
              { opacity: 1, transform: "none" },
            ],
            { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" }
          );
      };
      pin.addEventListener("pointerenter", showPreview);
      pin.addEventListener("pointermove", (event) => {
        if (
          previewSuppressed &&
          !movingThread &&
          !draggedPin &&
          event.buttons === 0 &&
          (event.movementX || event.movementY)
        ) {
          previewSuppressed = false;
          showPreview();
        }
      });
      pin.addEventListener("focus", showPreview);
      pin.addEventListener("blur", () => hidePreview());
      pin.addEventListener("pointerleave", () => {
        previewTimer = window.setTimeout(hidePreview, 120);
      });
      pin.dataset.thread = thread.id;
      pin.dataset.pointer = pinDirection(placement.rect, window.innerWidth);
      Object.assign(pin.style, { left: `${rect.x}px`, top: `${rect.y}px` });
      if (group && leader?.rect.attached && !leader.blocked) {
        let stack = stackElements.get(group[0].id);
        if (!stack) {
          stack = el("div", "pin-stack");
          stack.dataset.stack = group[0].id;
          stack.setAttribute("role", "group");
          stack.setAttribute(
            "aria-label",
            `${group.length} comments on this component`
          );
          const width = Math.min(178, 40 + (group.length - 1) * 22);
          Object.assign(stack.style, {
            left: `${Math.max(4, Math.min(leader.rect.x - 25, window.innerWidth - width - 8))}px`,
            top: `${leader.rect.y - 34}px`,
            maxWidth: `${width}px`,
          });
          stack.addEventListener("scroll", () => {
            hidePreview();
            positionDialog();
          });
          stackElements.set(group[0].id, stack);
          pins.append(stack);
        }
        pin.style.left = "";
        pin.style.top = "";
        pin.style.order = String(group.indexOf(thread));
        pin.style.marginLeft = group[0].id === thread.id ? "0" : "-12px";
        stack.append(pin);
      } else pins.append(pin);
    }
    for (const [id, stack] of stackElements)
      stack.scrollLeft = scrollOffsets.get(id) ?? 0;
    if (draft && draft.width > 0 && draft.height > 0) {
      const rect = locateAnchor(draft);
      const area = el("div", "area");
      Object.assign(area.style, {
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${Math.max(8, rect.width)}px`,
        height: `${Math.max(8, rect.height)}px`,
      });
      pins.append(area);
    }
  }
  let copiedPrompt: "all" | "page" | null = null;
  let copiedPromptTimer = 0;
  async function copyPrompt(scope: "all" | "page") {
    const prompt = agentPrompt(threads, {
      ...options,
      origin: location.origin,
      page: scope === "page" ? page() : undefined,
    });
    if (!prompt) {
      notify(
        scope === "page"
          ? "No open comments on this page"
          : "No open comments to copy"
      );
      return;
    }
    await navigator.clipboard.writeText(prompt);
    if (destroyed) return;
    copiedPrompt = scope;
    live.textContent = "Agent prompt copied";
    clearTimeout(copiedPromptTimer);
    renderToolbar();
    renderList();
    copiedPromptTimer = window.setTimeout(() => {
      copiedPrompt = null;
      renderToolbar();
      renderList();
    }, 2000);
  }
  function renderList() {
    if (options.onboarding) {
      sidebar.replaceChildren();
      if (expanded) {
        const panel = el("aside", "panel");
        panel.setAttribute("aria-label", "Project settings");
        const head = el("div", "panel-head", "Project settings");
        const content = el("div", "empty");
        content.append(
          el("p", "", "Leave comments on your connected website."),
          button(
            "Manage project",
            () => {
              openAccount();
            },
            "secondary"
          )
        );
        panel.append(head, content);
        sidebar.append(panel);
      }
      return;
    }
    const existingList = sidebar.querySelector(".list");
    const scroll = existingList?.scrollTop ?? 0;
    const focusedSearch =
      shadow.activeElement?.getAttribute("aria-label") === "Search comments";
    const searchCaret = focusedSearch
      ? (shadow.activeElement as HTMLInputElement).selectionStart
      : null;
    if (!expanded) {
      sidebar.replaceChildren();
      return;
    }
    let panel = sidebar.querySelector<HTMLElement>(".panel");
    if (!panel) {
      panel = el("aside", "panel");
      panel.setAttribute("aria-label", "All comments");
      const head = el("div", "panel-head");
      const title = el("div", "row between sidebar-title");
      const filterSlot = el("div", "filter-slot");
      const tools = el("div", "row");
      const setSearch = (open: boolean) => {
        const field = panel!.querySelector<HTMLElement>(
          ".sidebar-search-field"
        )!;
        const trigger = tools.querySelector<HTMLButtonElement>(
          '[aria-label="Search comments"]'
        )!;
        const origin = (open ? trigger : field).getBoundingClientRect();
        searchOpen = open;
        if (!open) {
          search = "";
          field.querySelector("input")!.value = "";
        }
        renderList();
        const destination = (open ? field : trigger).getBoundingClientRect();
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
          field.animate(
            open
              ? [
                  {
                    transform: `translate(${origin.left - destination.left}px, ${origin.top - destination.top}px)`,
                    width: `${origin.width}px`,
                    height: `${origin.height}px`,
                    borderRadius: "50%",
                    opacity: 0.4,
                  },
                  {
                    transform: "none",
                    width: `${destination.width}px`,
                    height: `${destination.height}px`,
                    borderRadius: "10px",
                    opacity: 1,
                  },
                ]
              : [
                  { transform: "none", opacity: 1 },
                  {
                    transform: `translate(${destination.left - origin.left}px, ${destination.top - origin.top}px) scale(.2)`,
                    opacity: 0,
                  },
                ],
            { duration: 280, easing: "cubic-bezier(.22,1,.36,1)" }
          );
        }
        if (open) field.querySelector("input")?.focus();
        else trigger.focus();
      };
      tools.append(
        button(
          "Copy this page’s comments for agent",
          () => run(() => copyPrompt("page")),
          "icon copy-page-prompt",
          "copy"
        ),
        button(
          "Search comments",
          () => setSearch(true),
          "icon sidebar-search-trigger",
          "search"
        ),
        button("Close sidebar", () => toggleExpanded(false), "icon", "expand")
      );
      const selector = el("div", "sidebar-selector");
      selector.append(filterSlot, el("div", "scope-slot"));
      title.append(selector, tools);
      const searchPanel = el("div", "sidebar-search");
      const searchInner = el("div", "sidebar-search-inner");
      const searchRow = el("div", "sidebar-search-row");
      const field = el("div", "sidebar-search-field");
      const input = el("input");
      input.type = "search";
      input.placeholder = "Search";
      input.setAttribute("aria-label", "Search comments");
      input.addEventListener("input", () => {
        search = input.value;
        renderList();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          closeSearch();
        }
      });
      field.append(icon("search"), input);
      const closeSearch = () => setSearch(false);
      field.append(
        button("Close search", closeSearch, "icon search-cancel", "close")
      );
      searchRow.append(field);
      searchInner.append(searchRow);
      searchPanel.append(searchInner);
      head.append(title, searchPanel);
      panel.append(head);
      sidebar.append(panel);
    }
    const copyPage =
      panel.querySelector<HTMLButtonElement>(".copy-page-prompt")!;
    const copyGlyph = copiedPrompt === "page" ? "check" : "copy";
    if (copyPage.dataset.glyph !== copyGlyph) {
      const previous = copyPage.querySelector("svg:not([data-leaving])");
      const next = icon(copyGlyph);
      const shouldAnimate =
        copyPage.dataset.glyph !== undefined &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches;
      copyPage.dataset.glyph = copyGlyph;
      if (shouldAnimate && previous) {
        previous.setAttribute("data-leaving", "true");
        copyPage.append(next);
        const timing = { duration: 200, easing: "cubic-bezier(.22,1,.36,1)" };
        const hidden = {
          opacity: 0,
          transform: "scale(.7)",
          filter: "blur(2px)",
        };
        const visible = {
          opacity: 1,
          transform: "scale(1)",
          filter: "blur(0px)",
        };
        previous
          .animate([visible, hidden], { ...timing, fill: "forwards" })
          .finished.then(() => previous.remove())
          .catch(() => previous.remove());
        next.animate([hidden, visible], timing);
      } else copyPage.replaceChildren(next);
    }
    copyPage.title =
      copiedPrompt === "page"
        ? "Copied prompt"
        : "Copy this page’s comments for agent";
    copyPage.setAttribute("aria-label", copyPage.title);
    panel.dataset.search = String(searchOpen);
    panel.querySelector<HTMLElement>(".filter-slot")!.inert = searchOpen;
    panel.querySelector<HTMLElement>(".scope-slot")!.inert = !searchOpen;
    panel.querySelector<HTMLElement>(".sidebar-search-trigger")!.inert =
      searchOpen;
    const searchPanel = panel.querySelector<HTMLElement>(".sidebar-search")!;
    searchPanel.inert = !searchOpen;
    const filterSlot = panel.querySelector<HTMLElement>(".filter-slot")!;
    if (filterSlot.dataset.value !== filter) {
      filterSlot.dataset.value = filter;
      filterSlot.replaceChildren(
        selectionMenu(
          "Filter comments",
          [
            ["open", "Comments"],
            ["all", "All comments"],
            ["resolved", "Resolved"],
          ],
          filter,
          (value) => {
            filter = value as typeof filter;
            renderList();
            renderPins();
          }
        )
      );
    }
    const scopeSlot = panel.querySelector<HTMLElement>(".scope-slot")!;
    if (scopeSlot.dataset.value !== String(allPages)) {
      scopeSlot.dataset.value = String(allPages);
      scopeSlot.replaceChildren(
        selectionMenu(
          "Comment pages",
          [
            ["page", "This page"],
            ["all", "All pages"],
          ],
          allPages ? "all" : "page",
          (value) => {
            allPages = value === "all";
            renderList();
          }
        )
      );
    }
    const previous = new Map(
      [...panel.querySelectorAll<HTMLElement>(".list > [data-thread]")].map(
        (card) => [card.dataset.thread, card.getBoundingClientRect().top]
      )
    );
    const list = el("div", "list");
    clearTimeout(listScrollTimer);
    list.addEventListener(
      "scroll",
      () => {
        list.dataset.scrolling = "true";
        clearTimeout(listScrollTimer);
        listScrollTimer = window.setTimeout(() => {
          delete list.dataset.scrolling;
        }, 800);
      },
      { passive: true }
    );
    for (const thread of filtered()) {
      const first = thread.comments[0];
      if (!first) continue;
      const card = button(
        `Open comment by ${first.author.name}`,
        () => selectThread(thread),
        `thread-card${selected === thread.id ? " active" : ""}`
      );
      card.replaceChildren();
      const header = el("div", "row");
      header.append(
        avatar(first.author),
        el("span", "author", first.author.name),
        el("small", "", age(first.createdAt))
      );
      const meta = el("div", "meta");
      meta.append(
        el("span", "page", thread.page === page() ? "" : thread.page),
        el(
          "span",
          "",
          thread.resolved
            ? "Resolved"
            : thread.comments.length > 1
              ? `${thread.comments.length - 1} ${thread.comments.length === 2 ? "reply" : "replies"}`
              : ""
        )
      );
      card.dataset.thread = thread.id;
      card.append(el("p", "preview", first.body), header, meta);
      if (thread.comments.length > 1) {
        const replies = el("div", "sidebar-replies");
        for (const reply of thread.comments.slice(1)) {
          const row = el("div", "sidebar-reply");
          row.append(avatar(reply.author));
          const content = el("div");
          content.append(
            el(
              "div",
              "reply-meta",
              `${reply.author.name} · ${age(reply.createdAt)}`
            ),
            el("p", "", reply.body)
          );
          row.append(content);
          replies.append(row);
        }
        card.append(replies);
      }
      list.append(card);
    }
    if (!list.childElementCount) {
      const empty = el("div", "empty");
      empty.append(
        icon("comment"),
        el(
          "strong",
          "",
          accessError
            ? "Private project"
            : connection === "Offline"
              ? "Connection interrupted"
              : search
                ? "No matching comments"
                : filter === "resolved"
                  ? "Nothing resolved yet"
                  : "No comments yet"
        )
      );
      if (accessError) {
        empty.append(el("p", "", accessError));
        if (!api.user?.verified)
          empty.append(button("Sign in", openAccount, "secondary"));
      } else if (connection === "Offline")
        empty.append(button("Retry", () => run(refresh), "secondary"));
      else if (!search && filter !== "resolved")
        empty.append(
          button(
            "Add a comment",
            () => {
              if (isCompactReview(window.innerWidth, window.innerHeight))
                toggleExpanded(false);
              setMode(true);
            },
            "secondary"
          )
        );
      list.append(empty);
    }
    if (existingList) existingList.replaceWith(list);
    else panel.append(list);
    list.scrollTop = scroll;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      let entered = 0;
      for (const card of list.querySelectorAll<HTMLElement>("[data-thread]")) {
        const oldTop = previous.get(card.dataset.thread);
        const delta =
          oldTop === undefined ? 8 : oldTop - card.getBoundingClientRect().top;
        if (Math.abs(delta) > 0.5)
          card.animate(
            [
              {
                opacity: oldTop === undefined ? 0 : 1,
                transform: `translateY(${Math.max(-40, Math.min(40, delta))}px)`,
              },
              { opacity: 1, transform: "translateY(0)" },
            ],
            {
              duration: 250,
              delay: oldTop === undefined ? Math.min(entered++, 5) * 40 : 0,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              fill: "backwards",
            }
          );
      }
      if (!list.querySelector("[data-thread]"))
        list.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
    }
    if (focusedSearch) {
      const input = panel.querySelector<HTMLInputElement>(
        'input[type="search"]'
      )!;
      input.focus();
      if (searchCaret !== null)
        input.setSelectionRange(searchCaret, searchCaret);
    }
  }

  function authorRow(comment: Comment) {
    const row = el("div", "row");
    row.append(
      avatar(comment.author),
      el("span", "author", comment.author.name),
      el("small", "", age(comment.createdAt))
    );
    row.title = comment.author.verified ? "Verified" : "Guest";
    return row;
  }
  function messageActions(
    comment: Comment,
    thread: Thread
  ): Parameters<typeof actionMenu>[1] {
    if (
      api.user?.id !== comment.author.id ||
      comment.body === "[Comment deleted]"
    )
      return [];
    return [
      {
        label: "Edit",
        icon: "edit",
        onSelect: () => {
          editing = comment.id;
          editText = comment.body;
          renderDialog();
        },
      },
      {
        label: "Delete",
        icon: "trash",
        destructive: true,
        onSelect: () => {
          const noticeAnchor = captureNoticePosition(thread.anchor);
          notify("Delete this comment?", {
            label: "Delete",
            run: () => {
              const wasSelected = selected;
              if (thread.comments.length === 1) selected = null;
              run(() =>
                saveOptimistic(
                  changeThread(thread.id, (current) => {
                    const comments = current.comments.filter(
                      (item) => item.id !== optimistic.id(comment.id)
                    );
                    return comments.length ? { ...current, comments } : null;
                  }),
                  async (id) => {
                    await api.request(
                      `threads/${id(thread.id)}/comments/${id(comment.id)}`,
                      "DELETE"
                    );
                  },
                  () => {
                    if (!selected) selected = wasSelected;
                  }
                )
              );
              notify("Comment deleted", undefined, noticeAnchor);
            },
          });
        },
      },
    ];
  }
  function renderMessage(comment: Comment, thread: Thread) {
    const item = el("article", "message");
    item.dataset.comment = comment.id;
    item.append(authorRow(comment));
    if (editing === comment.id) {
      const input = el("textarea");
      input.value = editText;
      input.maxLength = 4000;
      input.setAttribute("aria-label", "Edit comment");
      input.dataset.focusKey = "edit";
      input.addEventListener("input", () => (editText = input.value));
      const save = button(
        "Save changes",
        () => {
          const body = editText;
          editing = null;
          run(() =>
            saveOptimistic(
              changeThread(thread.id, (current) => ({
                ...current,
                comments: current.comments.map((item) =>
                  item.id === optimistic.id(comment.id)
                    ? { ...item, body, editedAt: Date.now() }
                    : item
                ),
              })),
              async (id) => {
                await api.request(
                  `threads/${id(thread.id)}/comments/${id(comment.id)}`,
                  "PATCH",
                  { body }
                );
              },
              () => {
                if (!editing) {
                  editing = optimistic.id(comment.id);
                  editText = body;
                }
              }
            )
          );
        },
        "primary"
      );
      save.disabled = pending;
      item.append(
        input,
        save,
        button(
          "Cancel",
          () => {
            editing = null;
            renderDialog();
          },
          "secondary"
        )
      );
      return item;
    }
    const content = el("div", "message-content");
    content.append(el("p", "message-text", comment.body));
    if (comment.body !== "[Comment deleted]") {
      const reaction = button(
        "Add reaction",
        () => {
          closePicker?.(true);
          closePicker = reactionPicker(
            shadow,
            reaction,
            (emoji) =>
              reactTo(
                comment,
                thread,
                emoji,
                !(api.user && comment.reactions[emoji]?.includes(api.user.id))
              ),
            Object.entries(comment.reactions).find(
              ([, users]) => api.user && users.includes(api.user.id)
            )?.[0],
            `branch-comments:emoji:${options.project}:${api.user?.id ?? "guest"}`
          );
        },
        "icon message-reaction",
        "smile"
      );
      const entries = Object.entries(comment.reactions).filter(
        ([, users]) => users.length > 0
      );
      reaction.dataset.reactions = JSON.stringify(entries);
      if (entries.length) {
        reaction.replaceChildren();
        reaction.classList.add("has-reactions");
        for (const [emoji, users] of entries)
          reaction.append(
            el(
              "span",
              "reaction-value",
              `${emoji}${users.length > 1 ? ` ${users.length}` : ""}`
            )
          );
        reaction.setAttribute("aria-label", "Change reactions");
      }
      reaction.setAttribute("aria-haspopup", "menu");
      reaction.setAttribute("aria-expanded", "false");
      content.append(reaction);
    }
    item.append(content);
    const actions = el("div", "actions");
    if (
      api.user?.id === comment.author.id &&
      comment.body !== "[Comment deleted]"
    ) {
      const menu = actionMenu(
        "Message actions",
        messageActions(comment, thread)
      );
      if (thread.comments[0]?.id !== comment.id)
        item.firstElementChild?.append(menu);
    }
    if (comment.editedAt) actions.append(el("small", "", "Edited"));
    if (actions.childElementCount) item.append(actions);
    return item;
  }
  function reactTo(
    comment: Comment,
    thread: Thread,
    emoji: string,
    active: boolean
  ) {
    if (!api.user && (!guests || !guestName.trim())) {
      openAccount();
      return;
    }
    run(async () => {
      if (!api.user) await api.guest(guestName);
      const user = api.user!;
      await saveOptimistic(
        changeThread(thread.id, (current) => ({
          ...current,
          comments: current.comments.map((item) => {
            if (item.id !== optimistic.id(comment.id)) return item;
            const reactions = Object.fromEntries(
              Object.entries(item.reactions).map(([key, users]) => [
                key,
                users.filter((id) => id !== user.id),
              ])
            );
            if (active)
              reactions[emoji] = [...(reactions[emoji] ?? []), user.id];
            return { ...item, reactions };
          }),
        })),
        async (id) => {
          await api.request(
            `threads/${id(thread.id)}/comments/${id(comment.id)}/reactions`,
            "POST",
            { emoji, active }
          );
        }
      );
      if (active)
        recordEmoji(
          `branch-comments:emoji:${options.project}:${user.id}`,
          emoji
        );
    });
  }

  async function githubLogin(provider: "github" | "google" = "github") {
    const popup = window.open(
      "about:blank",
      "branch-comments-signin",
      "popup,width=600,height=720"
    );
    if (!popup) throw new Error("Allow popups to sign in.");
    try {
      const start = await api.request<{ url: string }>(
        `auth/${provider}/start`,
        "POST",
        {}
      );
      const listen = (event: MessageEvent) => {
        if (
          event.origin !== endpoint.origin ||
          event.source !== popup ||
          event.data?.type !== "branch-comments:auth"
        )
          return;
        const { token, user } = event.data;
        if (
          typeof token !== "string" ||
          !user?.id ||
          !user?.name ||
          user.verified !== true
        )
          return;
        api.save({ token, user });
        profileDraft = null;
        window.removeEventListener("message", listen);
        clearTimeout(githubTimer);
        popup.close();
        account = !!options.onboarding;
        render();
        if (options.onboarding) return;
        if (submitAfterIdentity) run(resumeSubmission);
        else notify(`Signed in as ${user.name}`);
      };
      window.addEventListener("message", listen, { signal: abort.signal });
      githubTimer = window.setTimeout(() => {
        window.removeEventListener("message", listen);
      }, 600000);
      popup.location.href = start.url;
    } catch (reason) {
      popup.close();
      throw reason;
    }
  }
  function composer(thread: Thread | null) {
    const form = el(
      "form",
      `composer ${thread ? "reply-composer" : "new-comment-composer"}`
    );
    const input = el("textarea");
    input.placeholder = thread ? "Reply…" : "Add a comment…";
    input.rows = 1;
    input.maxLength = 4000;
    input.required = true;
    input.value = thread ? (replies.get(thread.id) ?? "") : draftText;
    input.setAttribute("aria-label", thread ? "Reply" : "Comment");
    input.dataset.focusKey = "body";
    const resizeInput = () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(128, Math.max(thread ? 34 : 28, input.scrollHeight))}px`;
      input.style.overflowY = input.scrollHeight > 128 ? "auto" : "hidden";
      positionDialog();
    };
    input.addEventListener("input", resizeInput);
    input.addEventListener("input", () => {
      if (thread) replies.set(thread.id, input.value);
      else draftText = input.value;
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    const send = button(
      thread ? "Send reply" : "Post comment",
      () => {},
      "send",
      "arrow"
    );
    send.type = "submit";
    send.disabled = pending;

    if (thread) form.append(input, send);
    else {
      const body = el("div", "draft-body");
      if (api.user) body.append(avatar(api.user));
      body.append(input, send);
      form.append(body);
    }
    input.addEventListener("input", () => {
      send.disabled = pending || !input.value.trim();
    });
    send.disabled ||= !input.value.trim();
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!input.value.trim() || pending) return;
      if (!api.user) {
        submitAfterIdentity = () => postMessage(thread);
        openAccount();
        return;
      }
      run(() => postMessage(thread));
    });
    requestAnimationFrame(() => {
      if (input.isConnected) resizeInput();
    });
    return form;
  }
  async function postMessage(thread: Thread | null) {
    if (options.onboarding)
      throw new Error("Open your connected website to leave a comment.");
    if (!api.user) throw new Error("Enter your name to leave a comment.");
    const now = Date.now();
    const comment: Comment = {
      id: `pending-${crypto.randomUUID()}`,
      body: thread ? (replies.get(thread.id) ?? "") : draftText,
      author: { ...api.user },
      createdAt: now,
      editedAt: null,
      reactions: {},
    };
    if (!comment.body.trim()) return;
    if (thread) {
      replies.delete(thread.id);
      await saveOptimistic(
        changeThread(thread.id, (current) => ({
          ...current,
          updatedAt: now,
          comments: [...current.comments, comment],
        })),
        async (id) => {
          const result = await api.request<{ id: string }>(
            `threads/${id(thread.id)}/comments`,
            "POST",
            { body: comment.body }
          );
          const saved =
            result.id ??
            (await api.list())
              .find((item) => item.id === id(thread.id))
              ?.comments.filter(
                (item) =>
                  item.author.id === comment.author.id &&
                  item.body === comment.body
              )
              .at(-1)?.id;
          return saved ? { [comment.id]: saved } : {};
        },
        () => {
          const id = optimistic.id(thread.id);
          if (threads.some((item) => item.id === id))
            replies.set(
              id,
              [comment.body, replies.get(id)].filter(Boolean).join("\n")
            );
          else if (draft === thread.anchor)
            draftText = [draftText, comment.body].filter(Boolean).join("\n");
          else
            recoveredDrafts.push({ anchor: thread.anchor, text: comment.body });
        }
      );
    } else if (draft) {
      const anchor = draft;
      const item: Thread = {
        id: `pending-${crypto.randomUUID()}`,
        page: page(),
        anchor,
        resolved: false,
        resolvedBy: null,
        createdAt: now,
        updatedAt: now,
        comments: [comment],
      };
      selected = item.id;
      draft = null;
      draftText = "";
      await saveOptimistic(
        (items) => [...items, item],
        async () => {
          const result = await api.request<{ id: string; commentId?: string }>(
            "threads",
            "POST",
            { page: item.page, anchor, body: comment.body }
          );
          // The initial message ID is returned so queued edits target the persisted comment.
          const saved =
            result.commentId ??
            (await api.list()).find((item) => item.id === result.id)
              ?.comments[0]?.id;
          return {
            [item.id]: result.id,
            ...(saved ? { [comment.id]: saved } : {}),
          };
        },
        () => {
          if (!draft) {
            selected = null;
            draft = anchor;
            draftText = comment.body;
          } else recoveredDrafts.push({ anchor, text: comment.body });
        }
      );
    }
  }

  async function resumeSubmission() {
    const submit = submitAfterIdentity;
    submitAfterIdentity = null;
    if (submit) await submit();
  }
  const reactionSwaps = new Map<
    string | undefined,
    { from: HTMLElement; to: string | undefined; started: number }
  >();
  function renderDialog() {
    let disposePreviousAccentPicker = disposeAccentPicker;
    disposeAccentPicker = undefined;
    closePicker?.(true);
    closePicker = undefined;
    const active = shadow.activeElement as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    const focusKey = active?.dataset.focusKey;
    const caret = focusKey ? active?.selectionStart : null;
    const scroll = dialogs.querySelector(".messages")?.scrollTop ?? 0;
    const nextKey = account ? "account" : draft ? "draft" : selected;
    const previousDialog = dialogs.firstElementChild as HTMLElement | null;
    const changing = dialogKey !== nextKey;
    const previousRect = previousDialog?.getBoundingClientRect();
    const previousReactions = new Map(
      [
        ...(previousDialog?.querySelectorAll<HTMLElement>("[data-comment]") ??
          []),
      ].map((item) => [
        item.dataset.comment,
        item.querySelector<HTMLElement>(".message-reaction"),
      ])
    );
    if (
      previousDialog &&
      changing &&
      dialogKey === "account" &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const leaving = el("div", "account-layer");
      leaving.inert = true;
      leaving.setAttribute("aria-hidden", "true");
      leaving.append(previousDialog);
      shadow.append(leaving);
      exitingDialogs.set(leaving, disposePreviousAccentPicker);
      disposePreviousAccentPicker = undefined;
      const exit = leaving.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 150,
        fill: "forwards",
      });
      previousDialog.animate(
        [{ transform: "none" }, { transform: "translateY(4px) scale(.99)" }],
        { duration: 150, fill: "forwards" }
      );
      void exit.finished
        .catch(() => {})
        .finally(() => {
          leaving.remove();
          exitingDialogs.get(leaving)?.();
          exitingDialogs.delete(leaving);
        });
    }
    if (
      previousDialog &&
      changing &&
      dialogKey !== "account" &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const current = getComputedStyle(previousDialog);
      const from = { opacity: current.opacity, transform: current.transform };
      previousDialog.getAnimations().forEach((animation) => animation.cancel());
      previousDialog.inert = true;
      previousDialog.setAttribute("aria-hidden", "true");
      previousDialog.style.pointerEvents = "none";
      shadow.append(previousDialog);
      exitingDialogs.set(previousDialog, undefined);
      const exit = previousDialog.animate(
        [from, { opacity: 0, transform: "translateY(4px) scale(.99)" }],
        {
          duration: 150,
          easing: "cubic-bezier(.22,1,.36,1)",
          fill: "forwards",
        }
      );
      void exit.finished
        .catch(() => {})
        .finally(() => {
          previousDialog.remove();
          exitingDialogs.delete(previousDialog);
        });
    }
    disposePreviousAccentPicker?.();
    dialogs.replaceChildren();
    dialogKey = nextKey;
    dialogs.classList.toggle("account-layer", account);
    if (!draft && !selected && !account) {
      positionNotice();
      return;
    }
    dialogs.classList.toggle("account-layer", account);
    const dialog = el("section", account ? "dialog account-dialog" : "dialog");
    if (account) dialog.setAttribute("aria-modal", "false");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute(
      "aria-label",
      account ? "Reviewer account" : draft ? "New comment" : "Comment thread"
    );
    const head = el("div", "dialog-head row between");

    const controls = el("div", "row");
    const thread = threads.find((t) => t.id === selected) ?? null;
    if (thread && !account) {
      const copy = (label: string, value: () => string) => ({
        label,
        icon: (label === "Copy link"
          ? "link"
          : label === "Copy selector"
            ? "code"
            : "comment") as keyof typeof icons,
        onSelect: () =>
          run(async () => {
            await navigator.clipboard.writeText(value());
            notify("Copied");
          }),
      });
      const source = thread.anchor.source;
      const sourceHref = source
        ? (options.sourceUrl?.(source, options.branch) ??
          `https://github.com/${options.repo}/blob/${encodeURIComponent(options.branch)}/${source.split("/").map(encodeURIComponent).join("/")}`)
        : "";
      const more = actionMenu("Comment actions", [
        ...messageActions(thread.comments[0], thread),
        ...(sourceHref && /^(https?:|vscode:|cursor:)/.test(sourceHref)
          ? [
              {
                label: "Open source",
                icon: "code" as const,
                onSelect: () =>
                  window.open(sourceHref, "_blank", "noopener,noreferrer"),
              },
            ]
          : []),
        copy("Copy link", () => {
          const url = new URL(thread.page, location.origin);
          url.searchParams.set("comment", thread.id);
          return url.href;
        }),
        copy("Copy feedback", () =>
          [
            `Repository: ${options.repo}`,
            `Branch: ${options.branch}`,
            `Page: ${new URL(thread.page, location.origin).href}`,
            `Target: ${thread.anchor.selector || "Page position"}`,
            ...(thread.anchor.source
              ? [`Source: ${thread.anchor.source}`]
              : []),
            ...(thread.anchor.text
              ? [`Element text: ${thread.anchor.text}`]
              : []),
            "",
            ...thread.comments.map(
              (comment) => `${comment.author.name}: ${comment.body}`
            ),
          ].join("\n")
        ),
        copy("Copy selector", () => thread.anchor.selector),
      ]);
      controls.append(more);
      const resolve = button(
        thread.resolved ? "Reopen comment" : "Resolve comment",
        () => {
          if (!api.user && (!guests || !guestName.trim())) {
            openAccount();
            return;
          }
          const noticeAnchor = captureNoticePosition(thread.anchor);
          const updateResolved = (resolved: boolean) => {
            const previous = selected;
            selected = resolved ? null : thread.id;
            return saveOptimistic(
              changeThread(thread.id, (current) => ({
                ...current,
                resolved,
                resolvedBy: resolved ? api.user : null,
              })),
              async (id) => {
                if (!api.user) await api.guest(guestName);
                await api.request(`threads/${id(thread.id)}`, "PATCH", {
                  resolved,
                });
              },
              () => {
                if (!selected) selected = previous;
              }
            );
          };
          run(() => updateResolved(!thread.resolved));
          notify(
            thread.resolved ? "Comment reopened" : "Comment resolved",
            {
              label: "Undo",
              run: () => run(() => updateResolved(thread.resolved)),
            },
            noticeAnchor
          );
        },
        "icon",
        "check"
      );
      resolve.disabled = pending || (!guestResolve && !api.user?.verified);
      controls.append(resolve);
    }
    controls.append(
      button(
        account ? "Close account" : "Close comment",
        dismiss,
        "icon",
        "close"
      )
    );
    head.append(controls);
    if (thread || account) dialog.append(head);
    else
      dialog.append(
        button("Close comment", dismiss, "draft-close icon", "close")
      );

    if (account) {
      const content = el("form", "account");
      if (api.user) {
        profileDraft ??= {
          name: api.user.name,
          avatarUrl: api.user.avatarUrl ?? "",
          accentColor: api.user.accentColor ?? DEFAULT_ACCENT,
        };
        const profile = profileDraft;
        const portrait = avatar({ ...api.user, ...profile });
        const summary = el("div", "account-summary");
        const status = el("span", "account-status");
        if (api.user.verified) {
          status.append(document.createTextNode("Connected with "));
          if (api.user.id.startsWith("google:")) status.append(googleLogo());
          status.append(
            document.createTextNode(
              api.user.id.startsWith("google:") ? "Google" : "GitHub"
            )
          );
        } else status.textContent = "Guest account";
        const photoButton = button(
          "Update profile photo",
          () => upload.click(),
          "account-avatar-button"
        );
        photoButton.replaceChildren(portrait);
        summary.append(photoButton, el("h3", "", "Your profile"), status);
        content.append(summary);
        const nameField = el("label", "account-name-label", "Display name");
        const nameInput = el("input");
        nameInput.value = profile.name;
        nameInput.name = "name";
        nameInput.autocomplete = "name";
        nameInput.required = true;
        nameInput.maxLength = 60;
        nameInput.dataset.focusKey = "profile-name";
        nameInput.addEventListener("input", () => {
          profile.name = nameInput.value;
          queueProfileSave(profile);
        });
        nameInput.addEventListener("blur", () => {
          queueProfileSave(profile, true);
        });
        nameField.append(nameInput);
        const upload = el("input");
        upload.type = "file";
        upload.accept = "image/png,image/jpeg,image/webp";
        upload.hidden = true;
        upload.setAttribute("aria-label", "Choose profile photo");
        upload.addEventListener("change", () =>
          run(async () => {
            const file = upload.files?.[0];
            if (!file) return;
            if (file.size > 10 * 1024 * 1024)
              throw new Error("Choose a photo under 10 MB.");
            const bitmap = await createImageBitmap(file);
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 128;
            const ctx = canvas.getContext("2d")!;
            const size = Math.min(bitmap.width, bitmap.height);
            ctx.drawImage(
              bitmap,
              (bitmap.width - size) / 2,
              (bitmap.height - size) / 2,
              size,
              size,
              0,
              0,
              128,
              128
            );
            bitmap.close();
            let quality = 0.8;
            do {
              profile.avatarUrl = canvas.toDataURL("image/jpeg", quality);
              quality -= 0.15;
            } while (profile.avatarUrl.length > 12000 && quality > 0.1);
            if (profile.avatarUrl.length > 12000)
              throw new Error("Choose a smaller photo.");
            queueProfileSave(profile, true);
            renderDialog();
          })
        );
        summary.append(upload);
        const colors = accentPicker(profile.accentColor, (color) => {
          profile.accentColor = color;
          applyAccent(portrait, color);
          queueProfileSave(profile);
        });
        disposeAccentPicker = colors.destroy;
        content.append(nameField, colors.element);
        if (options.onboarding)
          content.append(onboardingPanel(api, options.onboarding));
        else content.append(accountUsage(api));
        if (
          api.user?.verified &&
          !options.onboarding?.code &&
          !options.onboarding?.claimKey &&
          !options.onboarding?.invite
        ) {
          const settings = el("div");
          content.append(settings);
          void import("./project-management.js").then(
            ({ projectManagement }) => {
              if (settings.isConnected)
                settings.replaceWith(
                  projectManagement(
                    api,
                    options.onboarding?.workspace,
                    (deleted) => {
                      if (deleted) {
                        selected = null;
                        optimistic.replace([], optimistic.revision);
                        content.querySelector(".account-usage")?.remove();
                      } else {
                        const path = options.onboarding?.workspace
                          ? `usage?workspace=${encodeURIComponent(options.onboarding.workspace)}`
                          : "usage";
                        content
                          .querySelector(".account-usage")
                          ?.replaceWith(accountUsage(api, path));
                        void refresh().catch(() => {});
                      }
                    }
                  )
                );
            }
          );
        }
        content.addEventListener("submit", (event) => {
          event.preventDefault();
          queueProfileSave(profile, true);
        });
        const sessionActions = el("div", "account-session");
        sessionActions.append(
          button(
            "Sign out",
            () =>
              run(async () => {
                clearTimeout(profileSaveTimer);
                queuedProfile = null;
                const signingOut = api.logout();
                profileDraft = null;
                confirmedProfile = null;
                render();
                try {
                  await signingOut;
                } finally {
                  render();
                }
              }),
            "secondary"
          )
        );
        content.append(sessionActions);
        if (!api.user.verified && google) content.append(googleSignIn());
        if (!api.user.verified && github)
          content.append(
            button(
              "Sign in with GitHub",
              () => run(() => githubLogin()),
              "primary"
            )
          );
      } else {
        content.append(
          el("h3", "", options.onboarding ? "Set up komo" : "Leave comments")
        );
        if (guests) {
          const label = el("label", "account-name-label", "Your name");
          const name = el("input");
          name.name = "name";
          name.autocomplete = "name";
          name.placeholder = "Your name";
          name.required = true;
          name.maxLength = 60;
          name.value = guestName;
          name.dataset.focusKey = "account-name";
          name.addEventListener("input", () => (guestName = name.value));
          label.append(name);
          content.append(label);
          const save = button("Continue", () => {}, "primary");
          save.type = "submit";
          save.disabled = pending;
          content.append(save);
        }
        if (guests && (google || github))
          content.append(el("div", "account-divider", "or"));
        if (google) content.append(googleSignIn());
        if (github)
          content.append(
            button(
              "Continue with GitHub",
              () => run(() => githubLogin()),
              "secondary"
            )
          );
        content.addEventListener("submit", (event) => {
          event.preventDefault();
          run(async () => {
            await mutate(async () => {
              await api.guest(guestName);
              account = false;
            });
            await resumeSubmission();
          });
        });
      }
      dialog.append(content);
    } else if (draft) dialog.append(composer(null));
    else if (thread) {
      const messages = el("div", "messages");
      for (const comment of thread.comments)
        messages.append(renderMessage(comment, thread));
      dialog.append(messages);
      dialog.append(composer(thread));
    } else
      dialog.append(el("div", "empty", "This comment is no longer available."));
    dialogs.append(dialog);
    if (
      account &&
      changing &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      dialogs.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 250,
        easing: "ease-out",
      });
      dialog.animate(
        [
          { opacity: 0, transform: "translateY(8px) scale(.97)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" }
      );
    }
    if (!account) {
      const dragHandle = el("div", "comment-drag-handle");
      dragHandle.setAttribute("aria-hidden", "true");
      dialog.prepend(dragHandle);
      floatingDrag(
        dialog,
        dragHandle,
        (p) => {
          if (dialogKey) cardPlacements.set(dialogKey, p);
          positionDialog();
        },
        abort.signal,
        () => cardFollow.stop()
      );
    }
    positionDialog();
    if (!account && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const target = dialog.getBoundingClientRect();
      const origin = openingPreview ?? (!changing ? previousRect : null);
      if (
        origin &&
        (openingPreview ||
          Math.abs(origin.height - target.height) > 1 ||
          Math.abs(origin.width - target.width) > 1)
      ) {
        dialog.animate(
          [
            {
              left: `${origin.left}px`,
              top: `${origin.top}px`,
              width: `${origin.width}px`,
              height: `${origin.height}px`,
              opacity: 1,
            },
            {
              left: `${target.left}px`,
              top: `${target.top}px`,
              width: `${target.width}px`,
              height: `${target.height}px`,
              opacity: 1,
            },
          ],
          { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" }
        );
      } else if (changing) {
        dialog.animate(
          [
            { opacity: 0, transform: "translateY(6px) scale(.97)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" }
        );
      }
      for (const item of dialog.querySelectorAll<HTMLElement>(
        "[data-comment]"
      )) {
        const reaction = item.querySelector<HTMLElement>(".message-reaction");
        const previous = previousReactions.get(item.dataset.comment);
        const id = item.dataset.comment;
        if (
          reaction &&
          previous &&
          previous.dataset.reactions !== reaction.dataset.reactions
        )
          reactionSwaps.set(id, {
            from: previous,
            to: reaction.dataset.reactions,
            started: performance.now(),
          });
        const swap = reactionSwaps.get(id);
        const elapsed = swap ? performance.now() - swap.started : 470;
        if (
          reaction &&
          swap &&
          elapsed < 470 &&
          swap.to === reaction.dataset.reactions
        ) {
          const leaving = el("span", "reaction-leaving");
          leaving.setAttribute("aria-hidden", "true");
          for (const child of swap.from.children) {
            if (child.classList.contains("reaction-leaving")) continue;
            const copy = child.cloneNode(true);
            leaving.append(copy);
          }
          const arriving = [...reaction.children];
          reaction.append(leaving);
          const exit = leaving.animate(
            [
              { opacity: 1, transform: "scale(1)" },
              { opacity: 0, transform: "scale(.2, .35)" },
            ],
            { duration: 110, easing: "ease-in", fill: "forwards" }
          );
          exit.currentTime = elapsed;
          exit.finished
            .then(() => leaving.remove())
            .catch(() => leaving.remove());
          for (const emoji of arriving) {
            const enter = emoji.animate(
              [
                { opacity: 0, transform: "scale(.25, .4)", offset: 0 },
                { opacity: 1, transform: "scale(1.16, .92)", offset: 0.38 },
                { opacity: 1, transform: "scale(.95, 1.07)", offset: 0.6 },
                { opacity: 1, transform: "scale(1.025, .985)", offset: 0.8 },
                { opacity: 1, transform: "scale(1)", offset: 1 },
              ],
              {
                duration: 380,
                delay: 90,
                easing: "ease-in-out",
                fill: "backwards",
              }
            );
            enter.currentTime = elapsed;
            void enter.finished
              .then(() => {
                if (reactionSwaps.get(id) === swap) reactionSwaps.delete(id);
              })
              .catch(() => {});
          }
        }
      }
    }
    openingPreview = null;
    const messages = dialog.querySelector(".messages");
    if (messages) messages.scrollTop = scroll;
    if (focusKey) {
      const next = dialog.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[data-focus-key="${focusKey}"]`
      );
      if (next) {
        next.focus({ preventScroll: true });
        if (caret !== null && caret !== undefined)
          next.setSelectionRange(caret, caret);
      }
    }
  }
  function positionDialog() {
    const availableHeight = Math.min(
      window.innerHeight,
      window.visualViewport?.height ?? window.innerHeight
    );
    const dialog = dialogs.firstElementChild as HTMLElement | null;
    if (!dialog || account) return;
    if (draft && isCompactReview(window.innerWidth, window.innerHeight)) {
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      dialog.style.maxHeight = `${Math.max(0, availableHeight - 24)}px`;
      const position = mobileComposerPosition(
        window.innerWidth,
        availableHeight,
        top,
        dialog.offsetWidth,
        dialog.offsetHeight
      );
      cardFollow.place(dialogKey, dialog, position.x, position.y, false);
      dialog.style.setProperty("top", `${position.y}px`, "important");
      dialog.style.bottom = "auto";
      dialog.style.transformOrigin = "bottom center";
      draftScrollSpace.style.height = `${Math.max(0, window.innerHeight - availableHeight) + dialog.offsetHeight + 24}px`;
      if (!draftScrollSpace.isConnected) surface.append(draftScrollSpace);
      positionNotice();
      return;
    }
    dialog.style.maxHeight = "";
    const anchor = draft ?? threads.find((t) => t.id === selected)?.anchor;
    const pin =
      draggedPin?.id === selected
        ? draggedPin
        : anchor
          ? (() => {
              const rect = locateAnchor(anchor);
              const indicator =
                selected &&
                pins.querySelector<HTMLElement>(
                  `[data-thread="${CSS.escape(selected)}"]`
                );
              return indicator ? indicatorPoint(indicator, rect) : rect;
            })()
          : null;
    const follow = draggedPin?.id === selected;
    const updateOrigin = () => {
      dialog.style.transformOrigin =
        !pin || pin.x < dialog.offsetLeft + dialog.offsetWidth / 2
          ? "top left"
          : "top right";
    };
    const placement = !follow && dialogKey && cardPlacements.get(dialogKey);
    if (placement) {
      const p = constrain(
        placement,
        dialog.offsetWidth,
        dialog.offsetHeight,
        document.documentElement.clientWidth,
        availableHeight
      );
      cardFollow.place(dialogKey, dialog, p.x, p.y, follow);
      updateOrigin();
      positionNotice();
      return;
    }
    let x = (window.innerWidth - 354) / 2,
      y = availableHeight - 450;
    if (pin) {
      x = pin.x + 20;
      y = pin.y - 28;
    }
    const right =
      expanded && !isCompactReview(window.innerWidth, window.innerHeight)
        ? 396
        : 12;
    if (pin && x + dialog.offsetWidth > window.innerWidth - right)
      x = pin.x - dialog.offsetWidth - 20;
    cardFollow.place(
      dialogKey,
      dialog,
      Math.max(12, Math.min(x, window.innerWidth - dialog.offsetWidth - right)),
      Math.max(12, Math.min(y, availableHeight - dialog.offsetHeight - 92)),
      follow
    );
    updateOrigin();
    positionNotice();
  }
  function revealDraftTarget() {
    if (
      !draft ||
      account ||
      !isCompactReview(window.innerWidth, window.innerHeight)
    )
      return;
    positionDialog();
    const dialog = dialogs.firstElementChild as HTMLElement | null;
    if (!dialog) return;
    const top = (window.visualViewport?.offsetTop ?? 0) + 12;
    const bottom = dialog.getBoundingClientRect().top - 16;
    if (bottom <= top) return;
    const point = locateAnchor(draft);
    if (point.y < top || point.y > bottom)
      window.scrollBy({
        top: point.y - (top + bottom) / 2,
        behavior: "instant",
      });
  }
  function openAccount() {
    clearTimeout(accountOpenTimer);
    profileDraft = null;
    mode = false;
    const mobile = isCompactReview(window.innerWidth, window.innerHeight);
    const revealPanel = mobile && !expanded;
    if (revealPanel) toggleExpanded(true);
    const show = () => {
      accountOpenTimer = 0;
      if (destroyed || (mobile && !expanded)) return;
      account = true;
      render();
      focusAccount();
    };
    if (revealPanel) accountOpenTimer = window.setTimeout(show, 750);
    else show();
  }
  function focusAccount() {
    queueMicrotask(() => {
      if (!account) return;
      const mobile = isCompactReview(window.innerWidth, window.innerHeight);
      const target = mobile
        ? dialogs.querySelector<HTMLElement>(".account-dialog")
        : dialogs.querySelector<HTMLElement>("input,button");
      if (mobile && target) target.tabIndex = -1;
      target?.focus({ preventScroll: true });
    });
  }
  const anchorElements = new WeakMap<Anchor, Element>();
  function anchorElement(anchor: Anchor) {
    try {
      const cached = anchorElements.get(anchor);
      if (
        cached?.isConnected &&
        (!anchor.selector || cached.matches(anchor.selector))
      )
        return cached;
      const element = anchor.selector
        ? document.querySelector(anchor.selector)
        : document.body;
      if (element) anchorElements.set(anchor, element);
      return element;
    } catch {
      return null;
    }
  }
  function locateAnchor(anchor: Anchor) {
    return measureAnchor(anchor, anchorElement(anchor));
  }
  function siteElementAt(x: number, y: number) {
    return (
      document
        .elementsFromPoint(x, y)
        .find((element) => element !== host && !host.contains(element)) ?? null
    );
  }
  function indicatorPoint(
    pin: HTMLElement,
    fallback: { x: number; y: number }
  ) {
    if (!pin.closest(".pin-stack") || pin.dataset.dragging) return fallback;
    const bounds = pin.getBoundingClientRect();
    return {
      x: bounds.left + (pin.dataset.pointer === "right" ? 25 : 9),
      y: bounds.top + 28,
    };
  }
  function enablePinDrag(
    pin: HTMLButtonElement,
    thread: Thread,
    rect: ReturnType<typeof locateAnchor>
  ) {
    let start: { x: number; y: number } | null = null;
    let moved = false;
    let origin = rect;
    if (
      api.user &&
      (api.user.verified || thread.comments[0]?.author.id === api.user.id)
    )
      pin.style.cursor = "grab";
    pin.addEventListener("pointerdown", (event) => {
      if (
        event.button !== 0 ||
        pending ||
        !api.user ||
        !(api.user.verified || thread.comments[0]?.author.id === api.user.id)
      )
        return;
      origin = { ...rect, ...indicatorPoint(pin, rect) };
      start = { x: event.clientX, y: event.clientY };
      moved = false;
      pin.setPointerCapture(event.pointerId);
    });
    pin.addEventListener("pointermove", (event) => {
      if (!start) return;
      const dx = event.clientX - start.x,
        dy = event.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      if (!moved) {
        pin.dataset.dragging = "true";
        pin.style.position = "fixed";
        pin.style.margin = "0";
        movingThread = thread.id;
        previewSuppressed = true;
        hidePreview();
        if (selected === thread.id) {
          cardFollow.stop();
          selected = null;
          editing = null;
          renderDialog();
        }
      }
      moved = true;
      pin.dataset.pointer = pinDirection(
        { ...origin, x: origin.x + dx, y: origin.y + dy },
        window.innerWidth
      );
      pin.style.left = `${origin.x + dx}px`;
      pin.style.top = `${origin.y + dy}px`;
      draggedPin = { id: thread.id, x: origin.x + dx, y: origin.y + dy };
      cardPlacements.delete(thread.id);
      positionDialog();
    });
    pin.addEventListener(
      "click",
      (event) => {
        if (moved) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true
    );
    pin.addEventListener("pointerup", (event) => {
      if (!start) return;
      const x = origin.x + event.clientX - start.x,
        y = origin.y + event.clientY - start.y;
      start = null;
      movingThread = null;
      if (!moved) return;
      draggedPin = { id: thread.id, x, y };
      positionDialog();
      const target = componentAt(x, y);
      if (!target) {
        draggedPin = null;
        positionDialog();
        pinSnapshot = "";
        renderPins();
        return;
      }
      const anchor = captureAnchor(
        target,
        { x, y },
        { x: x + rect.width, y: y + rect.height },
        options.source?.(target)
      );
      anchor.unstacked = true;
      run(async () => {
        try {
          draggedPin = null;
          await saveOptimistic(
            changeThread(thread.id, (current) => ({ ...current, anchor })),
            async (id) => {
              await api.request(`threads/${id(thread.id)}`, "PATCH", {
                anchor,
              });
            }
          );
        } finally {
          draggedPin = null;
          positionDialog();
          pinSnapshot = "";
          renderPins();
        }
      });
    });
    pin.addEventListener("pointercancel", () => {
      draggedPin = null;
      positionDialog();
      start = null;
      movingThread = null;
      pinSnapshot = "";
      renderPins();
    });
  }
  function componentAt(x: number, y: number): Element | null {
    const hit = siteElementAt(x, y);
    if (!hit || !surface.contains(hit) || hit === surface) return null;
    const target =
      hit.closest(
        "button,a,input,textarea,select,[role=button],[role=link],[data-comment-anchor],h1,h2,h3,h4,h5,h6,p,li,figure,svg,canvas,img,video"
      ) ?? hit;
    // SVG paths and text spans belong to the control or text block they render.
    const control = target.closest("button,a,[role=button],[role=link]");
    return control && surface.contains(control) ? control : target;
  }
  function updateHover() {
    if (
      (!mode && !draft) ||
      drag ||
      (draft && draft.width > 0 && draft.height > 0)
    ) {
      hoverOutline.style.opacity = "0";
      if (!mode && !draft) {
        hoverTarget = null;
        hoverPoint = null;
      }
      return;
    }
    if (draft) hoverTarget = anchorElement(draft);
    if (mode && hoverPoint)
      hoverTarget = componentAt(hoverPoint.x, hoverPoint.y);
    if (!hoverTarget?.isConnected) {
      hoverOutline.style.opacity = "0";
      return;
    }
    const rect = hoverTarget.getBoundingClientRect();
    const bounds = framed
      ? surface.getBoundingClientRect()
      : {
          left: 0,
          top: 0,
          right: window.innerWidth,
          bottom: window.innerHeight,
        };
    const left = Math.max(0, bounds.left, rect.left),
      top = Math.max(bounds.top, rect.top);
    const right = Math.min(bounds.right, rect.right),
      bottom = Math.min(bounds.bottom, rect.bottom);
    if (right <= left || bottom <= top) {
      hoverOutline.style.opacity = "0";
      return;
    }
    Object.assign(hoverOutline.style, {
      opacity: "1",
      left: `${left}px`,
      top: `${top}px`,
      width: `${right - left}px`,
      height: `${bottom - top}px`,
      borderRadius: getComputedStyle(hoverTarget).borderRadius,
    });
  }
  function scheduleHover() {
    if (hoverFrame) return;
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = 0;
      updateHover();
    });
  }
  function render() {
    if (destroyed) return;
    if (account && !expanded) {
      if (isCompactReview(window.innerWidth, window.innerHeight)) {
        account = false;
        openAccount();
      } else toggleExpanded(true);
      return;
    }
    scalePage();
    const composingMobile =
      !!draft &&
      !account &&
      isCompactReview(window.innerWidth, window.innerHeight);
    host.classList.toggle("mobile-composing", composingMobile);
    if (!composingMobile) draftScrollSpace.remove();
    sidebar.inert = account;
    if (selected || draft || mode || hidden || account) hidePreview(true);
    catcher.hidden = !mode;
    updateHover();
    hints.replaceChildren();

    renderToolbar();
    renderPins();
    renderList();
    renderDialog();
  }
  let drag: {
    x: number;
    y: number;
    element: Element;
    pointerId: number;
  } | null = null;
  let selection: HTMLElement | null = null;
  catcher.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const element = componentAt(event.clientX, event.clientY);
    if (!element) return;
    hoverTarget = element;
    hoverPoint = null;
    hoverOutline.style.opacity = "0";
    drag = {
      x: event.clientX,
      y: event.clientY,
      element,
      pointerId: event.pointerId,
    };
    catcher.setPointerCapture(event.pointerId);
    selection = el("div", "selection");
    shadow.append(selection);
  });
  catcher.addEventListener("pointermove", (event) => {
    if (!drag || !selection) {
      hoverPoint = { x: event.clientX, y: event.clientY };
      scheduleHover();
      return;
    }
    Object.assign(selection.style, {
      left: `${Math.min(drag.x, event.clientX)}px`,
      top: `${Math.min(drag.y, event.clientY)}px`,
      width: `${Math.abs(drag.x - event.clientX)}px`,
      height: `${Math.abs(drag.y - event.clientY)}px`,
    });
  });
  function composeAt(
    element: Element,
    start: { x: number; y: number },
    end = start
  ) {
    hidePreview();
    draft = captureAnchor(element, start, end, options.source?.(element));
    hoverTarget = element;
    mode = false;
    selected = null;
    account = false;
    editing = null;
    error = "";
    render();
    shadow
      .querySelector<HTMLTextAreaElement>('[data-focus-key="body"]')
      ?.focus({ preventScroll: true });
    revealDraftTarget();
  }
  catcher.addEventListener("pointerup", (event) => {
    if (!drag) return;
    const target = drag;
    selection?.remove();
    selection = null;
    drag = null;
    composeAt(target.element, target, { x: event.clientX, y: event.clientY });
  });
  catcher.addEventListener("pointerleave", () => {
    if (drag || draft) return;
    hoverPoint = null;
    hoverTarget = null;
    hoverOutline.style.opacity = "0";
  });
  catcher.addEventListener("pointercancel", () => {
    drag = null;
    selection?.remove();
    selection = null;
    hoverPoint = null;
    hoverTarget = null;
    hoverOutline.style.opacity = "0";
  });
  function geometry() {
    if (frame || destroyed || document.hidden) return;
    const currentPage = page();
    if (
      !draft &&
      !selected &&
      !mode &&
      !activeNotice &&
      (hidden ||
        !threads.some(
          (thread) => thread.page === currentPage && !thread.resolved
        ))
    )
      return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      renderPins();
      positionDialog();
      positionNotice();
      updateHover();
    });
  }
  document.addEventListener(
    "scroll",
    (event) => {
      previewSuppressed = true;
      hidePreview();
      const target = event.target;
      // Sidebar and comment text scrolling do not move the page anchors.
      if (target === host || !target) return;
      const scroller = target === document ? document.scrollingElement : target;
      if (!(scroller instanceof Element)) return;
      const now = performance.now();
      const previous = scrollSamples.get(target);
      const x = scroller.scrollLeft,
        y = scroller.scrollTop;
      const distance = previous
        ? Math.hypot(x - previous.x, y - previous.y)
        : 2;
      const speed = previous ? distance / Math.max(1, now - previous.time) : 1;
      scrollSamples.set(target, { x, y, time: now });
      if (!movingThread && (pinsScrolling || distance >= 2 || speed > 0.1)) {
        if (!pinsScrolling)
          for (const pin of pins.querySelectorAll<HTMLElement>(".pin"))
            pin.getAnimations().forEach((animation) => animation.cancel());
        pinsScrolling = true;
        pins.dataset.scrolling = "true";
        clearTimeout(pinScrollTimer);
        pinScrollTimer = window.setTimeout(() => {
          if (destroyed) return;
          pinSnapshot = "";
          renderPins(true);
          pinsScrolling = false;
          delete pins.dataset.scrolling;
          if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
            for (const pin of pins.querySelectorAll<HTMLElement>(".pin"))
              pin.animate(
                [
                  { transform: "translate(var(--pin-x), -28px) scale(0)" },
                  { transform: "translate(var(--pin-x), -28px) scale(1)" },
                ],
                { duration: 250, easing: "cubic-bezier(.22,1.25,.36,1)" }
              );
        }, 140);
      }
      geometry();
    },
    {
      capture: true,
      passive: true,
      signal: abort.signal,
    }
  );
  window.visualViewport?.addEventListener(
    "scroll",
    () => {
      if (
        (account || draft) &&
        isCompactReview(window.innerWidth, window.innerHeight)
      ) {
        scalePage();
        geometry();
      }
    },
    { signal: abort.signal }
  );
  window.visualViewport?.addEventListener(
    "resize",
    () => {
      if (!isCompactReview(window.innerWidth, window.innerHeight)) return;
      scalePage();
      renderToolbar();
      revealDraftTarget();
      geometry();
    },
    { signal: abort.signal }
  );
  window.addEventListener(
    "resize",
    () => {
      scalePage();
      renderToolbar();
      geometry();
    },
    { signal: abort.signal }
  );
  document.addEventListener(
    "keydown",
    (event) => {
      keyboardAction = true;
      queueMicrotask(() => {
        keyboardAction = false;
      });
      const target = event.composedPath()[0];
      if (account && event.key === "Tab") {
        const controls = [
          ...dialogs.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),a[href]"
          ),
        ];
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && shadow.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && shadow.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
      const typing =
        target instanceof HTMLElement &&
        (target.matches("input,textarea,select") || target.isContentEditable);
      if (event.key === "Escape") {
        if (mode || draft || selected || account) dismiss();
        else if (expanded) toggleExpanded(false);
        return;
      }
      if (
        options.onboarding ||
        typing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        setMode(!mode);
      }
      if (event.key.toLowerCase() === "v") {
        event.preventDefault();
        setMode(false);
      }
    },
    { signal: abort.signal }
  );
  document.addEventListener(
    "pointerdown",
    (event) => {
      const path = event.composedPath();
      const reviewControl = path.some(
        (node) =>
          node instanceof Element &&
          node.getRootNode() === shadow &&
          node.matches(
            "button,input,textarea,summary,[role=menu],.emoji-menu,.emoji-keyboard,.floating-notice"
          )
      );
      if (
        event.button === 0 &&
        (selected || draft) &&
        !(draft && isCompactReview(window.innerWidth, window.innerHeight)) &&
        !account &&
        !path.includes(dialogs) &&
        !path.includes(toolbar) &&
        !path.includes(pins) &&
        !reviewControl
      ) {
        if (draft && draftText.trim())
          parkedDraft = { anchor: draft, text: draftText };
        dismiss();
      }
      for (const menu of shadow.querySelectorAll<HTMLDetailsElement>(
        ".comment-menu[open]"
      )) {
        if (!event.composedPath().includes(menu)) menu.open = false;
      }
    },
    { signal: abort.signal }
  );
  const observer = new ResizeObserver(geometry);
  observer.observe(surface);
  let mutationTimer = 0;
  const mutations = new MutationObserver(() => {
    // Background host churn needs one refresh per burst, not per animation frame.
    if (draft || selected || mode || activeNotice) return geometry();
    if (!mutationTimer)
      mutationTimer = window.setTimeout(() => {
        mutationTimer = 0;
        geometry();
      }, 80);
  });
  mutations.observe(surface, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  dialogs.addEventListener("pointerdown", (event) => {
    if (account && event.target === dialogs) dismiss();
  });
  const interval = window.setInterval(
    () => {
      if (document.hidden || destroyed) return;
      if (page() !== lastPage) {
        lastPage = page();
        parkedDraft = null;
        selected = null;
        draft = null;
        render();
      }
      void refresh().catch(() => {});
    },
    Math.max(2000, options.pollInterval ?? 4000)
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) {
        mutations.disconnect();
        clearTimeout(mutationTimer);
        mutationTimer = 0;
      } else {
        mutations.observe(surface, {
          childList: true,
          subtree: true,
          characterData: true,
        });
        geometry();
        void refresh().catch(() => {});
      }
    },
    { signal: abort.signal }
  );
  const controller: CommentsController = {
    destroy() {
      clearTimeout(mutationTimer);
      clearTimeout(pinScrollTimer);
      clearTimeout(accountOpenTimer);
      clearTimeout(copiedPromptTimer);
      reactionSwaps.clear();
      cardFollow.stop();
      run(saveProfile);
      disposeAccentPicker?.();
      closePicker?.(true);
      for (const [dialog, dispose] of exitingDialogs) {
        dispose?.();
        dialog.getAnimations().forEach((animation) => animation.cancel());
        dialog.remove();
      }
      exitingDialogs.clear();
      destroyed = true;
      pageMotion?.stop();
      dockMotion?.stop();
      abort.abort();
      clearInterval(interval);
      clearTimeout(toastTimer);
      clearTimeout(listScrollTimer);
      clearTimeout(githubTimer);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(hoverFrame);
      cancelAnimationFrame(noticeFrame);
      hidePreview();
      observer.disconnect();
      mutations.disconnect();
      draftScrollSpace.remove();
      const scroll =
        framed && !nativeReviewScroll
          ? surface.scrollTop * htmlZoom()
          : window.scrollY / appliedScale;
      for (const [header, styles] of fixedHeaders)
        Object.assign(header.style, styles);
      fixedHeaders.clear();
      document.documentElement.style.overflow = savedHtmlOverflow;
      Object.assign(surface.style, savedStyle);
      Object.assign(document.body.style, savedBody);
      document.documentElement.style.background = savedHtmlBackground;
      window.scrollTo({ top: scroll, behavior: "instant" });
      if (ownsWrapper) surface.replaceWith(...surface.childNodes);
      toolbarSize.disconnect();
      toolbarRoot.unmount();
      host.remove();
      instances.delete(document);
    },
    comment(element) {
      const compose = () => {
        if (destroyed || !element.isConnected) return;
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        composeAt(element, {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      };
      if (expanded) {
        toggleExpanded(false);
        if (pageMotion && pageTransitioning)
          void pageMotion.finished.then(compose);
        else compose();
      } else compose();
    },
    open() {
      toggleExpanded(true);
    },
    close() {
      dismiss();
      toggleExpanded(false);
    },
    refresh,
  };
  instances.set(document, controller);
  scalePage();
  render();
  run(async () => {
    const config = await api.request<{
      github: boolean;
      google?: boolean;
      guests: boolean;
      guestResolve: boolean;
    }>("config");
    google = !!config.google;
    github = config.github;
    guests = config.guests;
    guestResolve = config.guestResolve;
    try {
      await api.restore();
    } catch {
      /* An expired guest session can be renewed by entering a name. */
    }
    await refresh();
    const deepLink = new URL(location.href).searchParams.get("comment");
    const thread = threads.find((t) => t.id === deepLink);
    if (thread) {
      toggleExpanded(true);
      selectThread(thread);
    }
    render();
  });
  return controller;
}
