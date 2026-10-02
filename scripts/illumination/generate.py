# /// script
# requires-python = ">=3.10"
# ///
"""
Draws the site's ornaments and writes them into src/components/illumination/
and the rosette mask in src/styles/global.css.

    uv run scripts/illumination/generate.py

The geometry is computed here (stars, the lattice tile, the headpiece's
crest and finials), so change a shape by editing this file and regenerating,
not by editing the path data in the components.
"""
import math
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'src/components/illumination'
CSS = ROOT / 'src/styles/global.css'


def f(v: float) -> str:
    return f'{v:.2f}'.rstrip('0').rstrip('.')


def P(x: float, y: float) -> str:
    return f'{f(x)} {f(y)}'


def polar(cx, cy, r, deg):
    a = math.radians(deg)
    return cx + r * math.cos(a), cy + r * math.sin(a)


def star(cx, cy, r_out, r_in, points, rot=-90) -> str:
    """A star with `points` tips, as a closed path."""
    pts = [polar(cx, cy, r_out if i % 2 == 0 else r_in, rot + i * 180 / points) for i in range(points * 2)]
    return 'M' + 'L'.join(P(*p) for p in pts) + 'Z'


def octagram(cx, cy, r) -> str:
    """Two squares, one turned 45 degrees: the eight-point star of girih work."""
    a = [polar(cx, cy, r, 45 + 90 * i) for i in range(4)]
    b = [polar(cx, cy, r, 90 * i) for i in range(4)]
    return 'M' + 'L'.join(P(*p) for p in a) + 'ZM' + 'L'.join(P(*p) for p in b) + 'Z'


def circle(cx, cy, r) -> str:
    return f'M{P(cx + r, cy)}A{f(r)} {f(r)} 0 1 0 {P(cx - r, cy)}A{f(r)} {f(r)} 0 1 0 {P(cx + r, cy)}'


# Lattice tile: eight-point stars at the centre and corners, small diamonds
# between them, as hairlines. Tiles seamlessly.
T = 80
r = 0.28 * T
lattice = octagram(T / 2, T / 2, r) + ''.join(octagram(cx, cy, r) for cx, cy in [(0, 0), (T, 0), (0, T), (T, T)])
d = 0.06 * T
for cx, cy in [(T / 2, 0), (T / 2, T), (0, T / 2), (T, T / 2)]:
    lattice += f'M{P(cx - d, cy)}L{P(cx, cy - d)}L{P(cx + d, cy)}L{P(cx, cy + d)}Z'

# Shamsa: a sunburst medallion in a 120-unit box.
S = 60
shamsa = []
for i in range(24):
    x0, y0 = polar(S, S, 44, i * 15)
    x1, y1 = polar(S, S, 58 if i % 2 == 0 else 51, i * 15)
    shamsa.append(f'M{P(x0, y0)}L{P(x1, y1)}')
shamsa += [circle(S, S, 44), circle(S, S, 40)]
petals = []
for i in range(16):
    a0, a1 = i * 22.5, (i + 1) * 22.5
    x0, y0 = polar(S, S, 30, a0)
    x1, y1 = polar(S, S, 30, a1)
    mx, my = polar(S, S, 41, (a0 + a1) / 2)
    petals.append(f'{"M" if i == 0 else "L"}{P(x0, y0)}Q{P(mx, my)} {P(x1, y1)}')
shamsa += [''.join(petals) + 'Z', octagram(S, S, 24), star(S, S, 17, 8, 8), circle(S, S, 5)]
shamsa_d = ''.join(shamsa)

# Rosette: a filled eight-point star in a 24-unit box.
rosette_d = star(12, 12, 11, 5, 8)
corner_d = star(12, 12, 8, 3.4, 8)
corner_ring = circle(12, 12, 10)

