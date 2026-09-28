# Ward Organization Chart

A small Angular + Express app for managing the leadership and auxiliary presidencies of an LDS ward.
It is meant to run on a screen in the bishop's office (desktop layout) and on phones (mobile layout).

## Features

- **Full chart** (`/`): read-only view of every presidency. Tap or click a presidency to edit it.
  The display polls the server every 10 seconds so edits made from a phone show up on the office screen.
- **Edit a presidency** (`/org/:id`): each position (President, First Counselor, Second Counselor,
  Secretary) has a primary spot plus a list of proposed names.
  - Add as many proposed names as you like.
  - **Consider** promotes a proposed name into the primary spot (status *Considered*). Whoever was
    there moves back to the top of the proposed list.
  - Set the primary spot's status: **Considered** (yellow), **Agreed** (blue), **Called** (light green),
    **Sustained** (dark green), **Set Apart** (dark green with a check mark).
  - Edit a name, move it back to proposed, or remove it. Every change saves immediately.
- Data is stored as JSON on the server in `data/chart.json` and survives restarts.

## Running

```bash
npm install
npm run build        # builds the Angular app into dist/
npm start            # serves the app and API on http://localhost:3000
```

Environment variables:

| Variable   | Default   | Purpose                                   |
| ---------- | --------- | ----------------------------------------- |
| `PORT`     | `3000`    | HTTP port                                 |
| `HOST`     | `0.0.0.0` | Bind address                              |
| `DATA_DIR` | `./data`  | Directory that holds `chart.json`         |

On first start the server copies `server/seed.json` (empty presidencies) to `data/chart.json`.
To reset, stop the server and delete `data/chart.json`. To back up, copy that file.

## Development

```bash
npm run dev          # Express on :3000 with auto-reload + Angular dev server on :4200 (proxies /api)
npm test             # unit tests (vitest)
```

## API

| Method | Path                     | Description                                   |
| ------ | ------------------------ | --------------------------------------------- |
| GET    | `/api/chart`             | Whole chart                                   |
| PUT    | `/api/organizations/:id` | Replace one organization; returns whole chart |
| PUT    | `/api/chart`             | Replace the whole chart (restore a backup)    |

## Customizing the organizations

Edit `server/seed.json` before first start (or `data/chart.json` afterwards). Each organization has an
`id`, `name`, `row` (1 = top row, 2 = the auxiliaries row) and exactly four positions with keys
`president`, `first`, `second`, `secretary`. Position titles are free text, which is how the Bishopric
shows "Bishop" and "Executive Secretary".
