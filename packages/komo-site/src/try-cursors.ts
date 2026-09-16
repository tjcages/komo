type Point = { x: number; y: number };

// Sample once, then let the browser animate transforms without a JS frame loop.
export function createTryCursors(block: HTMLElement) {
  const tracks = [...block.querySelectorAll<HTMLElement>(".try-cursor-track")];
  let animations: Animation[] = [];
  let playing = false;
  let size = "";
  const starts: Point[] = [
    { x: 0.09, y: 0.18 },
    { x: 0.76, y: 0.72 },
    { x: 0.17, y: 0.65 },
  ];
  const rebuild = (width: number, height: number) => {
    if (!width || !height || size === `${width}:${height}`) return;
    size = `${width}:${height}`;
    const times = animations.map((animation) =>
      Number(animation.currentTime ?? 0),
    );
    animations.forEach((animation) => animation.cancel());
    animations = [];
    tracks.forEach((track, index) => {
      const pointer = track.querySelector<HTMLElement>(
        ".agent-cursor > .glyph",
      );
      if (!pointer) return;
      let seed = 73 + index * 191;
      const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const points = [starts[index % starts.length]];
      for (let i = 0; i < 9; i++) {
        const previous = points.at(-1)!;
        // Alternate broad gestures with the small corrections people make at a target.
        points.push(
          i % 3 === 1
            ? {
                x: Math.max(
                  0.07,
                  Math.min(0.86, previous.x + (random() - 0.5) * 0.1),
                ),
                y: Math.max(
                  0.12,
                  Math.min(0.8, previous.y + (random() - 0.5) * 0.14),
                ),
              }
            : { x: 0.07 + random() * 0.79, y: 0.12 + random() * 0.68 },
        );
      }
      points.push(points[0]);
      const frames: { point: Point; angle: number; time: number }[] = [];
      let time = 0;
      let angle = 0;
      let firstAngle = 0;
      const turn = (target: number) =>
        angle + ((((target - angle + 180) % 360) + 360) % 360) - 180;

      const add = (point: Point) => frames.push({ point, angle, time });
      for (let leg = 0; leg < points.length - 1; leg++) {
        const from = points[leg],
          to = points[leg + 1];
        const dx = to.x - from.x,
          dy = to.y - from.y;
        const bend = (random() - 0.5) * 0.55;
        const a = {
          x: from.x + dx * 0.3 - dy * bend,
          y: from.y + dy * 0.3 + dx * bend,
        };
        const b = {
          x: from.x + dx * 0.75 - dy * bend * 0.4,
          y: from.y + dy * 0.75 + dx * bend * 0.4,
        };
        const heading = (x: number, y: number) =>
          (Math.atan2(y * height, x * width) * 180) / Math.PI + 135;
        if (!leg) {
          angle = heading(a.x - from.x, a.y - from.y);
          firstAngle = angle;
          add(from);
        }
        time += 260 + random() * 850;
        add(from);
        // Turn during the pause so the pointer leads the next gesture.
        time += 160;
        angle = turn(heading(a.x - from.x, a.y - from.y));
        add(from);
        const duration =
          380 + Math.hypot(dx * width, dy * height) * 1.65 + random() * 220;
        const startTime = time;
        for (let step = 1; step <= 40; step++) {
          const progress = step / 40;
          const t = progress * progress * (3 - 2 * progress),
            u = 1 - t;
          const point = {
            x:
              u ** 3 * from.x +
              3 * u * u * t * a.x +
              3 * u * t * t * b.x +
              t ** 3 * to.x,
            y:
              u ** 3 * from.y +
              3 * u * u * t * a.y +
              3 * u * t * t * b.y +
              t ** 3 * to.y,
          };
          angle = turn(
            heading(
              u * u * (a.x - from.x) +
                2 * u * t * (b.x - a.x) +
                t * t * (to.x - b.x),
              u * u * (a.y - from.y) +
                2 * u * t * (b.y - a.y) +
                t * t * (to.y - b.y),
            ),
          );
          time = startTime + duration * progress;
          add(point);
        }
      }
      time += 500;
      add(points[0]);
      time += 220;
      angle = turn(firstAngle);
      add(points[0]);
      const positions = frames.map((frame) => ({
        offset: frame.time / time,
        transform: `translate(${frame.point.x * 100}%, ${frame.point.y * 100}%)`,
      }));
      const rotations = frames.map((frame) => ({
        offset: frame.time / time,
        transform: `rotate(${frame.angle}deg)`,
      }));
      const movement = track.animate(positions, {
        duration: time,
        iterations: Infinity,
      });
      const rotation = pointer.animate(rotations, {
        duration: time,
        iterations: Infinity,
      });
      for (const animation of [movement, rotation]) {
        animation.currentTime = times[animations.length] ?? index * 2400;
        if (!playing) animation.pause();
        animations.push(animation);
      }
    });
  };
  new ResizeObserver(([entry]) => {
    if (entry) rebuild(block.clientWidth, block.clientHeight);
  }).observe(block);
  return {
    setPlaying(value: boolean) {
      playing = value;
      animations.forEach((animation) =>
        value ? animation.play() : animation.pause(),
      );
    },
  };
}
