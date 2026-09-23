# Mobile comments Drawer

Compact screens use one Drawer layout (width up to 760px, or landscape width up to 1000px and height up to 500px). Desktop Edge/Frame preferences remain saved and return when the viewport expands. The host page stays unscaled on mobile.

The user chose a lightweight drawer instead of adding Vaul, keeping the existing bundle budgets. The lazy-loaded controller provides handle dragging, dismissal, interrupted animation cleanup, reduced motion, focus restoration, scroll locking, and account handoff. The comments list scrolls independently. Restoring an open sidebar skips its entrance animation. Native label crossfades reduce toolbar runtime cost while preserving its position animation.

On the marketing site, tapping the current URL in the expanded mobile navigation closes the menu without navigating. Other destinations and modified clicks retain their normal behavior.

## Validation

- Build, typecheck, 207 tests, size check, and packed-consumer checks passed.
- Initial gzip: 97,330 bytes / 100,000. All features: 195,966 bytes / 196,000. Budgets unchanged; remaining headroom is small.
- Responsive Chrome: 320×568, 390×844, 844×390, and desktop restoration. A 40-comment fixture verified independent scrolling and search, handle dismissal, account handoff, and host scroll/style restoration.
- Deployed preview: live comments/account loaded, open Drawer restored on refresh, toolbar pin toggles settled, and no console errors were reported. Same-page navigation preserved paused walkthrough state locally.
- These initial checks used desktop responsive emulation. Later native iOS Device Hub evidence is recorded below; physical iOS/Android hardware remains untested.

Preview: https://mobile-drawer-komo-site.off-brand.workers.dev/

Worker version: `1467d00b-223a-43d6-85ad-f4f745d94e49`. This preview uses the existing API preview version; no production API or database changes are included.

## Mobile indicator follow-up

Mobile scroll updates keep indicators visible instead of repeatedly hiding and bouncing them back in. Opening a mobile comment no longer scrolls the page. Removed both fixed mobile card top/bottom overrides so existing anchor placement can keep cards near indicators, with the toolbar boundary as their lowest position.

Responsive fixture verification: tapping at scrollY 333 preserved scrollY 333; card and indicator tops aligned at 380.875px. Scrolling toward the lower viewport clamped the card bottom to 751.844px in an 844px viewport. Build, typecheck, 207 tests, and the unchanged 196 KB size budget pass.

## Safari interaction refinement

The Drawer supports dragging across its header and pulling down from the top of the comment list. Native list scrolling remains available when scrolled away from the top. Dragging fades the backdrop; cancelled drags return to the open position.

While the mobile overlay is open, root background and existing theme-color metadata receive a matching tint. Closing or destroying the widget restores them. Viewport height changes no longer rebuild the toolbar or reset layout motion. Mobile pins hide during scrolling and fade back after 180ms of inactivity, replacing the previous always-visible behavior.

Focused reply and new-comment textareas use an animated, centered card position within the visual viewport. Blurring returns to normal anchor placement. Removed draft-only page-scroll adjustments. The marketing site already uses the document scroller: deployed read-back confirms HTML scrolling, window scroll movement, and visible overflow on the body and site root.

Validation: build/typecheck passed; the existing 207-test suite passed, followed by 15 focused tests including the new pull/cancel/list-scroll case. Initial gzip 96,788 bytes; all features exactly 196,000 bytes. Unused and superseded styles were removed to retain the budget. Browser checks verified centered reply placement, header dismissal, tint restoration, and native scrolling.

Preview Worker version: `e7714b1c-7853-48f7-b0fe-eed3d755a96d`.

The initial attempt looked for the former standalone Simulator.app and was blocked. Device Hub was subsequently recovered at the path below, allowing native iOS Safari testing.

## Device Hub follow-up

The owner still reproduced the mobile problems, so desktop-browser evidence was insufficient. A confirmed defect was the layout code's inline `opacity: 1` overriding the pin layer's scroll-hiding CSS. Layout completion now clears that temporary inline override. Build, typecheck, all 208 tests, and size pass (96,784 bytes initial; 195,996 bytes all features).

Candidate preview: https://5db3903e-komo-site.off-brand.workers.dev/ (also the mobile-drawer alias). Device validation is in progress.

Device Hub recovery: its installed app is `Xcode.app/Contents/Applications/DeviceHub.app`. Normal app attachment and System Events can return an invalid process identity or empty window list. The device window was recovered through CoreGraphics' owner PID and direct Accessibility `AXMainWindow` access. The absence of the old standalone Simulator.app is not a blocker to using Device Hub.

### Native device evidence

Device Hub runs an iPhone 18 Pro with iOS 27. This is the native iOS runtime, not a desktop browser viewport; it is not physical hardware. Background window capture and some Accessibility controls work. Direct screen gestures require the device window to be briefly foregrounded, confirmed visible through CoreGraphics, and the previous app restored afterward. System Events and NSWorkspace focus alone are not reliable evidence that this window is visible.

Verified in native Safari:

- The Drawer opens and a downward handle drag dismisses it.
- Focusing a reply opens the software keyboard and centers the comment card in the remaining visual viewport. Safari also scrolls the host page on focus; this check does not establish scroll preservation during keyboard opening.
- Native window scrolling hides indicators (`data-scrolling=true`, computed opacity 0), then restores them after scrolling ends. Recorded scrollY changed from 76 to 187 to 240; visual viewport height changed from 714 to 754 as browser chrome collapsed.
- Closing the Drawer restores root/body backgrounds, theme metadata, scroll locks, and hidden state in the DOM. Safari's status strip nevertheless retains the overlay tint. The preview also exhibited a retained dark bottom region, while the synthetic fixture's bottom region restored correctly.

An isolated experiment delaying color restoration until 400ms after dismissal did not fix the retained status tint. No timing workaround was added to the package. A second isolated fixture omitted the root background tint: Safari still tinted the status strip while open, but its close gesture was not reliably delivered, so restoration in that variant is unverified. Neither experiment changed package source. The candidate is not being declared fully verified.

Remaining native checks: new-comment software keyboard, dismissal by pulling comment content at list start, and continuous toolbar animation quality. A later control attempt failed its foreground-window safety check, so raw input stopped rather than risk interacting with the user's other app. The reply keyboard result does not substitute for the untested new-comment case.
