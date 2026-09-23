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

## Scroll and entrance follow-up

After owner testing of the older Worker preview found scrolling and Drawer entrance unacceptable, a new candidate removes the expensive fade mask from the mobile comment scroller and skips page geometry updates for scrolls inside the widget. The mobile toolbar is absolute within the overlay, without a lagging height transition when Safari changes its visual viewport. The sheet uses a shorter transform animation; its backdrop now fades with the sheet and remains visible until dismissal finishes. The Drawer no longer changes the page's theme metadata or root background, and locks body scrolling without changing the root overflow. This is intended to avoid Safari chrome tint retention and layout shifts, but needs owner device verification.

Computer-use attachment to Device Hub repeatedly failed with `Computer Use server error -10005: timeoutReached`, including after Device Hub and Codex relaunch and an exact bundle-ID attempt. No native verification of this candidate is claimed.

## Composited pull gesture follow-up

The owner found downward dragging laggy on the new Worker preview. The gesture handler was reading `sheet.offsetHeight` after writing its transform on every move, which can force synchronous layout. It now measures height once at gesture start, writes `translate3d` and backdrop opacity during movement, and uses the cached height for dismissal. The non-passive `touchmove` handler attaches only for a possible downward pull when the comment list is at its top, leaving ordinary list scrolling native. The sheet and backdrop advertise their composited properties with `will-change`. This follows the relevant drag approach in Vaul's `src/index.tsx` without adding Vaul to the bundle. Native iOS feel remains for owner verification while Device Hub attachment is unavailable.

The owner reported no perceived improvement on that preview and clarified that the lag is during finger tracking; the release animation is acceptable. Safari's bottom controls also resize the visual viewport and move the toolbar. The next candidate keeps the fixed overlay at layout-viewport height, then updates only the sheet and toolbar's individual `translate` property to follow the visual viewport bottom. This avoids relaying out the entire sheet and toolbar as the browser controls collapse. Device validation is still required.

## Vaul gesture follow-up

The owner confirmed the toolbar now follows Safari's resizing controls smoothly, but dragging the Drawer still lags at the handle and at the top of the comments. The Drawer now uses Vaul's pointer method: capture at press, a 10px touch direction threshold, a scrollable-ancestor check before granting the drag, and direct `translate3d` updates with transition disabled for each pointer move. Like Vaul without snap points, dragging writes only the Drawer transform; the overlay fades on open and close. Opening, cancelled drags, and dismissal settle with Vaul's 500ms transform easing. The sheet uses `touch-action: none`; the comment list retains `touch-action: pan-y`. This replaces the separate touch and pointer gesture handlers and the Web Animations path. Vaul itself is not imported because its React and Radix dependencies cannot fit this vanilla widget's browser bundle budget. The adapted method and MIT license are credited in `packages/komo/NOTICE.md`.

The previous CSS `translate` positioning that made the toolbar track Safari's viewport remains unchanged. The owner must verify Drawer finger tracking on the next Worker preview; automated pointer tests establish the gesture state and scroll guard, not native iOS smoothness.

Local validation: build and typecheck passed; all 208 tests passed. Initial gzip is 96,829 bytes and all-features gzip is 195,781 bytes, below the unchanged 196,000-byte limit.
