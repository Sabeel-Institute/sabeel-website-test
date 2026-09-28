// Compares two builds of the site and writes a visual report.
//
//   node scripts/visual-diff/run.mjs --before <dist> --after <dist> --out <dir>
//
// Both builds are served locally. BackstopJS screenshots each page whose HTML
// differs between them on a phone and a desktop screen and compares the
// screenshots pixel by pixel. The report folder holds index.html (the page
// reviewers read), summary.json (counts for the pull request comment) and the
// images it shows.
//
// A page whose HTML is byte-identical in both builds renders identically:
// every stylesheet, script, font and image it loads lives under _astro/ with a
// content hash in its name, so changing any of them changes the HTML. Files
// outside _astro/ (copied from public/) have no hash, so if any of those
// differ, every page is compared.
//
// The report is published on the Firebase preview, whose data transfer counts
// against the same daily quota as the live site. It therefore shows
// screenshots for at most MAX_SHOWN pages, and only for the screens on which
// a page changed.

import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { renderSummary } from './summary.mjs';

const backstop = createRequire(import.meta.url)('backstopjs');

const VIEWPORTS = [
  { label: 'phone', width: 390, height: 844 },
  { label: 'desktop', width: 1440, height: 900 },
];
const MAX_SHOWN = 20;
// Colour BackstopJS paints changed pixels in its difference images.
const CHANGED = { red: 255, green: 0, blue: 255 };
// WebP cannot encode taller images; those are published as JPEG.
const WEBP_MAX = 16383;

const TYPES = {
  '.avif': 'image/avif',
  '.css': 'text/css',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
};

class UsageError extends Error {}

async function main() {
  const { before, after, out } = await readArgs();
  const pages = await classifyPages(before, after);
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'visual-diff-'));
  const shown = await compareAndPublish(pages, { before, after, work, out }).finally(() =>
    fs.rm(work, { recursive: true, force: true }),
  );

  const count = (...statuses) => pages.filter((page) => statuses.includes(page.status)).length;
  const summary = {
    different: count('different'),
    added: count('added'),
    removed: count('removed'),
    unchanged: count('unchanged', 'same'),
  };
  await fs.writeFile(path.join(out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await fs.writeFile(path.join(out, 'index.html'), renderSummary({ pages, shown, summary, viewports: VIEWPORTS }));
  console.log(
    `${summary.different} different, ${summary.added} added, ${summary.removed} removed, ` +
      `${summary.unchanged} unchanged. Report: ${path.join(out, 'index.html')}`,
  );
}

async function readArgs() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        before: { type: 'string' },
        after: { type: 'string' },
        out: { type: 'string' },
      },
    }));
  } catch (error) {
    throw new UsageError(error.message);
  }
  for (const name of ['before', 'after', 'out']) {
    if (!values[name]) throw new UsageError(`--${name} is required`);
  }
  const before = path.resolve(values.before);
  const after = path.resolve(values.after);
  const out = path.resolve(values.out);
  for (const [name, dir] of [['before', before], ['after', after]]) {
    if (!(await isFile(path.join(dir, 'index.html')))) {
      throw new UsageError(`--${name} ${dir} is not a built site: it has no index.html`);
    }
  }
  const existing = await fs.readdir(out).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw new UsageError(`--out ${out} is not a usable folder: ${error.message}`);
  });
  if (existing.length) throw new UsageError(`--out ${out} must be empty or not exist yet`);
  return { before, after, out };
}

// Every page in either build, with a status: unchanged, changed, added or
// removed. Changed pages become different or same once their screenshots are
// compared.
async function classifyPages(before, after) {
  const beforeFiles = await listFiles(before);
  const afterFiles = await listFiles(after);
  const all = [...new Set([...beforeFiles, ...afterFiles])].sort();
  const same = async (file) =>
    beforeFiles.has(file) &&
    afterFiles.has(file) &&
    (await fs.readFile(path.join(before, file))).equals(await fs.readFile(path.join(after, file)));

  let unhashedChanged = false;
  for (const file of all) {
    if (file.endsWith('.html') || file.startsWith('_astro/') || (await same(file))) continue;
    console.log(`${file} differs, so every page is compared`);
    unhashedChanged = true;
    break;
  }

  const pages = [];
  for (const file of all.filter((name) => name.endsWith('.html'))) {
    const inAfter = afterFiles.has(file);
    let status;
    if (!beforeFiles.has(file)) status = 'added';
    else if (!inAfter) status = 'removed';
    else if (!unhashedChanged && (await same(file))) status = 'unchanged';
    else status = 'changed';
    const html = await fs.readFile(path.join(inAfter ? after : before, file), 'utf8');
    pages.push({ route: routeOf(file), title: titleOf(html), status });
  }
  return pages;
}

