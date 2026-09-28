import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * JSON-file persistence.
 *
 *   <dataDir>/orgs.json          registry of organizations (name + pin hash)
 *   <dataDir>/charts/<orgId>.json  one chart per organization
 *   <dataDir>/jwt-secret         auto-generated signing secret (unless JWT_SECRET is set)
 *
 * Every mutation runs through a single queue so concurrent saves never interleave.
 */
export class Store {
  constructor(dataDir, seedFile) {
    this.dataDir = dataDir;
    this.seedFile = seedFile;
    this.orgsFile = path.join(dataDir, 'orgs.json');
    this.chartsDir = path.join(dataDir, 'charts');
    this.queue = Promise.resolve();
  }

  /** Run `fn` after every previously queued operation has finished. */
  locked(fn) {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }

  async readOrgs() {
    const parsed = await readJson(this.orgsFile);
    return parsed ?? { defaultOrgId: null, orgs: [] };
  }

  writeOrgs(registry) {
    return writeJsonAtomic(this.orgsFile, registry);
  }

  chartFile(orgId) {
    return path.join(this.chartsDir, `${orgId}.json`);
  }

  readChart(orgId) {
    return readJson(this.chartFile(orgId));
  }

  writeChart(orgId, chart) {
    return writeJsonAtomic(this.chartFile(orgId), chart);
  }

  async seedChart() {
    return JSON.parse(await fs.readFile(this.seedFile, 'utf8'));
  }
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, file);
}
