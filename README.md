# Trade Show Digital Spin Wheel (V3)

A dependency-free web app to gamify prospect capture at events.

## What it does

- Attendee scans a QR code and lands on the player page.
- Attendee submits configurable lead fields (name/phone/email by default).
- Attendee spins a digital prize wheel.
- Win result is recorded with the captured lead.
- Admin page configures copy, theme, form fields, prize odds/inventory, wheel behavior, and QR link.
- Admin page includes franchise location and address fields for booth-specific branding.
- Multi-franchise mode: each franchise has isolated configuration and lead storage.
- Admin includes a participant lookup table to see who won which prize.
- Leads can be exported as CSV.

## Files

- `/Users/kunalshah/AI/wheel/index.html` - player experience
- `/Users/kunalshah/AI/wheel/admin.html` - admin configuration console
- `/Users/kunalshah/AI/wheel/shared.js` - config and lead persistence, weighted prize logic
- `/Users/kunalshah/AI/wheel/player.js` - lead capture + wheel animation + win flow
- `/Users/kunalshah/AI/wheel/admin.js` - full configuration UI + QR + CSV export
- `/Users/kunalshah/AI/wheel/styles.css` - UI styling
- `/Users/kunalshah/AI/wheel/assets/degree-logo.svg` - v2 logo asset
- `/Users/kunalshah/AI/wheel/versions/v1` - saved v1 snapshot
- `/Users/kunalshah/AI/wheel/versions/v2` - saved v2 snapshot
- `/Users/kunalshah/AI/wheel/versions/v3` - saved v3 snapshot

## Run locally

From the project root:

```bash
node server.js
```

Then open:

- Player: `http://localhost:8080/index.html`
- Admin: `http://localhost:8080/admin.html`

This server writes franchise lead files to:

- `/Users/kunalshah/AI/wheel/data/leads/<franchise-id>.json`
- `/Users/kunalshah/AI/wheel/data/configs/<franchise-id>.json` (admin settings per franchise)

On Railway, data is written under `/app/data` by default (mount your persistent volume there):

- `/app/data/leads/<franchise-id>.json`
- `/app/data/configs/<franchise-id>.json`

## Configuration model

All settings are persisted in browser local storage and can be changed from Admin:

- Event badge, headline, subheadline
- Franchise location and address
- Theme colors
- Lead fields (label/type/required/enabled)
- Prize list (name/weight/inventory/color)
- Wheel spin duration and rotation range
- Wheel style colors (pointer, labels, separators, center)
- Public URL used for QR generation

## Multi-user / multi-franchise usage

- Every franchise uses a unique URL query parameter: `?franchise=<id>`.
- Example player URL: `http://localhost:8080/index.html?franchise=houston-west`
- Example admin URL: `http://localhost:8080/admin.html?franchise=houston-west`
- Admin can create and switch franchise workspaces from the `Franchise Workspace` card.
- Leads are stored and exported separately per franchise ID.
- Each franchise lead list is also persisted to its own JSON file in `data/leads`.
- The full admin configuration for each franchise is persisted separately in `data/configs`.

## Notes

- QR image generation uses `api.qrserver.com`.
- Lead data is stored per browser in local storage. For production multi-device syncing, connect this UI to a backend database/API.
