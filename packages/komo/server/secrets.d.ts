interface Env {
  GOOGLE_CLIENT_SECRET: string;
  KOMO_HOSTED?: string;
  KOMO_PAUSED?: string;
  EDGE_LIMIT?: RateLimit;
}

declare module "*.txt" {
  const content: string;
  export default content;
}
