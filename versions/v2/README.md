# Trade Show Digital Spin Wheel

A dependency-free web app to gamify prospect capture at events.

## What it does

- Attendee scans a QR code and lands on the player page.
- Attendee submits configurable lead fields (name/phone/email by default).
- Attendee spins a digital prize wheel.
- Win result is recorded with the captured lead.
- Admin page configures copy, theme, form fields, prize odds/inventory, wheel behavior, and QR link.
- Leads can be exported as CSV.

## Files

- `/Users/kunalshah/AI/wheel/index.html` - player experience
- `/Users/kunalshah/AI/wheel/admin.html` - admin configuration console
- `/Users/kunalshah/AI/wheel/shared.js` - config and lead persistence, weighted prize logic
- `/Users/kunalshah/AI/wheel/player.js` - lead capture + wheel animation + win flow
- `/Users/kunalshah/AI/wheel/admin.js` - full configuration UI + QR + CSV export
- `/Users/kunalshah/AI/wheel/styles.css` - UI styling

## Run locally

From the project root:

```bash
python3 -m http.server 8080
```

Then open:

- Player: `http://localhost:8080/index.html`
- Admin: `http://localhost:8080/admin.html`

## Configuration model

All settings are persisted in browser local storage and can be changed from Admin:

- Event badge, headline, subheadline
- Theme colors
- Lead fields (label/type/required/enabled)
- Prize list (name/weight/inventory/color)
- Wheel spin duration and rotation range
- Public URL used for QR generation

## Notes

- QR image generation uses `api.qrserver.com`.
- Lead data is stored per browser in local storage. For production multi-device syncing, connect this UI to a backend database/API.