# Headpiece: a ruled band with a crested centre and finials, 600 x 112.
W, H = 600, 112
y0, y1 = 78, 104
head = [f'M{P(8, y0)}H224', f'M{P(376, y0)}H{f(W - 8)}', f'M{P(8, y1)}H{f(W - 8)}']
head.append(
    f'M{P(224, y0)}C{P(224, 52)} {P(252, 42)} {P(272, 40)}C{P(288, 38)} {P(296, 32)} {P(300, 24)}'
    f'C{P(304, 32)} {P(312, 38)} {P(328, 40)}C{P(348, 42)} {P(376, 52)} {P(376, y0)}'
)
head.append(
    f'M{P(232, y0)}C{P(232, 58)} {P(256, 48)} {P(274, 46)}C{P(290, 44)} {P(297, 38)} {P(300, 32)}'
    f'C{P(303, 38)} {P(310, 44)} {P(326, 46)}C{P(344, 48)} {P(368, 58)} {P(368, y0)}'
)
for x, top, base in [(300, 4, 24), (264, 24, 44), (336, 24, 44), (238, 44, 60), (362, 44, 60)]:
    head.append(f'M{P(x, base)}V{f(top + 6)}')
    head.append(f'M{P(x, top)}C{P(x + 3, top + 3)} {P(x + 3, top + 6)} {P(x, top + 8)}C{P(x - 3, top + 6)} {P(x - 3, top + 3)} {P(x, top)}Z')
for x in (224, 376):
    head.append(star(x, y0, 6, 2.6, 8))
for x, dx in [(8, 1), (W - 8, -1)]:
    head.append(f'M{P(x, y0)}C{P(x - dx * 6, y0 + 4)} {P(x - dx * 6, y1 - 4)} {P(x, y1)}')
ym = (y0 + y1) / 2
for x in list(range(40, 210, 24)) + list(range(392, 562, 24)):
    head.append(f'M{P(x - 3, ym)}L{P(x, ym - 3)}L{P(x + 3, ym)}L{P(x, ym + 3)}Z')
head_d = ''.join(head)
crest_d = star(300, 60, 11, 5, 8)

# Arch: an ogee pointed arch in a unit square, for clip and rim alike.
arch_d = (
    'M0 1V0.44C0 0.26 0.1 0.14 0.26 0.1C0.38 0.07 0.46 0.04 0.5 0'
    'C0.54 0.04 0.62 0.07 0.74 0.1C0.9 0.14 1 0.26 1 0.44V1Z'
)

