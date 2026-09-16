import { canonicalPage } from "../src/page.js";
import type { Anchor } from "../src/types.js";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
export function check(
  condition: unknown,
  status: number,
  message: string
): asserts condition {
  if (!condition) throw new HttpError(status, message);
}
export function string(value: unknown, max: number, label: string): string {
  check(
    typeof value === "string" && value.trim().length > 0 && value.length <= max,
    400,
    `Invalid ${label}.`
  );
  return value.trim();
}
export function pagePath(value: unknown): string {
  const page = string(value, 2000, "page");
  check(
    page.startsWith("/") &&
      !page.startsWith("//") &&
      !/[?#\\]/.test(page) &&
      ![...page].some((char) => char.charCodeAt(0) < 32),
    400,
    "Invalid page path."
  );
  return canonicalPage(page);
}
export function anchorValue(value: unknown): Anchor {
  check(value && typeof value === "object", 400, "Invalid anchor.");
  const a = value as Record<string, unknown>;
  for (const key of [
    "x",
    "y",
    "width",
    "height",
    "pageX",
    "pageY",
    "viewportWidth",
  ]) {
    check(
      typeof a[key] === "number" && Number.isFinite(a[key]) && a[key] >= 0,
      400,
      `Invalid anchor ${key}.`
    );
  }
  for (const key of ["x", "y", "width", "height"])
    check(Number(a[key]) <= 1, 400, "Anchor outside element.");
  check(
    Number(a.x) + Number(a.width) <= 1.001 &&
      Number(a.y) + Number(a.height) <= 1.001,
    400,
    "Area outside element."
  );
  check(
    Number(a.viewportWidth) > 0 &&
      Number(a.viewportWidth) <= 20000 &&
      Number(a.pageY) <= 10000000 &&
      Number(a.pageX) <= 20000,
    400,
    "Anchor outside page."
  );
  check(
    typeof a.selector === "string" &&
      a.selector.length <= 2000 &&
      typeof a.text === "string" &&
      a.text.length <= 160,
    400,
    "Invalid anchor selector."
  );
  const source =
    typeof a.source === "string" &&
    a.source.length <= 500 &&
    !a.source.includes("..") &&
    !a.source.startsWith("/")
      ? a.source
      : undefined;
  return {
    selector: a.selector,
    text: a.text,
    x: Number(a.x),
    y: Number(a.y),
    width: Number(a.width),
    height: Number(a.height),
    pageX: Number(a.pageX),
    pageY: Number(a.pageY),
    viewportWidth: Number(a.viewportWidth),
    source,
    ...(a.unstacked === true ? { unstacked: true } : {}),
  };
}

export function originAllowed(origin: string, patterns: string[]): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.origin !== origin) return false;
  return patterns.some((pattern) => {
    if (!pattern.includes("*")) return pattern === origin;
    const escaped = pattern
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[a-zA-Z0-9-]+");
    return new RegExp(`^${escaped}$`).test(origin);
  });
}

export function cliReturnOrigin(value: unknown, fallback: string): string {
  if (value === undefined) return fallback;
  check(typeof value === "string", 400, "Invalid CLI return origin.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(400, "Invalid CLI return origin.");
  }
  check(
    url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      Number(url.port) >= 1024 &&
      url.origin === value,
    400,
    "CLI sign-in must return to an ephemeral loopback port."
  );
  return url.origin;
}
