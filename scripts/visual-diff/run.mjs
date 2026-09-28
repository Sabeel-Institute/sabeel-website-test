// Compares two builds of the site and writes a visual report.
//
//   node scripts/visual-diff/run.mjs --before <dist> --after <dist> --out <dir>
//
// Both builds are served locally. BackstopJS screenshots, in both builds, each
// page whose HTML differs between them, on a phone and a desktop screen, and
// pixelmatch compares the screenshots pixel for pixel. A page that cannot be
// captured is reported as such rather than stopping the run. The report
// folder holds index.html (the page reviewers read), summary.json (counts for
// the pull request comment) and the images it shows.
//
// A page whose HTML is identical in both builds renders identically as long
// as every file it loads is identical. Astro names the files it generates
// under _astro/ after a hash, so a page that loads changed styles, scripts,
// fonts or images has changed HTML. If any other file differs (a file from
// public/, or a generated file that kept its name), every page is compared.
//
// The report is published on the Firebase preview, whose data transfer counts
// against the same quota as the live site. It therefore shows screenshots for
// at most MAX_SHOWN pages, and only for the screens on which a page changed.

import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import pixelmatch from 'pixelmatch';
import sharp from 'sharp';
import { renderSummary } from './summary.mjs';

const VIEWPORTS = [
  { label: 'phone', width: 390, height: 844 },
  { label: 'desktop', width: 1440, height: 900 },
];
const MAX_SHOWN = 20;
// Pages that look different are captured a second time, and the second result
// stands, when there are at most this many of them.
const RECHECK_MAX = 40;
// Colour of changed pixels in the difference images.
const CHANGED = [255, 0, 255];
// WebP cannot encode taller images; those are published as JPEG, and images
// taller than JPEG allows are scaled down to fit.
const WEBP_MAX = 16383;
const JPEG_MAX = 65500;

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
    failed: count('failed'),
    unchanged: count('unchanged', 'same'),
  };
  await fs.writeFile(path.join(out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await fs.writeFile(path.join(out, 'index.html'), renderSummary({ pages, shown, summary, viewports: VIEWPORTS }));
  console.log(
    `${summary.different} different, ${summary.added} added, ${summary.removed} removed, ` +
      `${summary.failed} not captured, ${summary.unchanged} unchanged. Report: ${path.join(out, 'index.html')}`,
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
// compared, and any page becomes failed if a screenshot of it failed.
async function classifyPages(before, after) {
  const beforeFiles = await listFiles(before);
  const afterFiles = await listFiles(after);
  const all = [...new Set([...beforeFiles, ...afterFiles])].sort();
  const same = async (file) =>
    (await fs.readFile(path.join(before, file))).equals(await fs.readFile(path.join(after, file)));

  // A file under _astro/ that only one build has is covered by the HTML check:
  // its name is new, so only pages whose HTML changed load it.
  let assetChanged = false;
  for (const file of all) {
    if (file.endsWith('.html')) continue;
    const inBoth = beforeFiles.has(file) && afterFiles.has(file);
    if (inBoth ? await same(file) : file.startsWith('_astro/')) continue;
    console.log(`${file} differs, so every page is compared`);
    assetChanged = true;
    break;
  }

  const pages = [];
  for (const file of all.filter((name) => name.endsWith('.html'))) {
    const inAfter = afterFiles.has(file);
    let status;
    if (!beforeFiles.has(file)) status = 'added';
    else if (!inAfter) status = 'removed';
    else if (!assetChanged && (await same(file))) status = 'unchanged';
    else status = 'changed';
    const html = await fs.readFile(path.join(inAfter ? after : before, file), 'utf8');
    pages.push({ route: routeOf(file), title: titleOf(html), status, inAfter });
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
  const raw = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].split(' | ')[0].trim() ?? '';
  return raw.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, name) => {
    if (name[0] !== '#') return ENTITIES[name.toLowerCase()] ?? entity;
    const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

// Screenshots the pages that are not unchanged, settles whether each changed
// page looks different, and publishes images for the pages chosen by pick().
// Returns those pages.
async function compareAndPublish(pages, { before, after, work, out }) {
  const compared = pages.filter((page) => page.status !== 'unchanged');
  console.log(`${pages.length} pages, ${compared.length} to compare`);
  for (const page of compared) page.kind = page.status;
  if (compared.length) {
    await assess(compared, before, after, path.join(work, 'first'));
    // Captures are repeatable, but a rare timing problem on a busy machine can
    // still spoil one. Pages that look different or failed are captured again,
    // unless so many changed that one spoiled capture would not matter.
    const recheck = compared.filter((page) => page.status === 'different' || page.status === 'failed');
    if (recheck.length && recheck.length <= RECHECK_MAX) {
      console.log(`Capturing again the pages that differ or failed: ${recheck.length}`);
      await assess(recheck, before, after, path.join(work, 'again'));
    }
  }
  const shown = pick(pages);
  await fs.mkdir(path.join(out, 'images'), { recursive: true });
  for (const [index, page] of shown.entries()) page.images = await publishImages(page, index, out);
  return shown;
}

// Screenshots the pages in both builds into dir and sets each page's status:
// failed if a screenshot failed, otherwise added or removed as classified, or
// different or same once the screenshots of a changed page are compared.
async function assess(pages, before, after, dir) {
  const shots = await capture(pages, before, after, dir);
  for (const page of pages) {
    page.shots = shots.get(page.route);
    page.failures = Object.entries(page.shots).flatMap(([label, shot]) => shot.failed.map((side) => `${side} on a ${label}`));
    if (page.failures.length) page.status = 'failed';
    else if (page.kind !== 'changed') page.status = page.kind;
    else {
      for (const [label, shot] of Object.entries(page.shots)) {
        Object.assign(shot, await compare(shot, path.join(dir, `diff-${shot.index}-${label}.png`)));
      }
      page.status = Object.values(page.shots).some((shot) => shot.differs) ? 'different' : 'same';
    }
  }
}

// The pages the report shows screenshots of: new and removed pages, then the
// pages that changed most, keeping at least half of the MAX_SHOWN places for
// changed pages when there are enough of them.
function pick(pages) {
  const newOrGone = pages.filter((page) => page.status === 'added' || page.status === 'removed');
  const different = pages
    .filter((page) => page.status === 'different')
    .sort((a, b) => score(b) - score(a));
  const first = newOrGone.slice(0, Math.max(MAX_SHOWN / 2, MAX_SHOWN - different.length));
  return [...first, ...different.slice(0, MAX_SHOWN - first.length)];
}

// The share of the page, in percent, that changed on the screen where it
// changed most.
function score(page) {
  return Math.max(...Object.values(page.shots).map((shot) => shot.mismatch));
}

// Screenshots the given pages in both builds with BackstopJS into dir.
// Returns, for each route and viewport, the two screenshot files.
async function capture(pages, before, after, dir) {
  const servers = await Promise.all([serve(before), serve(after)]);
  const urls = servers.map((server) => `http://127.0.0.1:${server.address().port}`);
  const shotsDir = path.join(dir, 'shots');
  // BackstopJS writes its own temporary files to the system temp folder when
  // it first loads; send them into the work folder, which is removed
  // afterwards.
  await fs.mkdir(dir, { recursive: true });
  process.env.TMPDIR = dir;
  const backstop = createRequire(import.meta.url)('backstopjs');
  const concurrency = Math.min(os.availableParallelism(), 8);
  const scenarios = ['before', 'after'].flatMap((side, s) =>
    pages.map((page) => ({
      label: `${side} ${page.route}`,
      url: urls[s] + encodeRoute(page.route),
      // ready.cjs waits for the rest of the page, with a time limit.
      engineOptions: { gotoParameters: { waitUntil: 'domcontentloaded' } },
    })),
  );
  // BackstopJS rejects after all screenshots are taken if any of them failed;
  // the files show which, below.
  let failure;
  try {
    await backstop('reference', {
      config: {
        id: 'site',
        viewports: VIEWPORTS.map((viewport) => ({ ...viewport })),
        scenarios,
        onBeforeScript: 'before.cjs',
        onReadyScript: 'ready.cjs',
        paths: {
          engine_scripts: path.join(import.meta.dirname, 'engine'),
          bitmaps_reference: shotsDir,
        },
        fileNameTemplate: '{scenarioIndex}_{viewportLabel}',
        engine: 'playwright',
        engineOptions: { browser: 'chromium' },
        asyncCaptureLimit: concurrency,
      },
    });
  } catch (error) {
    failure = describe(error);
    console.warn(`Some screenshots failed, for example ${failure}`);
  } finally {
    for (const server of servers) server.close();
  }

  const results = new Map();
  for (const [index, page] of pages.entries()) {
    const shots = {};
    for (const viewport of VIEWPORTS) {
      const [before, after] = [index, pages.length + index].map((n) => path.join(shotsDir, `${n}_${viewport.label}.png`));
      const failed = [];
      for (const [side, file] of [['before', before], ['after', after]]) {
        const metadata = await sharp(file).metadata().catch(() => null);
        if (!metadata) throw new Error(`Screenshots failed: ${failure ?? `${file} is missing`}`);
        // BackstopJS puts a small placeholder image in place of a failed one.
        if (metadata.width < viewport.width) failed.push(side);
      }
      shots[viewport.label] = { index, before, after, failed };
    }
    results.set(page.route, shots);
  }
  return results;
}

function describe(error) {
  if (error instanceof Error) return error.message;
  if (error?.engineErrorMsg) return `${error.label} (${error.viewportLabel}): ${error.engineErrorMsg}`;
  return String(error);
}

const encodeRoute = (route) => route.split('/').map(encodeURIComponent).join('/');

// Compares two screenshots exactly. Screenshots of different sizes are
// compared on the larger size, where pixels only one of them has count as
// changed. Writes the difference image to diffFile when they differ.
async function compare(shot, diffFile) {
  const [a, b] = await Promise.all([fs.readFile(shot.before), fs.readFile(shot.after)]);
  if (a.equals(b)) return { differs: false, mismatch: 0 };
  const [one, two] = await Promise.all(
    [a, b].map((png) => sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })),
  );
  const width = Math.max(one.info.width, two.info.width);
  const height = Math.max(one.info.height, two.info.height);
  const pad = ({ data, info }) => {
    if (info.width === width && info.height === height) return data;
    const padded = Buffer.alloc(width * height * 4);
    for (let y = 0; y < info.height; y++) data.copy(padded, y * width * 4, y * info.width * 4, (y + 1) * info.width * 4);
    return padded;
  };
  const diff = Buffer.alloc(width * height * 4);
  pixelmatch(pad(one), pad(two), diff, width, height, { threshold: 0, includeAA: true, alpha: 0.3, diffColor: CHANGED });

  const commonWidth = Math.min(one.info.width, two.info.width);
  const commonHeight = Math.min(one.info.height, two.info.height);
  const pixels = new Uint32Array(diff.buffer, diff.byteOffset, width * height);
  const changed = new Uint32Array(new Uint8Array([...CHANGED, 255]).buffer)[0];
  const bands = [];
  let count = 0;
  for (let y = 0; y < height; y++) {
    let rowChanged = false;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x >= commonWidth || y >= commonHeight) pixels[i] = changed;
      if (pixels[i] === changed) {
        count++;
        rowChanged = true;
      }
    }
    if (!rowChanged) continue;
    // Changed rows closer than 60 pixels form one band.
    const last = bands.at(-1);
    if (last && y - last[1] <= 60) last[1] = y;
    else bands.push([y, y]);
  }
  // The files can differ while the pixels are the same.
  if (!count) return { differs: false, mismatch: 0 };
  await sharp(diff, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 1 })
    .toFile(diffFile);
  return { differs: true, diff: diffFile, bands, mismatch: (100 * count) / (width * height) };
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
        changes: shot.bands,
      };
    }
  }
  return images;
}

// Returns the screenshot's own size, which the summary lays images out by,
// even when the published image is scaled down.
async function publish(source, target) {
  const { width, height } = await sharp(source).metadata();
  const webp = width <= WEBP_MAX && height <= WEBP_MAX;
  const file = `${target}.${webp ? 'webp' : 'jpg'}`;
  let image = sharp(source).flatten({ background: '#ffffff' });
  if (height > JPEG_MAX) image = image.resize({ height: JPEG_MAX });
  await (webp ? image.webp({ quality: 80 }) : image.jpeg({ quality: 80, mozjpeg: true })).toFile(file);
  return { src: `images/${path.basename(file)}`, width, height };
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
    if (!found) {
      file = path.join(root, '404.html');
      if (!(await isFile(file))) {
        response.writeHead(404, { 'content-type': TYPES['.txt'] }).end('Not found');
        return;
      }
    }
    const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
    response.writeHead(found ? 200 : 404, { 'content-type': type });
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
