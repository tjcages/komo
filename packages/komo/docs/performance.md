# Performance audit — 2026-09-16

Historical measurement at baseline commit `95fa3c83`. These figures are not current package sizes or current build limits. All functionality and animation paths remained available in the measured revision.

## Size

Production ESM consumer build, esbuild splitting enabled; decimal bytes. Initial transfer includes static imports; optional chunks load on demand.

| Metric | Before | After |
| --- | ---: | ---: |
| Initial JavaScript, gzip | 195,045 | 160,203 |
| Initial JavaScript, Brotli | 171,087 | 138,944 |
| All JavaScript, gzip | 208,345 | 178,817 |
| npm archive | 347,950 | 341,808 |
| Installed dependencies, KiB | 41,552 | 28,852 |

The historical install comparison used the same package artifact with and without three former runtime dependencies. This isolated their disk cost at the time: 30.6% less. The archive was 1.8% smaller; unpacked package size was approximately unchanged. The current package declares React and React DOM as peers, and the official icon package as a development dependency. Read `package.json` and run the size command for the current package.

The accent picker loads on demand. CSS and published JavaScript are minified. Motion and picker code ship as bundled chunks, avoiding installation of their full development trees. Bundled dependency licenses ship in `dist/THIRD_PARTY_NOTICES.txt`. Icons still come from the official dependency.

## Runtime

Synthetic desktop browser workload: 1280 × 900, 5,000 DOM rows, 250 open threads with long bodies, 100 text mutations per frame, 180 frames after a two-second warmup. No server writes. One run per configuration; frame intervals include host work and browser scheduling, not just komo CPU time.

| Metric | Before | After |
| --- | ---: | ---: |
| Mean frame interval | 120.45 ms | 12.37 ms |
| Worst frame interval | 932.6 ms | 17.7 ms |
| Selector queries during measurement | 44,500 | 0 |
| Occlusion hit tests | 22,250 | 2,581 |

With no comments, komo made no geometry reads, selector queries, or hit tests during the mutation workload. Mean frame interval was 8.28 ms, compared with 8.25 ms without komo.

Changes remove repeated full-thread serialization, cache connected anchor elements, skip offscreen hit tests, coalesce pointer work, avoid duplicate refresh renders, and pause mutation observation in background tabs. Static icons no longer create temporary React roots.

These results are not Core Web Vitals or a guarantee of negligible overhead on every device. Real iOS Safari, Firefox, low-end Android, memory profiling, and long-session testing remain release validation work. Large visible thread counts still require geometry work.

## Reproduce

```sh
pnpm --filter @tjcages/komo build
pnpm --filter @tjcages/komo size
pnpm --filter @tjcages/komo bench
```

Open the benchmark URL printed by the final command. Use `?mode=none` for the host-only control and `?mode=after&comments=0` for an empty project. To compare an older production ESM bundle, set `KOMO_BENCH_BASELINE` to its directory containing `index.js` and use `?mode=before`. Keep viewport, browser, hardware, and foreground state identical.

The current size command fails above 104,000 gzip bytes initially or 202,000 across all feature chunks. These budgets make future growth explicit. Benchmark files and build tooling do not ship in the npm archive.