components = {
    'Defs': f'''---
/**
 * Shared ornament definitions, included once by BaseLayout: the girih lattice
 * pattern, the gilt gradient, the arch clip, and the corner rosette. Other
 * components refer to them by id (url(#girih), url(#gilt), url(#arch),
 * href="#corner"), so each ornament is drawn in one place.
 */
---

<svg width="0" height="0" class="absolute" aria-hidden="true" focusable="false">
  <defs>
    <pattern id="girih" width="{T}" height="{T}" patternUnits="userSpaceOnUse">
      <path d="{lattice}" fill="none" stroke-width="1" style="stroke: var(--color-gold)"></path>
    </pattern>
    <linearGradient id="gilt" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" style="stop-color: var(--color-gold-deep)"></stop>
      <stop offset="0.5" style="stop-color: var(--color-gold-light)"></stop>
      <stop offset="1" style="stop-color: var(--color-gold-deep)"></stop>
    </linearGradient>
    <clipPath id="arch" clipPathUnits="objectBoundingBox">
      <path d="{arch_d}"></path>
    </clipPath>
    <symbol id="corner" viewBox="0 0 24 24">
      <path d="{corner_ring}" fill="none" stroke="currentColor" stroke-width="1"></path>
      <path d="{corner_d}" fill="currentColor"></path>
    </symbol>
    <symbol id="rosette" viewBox="0 0 24 24">
      <path d="{rosette_d}" fill="currentColor"></path>
    </symbol>
  </defs>
</svg>
''',
    'Lattice': '''---
/**
 * A faint girih lattice over a section's background. Colour and opacity come
 * from the class (`text-gold opacity-10`); `fade` clears the middle so text
 * sits on plain ground.
 */
interface Props {
  class?: string;
  fade?: boolean;
}
const { class: className = 'text-gold opacity-10', fade = false } = Astro.props;
---

<svg
  aria-hidden="true"
  focusable="false"
  class:list={[
    'pointer-events-none absolute inset-0 size-full',
    fade && '[mask-image:radial-gradient(ellipse_at_center,transparent_30%,black_100%)]',
    className,
  ]}
>
  <rect width="100%" height="100%" fill="url(#girih)"></rect>
</svg>
''',
    'Shamsa': f'''---
/** A sunburst medallion in hairlines; size and colour come from the class. */
interface Props {{
  class?: string;
}}
const {{ class: className = 'size-40 text-gold' }} = Astro.props;
---

<svg aria-hidden="true" focusable="false" viewBox="0 0 120 120" class:list={{['pointer-events-none', className]}}>
  <path d="{shamsa_d}" fill="none" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"></path>
</svg>
''',
    'Headpiece': f'''---
/**
 * The headpiece above a page title: a ruled band with a crested centre and
 * finials, drawn in gilt hairlines. Width comes from the class.
 */
interface Props {{
  class?: string;
}}
const {{ class: className = 'w-full max-w-[32rem]' }} = Astro.props;
---

<svg aria-hidden="true" focusable="false" viewBox="0 0 {W} {H}" class:list={{['pointer-events-none block h-auto', className]}}>
  <path d="{head_d}" fill="none" stroke="url(#gilt)" stroke-width="1.2" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>
  <path d="{crest_d}" fill="currentColor"></path>
</svg>
''',
    'Frame': '''---
/**
 * A ruled frame (jadwal) around a section: double hairlines with a rosette at
 * each corner. Absolutely positioned inside a `relative` parent; on phones only
 * the top and bottom rules show, so the frame never crowds the text.
 */
interface Props {
  class?: string;
}
const { class: className = 'inset-2 sm:inset-3 lg:inset-5' } = Astro.props;
const corner = 'absolute size-5 text-gold';
---

<div aria-hidden="true" class:list={['pointer-events-none absolute', className]}>
  <span class="absolute inset-0 border-y border-gold/60 sm:border"></span>
  <span class="absolute inset-[3px] border-y border-gold/30 sm:border"></span>
  <svg class:list={[corner, '-top-2.5 -left-2.5']}><use href="#corner"></use></svg>
  <svg class:list={[corner, '-top-2.5 -right-2.5']}><use href="#corner"></use></svg>
  <svg class:list={[corner, '-bottom-2.5 -left-2.5']}><use href="#corner"></use></svg>
  <svg class:list={[corner, '-right-2.5 -bottom-2.5']}><use href="#corner"></use></svg>
</div>
''',
    'Rosette': '''---
/** A small eight-point rosette, filled with the current colour. */
interface Props {
  class?: string;
}
const { class: className = 'size-3.5 text-gold' } = Astro.props;
---

<svg aria-hidden="true" focusable="false" class:list={['pointer-events-none shrink-0', className]}><use href="#rosette"></use></svg>
''',
}

OUT.mkdir(exist_ok=True)
for name, body in components.items():
    (OUT / f'{name}.astro').write_text(body)

# Photo.astro draws the arch rim with the same path as the clip.
photo = ROOT / 'src/components/Photo.astro'
text = photo.read_text()
text, n = re.subn(r"const archPath = '[^']*';", f"const archPath = '{arch_d}';", text)
assert n == 1, 'Photo.astro has no archPath line'
photo.write_text(text)

# The rosette as a CSS mask for the band on cards.
svg = f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='{rosette_d}'/></svg>"
mask = 'url("data:image/svg+xml,' + quote(svg, safe="/:'=<>") + '")'
css = CSS.read_text()
css, n = re.subn(r'url\("data:image/svg\+xml,[^"]*"\)', lambda _: mask, css)
assert n == 1, 'global.css has no rosette mask'
CSS.write_text(css)
print('wrote', ', '.join(sorted(p.name for p in OUT.iterdir())), 'and updated Photo.astro and global.css')
