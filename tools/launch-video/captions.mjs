import { writeFile } from "node:fs/promises";
const cues = [
  [0, 3, "Website feedback, right where it belongs."],
  [3, 7.5, "Point at the headline. “Give it more room to breathe.”"],
  [7.5, 10, "A second reviewer: “Make the primary button easier to find.”"],
  [10, 15, "Reply and react. Keep the conversation in context."],
  [15, 20, "Move the drawer, open all comments, and copy the feedback."],
  [
    20,
    26,
    "Paste the context into your coding agent. The agent edits the code.",
  ],
  [
    26,
    30,
    "The headline gets more space. The primary button gets a lavender fill.",
  ],
  [
    30,
    35,
    "Verify the changes, reply with the result, and resolve the feedback.",
  ],
  [35, 42, "Install komo. Get your project key with komo init. komo.offbr.co"],
];
const stamp = (t) =>
  `00:${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")},${String(Math.round((t % 1) * 1000)).padStart(3, "0")}`;
await writeFile(
  new URL("../../docs/launch/captions.srt", import.meta.url),
  cues
    .map(([a, b, s], i) => `${i + 1}\n${stamp(a)} --> ${stamp(b)}\n${s}\n`)
    .join("\n"),
);
await writeFile(
  new URL("../../docs/launch/transcript.md", import.meta.url),
  "# Launch film transcript\n\nSilent-first, 42 seconds. The captions describe the choreographed fixture demonstration; there is no voiceover.\n\n" +
    cues.map(([a, b, s]) => `- **${a}–${b}s:** ${s}`).join("\n") +
    "\n",
);
