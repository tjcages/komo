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

Worker version: `1467d00b-223a-43d6-85ad-f4f745d94e49`. This preview uses the existing API preview version; no production API or database changes are included.

## Mobile indicator follow-up

Mobile scroll updates keep indicators visible instead of repeatedly hiding and bouncing them back in. Opening a mobile comment no longer scrolls the page. Removed both fixed mobile card top/bottom overrides so existing anchor placement can keep cards near indicators, with the toolbar boundary as their lowest position.

Responsive fixture verification: tapping at scrollY 333 preserved scrollY 333; card and indicator tops aligned at 380.875px. Scrolling toward the lower viewport clamped the card bottom to 751.844px in an 844px viewport. Build, typecheck, 207 tests, and the unchanged 196 KB size budget pass.
