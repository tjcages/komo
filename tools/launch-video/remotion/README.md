# komo — 14-second Remotion promo

A new component-vignette cut; the previous `/launch-demo/` remains available.

Claim: leave feedback anywhere on a website and carry its context to an agent.
Proof: pins become a conversation, comments collect in the sidebar, and the drawer's copy action leads to a prompt.

| Seconds | Shot |
| --- | --- |
| 0–2.2 | Opacity-staggered “Leave feedback anywhere.”, two native pins, cursor click |
| 2.2–4.4 | Native conversation, typed replies and reaction |
| 4.4–6.5 | Sidebar opens; eight new comments displace four existing comments |
| 6.5–8.5 | Centered drawer compresses and expands |
| 8.5–9.7 | Macro copy action and confirmation |
| 9.7–11.5 | Abstract agent prompt bar receives feedback excerpts |
| 11.5–14 | Actual komo SVG letters bounce, URL holds, fade |

## Source and rendering

Runtime is a sibling directory, outside the package workspace. Requires the owner's purchased `product-video` skills in `.agents/skills` (excluded from Git), Node 22+, and npm. Their helper source is not redistributed here. All Remotion packages are pinned to 4.0.484.

```sh
node tools/launch-video/remotion/setup.mjs
cd ../komo-promo
npm ci
npx tsc --noEmit
npx remotion studio src/index.ts
node qc.mjs --flat=context,conversation,sidebar,drawer,agent,logo --wide=copy
node build.mjs
```

Output: `../komo-promo/out/film.mp4`. Seven independent scene compositions plus `komo-promo`, the full 420-frame timeline. `src/edit.json` controls cuts. The final scene is intentionally a logo vignette, not a workspace pull-back. No audio is included.

`native.json` contains fixture-only HTML emitted by the actual widget renderer, its stylesheet with wall-clock animation/transition declarations stripped, and the site's SVG logo. It contains no running product code, customer feedback, screenshots, or iframe. The stage retains native classes, icons, colors and controls; frame-driven wrappers provide composition and motion. The drawer samples Motion's pure spring generator at fixed frame times using the product's 400ms / 0.24 bounce parameters. Card motion uses the product's 600 stiffness / 34 damping. No live hooks, polling, portals, or production timers execute in the render.

The sidebar is framed on the native dark review surface. Prompt content is a concise fixture excerpt for readability, not a claim that an agent executed work. Opening title uses fade staggering (no slide). Drawer is absent from all unrelated scenes.

The native fixture was captured from the isolated existing demo at beats 5 (pins/toolbar), 14 (conversation), 46 (sidebar), and 55 (drawer), then reduced to the rendered elements. Refresh this fixture when the actual widget changes; do not redesign the UI inside the film.
