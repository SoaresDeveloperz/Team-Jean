---
name: Next.js preview origins
description: Configure allowedDevOrigins for Next.js apps served through nested Replit preview hosts.
---

For Next.js development on Replit, the preview host can be nested, such as `<id>.riker.replit.dev`. A generic `*.replit.dev` entry did not match this host; include the runtime `REPLIT_DEV_DOMAIN` in `allowedDevOrigins`.

**Why:** The generic wildcard still produced blocked `/_next/hmr` warnings. Testing the exact preview origin after adding the runtime domain returned a successful WebSocket upgrade.

**How to apply:** When Next.js reports cross-origin blocking in a Replit preview, add `process.env.REPLIT_DEV_DOMAIN` to `allowedDevOrigins` and verify the exact origin rather than relying on a one-level wildcard.