async function listFiles(root) {
  const entries = await fs.readdir(root, { recursive: true, withFileTypes: true });
  return new Set(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')),
  );
}

async function isFile(file) {
  return (await fs.stat(file).catch(() => null))?.isFile() ?? false;
}

function routeOf(file) {
  if (file === 'index.html') return '/';
  if (file.endsWith('/index.html')) return `/${file.slice(0, -'index.html'.length)}`;
  return `/${file}`;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

// The page's title up to " | ", which leaves out the site name.
function titleOf(html) {
  const raw = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].split(' | ')[0].trim() ?? '';
  return raw.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, name) => {
    if (name[0] !== '#') return ENTITIES[name.toLowerCase()] ?? entity;
    return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
  });
}

// Screenshots the pages that are not unchanged, settles whether each changed
// page looks different, and publishes images for the MAX_SHOWN pages with the
// largest changes. Returns those pages.
async function compareAndPublish(pages, { before, after, work, out }) {
  const compared = pages.filter((page) => page.status !== 'unchanged');
  console.log(`${pages.length} pages, ${compared.length} to compare`);
  if (compared.length) {
    const shots = await capture(compared, before, after, work);
    for (const page of compared) {
      page.shots = shots.get(page.route);
      if (page.status === 'changed') {
        page.status = Object.values(page.shots).some((shot) => shot.differs) ? 'different' : 'same';
      }
    }
  }
  const shown = pages
    .filter((page) => ['different', 'added', 'removed'].includes(page.status))
    .sort((a, b) => score(b) - score(a))
    .slice(0, MAX_SHOWN);
  await fs.mkdir(path.join(out, 'images'), { recursive: true });
  for (const [index, page] of shown.entries()) page.images = await publishImages(page, index, out);
  return shown;
}

// Pages with the largest visible change come first; new and removed pages
// are all change.
function score(page) {
  if (page.status !== 'different') return Infinity;
  return Math.max(...Object.values(page.shots).map((shot) => shot.mismatch));
}

// Screenshots the given pages in both builds. Returns, for each route and
// viewport, the screenshot files and whether they differ.
async function capture(pages, before, after, work) {
  const servers = await Promise.all([serve(before), serve(after)]);
  const [beforeUrl, afterUrl] = servers.map((server) => `http://127.0.0.1:${server.address().port}`);
  const concurrency = Math.min(os.availableParallelism(), 8);
  const config = () => ({
    id: 'site',
    viewports: VIEWPORTS.map((viewport) => ({ ...viewport })),
    scenarios: pages.map((page) => ({
      label: page.route,
      referenceUrl: beforeUrl + page.route,
      url: afterUrl + page.route,
    })),
    onReadyScript: 'ready.cjs',
    paths: {
      engine_scripts: path.join(import.meta.dirname, 'engine'),
      bitmaps_reference: path.join(work, 'before'),
      bitmaps_test: path.join(work, 'after'),
      html_report: path.join(work, 'report'),
      json_report: path.join(work, 'report'),
    },
    fileNameTemplate: '{scenarioIndex}_{viewportLabel}',
    report: ['json'],
    openReport: false,
    engine: 'playwright',
    engineOptions: { browser: 'chromium' },
    asyncCaptureLimit: concurrency,
    asyncCompareLimit: concurrency,
    misMatchThreshold: 0,
    resembleOutputOptions: { usePreciseMatching: true, errorType: 'flat', errorColor: CHANGED, transparency: 0.3 },
  });

  try {
    await backstop('reference', { config: config() }).catch((error) => {
      throw new Error(`Screenshots of the before build failed: ${describe(error)}`);
    });
    // BackstopJS rejects when any screenshot differs; the JSON report read
    // below holds the outcome.
    await backstop('test', { config: config() }).catch(() => {});
  } finally {
    for (const server of servers) server.close();
  }

  const reportDir = path.join(work, 'report');
  const reportFile = path.join(reportDir, 'jsonReport.json');
  const report = JSON.parse(
    await fs.readFile(reportFile, 'utf8').catch(() => {
      throw new Error(`BackstopJS did not write ${reportFile}; see its log above`);
    }),
  );
  const expected = pages.length * VIEWPORTS.length;
  if (report.tests.length !== expected) {
    throw new Error(`BackstopJS reported ${report.tests.length} screenshots, expected ${expected}`);
  }

  const results = new Map();
  for (const { pair, status } of report.tests) {
    if (pair.engineErrorMsg) {
      throw new Error(`Screenshot of ${pair.label} (${pair.viewportLabel}) failed: ${pair.engineErrorMsg}`);
    }
    if (!results.has(pair.label)) results.set(pair.label, {});
    const { rawMisMatchPercentage = 0, dimensionDifference } = pair.diff;
    results.get(pair.label)[pair.viewportLabel] = {
      before: path.resolve(reportDir, pair.reference),
      after: path.resolve(reportDir, pair.test),
      diff: pair.diffImage && path.resolve(reportDir, pair.diffImage),
      differs: status !== 'pass',
      // Percentage of changed pixels, plus 100 when the page height changed.
      mismatch: rawMisMatchPercentage + (dimensionDifference.height ? 100 : 0),
    };
  }
  return results;
}

