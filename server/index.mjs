import express from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'chart.json');
const SEED_FILE = path.join(__dirname, 'seed.json');
const DIST_DIR = path.join(__dirname, '..', 'dist', 'org-chart', 'browser');

const STATUSES = new Set(['considered', 'agreed', 'called', 'sustained', 'setApart']);
const POSITION_KEYS = ['president', 'first', 'second', 'secretary'];

// ---------- persistence ----------

let queue = Promise.resolve();
/** Run file operations one at a time so concurrent saves never interleave. */
function serialized(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function readChart() {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    const seed = JSON.parse(await fs.readFile(SEED_FILE, 'utf8'));
    await writeChart(seed);
    return seed;
  }
}

async function writeChart(chart) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(chart, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, DATA_FILE);
}

// ---------- validation ----------

const isStr = (v, max = 200) => typeof v === 'string' && v.length <= max;

function validateCandidate(c) {
  return (
    c &&
    typeof c === 'object' &&
    isStr(c.id, 64) &&
    c.id.length > 0 &&
    isStr(c.name) &&
    c.name.trim().length > 0
  );
}

function validatePosition(p) {
  if (!p || typeof p !== 'object') return 'position must be an object';
  if (!POSITION_KEYS.includes(p.key)) return `unknown position key "${p.key}"`;
  if (!isStr(p.title) || !p.title.trim()) return 'position title required';
  if (p.primary !== null) {
    if (!validateCandidate(p.primary)) return 'invalid primary candidate';
    if (!STATUSES.has(p.primary.status)) return `invalid status "${p.primary.status}"`;
  }
  if (!Array.isArray(p.proposed) || p.proposed.length > 50) return 'proposed must be an array';
  if (!p.proposed.every(validateCandidate)) return 'invalid proposed candidate';
  return null;
}

function validateOrganization(org) {
  if (!org || typeof org !== 'object') return 'organization must be an object';
  if (!isStr(org.id, 64) || !org.id) return 'organization id required';
  if (!isStr(org.name) || !org.name.trim()) return 'organization name required';
  if (typeof org.row !== 'number') return 'organization row must be a number';
  if (!Array.isArray(org.positions) || org.positions.length !== POSITION_KEYS.length) {
    return `organization must have exactly ${POSITION_KEYS.length} positions`;
  }
  for (const p of org.positions) {
    const err = validatePosition(p);
    if (err) return err;
  }
  return null;
}

// ---------- app ----------

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.get('/api/chart', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await serialized(readChart));
  } catch (err) {
    next(err);
  }
});

app.put('/api/organizations/:id', async (req, res, next) => {
  try {
    const org = req.body;
    const err = validateOrganization(org);
    if (err) return res.status(400).json({ error: err });
    if (org.id !== req.params.id) return res.status(400).json({ error: 'id mismatch' });

    const chart = await serialized(async () => {
      const chart = await readChart();
      const idx = chart.organizations.findIndex((o) => o.id === org.id);
      if (idx === -1) return null;
      chart.organizations[idx] = org;
      chart.updatedAt = new Date().toISOString();
      await writeChart(chart);
      return chart;
    });
    if (!chart) return res.status(404).json({ error: 'organization not found' });
    res.json(chart);
  } catch (err) {
    next(err);
  }
});

// Full replace: handy for restoring a backup of data/chart.json.
app.put('/api/chart', async (req, res, next) => {
  try {
    const chart = req.body;
    if (!chart || !Array.isArray(chart.organizations)) {
      return res.status(400).json({ error: 'chart.organizations must be an array' });
    }
    for (const org of chart.organizations) {
      const err = validateOrganization(org);
      if (err) return res.status(400).json({ error: err });
    }
    chart.updatedAt = new Date().toISOString();
    await serialized(() => writeChart(chart));
    res.json(chart);
  } catch (err) {
    next(err);
  }
});

// Serve the built Angular app (run `npm run build` first).
app.use(express.static(DIST_DIR, { index: false, maxAge: '1h' }));
app.get('/{*splat}', async (req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
  try {
    await fs.access(path.join(DIST_DIR, 'index.html'));
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  } catch {
    res
      .status(503)
      .type('text')
      .send('Angular build not found. Run `npm run build` and restart the server.');
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

app.listen(PORT, HOST, () => {
  console.log(`Org chart server listening on http://${HOST}:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});
