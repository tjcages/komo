import { initKomo } from "@tjcages/komo";

// Same hosted project and preview-gateway rules as the landing page demo.
initKomo({
  endpoint: /^[a-z0-9-]+-komo-site\.off-brand\.workers\.dev$/.test(
    location.hostname,
  )
    ? location.origin
    : undefined,
  sessionDomain: "off-brand.workers.dev",
  sessionEndpoint: "https://komo.offbr.co",
  project: "komo-landing-demo",
  repo: "tjcages/komo",
  autoHideDrawer: false,
});