function describe(error) {
  if (error instanceof Error) return error.message;
  if (error?.engineErrorMsg) return `${error.label} (${error.viewportLabel}): ${error.engineErrorMsg}`;
  return String(error);
}

// Writes the images the summary shows for a page into out/images: the new
// screenshots of an added page, the old ones of a removed page, and before,
// after and difference images for each screen on which a page changed.
async function publishImages(page, index, out) {
  const images = {};
  for (const { label } of VIEWPORTS) {
    const shot = page.shots[label];
    const name = (kind) => path.join(out, 'images', `${index}-${label}-${kind}`);
    if (page.status === 'added') images[label] = { after: await publish(shot.after, name('after')) };
    else if (page.status === 'removed') images[label] = { before: await publish(shot.before, name('before')) };
    else if (shot.differs) {
      images[label] = {
        before: await publish(shot.before, name('before')),
        after: await publish(shot.after, name('after')),
        diff: await publish(shot.diff, name('diff')),
        changes: await changedBands(shot),
      };
    }
  }
  return images;
}

async function publish(source, target) {
  const { width, height } = await sharp(source).metadata();
  const webp = width <= WEBP_MAX && height <= WEBP_MAX;
  const file = `${target}.${webp ? 'webp' : 'jpg'}`;
  const image = sharp(source).flatten({ background: '#ffffff' });
  await (webp ? image.webp({ quality: 80 }) : image.jpeg({ quality: 80, mozjpeg: true })).toFile(file);
  return { src: `images/${path.basename(file)}`, width, height };
}

// Vertical ranges, in screenshot pixels, that contain changed pixels. Ranges
// closer than 60 pixels are merged. Content added below the end of the
// shorter screenshot counts as one range.
async function changedBands(shot) {
  const { data, info } = await sharp(shot.diff).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bands = [];
  const extend = (start, end) => {
    const last = bands.at(-1);
    if (last && start - last[1] <= 60) last[1] = end;
    else bands.push([start, end]);
  };
  const rowBytes = info.width * 4;
  for (let y = 0; y < info.height; y++) {
    for (let i = y * rowBytes; i < (y + 1) * rowBytes; i += 4) {
      if (data[i] === CHANGED.red && data[i + 1] === CHANGED.green && data[i + 2] === CHANGED.blue && data[i + 3] === 255) {
        extend(y, y);
        break;
      }
    }
  }
  const [a, b] = await Promise.all([sharp(shot.before).metadata(), sharp(shot.after).metadata()]);
  if (a.height !== b.height) extend(Math.min(a.height, b.height), Math.max(a.height, b.height));
  return bands;
}

// Serves a built site the way Firebase Hosting does for these requests:
// folders serve their index.html and missing files get 404.html.
async function serve(root) {
  const server = createServer(async (request, response) => {
    let file;
    try {
      file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    } catch {
      response.writeHead(400).end();
      return;
    }
    if ((await fs.stat(file).catch(() => null))?.isDirectory()) file = path.join(file, 'index.html');
    const found = file.startsWith(root + path.sep) && (await isFile(file));
    if (!found) file = path.join(root, '404.html');
    response.writeHead(found ? 200 : 404, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file)
      .on('error', () => response.destroy())
      .pipe(response);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}

try {
  await main();
} catch (error) {
  console.error(error instanceof UsageError ? `run.mjs: ${error.message}` : error);
  process.exitCode = error instanceof UsageError ? 2 : 1;
}
