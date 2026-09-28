# Ward Organization Chart

A small Angular + Express app for managing the leadership and auxiliary presidencies of an LDS ward.
It is meant to run on a screen in the bishop's office (desktop layout) and on phones (mobile layout).

## Features

- **Organizations**: the app can hold several wards or branches. The root URL opens the default
  organization. A small text menu in the top-right corner switches between organizations, creates a
  new one, or locks the current one.
- **PIN protection**: every organization has a five-letter PIN. It must be entered before any of that
  organization's data is requested. A correct PIN yields a signed token (JWT) that the device keeps
  for 30 days; "Lock" in the corner menu forgets it. PINs are stored only as scrypt hashes and are
  never sent to clients. Guessing is throttled per organization and per client address.
- **Full chart** (`/o/:orgId`): every presidency at a glance. Names can be edited right on the chart:
  tap a name to change it (clear it to remove it), or tap "+ Add name" under a position to propose
  someone. Tap a presidency's title (marked with a chevron) to open the focused view. The display
  polls the server every 10 seconds so edits made from a phone show up on the office screen.
- **Focused presidency** (`/o/:orgId/edit/:id`): large type for the office screen, plus the actions
  that need more room. Each position (President, First Counselor, Second Counselor, Secretary) has a
  primary spot plus a list of proposed names.
  - Add as many proposed names as you like.
  - **Consider** promotes a proposed name into the primary spot (status *Considered*). Whoever was
    there moves back to the top of the proposed list.
  - Set the primary spot's status: **Considered** (yellow), **Agreed** (blue), **Called** (light green),
    **Sustained** (dark green), **Set Apart** (dark green with a check mark).
  - Edit a name, move it back to proposed, or remove it. Every change saves immediately.
- Data is stored as JSON on the server under `data/` and survives restarts.

## Running

```bash
npm install
npm run build        # builds the Angular app into dist/
npm start            # serves the app and API on http://localhost:3000
```

Environment variables (see `.env.example`):

| Variable           | Default            | Purpose                                                        |
| ------------------ | ------------------ | -------------------------------------------------------------- |
| `PORT`             | `3000`             | HTTP port                                                      |
| `HOST`             | `0.0.0.0`          | Bind address                                                   |
| `DATA_DIR`         | `./data`           | Directory that holds all data                                  |
| `DEFAULT_ORG_NAME` | `Summerfield Ward` | Name of the organization created on first start                |
| `DEFAULT_ORG_PIN`  | random, logged     | Five-letter PIN of that organization (read on first start only) |
| `JWT_SECRET`       | generated          | Token signing secret; generated into `data/jwt-secret` if unset |
| `TOKEN_TTL_DAYS`   | `30`               | How long an entered PIN stays valid on a device                |
| `TRUST_PROXY`      | `1`                | Number of reverse proxies in front of the app (for rate limiting) |

On first start the server creates the default organization with an empty chart from
`server/seed.json`. If `DEFAULT_ORG_PIN` is not set, a random PIN is generated and printed to the
server log once. The PIN is never written anywhere in plain text, so if it is lost, delete the
organization's entry from `data/orgs.json` and restart (its chart file is kept).

To back up, copy the `data/` directory. To reset everything, stop the server and delete it.

## Development

```bash
npm run dev          # Express on :3000 with auto-reload + Angular dev server on :4200 (proxies /api)
npm test             # unit tests (vitest)
```

## API

Routes under `/api/orgs/:orgId/` other than `login` require `Authorization: Bearer <token>` for that
organization.

| Method | Path                                  | Auth        | Description                                   |
| ------ | ------------------------------------- | ----------- | --------------------------------------------- |
| GET    | `/api/orgs`                           | none        | Organization ids and names, plus the default   |
| POST   | `/api/orgs`                           | any org     | Create `{ name, pin }`; returns org and token  |
| POST   | `/api/orgs/:orgId/login`              | none        | `{ pin }` → `{ token, expiresAt }`              |
| GET    | `/api/orgs/:orgId/chart`              | that org    | Whole chart                                   |
| PUT    | `/api/orgs/:orgId/presidencies/:id`   | that org    | Replace one presidency; returns whole chart   |

## Customizing the presidencies

Edit `server/seed.json` before creating an organization (or `data/charts/<org-id>.json` afterwards).
Each presidency has an `id`, `name`, `row` (1 = top row, 2 = the auxiliaries row) and exactly four
positions with keys `president`, `first`, `second`, `secretary`. Position titles are free text, which
is how the Bishopric shows "Bishop" and "Executive Secretary".

## Deploying on the cooperplanet webhost

The app runs as a single container on the `10.42.12.0/24` subnet at `10.42.12.20`, which
the webhost nginx proxies as `https://orgchart.cooperplanet.com`. See
`docs/adding-a-service.md` in the `cooperplanet/webhost` repo for the overall pattern.

On the server, from a checkout of this repo:

```bash
docker compose up -d --build
```

Before the first start, copy `.env.example` to `.env` next to `compose.yml` and set
`DEFAULT_ORG_PIN` (and `DEFAULT_ORG_NAME` if different). The container listens on port 80 and keeps
its data in the `./data` directory next to `compose.yml`, so it survives rebuilds and restarts. Back
it up by copying that directory.
