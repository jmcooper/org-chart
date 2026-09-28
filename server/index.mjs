import express from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LoginLimiter,
  TokenService,
  bearerToken,
  hashPin,
  loadJwtSecret,
  normalizePin,
  randomPin,
  verifyPin,
} from './auth.mjs';
import { Store } from './store.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const SEED_FILE = path.join(__dirname, 'seed.json');
const DIST_DIR = path.join(__dirname, '..', 'dist', 'org-chart', 'browser');
const TOKEN_TTL_DAYS = Number(process.env.TOKEN_TTL_DAYS) || 30;
const DEFAULT_ORG_NAME = process.env.DEFAULT_ORG_NAME || 'Summerfield Ward';

const STATUSES = new Set(['considered', 'agreed', 'called', 'sustained', 'setApart']);
const POSITION_KEYS = ['president', 'first', 'second', 'secretary'];
const MAX_ORGS = 200;

const store = new Store(DATA_DIR, SEED_FILE);
const tokens = new TokenService(await loadJwtSecret(DATA_DIR), TOKEN_TTL_DAYS);
const limiter = new LoginLimiter();

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

function validatePresidency(pres) {
  if (!pres || typeof pres !== 'object') return 'presidency must be an object';
  if (!isStr(pres.id, 64) || !pres.id) return 'presidency id required';
  if (!isStr(pres.name) || !pres.name.trim()) return 'presidency name required';
  if (typeof pres.row !== 'number') return 'presidency row must be a number';
  if (!Array.isArray(pres.positions) || pres.positions.length !== POSITION_KEYS.length) {
    return `presidency must have exactly ${POSITION_KEYS.length} positions`;
  }
  for (const p of pres.positions) {
    const err = validatePosition(p);
    if (err) return err;
  }
  return null;
}

function normalizeOrgName(input) {
  if (typeof input !== 'string') return null;
  const name = input.trim().replace(/\s+/g, ' ');
  return name.length >= 1 && name.length <= 60 ? name : null;
}

// ---------- organizations ----------

/** Soft-deleted organizations stay in orgs.json (restorable by hand) but are invisible to the API. */
const visibleOrgs = (registry) => registry.orgs.filter((o) => o.deleted !== true);
const findVisible = (registry, id) => visibleOrgs(registry).find((o) => o.id === id);

/** What clients are allowed to see about an organization. Never the pin hash. */
const publicOrg = (org) => ({ id: org.id, name: org.name, archived: org.archived === true });

function slugFor(name, taken) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'org';
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/** Must be called inside store.locked(). */
async function createOrg(registry, name, pin) {
  const id = slugFor(name, new Set(registry.orgs.map((o) => o.id))); // deleted ids stay reserved
  const org = {
    id,
    name,
    archived: false,
    deleted: false,
    pinHash: await hashPin(pin),
    createdAt: new Date().toISOString(),
  };
  registry.orgs.push(org);
  if (!findVisible(registry, registry.defaultOrgId)) registry.defaultOrgId = id;
  return org;
}

/** First start: create the default organization with an empty chart. */
async function bootstrap() {
  await store.locked(async () => {
    const registry = await store.readOrgs();
    if (visibleOrgs(registry).length > 0) return;

    let pin = normalizePin(process.env.DEFAULT_ORG_PIN);
    let generated = false;
    if (!pin) {
      if (process.env.DEFAULT_ORG_PIN)
        console.warn('DEFAULT_ORG_PIN must be exactly five letters; ignoring it.');
      pin = randomPin();
      generated = true;
    }

    const org = await createOrg(registry, DEFAULT_ORG_NAME, pin);
    await store.writeChart(org.id, await store.seedChart());
    await store.writeOrgs(registry);

    console.log(`Created default organization "${org.name}" (${org.id}).`);
    if (generated) {
      console.log(`No DEFAULT_ORG_PIN was set. Generated PIN for "${org.name}": ${pin}`);
    }
  });
}

// ---------- middleware ----------

/** Requires a bearer token issued for the organization in the URL. */
function requireOrgToken(req, res, next) {
  const token = bearerToken(req);
  const orgId = token && tokens.verify(token);
  if (!orgId || orgId !== req.params.orgId) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  store
    .readOrgs()
    .then((registry) => {
      if (!findVisible(registry, orgId))
        return res.status(404).json({ error: 'organization not found' });
      next();
    })
    .catch(next);
}

/** Requires a valid token for any organization (used to create new ones). */
function requireAnyToken(req, res, next) {
  const token = bearerToken(req);
  if (!token || !tokens.verify(token)) return res.status(401).json({ error: 'unauthorized' });
  return next();
}

