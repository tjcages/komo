"use client";

import { useEffect, useRef } from "react";
import { initKomo } from "./index.js";
import type { KomoConfig } from "./config.js";
import type { CommentsController } from "./types.js";

export type { KomoConfig } from "./config.js";

function sameConfig(a: KomoConfig, b: KomoConfig): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<
    keyof KomoConfig
  >;
  return [...keys].every((key) => {
    if (key !== "onboarding") return Object.is(a[key], b[key]);
    const before = a.onboarding;
    const after = b.onboarding;
    if (!before || !after) return before === after;
    return Object.keys({ ...before, ...after }).every((field) =>
      Object.is(
        before[field as keyof typeof before],
        after[field as keyof typeof after],
      ),
    );
  });
}

/** Mount once near the React app root. Memoize callback options with useCallback. */
export function useKomo(config: KomoConfig): void {
  const mounted = useRef<{
    config: KomoConfig;
    controller: CommentsController;
  } | null>(null);

  useEffect(() => {
    if (mounted.current && sameConfig(mounted.current.config, config)) return;
    mounted.current?.controller.destroy();
    mounted.current = null;
    if (config.enabled === false) return;
    const snapshot = {
      ...config,
      ...(config.onboarding ? { onboarding: { ...config.onboarding } } : {}),
    };
    mounted.current = { config: snapshot, controller: initKomo(snapshot) };
  });

  useEffect(
    () => () => {
      mounted.current?.controller.destroy();
      mounted.current = null;
    },
    [],
  );
}
