# Launch copy

Drafts for approval. Nothing has been posted. Counts use 23 characters per URL (t.co) and count line breaks. No emoji or CJK characters are used.

## standalone

### 1. general (221/280)

I made komo for the "which button?" part of website feedback.

Point at an element, leave a comment, discuss it there, and copy the context into your coding agent.

The public beta is ready to try: https://komo.offbr.co

### 2. developer (229/280)

Shipping a preview? Put the feedback on the page.

komo gives you anchored comments, replies, reactions, and a CLI your coding agent can use to read and resolve feedback. React hook included.

Public beta: https://komo.offbr.co

### 3. designer (217/280)

"A little more space here."

With komo, "here" is an actual place on your website. Point at an element or mark an area, leave feedback, and keep the conversation attached.

Try the public beta: https://komo.offbr.co

## thread

### 1. Thread post (161/280)

komo is in public beta.

It puts comments on your website so feedback stays attached to the thing you’re talking about.

Here’s the loop: https://komo.offbr.co

### 2. Thread post (217/280)

Point at an element or mark an area. Leave a comment. Reply, react, and resolve it when the work is checked.

Reviewers can use Google or leave a guest name. You can keep projects private with invited Google accounts.

### 3. Thread post (218/280)

When it’s time to make the change, copy open feedback into your coding agent. The prompt includes page and element context.

There’s a CLI too. The agent edits your code; komo carries the feedback and the conversation.

### 4. Thread post (200/280)

Install @tjcages/komo, then run its init command for a project key. Use initKomo, or useKomo in React.

Use the hosted starter or self-host on Cloudflare. Docs and a live demo: https://komo.offbr.co/install/

## replies

### 1. React (204/280)

React 18.2 and 19 are supported. Import useKomo from @tjcages/komo/react and call it once near your app root with the project key from setup. The hook handles mounting and cleanup. https://komo.offbr.co/install/

### 2. agent handoff (225/280)

Copying feedback doesn’t run an agent. Paste the prompt into the agent you use, or give it the komo CLI workflow. It reads the feedback, edits your code, verifies the result, then replies and resolves. https://komo.offbr.co/agent-prompts/

### 3. hosting (192/280)

The hosted starter allows 3 projects per owner and 250 stored comments per project, including replies. You can also self-host on Cloudflare; its limits and costs apply. https://komo.offbr.co/hosting/

### 4. scope (231/280)

Feedback is shared across deployments of a project by default. Branch isolation is optional. Your public project key identifies the project; approved sites and project access settings control who can use it. https://komo.offbr.co/configuration/

## Claim checks

Features and setup: README.md and packages/komo/src/types.ts. Hosted caps and reply accounting: packages/komo/server/workspaces.ts and server/index.ts. React claim requires published 0.4.0. “Public beta” is launch-day copy, subject to the owner’s go/no-go. Google branding approval is not claimed.