// ---------- app ----------

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
app.use(express.json({ limit: '1mb' }));
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/orgs', async (_req, res, next) => {
  try {
    const registry = await store.readOrgs();
    const orgs = visibleOrgs(registry);
    const defaultOrgId = findVisible(registry, registry.defaultOrgId)?.id ?? orgs[0]?.id ?? null;
    res.json({ defaultOrgId, orgs: orgs.map(publicOrg) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/orgs', requireAnyToken, async (req, res, next) => {
  try {
    const name = normalizeOrgName(req.body?.name);
    const pin = normalizePin(req.body?.pin);
    if (!name) return res.status(400).json({ error: 'Name must be 1–60 characters' });
    if (!pin) return res.status(400).json({ error: 'PIN must be exactly five letters' });

    const org = await store.locked(async () => {
      const registry = await store.readOrgs();
      if (visibleOrgs(registry).length >= MAX_ORGS) return null;
      const org = await createOrg(registry, name, pin);
      await store.writeChart(org.id, await store.seedChart());
      await store.writeOrgs(registry);
      return org;
    });
    if (!org) return res.status(409).json({ error: 'Too many organizations' });
    res.status(201).json({ org: publicOrg(org), ...tokens.issue(org) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/orgs/:orgId/login', async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const wait = limiter.retryAfter(orgId, req.ip);
    if (wait > 0) {
      res.set('Retry-After', String(wait));
      return res.status(429).json({
        error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} min.`,
        retryAfter: wait,
      });
    }

    const pin = normalizePin(req.body?.pin);
    const registry = await store.readOrgs();
    const org = findVisible(registry, orgId);
    const ok = org && pin ? await verifyPin(pin, org.pinHash) : false;
    if (!ok) {
      limiter.fail(orgId, req.ip);
      return res.status(401).json({ error: 'Incorrect PIN' });
    }
    limiter.succeed(orgId, req.ip);
    res.json(tokens.issue(org));
  } catch (err) {
    next(err);
  }
});

/** Archiving hides an organization from the switcher; its data and PIN are kept. */
async function setArchived(req, res, next, archived) {
  try {
    const org = await store.locked(async () => {
      const registry = await store.readOrgs();
      const org = findVisible(registry, req.params.orgId);
      if (!org) return null;
      org.archived = archived;
      await store.writeOrgs(registry);
      return org;
    });
    if (!org) return res.status(404).json({ error: 'organization not found' });
    res.json(publicOrg(org));
  } catch (err) {
    next(err);
  }
}

app.post('/api/orgs/:orgId/archive', requireOrgToken, (req, res, next) =>
  setArchived(req, res, next, true),
);
app.post('/api/orgs/:orgId/unarchive', requireOrgToken, (req, res, next) =>
  setArchived(req, res, next, false),
);

/**
 * Soft delete: the organization is flagged in orgs.json and disappears from the API and UI,
 * but its entry and chart file stay on disk so an admin can restore it by hand.
 */
app.delete('/api/orgs/:orgId', requireOrgToken, async (req, res, next) => {
  try {
    const result = await store.locked(async () => {
      const registry = await store.readOrgs();
      const org = findVisible(registry, req.params.orgId);
      if (!org) return 'missing';
      const typed =
        typeof req.body?.confirm === 'string' ? req.body.confirm.trim().toUpperCase() : '';
      if (typed !== org.name.toUpperCase()) return 'confirm';
      if (visibleOrgs(registry).length <= 1) return 'last';
      org.deleted = true;
      org.deletedAt = new Date().toISOString();
      if (registry.defaultOrgId === org.id) registry.defaultOrgId = visibleOrgs(registry)[0].id;
      await store.writeOrgs(registry);
      return 'ok';
    });
    if (result === 'missing') return res.status(404).json({ error: 'organization not found' });
    if (result === 'confirm')
      return res.status(400).json({ error: 'Type the organization name exactly to confirm' });
    if (result === 'last')
      return res.status(409).json({ error: 'The last organization cannot be deleted' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

app.get('/api/orgs/:orgId/chart', requireOrgToken, async (req, res, next) => {
  try {
    const chart = await store.readChart(req.params.orgId);
    if (!chart) return res.status(404).json({ error: 'organization not found' });
    res.json(chart);
  } catch (err) {
    next(err);
  }
});

app.put('/api/orgs/:orgId/presidencies/:id', requireOrgToken, async (req, res, next) => {
  try {
    const pres = req.body;
    const err = validatePresidency(pres);
    if (err) return res.status(400).json({ error: err });
    if (pres.id !== req.params.id) return res.status(400).json({ error: 'id mismatch' });

    const chart = await store.locked(async () => {
      const chart = await store.readChart(req.params.orgId);
      if (!chart) return null;
      const idx = chart.presidencies.findIndex((p) => p.id === pres.id);
      if (idx === -1) return null;
      chart.presidencies[idx] = pres;
      chart.updatedAt = new Date().toISOString();
      await store.writeChart(req.params.orgId, chart);
      return chart;
    });
    if (!chart) return res.status(404).json({ error: 'presidency not found' });
    res.json(chart);
  } catch (err) {
    next(err);
  }
});

app.all('/api/{*splat}', (_req, res) => res.status(404).json({ error: 'not found' }));

// Serve the built Angular app (run `npm run build` first).
app.use(express.static(DIST_DIR, { index: false, maxAge: '1h' }));
app.get('/{*splat}', async (_req, res) => {
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

await bootstrap();
app.listen(PORT, HOST, () => {
  console.log(`Org chart server listening on http://${HOST}:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
