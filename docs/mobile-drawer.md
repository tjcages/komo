# Mobile comments Drawer

Compact screens use one Drawer layout (width up to 760px, or landscape width up to 1000px and height up to 500px). Desktop Edge/Frame preferences remain saved and return when the viewport expands. The host page stays unscaled on mobile.

The user chose a lightweight drawer instead of adding Vaul, keeping the existing bundle budgets. The lazy-loaded controller provides handle dragging, dismissal, interrupted animation cleanup, reduced motion, focus restoration, scroll locking, and account handoff. The comments list scrolls independently. Restoring an open sidebar skips its entrance animation. Native label crossfades reduce toolbar runtime cost while preserving its position animation.

On the marketing site, tapping the current URL in the expanded mobile navigation closes the menu without navigating. Other destinations and modified clicks retain their normal behavior.

## Validation

- Build, typecheck, 207 tests, size check, and packed-consumer checks passed.
- Initial gzip: 97,330 bytes / 100,000. All features: 195,966 bytes / 196,000. Budgets unchanged; remaining headroom is small.
- Responsive Chrome: 320×568, 390×844, 844×390, and desktop restoration. A 40-comment fixture verified independent scrolling and search, handle dismissal, account handoff, and host scroll/style restoration.
- Deployed preview: live comments/account loaded, open Drawer restored on refresh, toolbar pin toggles settled, and no console errors were reported. Same-page navigation preserved paused walkthrough state locally.
- Physical iOS/Android devices and native software keyboards have not been tested.

Preview: https://mobile-drawer-komo-site.off-brand.workers.dev/

Worker version: `9e330a75-b6f3-480b-b975-615f03aa9633`. This preview uses the existing API preview version; no production API or database changes are included.
