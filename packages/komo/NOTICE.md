# Morphing menu source

`src/MorphingMenu.tsx` (compiled into the shared `dist` chunks) and `src/morphing-menu-styles.ts` use the copyable component and CSS published by Danny Williams at https://dannyjpwilliams.com/playground/morphing-menu/, retrieved 2026-09-15. The page explicitly instructs users to copy these files and customize the actions. Credit for that component remains with Danny Williams.

Local changes: CSS injection into Shadow DOM, composed-path outside-click detection, review-specific actions and appearance.

## Icons

Review icons use the official `@untitledui/icons` package from https://github.com/untitleduico/icons. The dependency supplies the original SVG artwork. No icon artwork is copied into this package.

## Interaction reference

Component highlighting, compact growing composers, pin previews, and target-aware feedback copying were informed by Mesurer (https://github.com/ibelick/mesurer), by Julien Thibeaut, reviewed at version 0.1.5. These interactions are implemented here against the shared comments API and use Untitled UI icons.

## Floating drag and edge snapping

`src/floating-drag.ts` and `resizeEdgeBox` adapt the gesture geometry, velocity smoothing, edge thresholds, and edge resize from https://github.com/tjcages/panels (`src/hooks/use-drag-resize.ts`).

The edge sidebar (`sidebar: "edge"`) reuses that drag math and follows the panels floating-panel pattern: a panel that docks to a viewport edge, parks off-screen while closed, and peeks out at the edge while collapsed (`src/edge-sidebar.ts` and the `--edge-park-x` / `--edge-peek-x` offsets). The open animation is the drawer expand: the same compress-then-spring, with the comment rows staggering in. The drawer stays at the bottom of the sidebar as tabs. The account dialog sits inside that panel, inset from the sides and top, with no scrim. Background mode keeps the viewport account column and overlay.

MIT License

Copyright (c) 2026 tjcages

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Bundled dependencies

The production build includes selected Motion and picker modules. Their original licenses are collected in `dist/THIRD_PARTY_NOTICES.txt`. React and the official icon package remain external dependencies.
