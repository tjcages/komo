// Types for the pieces of config.mjs that the local runner bundles.
export function gitValue(args: string[], cwd: string): string;
export function repository(remote: string): string;
export function branchName(
  env: Record<string, string | undefined>,
  cwd: string
): string;
export function findSettings(
  cwd: string
): Promise<{ directory: string; settings?: Record<string, unknown> }>;
export function clientModule(config: unknown): string;
