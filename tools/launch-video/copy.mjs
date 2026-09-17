import { readFile, writeFile } from "node:fs/promises";
const url = new URL("../../docs/launch/copy.json", import.meta.url),
  data = JSON.parse(await readFile(url));
// All non-URL characters here have X weight 1; URLs count as 23 after t.co wrapping.
const count = (s) => [...s.replace(/https?:\/\/\S+/g, "x".repeat(23))].length;
let md =
  "# Launch copy\n\nDrafts for approval. Nothing has been posted. Counts use 23 characters per URL (t.co) and count line breaks. No emoji or CJK characters are used.\n\n";
for (const [section, posts] of Object.entries(data)) {
  md += `## ${section}\n\n`;
  posts.forEach((post, i) => {
    const text = typeof post === "string" ? post : post.text;
    const n = count(text);
    if (n > 280) throw Error(`${section} ${i + 1}: ${n}`);
    md += `### ${i + 1}. ${post.audience || post.topic || "Thread post"} (${n}/280)\n\n${text}\n\n`;
    console.log(section, i + 1, n);
  });
}
md +=
  "## Claim checks\n\nFeatures and setup: README.md and packages/komo/src/types.ts. Hosted caps and reply accounting: packages/komo/server/workspaces.ts and server/index.ts. React claim requires published 0.4.0. “Public beta” is launch-day copy, subject to the owner’s go/no-go. Google branding approval is not claimed.\n";
await writeFile(new URL("../../docs/launch/copy.md", import.meta.url), md);
