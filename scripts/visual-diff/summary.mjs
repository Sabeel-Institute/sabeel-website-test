// Renders the page reviewers read: which pages look different, with before
// and after screenshots for the pages run.mjs published images for.

const escape = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const count = (n, one, many) => `<strong>${n}</strong> ${n === 1 ? one : many}`;

const capitalize = (word) => word[0].toUpperCase() + word.slice(1);

// pages: every page, in route order. shown: the pages with images, most
// changed first.
export function renderSummary({ pages, shown, summary, viewports }) {
  const cards = (status) =>
    shown
      .filter((page) => page.status === status)
      .map((page) => card(page, viewports))
      .join('\n');
  const unshown = pages.filter((page) => ['different', 'added', 'removed'].includes(page.status) && !page.images);
  const same = pages.filter((page) => page.status === 'same');
  const failed = pages.filter((page) => page.status === 'failed');

  const sections = [];
  if (failed.length) {
    sections.push(
      section(
        'Could not capture',
        `<p>These screenshots failed, so these pages were not compared. The log of the visual-diff job in the Site workflow run says why.</p>
  <ul class="plain">${failed.map((page) => `<li>${pageLink(page)} <span class="tag">${escape(page.failures.join(', '))}</span></li>`).join('')}</ul>`,
      ),
    );
  }
  if (!summary.different && !summary.added && !summary.removed && !summary.failed) {
    sections.push(section('No visual changes', '<p>Every page looks exactly as it does on main.</p>'));
  }
  sections.push(
    section('Pages that look different', cards('different')),
    section('New pages', cards('added')),
    section('Removed pages', cards('removed')),
  );
  if (unshown.length) {
    sections.push(
      section(
        'More changed pages',
        `<p>Screenshots are shown for the ${shown.length} pages with the largest changes. These pages changed too:</p>
  <ul class="plain">${unshown.map((page) => `<li>${pageLink(page)} <span class="tag">${STATUS[page.status]}</span></li>`).join('')}</ul>`,
      ),
    );
  }
  if (same.length) {
    sections.push(
      section(
        'Changed code, same look',
        `<p>These pages look exactly as before, although their HTML, or a file every page may load, changed.</p>
  <ul class="plain">${same.map((page) => `<li>${pageLink(page)}</li>`).join('')}</ul>`,
      ),
    );
  }

  const sizes = viewports.map((v) => `${v.width} × ${v.height} pixels (${v.label})`).join(' and ');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="icon" href="data:,">
<title>Visual changes</title>
<style>${CSS}${viewports.map((v) => `.page:has([value="${v.label}"]:checked) .shot[data-screen="${v.label}"]`).join(',\n')} { display: block; }
</style>
</head>
<body>
<main>
<header class="intro">
  <h1>Visual changes</h1>
  <p>Screenshots of the pages this pull request changes, on a phone and on a desktop screen.
  <b>Before</b> is the site on main without this pull request. <b>After</b> is the site with it.</p>
  <ul class="tally">
    <li>${count(summary.different, 'page looks different', 'pages look different')}</li>
    <li>${count(summary.added, 'new page', 'new pages')}</li>
    <li>${count(summary.removed, 'page removed', 'pages removed')}</li>
    <li>${count(summary.unchanged, 'page looks the same', 'pages look the same')}</li>${
      summary.failed ? `\n    <li>${count(summary.failed, 'page could not be captured', 'pages could not be captured')}</li>` : ''
    }
  </ul>
</header>
${sections.filter(Boolean).join('\n')}
<footer>
  <p>Whole pages are captured in Chromium at ${escape(sizes)} and compared pixel by pixel.</p>
</footer>
</main>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

const STATUS = { different: 'looks different', added: 'new page', removed: 'removed' };

function section(heading, body) {
  if (!body) return '';
  return `<section>
  <h2>${escape(heading)}</h2>
  ${body}
</section>`;
}

function pageLink(page) {
  const label = page.title
    ? `${escape(page.title)} <span class="route">${escape(page.route)}</span>`
    : `<span class="route">${escape(page.route)}</span>`;
  const href = `..${page.route.split('/').map(encodeURIComponent).join('/')}`;
  return page.inAfter ? `<a href="${escape(href)}">${label}</a>` : label;
}

let cardId = 0;

function card(page, viewports) {
  const id = ++cardId;
  const compare = page.status === 'different';
  // Open on the screen where the page changed most.
  const first = compare
    ? viewports.reduce((best, v) => (page.shots[v.label].mismatch > page.shots[best.label].mismatch ? v : best))
    : viewports.at(-1);
  const screens = viewports
    .map((viewport) => {
      const note = compare && !page.images[viewport.label] ? ' <small>no change</small>' : '';
      const checked = viewport === first ? ' checked' : '';
      return `<label><input type="radio" name="screen-${id}" value="${viewport.label}"${checked}> ${capitalize(viewport.label)}${note}</label>`;
    })
    .join('');
  const views = compare
    ? `<fieldset class="toggle"><legend>View</legend>
      <label><input type="radio" name="view-${id}" value="slider" checked> Slider</label>
      <label><input type="radio" name="view-${id}" value="side"> Side by side</label>
      <label><input type="radio" name="view-${id}" value="highlight"> Highlight changes</label>
    </fieldset>`
    : '';
  return `<article class="page">
  <h3>${pageLink(page)}</h3>
  <div class="controls">
    <fieldset class="toggle"><legend>Screen</legend>${screens}</fieldset>
    ${views}
  </div>
  ${viewports.map((viewport) => shot(page, viewport)).join('\n  ')}
</article>`;
}

function shot(page, viewport) {
  const images = page.images[viewport.label];
  const on = `on a ${viewport.label}`;
  if (!images) return `<div class="shot" data-screen="${viewport.label}"><p class="same">Looks the same ${on}.</p></div>`;
  // Screenshots are shown at the same scale: a screenshot narrower than the
  // widest one (a page that scrolls sideways) takes a share of the width.
  const widest = Math.max(...['before', 'after', 'diff'].map((kind) => images[kind]?.width ?? 0));
  const open = `<div class="shot" data-screen="${viewport.label}" style="--width: ${widest}px`;
  const img = (kind, alt) => {
    const { src, width, height } = images[kind];
    const share = +((100 * width) / widest).toFixed(3);
    return `<img class="${kind}" src="${escape(src)}" width="${width}" height="${height}" style="width: ${share}%" alt="${escape(alt)}" loading="lazy" decoding="async">`;
  };
  if (page.status !== 'different') {
    const kind = page.status === 'added' ? 'after' : 'before';
    return `${open}">
    <div class="labels"><span>${capitalize(kind)}</span></div>
    <div class="stack">${img(kind, `${capitalize(kind)}: ${page.title} ${on}`)}</div>
  </div>`;
  }
  const jumps = images.changes
    .slice(0, 12)
    .map(([top], i) => `<button type="button" data-y="${top}">${i + 1}</button>`)
    .join('');
  const more = images.changes.length > 12 ? ` <span>and ${images.changes.length - 12} more</span>` : '';
  return `${open}; --pos: 50%">
    <div class="toolbar">
      <input class="reveal" type="range" min="0" max="100" value="50" aria-label="Divider between before and after ${on}">
      <div class="jumps" role="group" aria-label="Go to change">Go to change ${jumps}${more}</div>
    </div>
    <div class="labels"><span>Before</span><span class="hl">Changes marked in pink</span><span>After</span></div>
    <div class="stack">
      ${img('before', `Before: ${page.title} ${on}`)}
      <div class="after">${img('after', `After: ${page.title} ${on}`)}</div>
      ${img('diff', `Changes marked in pink: ${page.title} ${on}`)}
      <span class="divider" aria-hidden="true"></span>
    </div>
  </div>`;
}

const SCRIPT = `
for (const input of document.querySelectorAll('.reveal')) {
  input.addEventListener('input', () => input.closest('.shot').style.setProperty('--pos', input.value + '%'));
}
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-y]');
  if (!button) return;
  const image = [...button.closest('.shot').querySelectorAll('.stack img')].find((img) => img.offsetParent);
  const scale = image.clientWidth / Number(image.getAttribute('width'));
  const top = image.getBoundingClientRect().top + scrollY + Number(button.dataset.y) * scale;
  scrollTo({ top: top - innerHeight / 3, behavior: 'smooth' });
});
`;

const CSS = `
:root {
  --canvas: #f6ebdd; --surface: #fbf6f0;
  --ink: #3a2f28; --ink-soft: #6a5748; --raspberry: #83114f; --on-raspberry: #f9f2e9;
  --gold: #c6a15b; --gold-text: #795e2a; --border: #dfd1c1; --border-strong: #c9b7a7;
  color-scheme: light;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--canvas); color: var(--ink);
  font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 1240px; margin: 0 auto; padding: 32px 16px 64px; }
h1, h2, h3 { font-family: Georgia, "Times New Roman", serif; font-weight: 600; color: var(--raspberry); line-height: 1.2; }
h1 { font-size: 2.4rem; margin: 0 0 12px; }
h2 { font-size: 1.7rem; margin: 48px 0 16px; padding-top: 24px; border-top: 1px solid var(--gold); }
h3 { font-size: 1.35rem; margin: 0 0 12px; }
h3, .plain li { overflow-wrap: anywhere; }
a { color: var(--raspberry); }
.route { font: 0.85rem ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--ink-soft); margin-left: 6px; }
.tag { font-size: 0.8rem; color: var(--gold-text); margin-left: 6px; }
.intro p { max-width: 68ch; }
.tally { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; padding: 0; margin: 20px 0 0; }
.tally li { background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 6px 14px; }
.tally strong { color: var(--raspberry); }
.plain { list-style: none; padding: 0; margin: 0; }
.plain li { padding: 4px 0; }
.page { background: var(--surface); border: 1px solid var(--border); border-top: 4px solid var(--gold);
  border-radius: 14px; padding: 20px; margin: 0 0 32px; }
.controls { display: flex; flex-wrap: wrap; gap: 12px 24px; margin-bottom: 16px; }
.toggle { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; border: 0; margin: 0; padding: 0; }
.toggle legend { float: left; margin-right: 6px; font-size: 0.85rem; color: var(--ink-soft); }
.toggle label { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 6px 14px;
  border: 1px solid var(--border-strong); border-radius: 999px; background: var(--canvas); cursor: pointer; }
.toggle label:has(:checked) { background: var(--raspberry); border-color: var(--raspberry); color: var(--on-raspberry); }
.toggle label:has(:focus-visible) { outline: 2px solid var(--gold); outline-offset: 2px; }
.toggle input { position: absolute; opacity: 0; pointer-events: none; }
.toggle small { font-size: 0.75rem; }
.shot { display: none; max-width: var(--width); margin: 0 auto; }
.same { margin: 0; padding: 24px; text-align: center; color: var(--ink-soft); }
.toolbar { position: sticky; top: 0; z-index: 2; padding: 8px 0; background: var(--surface); }
.reveal { display: block; width: 100%; margin: 0 0 6px; accent-color: var(--raspberry); cursor: ew-resize; }
.jumps { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--ink-soft); }
.jumps button { min-width: 32px; min-height: 32px; border: 1px solid var(--border-strong); border-radius: 8px;
  background: var(--canvas); color: var(--ink); font: inherit; cursor: pointer; }
.jumps button:hover { border-color: var(--raspberry); color: var(--raspberry); }
.labels { display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; color: var(--ink-soft); margin: 4px 0; }
.labels .hl { display: none; }
.stack { position: relative; display: grid; align-items: start; border: 1px solid var(--border); background: #fff; }
.stack > * { grid-area: 1 / 1; }
.stack img { display: block; height: auto; }
.stack > .after { clip-path: inset(0 0 0 var(--pos)); }
.stack > .diff { display: none; }
.divider { position: absolute; top: 0; bottom: 0; left: var(--pos); width: 2px; margin-left: -1px;
  background: var(--raspberry); pointer-events: none; }
.page:has([value="side"]:checked) .shot { max-width: calc(2 * var(--width) + 12px); }
.page:has([value="side"]:checked) .stack { grid-template-columns: 1fr 1fr; gap: 12px; border: 0; background: none; }
.page:has([value="side"]:checked) .stack > .after { grid-area: 1 / 2; clip-path: none; }
.page:has([value="side"]:checked) :is(.reveal, .divider) { display: none; }
.page:has([value="highlight"]:checked) :is(.reveal, .divider, .before, .after, .labels span) { display: none; }
.page:has([value="highlight"]:checked) :is(.diff, .labels .hl) { display: block; }
footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--border); color: var(--ink-soft); font-size: 0.9rem; }
`;
