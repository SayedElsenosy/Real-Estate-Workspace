# ELAF Sales Hub: isolated cloud browser

This directory contains the backend only. It is deployed on Render from branch `elaf-sales-cloud-browser`, separate from the site's Vercel frontend and separate from the existing CRM code.

Only the Vercel authenticated server-side proxy may call it, using the `x-hub-key` header. Browser cookies/storage state are AES-256-GCM encrypted and stored in the separate Neon project `elaf-sales-hub-sessions`. Passwords and screenshots are not persisted. The user enters login credentials into the remote Chrome session and explicitly clicks "Verify and save". The frontend must never log submitted keystrokes or the screenshots.

Required environment variables:
- `DATABASE_URL` — dedicated project connection string (do not reuse BUNYRA).
- `SESSION_ENCRYPTION_KEY` — 32-byte hex AES encryption key.
- `HUB_BRIDGE_SECRET` — 32+ character random shared secret for Vercel / Render backend requests.
- `PORT` set by Render.

API (all POST routes except /health require x-hub-key):
POST /api/engaz with action start, view, click, type, key, scroll, finish, status, disconnect.
Returns screenshot as JPEG data URL in view. No automated CRM changes or WhatsApp messages are implemented.

Render free service spins down after 15m idle and local state is ephemeral; encrypted storageState survives in Neon, but free instance is for a test only, not 24/7 production. Use a never-sleep service plan for continuous automation after obtaining user approval for additional charges.

This is a separate feature branch; no existing production branch files are modified.
