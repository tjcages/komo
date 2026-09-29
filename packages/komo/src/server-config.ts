/** Existing backend project policy; credentials belong in deployment secrets. */
export interface KomoProjectConfig {
  repo: string;
  origins: string[];
  allowGuests?: boolean;
  allowGuestResolve?: boolean;
  requireOwner?: boolean;
  bootstrapHash?: string;
  suspended?: boolean;
  writesPerDay?: number;
  retainedCommentsPerUser?: number;
}

/** Backend configuration only; never import this file into the website widget. */
export interface KomoServerConfig {
  projects: Record<string, KomoProjectConfig>;
  googleClientId?: string;
  githubClientId?: string;
  /** Node API origin. PUBLIC_URL overrides this value. */
  publicUrl?: string;
  /** Node listener port. PORT overrides this value; defaults to 8080. */
  port?: number;
  /** Trusted Node proxy hops. KOMO_PROXY_HOPS overrides this value. */
  proxyHops?: number;
}

/** Type backend settings without loading the server or reading environment secrets. */
export function defineKomoConfig(config: KomoServerConfig): KomoServerConfig {
  return config;
}
