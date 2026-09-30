import type { CommentsOptions } from "./types.js";

/** An agent session that runs `komo mcp` and watches this project. */
export type WatchingAgent = {
  channel: string;
  label: string;
  state: "waiting" | "working";
};

const loopback = ["localhost", "127.0.0.1", "[::1]"];
const channel = /^agent-[0-9a-f]{12}$/;

/** The local endpoint, when this page may send comments to a local agent. */
export function localEndpoint(options: CommentsOptions): string | undefined {
  const { hostname } = location;
  if (
    options.local === false ||
    !(loopback.includes(hostname) || hostname.endsWith(".localhost"))
  )
    return;
  const endpoint = new URL(
    (typeof options.local === "object" && options.local.endpoint) ||
      "http://127.0.0.1:4848",
  );
  if (
    !/^https?:$/.test(endpoint.protocol) ||
    !loopback.includes(endpoint.hostname)
  )
    throw new Error("The local comments endpoint must be a loopback address.");
  return endpoint.href;
}

/**
 * Agents that watch this project now, or null when the server did not answer:
 * a failed or slow probe says nothing about who watches.
 */
export async function watchingAgents(
  endpoint: string,
  project: string,
  repo: string,
): Promise<WatchingAgent[] | null> {
  const url = new URL("local/agents", endpoint.replace(/\/?$/, "/"));
  url.searchParams.set("project", project);
  url.searchParams.set("repo", repo);
  try {
    const response = await fetch(url, {
      credentials: "omit",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const { agents } = await response.json();
    if (!Array.isArray(agents)) return null;
    return agents.flatMap((agent) =>
      channel.test(agent?.channel) && typeof agent.label === "string"
        ? [
            {
              channel: agent.channel,
              label: agent.label.slice(0, 60),
              state: agent.state === "working" ? "working" : "waiting",
            },
          ]
        : [],
    );
  } catch {
    return null;
  }
}

// Per site and local server, so a choice cannot target a different store.
const storageKey = (project: string, endpoint: string) =>
  `komo:send-to:${location.host}:${project}:${endpoint}`;

export function store(project: string, endpoint: string, value: string) {
  try {
    localStorage.setItem(storageKey(project, endpoint), value);
  } catch {
    /* The value lasts for this page view. */
  }
}

/** An agent channel, or null when this page has no saved choice. */
export function savedChoice(project: string, endpoint: string): string | null {
  try {
    const value = localStorage.getItem(storageKey(project, endpoint));
    return channel.test(value ?? "") ? value : null;
  } catch {
    return null;
  }
}
