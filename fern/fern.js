/* =========================================================================
   FERN FORGE — fern.js
   Grows branching forms (trees, ferns, bushes, coral, willow, winter,
   vine, snowflake) from a rule that is repeated several times.
   Plain Canvas 2D, no build step, no dependencies.

   Complete feature set:
     - 8 presets, curve + wildness sliders, orientation
     - tapered branches, color flow base -> tip, buds / leaves
     - optional left/right mirroring
     - line art or solid silhouette fill
     - solid or gradient background
     - growth animation (toggleable)
     - readable / editable / copyable seed
     - remember settings between visits
     - aspect-aware scaling so tall wallpapers fill the canvas
     - safe export ceiling with automatic quality adjustment
   ========================================================================= */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     1. OUTPUT SIZES  (same two shapes as Pattern Weaver and Flow Field)
     --------------------------------------------------------------------- */
  const SIZES = {
    square: { w: 900,  h: 900  },   // Square 900 x 900
    a17:    { w: 1080, h: 2340 }    // Samsung A17 wallpaper
  };

  // Hard ceiling so a phone never chokes. If the shape would grow past this
  // many drawing instructions, we stop expanding and draw what we have.
  const MAX_TOKENS = 40000;

  // Export safety limits. A single canvas that is too large or has too many
  // pixels can fail silently on phones, especially iPhones.
  const MAX_CANVAS_DIM    = 8192;
  const MAX_EXPORT_PIXELS = 16000000;

  const LS_KEY = 'fernForgeSettingsV1';

  /* ---------------------------------------------------------------------
     2. PRESETS
     Each preset is a rulebook plus a set of starting values.
       F  = draw one segment
       +  = turn one way
       -  = turn the other way
       [  = remember this spot
       ]  = jump back to the remembered spot (this is what makes branches)
       X  = a placeholder rule (used by Fern); it is replaced, not drawn
     --------------------------------------------------------------------- */
  const LOOK_DEFAULTS = {
    width: 0.007,     // trunk thickness as a fraction of the drawing's short side
    taper: 2.0,       // how quickly branches thin out (higher = faster)
    tipFloor: 0.06,   // thinnest tip thickness, as a fraction of trunk
    accentScale: 1.0  // size of buds / leaves
  };

  const PRESETS = {
    tree: {
      axiom: 'F',
      rules: { F: 'F[+F]F[-F]F' },
      depth: 5, angle: 22, shrink: 0.75, jitter: 8, curve: 14, wild: 5, orient: 'up',
      look: { width: 0.008, taper: 2.2, tipFloor: 0.05, accentScale: 1.0 }
    },
    fern: {
      axiom: 'X',
      rules: { X: 'F[+X]F[-X]+X', F: 'FF' },
      depth: 5, angle: 25, shrink: 0.60, jitter: 10, curve: 22, wild: 8, orient: 'up',
      look: { width: 0.004, taper: 1.2, tipFloor: 0.35, accentScale: 1.2 }
    },
    bush: {
      axiom: 'F',
      rules: { F: 'F[+F]F[-F][F]' },
      depth: 4, angle: 30, shrink: 0.70, jitter: 12, curve: 20, wild: 12, orient: 'up',
      look: { width: 0.006, taper: 1.6, tipFloor: 0.15, accentScale: 0.9 }
    },
    coral: {
      axiom: 'F',
      rules: { F: 'F[+F][-F]' },
      depth: 5, angle: 22, shrink: 0.68, jitter: 16, curve: 25, wild: 18, orient: 'up',
      look: { width: 0.005, taper: 1.5, tipFloor: 0.30, accentScale: 0.7 }
    },
    willow: {
      axiom: 'F',
      rules: { F: 'F[+F]F[-F][F]' },
      depth: 5, angle: 18, shrink: 0.72, jitter: 10, curve: 28, wild: 10, orient: 'down',
      look: { width: 0.004, taper: 1.0, tipFloor: 0.40, accentScale: 1.1 }
    },
    winter: {
      axiom: 'F',
      rules: { F: 'F[+F]F[-F]F' },
      depth: 6, angle: 34, shrink: 0.62, jitter: 18, curve: 10, wild: 22, orient: 'up',
      look: { width: 0.005, taper: 2.6, tipFloor: 0.03, accentScale: 0.6 }
    },
    vine: {
      axiom: 'F',
      rules: { F: 'F[+F][-F]FF' },
      depth: 5, angle: 16, shrink: 0.78, jitter: 10, curve: 30, wild: 20, orient: 'up',
      look: { width: 0.006, taper: 1.8, tipFloor: 0.20, accentScale: 1.2 }
    },
    snowflake: {
      axiom: 'F',
      rules: { F: 'F[+F][-F]' },
      depth: 4, angle: 38, shrink: 0.72, jitter: 6, curve: 4, wild: 2, orient: 'up',
      mirror: true,
      look: { width: 0.004, taper: 2.0, tipFloor: 0.05, accentScale: 0.7 }
    }
  };

  // Orientation means which direction the first trunk faces. Spreading wide
  // starts several trunks fanned out from the same point.
  const ORIENT = {
    up:     [-Math.PI / 2],
    down:   [ Math.PI / 2],
    side:   [0],
    spread: [-Math.PI * 0.15, -Math.PI * 0.50, -Math.PI * 0.85]
  };

  /* ---------------------------------------------------------------------
     3. DOM
     --------------------------------------------------------------------- */
  const canvas      = document.getElementById('fernCanvas');
  const ctx         = canvas.getContext('2d');
  const wrapEl      = canvas.parentElement;

  const presetRow   = document.getElementById('presetRow');
  const generateBtn = document.getElementById('generateBtn');
  const newSeedBtn  = document.getElementById('newSeedBtn');
  const copySeedBtn = document.getElementById('copySeedBtn');
  const pngBtn      = document.getElementById('pngBtn');
  const jpgBtn      = document.getElementById('jpgBtn');

  const depthEl   = document.getElementById('depth');
  const angleEl   = document.getElementById('angle');
  const shrinkEl  = document.getElementById('shrink');
  const jitterEl  = document.getElementById('jitter');
  const curveEl   = document.getElementById('curve');
  const wildEl    = document.getElementById('wild');

  const depthVal  = document.getElementById('depthVal');
  const angleVal  = document.getElementById('angleVal');
  const shrinkVal = document.getElementById('shrinkVal');
  const jitterVal = document.getElementById('jitterVal');
  const curveVal  = document.getElementById('curveVal');
  const wildVal   = document.getElementById('wildVal');

  const lineColorEl = document.getElementById('lineColor');
  const tipColorEl  = document.getElementById('tipColor');
  const bgColorEl   = document.getElementById('bgColor');
  const bgColor2El  = document.getElementById('bgColor2');
  const bg2Row      = document.getElementById('bg2Row');

  const mirrorToggle  = document.getElementById('mirrorToggle');
  const accentSelect  = document.getElementById('accentSelect');
  const fillSelect    = document.getElementById('fillSelect');
  const flowToggle    = document.getElementById('flowToggle');
  const bgMode        = document.getElementById('bgMode');
  const animToggle    = document.getElementById('animToggle');
  const rememberToggle = document.getElementById('rememberToggle');

  const orientSelect = document.getElementById('orientSelect');
  const sizeSelect   = document.getElementById('sizeSelect');
  const qualitySel   = document.getElementById('qualitySelect');
  const seedInput    = document.getElementById('seedInput');

  /* ---------------------------------------------------------------------
     4. STATE
     --------------------------------------------------------------------- */
  const state = {
    preset: 'tree',
    depth: 5,
    angle: 22,
    shrink: 0.75,
    jitter: 8,
    curve: 14,
    wild: 5,
    orient: 'up',
    mirror: false,
    accent: 'leaves',
    fill: 'lines',
    base: '#7c5cff',
    tip:  '#ffd257',
    flow: true,
    bgMode: 'solid',
    bg:   '#07080d',
    bg2:  '#14172a',
    anim: true,
    remember: true,
    sizeKey: 'square',
    quality: 1,
    seed: (Math.random() * 999999) | 0,
    look: null
  };

  let lastShape = null;   // last computed shape, reused for export
  let renderTimer = null;
  let saveTimer = null;
  let animRaf = null;

  function applyLook() {
    state.look = Object.assign(
      {},
      LOOK_DEFAULTS,
      (PRESETS[state.preset] && PRESETS[state.preset].look) || {}
    );
  }
  applyLook();

  /* ---------------------------------------------------------------------
     5. SEEDED RANDOMNESS
     Same seed always grows the same shape.
     --------------------------------------------------------------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------------------------------------------------------------
     6. EXPAND THE RULE
     Turns the small rulebook into a long instruction list by applying the
     rules once per depth level. Every instruction remembers the level it was
     born at, so deeper branches can be drawn shorter and thinner.
     --------------------------------------------------------------------- */
  function expand(preset, depth) {
    const p = PRESETS[preset];
    let tokens = [];
    for (const ch of p.axiom) tokens.push({ c: ch, g: 0 });

    for (let level = 1; level <= depth; level++) {
      const next = [];
      let capped = false;

      for (const t of tokens) {
        const rule = p.rules[t.c];
        if (rule) {
          for (const ch of rule) next.push({ c: ch, g: level });
        } else {
          next.push(t);
        }
        if (next.length > MAX_TOKENS) { capped = true; break; }
      }

      tokens = next;
      if (capped) break;
    }

    return tokens;
  }

  /* ---------------------------------------------------------------------
     7. GROW THE TREE
     A "turtle" starts at the root, follows the instruction list, and records
     every branch it draws as a parent -> child edge. Wildness adds extra
     random variation on top of the base angle and length settings.
     --------------------------------------------------------------------- */
  function growTree(tokens, rng, startDir, opt) {
    const turnBase  = (opt.angle * Math.PI) / 180;
    const jitterRad = (opt.jitter * Math.PI) / 180;
    const wildA     = opt.wild * 0.6;                  // extra turn chaos in radians
    const wildL     = opt.wild * 0.35;                 // extra length variation

    const root = { x: 0, y: 0, dir: startDir, gen: 0, children: [], seg: null };
    let cur = root;
    const stack = [];

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];

      if (t.c === 'F') {
        const baseLen = Math.pow(opt.shrink, t.g);
        const len = baseLen * Math.max(0.2, 1 + (rng() * 2 - 1) * wildL);
        const nx = cur.x + Math.cos(cur.dir) * len;
        const ny = cur.y + Math.sin(cur.dir) * len;
        const child = {
          x: nx, y: ny, dir: cur.dir, gen: t.g, children: [],
          seg: { x1: cur.x, y1: cur.y, x2: nx, y2: ny, gen: t.g, dir: cur.dir }
        };
        cur.children.push(child);
        cur = child;
      } else if (t.c === '+') {
        cur.dir += turnBase + (rng() * 2 - 1) * jitterRad + (rng() * 2 - 1) * wildA;
      } else if (t.c === '-') {
        cur.dir -= turnBase + (rng() * 2 - 1) * jitterRad + (rng() * 2 - 1) * wildA;
      } else if (t.c === '[') {
        stack.push({ node: cur, dir: cur.dir });
      } else if (t.c === ']') {
        if (stack.length) {
          const saved = stack.pop();
          cur = saved.node;
          cur.dir = saved.dir;
        }
      }
    }

    return root;
  }

  /* ---------------------------------------------------------------------
     8. FLATTEN THE TREE
     Converts the tree into per-generation lists of curved segments plus a
     list of every branch tip (a point with no children). Curved segments are
     drawn as gentle quadratic curves.
     --------------------------------------------------------------------- */
  function flatten(root, curveAmt) {
    const groups = {};
    const tips = [];
    let maxGen = 0;

    const stack = [root];
    while (stack.length) {
      const n = stack.pop();

      if (n.seg) {
        const g = n.seg.gen;
        if (g > maxGen) maxGen = g;

        const dx = n.seg.x2 - n.seg.x1;
        const dy = n.seg.y2 - n.seg.y1;
        const len = Math.hypot(dx, dy) || 1e-6;
        const mx = (n.seg.x1 + n.seg.x2) / 2;
        const my = (n.seg.y1 + n.seg.y2) / 2;

        // Bend to one side. The sign comes from the coordinates themselves,
        // so the same shape always bends the same way.
        const sign = ((Math.floor(n.seg.x1 * 10000) + Math.floor(n.seg.y1 * 10000)) & 1) ? 1 : -1;
        const off = len * curveAmt * sign;

        const seg = {
          x1: n.seg.x1, y1: n.seg.y1,
          x2: n.seg.x2, y2: n.seg.y2,
          cx: mx + (-dy / len) * off,
          cy: my + (dx / len) * off
        };

        if (!groups[g]) groups[g] = [];
        groups[g].push(seg);
      }

      if (n.seg && n.children.length === 0) {
        tips.push({ x: n.x, y: n.y, dir: n.dir, gen: n.gen });
      }

      for (let i = n.children.length - 1; i >= 0; i--) {
        stack.push(n.children[i]);
      }
    }

    return { groups, tips, maxGen };
  }

  function mergeShapes(list) {
    const out = { groups: {}, tips: [], maxGen: 0 };
    for (const s of list) {
      for (const g in s.groups) {
        if (!out.groups[g]) out.groups[g] = [];
        out.groups[g] = out.groups[g].concat(s.groups[g]);
      }
      out.tips = out.tips.concat(s.tips);
      if (s.maxGen > out.maxGen) out.maxGen = s.maxGen;
    }
    return out;
  }

  /* ---------------------------------------------------------------------
     9. MIRROR
     Duplicates the shape across the vertical center line so the result is
     perfectly symmetrical left and right.
     --------------------------------------------------------------------- */
  function mirrorShape(shape) {
    const groups = {};
    for (const g in shape.groups) {
      const arr = shape.groups[g];
      const out = new Array(arr.length * 2);
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        out[i] = s;
        out[i + arr.length] = { x1: -s.x1, y1: s.y1, x2: -s.x2, y2: s.y2, cx: -s.cx, cy: s.cy };
      }
      groups[g] = out;
    }

    const tips = new Array(shape.tips.length * 2);
    for (let i = 0; i < shape.tips.length; i++) {
      const t = shape.tips[i];
      tips[i] = t;
      tips[i + shape.tips.length] = { x: -t.x, y: t.y, dir: Math.PI - t.dir, gen: t.gen };
    }

    return { groups, tips, maxGen: shape.maxGen };
  }

  /* ---------------------------------------------------------------------
     10. COLOR HELPERS
     --------------------------------------------------------------------- */
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToCss(r, g, b) {
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  }

  function lerpColor(a, b, t) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    return rgbToCss(
      A[0] + (B[0] - A[0]) * t,
      A[1] + (B[1] - A[1]) * t,
      A[2] + (B[2] - A[2]) * t
    );
  }

  /* ---------------------------------------------------------------------
     11. BUILD THE SHAPE
     Expands the rule once, grows every starting trunk with the same random
     stream, merges them, and mirrors if requested.
     --------------------------------------------------------------------- */
  function buildShape() {
    const tokens = expand(state.preset, state.depth);
    const rng = mulberry32(state.seed);
    const dirs = ORIENT[state.orient] || ORIENT.up;

    const parts = dirs.map(function (dir) {
      const root = growTree(tokens, rng, dir, {
        angle:  state.angle,
        shrink: state.shrink,
        jitter: state.jitter,
        wild:   state.wild / 100
      });
      return flatten(root, state.curve / 100);
    });

    let shape = mergeShapes(parts);
    if (state.mirror) shape = mirrorShape(shape);
    return shape;
  }

  /* ---------------------------------------------------------------------
     12. FIT, BACKGROUND, DRAW
     --------------------------------------------------------------------- */

  function fillBackground(c, W, H, s) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (s.bgMode === 'gradient') {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, s.bg);
      g.addColorStop(1, s.bg2);
      c.fillStyle = g;
    } else {
      c.fillStyle = s.bg;
    }
    c.fillRect(0, 0, W, H);
  }

  // Works out how the shape lands in the canvas. A shape is scaled up to fit
  // both axes, then gently stretched toward the long axis so tall wallpapers
  // are mostly filled instead of leaving big empty bands. Streching stays
  // capped so the plant still looks natural.
  function computeFit(shape, W, H) {
    if (!shape || !shape.groups) return null;

    const gens = Object.keys(shape.groups).map(Number);
    if (!gens.length) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const g of gens) {
      for (const s of shape.groups[g]) {
        if (s.x1 < minX) minX = s.x1;
        if (s.x2 < minX) minX = s.x2;
        if (s.cx < minX) minX = s.cx;
        if (s.y1 < minY) minY = s.y1;
        if (s.y2 < minY) minY = s.y2;
        if (s.cy < minY) minY = s.cy;
        if (s.x1 > maxX) maxX = s.x1;
        if (s.x2 > maxX) maxX = s.x2;
        if (s.cx > maxX) maxX = s.cx;
        if (s.y1 > maxY) maxY = s.y1;
        if (s.y2 > maxY) maxY = s.y2;
        if (s.cy > maxY) maxY = s.cy;
      }
    }

    const bw = Math.max(maxX - minX, 1e-6);
    const bh = Math.max(maxY - minY, 1e-6);

    const margin = Math.min(W, H) * 0.07;
    const availW = Math.max(W - margin * 2, 1);
    const availH = Math.max(H - margin * 2, 1);

    const contain = Math.min(availW / bw, availH / bh);
    const STRETCH_MAX = 1.9;

    const sx = contain * Math.min(STRETCH_MAX, Math.max(1, (availW / bw) / contain));
    const sy = contain * Math.min(STRETCH_MAX, Math.max(1, (availH / bh) / contain));

    const offX = (W - bw * sx) / 2 - minX * sx;
    const offY = (H - bh * sy) / 2 - minY * sy;

    return {
      sx, sy,
      offX, offY,
      strokeScale: contain,                 // uniform scale used for line width
      worldMin: Math.min(bw, bh)
    };
  }

  function drawGenerations(c, W, H, opts, shape, upToGen, showTips, fit) {
    fillBackground(c, W, H, opts);
    if (!fit) return;

    const maxGen = Math.max(1, shape.maxGen || 1);
    const baseW = fit.worldMin * opts.look.width;

    if (opts.fill === 'silhouette') {
      // Solid-looking plant: much thicker bodies so branches read as a filled
      // form rather than fine lines.
      baseW *= 3.2;
    }

    // Precompute thickness and color for every generation.
    const widths = new Array(maxGen + 1);
    const colors = new Array(maxGen + 1);
    const tipFloor = opts.fill === 'silhouette' ? 0.20 : opts.look.tipFloor;

    for (let g = 0; g <= maxGen; g++) {
      const t = g / maxGen;
      widths[g] = Math.max(baseW * (tipFloor + (1 - tipFloor) * Math.pow(1 - t, opts.look.taper)), 1);
      colors[g] = opts.flow ? lerpColor(opts.base, opts.tip, t) : opts.base;
    }

    c.lineCap = 'round';
    c.lineJoin = 'round';

    for (let g = 0; g <= Math.min(upToGen, maxGen); g++) {
      const arr = shape.groups[g];
      if (!arr || !arr.length) continue;

      c.strokeStyle = colors[g];
      c.lineWidth = Math.max(widths[g] * fit.strokeScale, 1);

      c.beginPath();
      for (const s of arr) {
        const x1 = s.x1 * fit.sx + fit.offX;
        const y1 = s.y1 * fit.sy + fit.offY;
        const x2 = s.x2 * fit.sx + fit.offX;
        const y2 = s.y2 * fit.sy + fit.offY;
        const cx = s.cx * fit.sx + fit.offX;
        const cy = s.cy * fit.sy + fit.offY;

        c.moveTo(x1, y1);
        c.quadraticCurveTo(cx, cy, x2, y2);
      }
      c.stroke();
    }

    // Tips and leaves go on top, only once the growth is nearly done.
    if (showTips && shape.tips && opts.accent && opts.accent !== 'none') {
      c.fillStyle = opts.tip;
      const leafLen = fit.worldMin * 0.035 * opts.look.accentScale * fit.strokeScale;
      const leafWid = leafLen * 0.42;
      const budR = fit.worldMin * 0.014 * opts.look.accentScale * fit.strokeScale;

      for (const tp of shape.tips) {
        const px = tp.x * fit.sx + fit.offX;
        const py = tp.y * fit.sy + fit.offY;

        if (opts.accent === 'leaves') {
          const dir = Math.atan2(Math.sin(tp.dir) * fit.sy, Math.cos(tp.dir) * fit.sx);
          c.save();
          c.translate(px, py);
          c.rotate(dir);
          c.beginPath();
          c.ellipse(0, 0, leafLen, leafWid, 0, 0, Math.PI * 2);
          c.fill();
          c.restore();
        } else if (opts.accent === 'buds') {
          c.beginPath();
          c.arc(px, py, budR, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
  }

  function drawTo(c, W, H, shape, opts) {
    const fit = computeFit(shape, W, H);
    drawGenerations(c, W, H, opts, shape, shape && shape.maxGen || 0, true, fit);
  }

  /* ---------------------------------------------------------------------
     13. PREVIEW + ANIMATION
     --------------------------------------------------------------------- */
  function fitPreviewBox() {
    const size = SIZES[state.sizeKey];
    const aspect = size.h / size.w;

    const style = window.getComputedStyle(wrapEl);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);

    const availW = Math.max(wrapEl.clientWidth - padX, 120);
    const availH = Math.max(window.innerHeight * 0.44, 160);

    let w = availW;
    let h = w * aspect;
    if (h > availH) { h = availH; w = h / aspect; }

    return { w, h };
  }

  function startAnimation(shape) {
    if (animRaf) cancelAnimationFrame(animRaf);

    const W = canvas.width;
    const H = canvas.height;
    const fit = computeFit(shape, W, H);
    const maxGen = Math.max(1, shape.maxGen || 1);
    const duration = 900;
    const t0 = performance.now();

    function frame(now) {
      const p = Math.min(1, (now - t0) / duration);
      const upTo = Math.floor(p * (maxGen + 1)) - 1;
      const showTips = p > 0.86;
      drawGenerations(ctx, W, H, state, shape, upTo, showTips, fit);

      if (p < 1) {
        animRaf = requestAnimationFrame(frame);
      } else {
        animRaf = null;
      }
    }

    animRaf = requestAnimationFrame(frame);
  }

  function renderPreview(animate) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = fitPreviewBox();

    canvas.width  = Math.max(1, Math.round(box.w * dpr));
    canvas.height = Math.max(1, Math.round(box.h * dpr));
    canvas.style.width  = box.w + 'px';
    canvas.style.height = box.h + 'px';

    lastShape = buildShape();

    if (animate && state.anim) {
      startAnimation(lastShape);
    } else {
      drawTo(ctx, canvas.width, canvas.height, lastShape, state);
    }
  }

  function schedulePreview() {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(function () { renderPreview(false); }, 80);
  }

  /* ---------------------------------------------------------------------
     14. TOAST + SAVING + SEED
     --------------------------------------------------------------------- */
  function notify(msg) {
    let el = document.getElementById('fernToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fernToast';
      el.style.cssText =
        'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);' +
        'background:#1c2130;border:1px solid #333a4d;color:#eef0f7;' +
        'font-size:12px;font-weight:700;padding:10px 16px;border-radius:999px;' +
        'z-index:99;opacity:0;transition:opacity .2s ease;pointer-events:none;' +
        'max-width:88vw;text-align:center;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.opacity = '0'; }, 2200);
  }

  function snapshot() {
    return {
      preset: state.preset, depth: state.depth, angle: state.angle,
      shrink: state.shrink, jitter: state.jitter, curve: state.curve,
      wild: state.wild, orient: state.orient, mirror: state.mirror,
      accent: state.accent, fill: state.fill, base: state.base, tip: state.tip,
      flow: state.flow, bgMode: state.bgMode, bg: state.bg, bg2: state.bg2,
      anim: state.anim, remember: state.remember, sizeKey: state.sizeKey,
      quality: state.quality, seed: state.seed
    };
  }

  function saveSettings() {
    if (!state.remember) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(snapshot()));
    } catch (e) { /* storage may be blocked; the tool still works */ }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSettings, 300);
  }

  function restoreSettings() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(LS_KEY));
    } catch (e) {
      saved = null;
    }
    if (!saved) return;

    const picks = ['preset', 'depth', 'angle', 'shrink', 'jitter', 'curve', 'wild',
      'orient', 'mirror', 'accent', 'fill', 'base', 'tip', 'flow', 'bgMode', 'bg',
      'bg2', 'anim', 'remember', 'sizeKey', 'quality', 'seed'];
    for (const k of picks) {
      if (saved[k] !== undefined) state[k] = saved[k];
    }

    if (!PRESETS[state.preset]) state.preset = 'tree';
    if (!ORIENT[state.orient]) state.orient = 'up';
    if (['none', 'buds', 'leaves'].indexOf(state.accent) === -1) state.accent = 'leaves';
    if (['lines', 'silhouette'].indexOf(state.fill) === -1) state.fill = 'lines';
    if (['solid', 'gradient'].indexOf(state.bgMode) === -1) state.bgMode = 'solid';
    if (!SIZES[state.sizeKey]) state.sizeKey = 'square';
    state.seed = Math.max(0, Math.min(999999, Math.floor(state.seed)));
  }

  function copySeed() {
    const text = String(state.seed);
    const done = function () { notify('Seed copied'); };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else {
      fallback();
    }

    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        done();
      } catch (e) {
        notify('Copy failed — seed ' + text);
      }
      document.body.removeChild(ta);
    }
  }

  /* ---------------------------------------------------------------------
     15. EXPORT
     Draws a fresh copy at full output size and saves it to the phone.
     --------------------------------------------------------------------- */
  function exportImage(type) {
    const size = SIZES[state.sizeKey];
    let quality = parseInt(qualitySel.value, 10) || 1;

    while (quality > 1 && (
      size.w * quality > MAX_CANVAS_DIM ||
      size.h * quality > MAX_CANVAS_DIM ||
      size.w * quality * size.h * quality > MAX_EXPORT_PIXELS
    )) {
      quality--;
    }

    const requested = parseInt(qualitySel.value, 10) || 1;
    if (quality !== requested) {
      notify('Quality lowered to ' + quality + '× to keep this phone safe.');
    }

    const outW = size.w * quality;
    const outH = size.h * quality;

    const off = document.createElement('canvas');
    off.width = outW;
    off.height = outH;
    const octx = off.getContext('2d');

    const shape = lastShape || buildShape();
    drawTo(octx, outW, outH, shape, state);

    let url;
    if (type === 'jpeg') {
      url = off.toDataURL('image/jpeg', 0.92);
    } else {
      url = off.toDataURL('image/png');
    }

    const ext = type === 'jpeg' ? 'jpg' : 'png';
    const name = 'fern-forge-' + state.sizeKey + '-' + state.seed + '.' + ext;

    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    notify('Saved ' + outW + '×' + outH + ' ' + ext.toUpperCase());
  }

  /* ---------------------------------------------------------------------
     16. CONTROLS
     --------------------------------------------------------------------- */
  function updateSliderLabels() {
    depthVal.textContent  = state.depth;
    angleVal.textContent  = state.angle + '°';
    shrinkVal.textContent = state.shrink.toFixed(2);
    jitterVal.textContent = state.jitter;
    curveVal.textContent  = state.curve;
    wildVal.textContent   = state.wild;
  }

  function syncAllControls() {
    const chips = presetRow.querySelectorAll('.chip');
    for (let i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('active', chips[i].dataset.preset === state.preset);
    }

    depthEl.value  = state.depth;
    angleEl.value  = state.angle;
    shrinkEl.value = Math.round(state.shrink * 100);
    jitterEl.value = state.jitter;
    curveEl.value  = state.curve;
    wildEl.value   = state.wild;
    updateSliderLabels();

    orientSelect.value  = state.orient;
    accentSelect.value  = state.accent;
    fillSelect.value    = state.fill;
    bgMode.value        = state.bgMode;
    sizeSelect.value    = state.sizeKey;
    qualitySel.value    = String(state.quality);

    lineColorEl.value = state.base;
    tipColorEl.value  = state.tip;
    bgColorEl.value   = state.bg;
    bgColor2El.value  = state.bg2;

    flowToggle.checked    = state.flow;
    mirrorToggle.checked  = state.mirror;
    animToggle.checked    = state.anim;
    rememberToggle.checked = state.remember;

    bg2Row.classList.toggle('hidden', state.bgMode !== 'gradient');
    seedInput.value = String(state.seed);
  }

  function setPreset(name) {
    const p = PRESETS[name];
    if (!p) return;

    state.preset = name;
    state.depth  = p.depth;
    state.angle  = p.angle;
    state.shrink = p.shrink;
    state.jitter = p.jitter;
    state.curve  = p.curve;
    state.wild   = p.wild;
    state.orient = p.orient;
    if (p.mirror !== undefined) state.mirror = p.mirror;

    applyLook();
    syncAllControls();

    state.seed = (Math.random() * 999999) | 0;
    seedInput.value = String(state.seed);
    scheduleSave();
    renderPreview(true);
  }

  presetRow.addEventListener('click', function (e) {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    setPreset(chip.dataset.preset);
  });

  depthEl.addEventListener('input', function () {
    state.depth = parseInt(depthEl.value, 10);
    updateSliderLabels(); scheduleSave(); schedulePreview();
  });
  angleEl.addEventListener('input', function () {
    state.angle = parseInt(angleEl.value, 10);
    updateSliderLabels(); scheduleSave(); schedulePreview();
  });
  shrinkEl.addEventListener('input', function () {
    state.shrink = parseInt(shrinkEl.value, 10) / 100;
    updateSliderLabels(); scheduleSave(); schedulePreview();
  });
  jitterEl.addEventListener('input', function () {
    state.jitter = parseInt(jitterEl.value, 10);
    updateSliderLabels(); scheduleSave(); schedulePreview();
  });
  curveEl.addEventListener('input', function () {
    state.curve = parseInt(curveEl.value, 10);
    updateSliderLabels(); scheduleSave(); schedulePreview();
  });
  wildEl.addEventListener('input', function () {
    state.wild = parseInt(wildEl.value, 10);
    updateSliderLabels(); scheduleSave(); schedulePreview();
  });

  orientSelect.addEventListener('change', function () {
    state.orient = orientSelect.value; scheduleSave(); renderPreview(true);
  });
  accentSelect.addEventListener('change', function () {
    state.accent = accentSelect.value; scheduleSave(); renderPreview(false);
  });
  fillSelect.addEventListener('change', function () {
    state.fill = fillSelect.value; scheduleSave(); renderPreview(false);
  });

  lineColorEl.addEventListener('input', function () {
    state.base = lineColorEl.value; scheduleSave(); renderPreview(false);
  });
  tipColorEl.addEventListener('input', function () {
    state.tip = tipColorEl.value; scheduleSave(); renderPreview(false);
  });
  bgColorEl.addEventListener('input', function () {
    state.bg = bgColorEl.value; scheduleSave(); renderPreview(false);
  });
  bgColor2El.addEventListener('input', function () {
    state.bg2 = bgColor2El.value; scheduleSave(); renderPreview(false);
  });

  flowToggle.addEventListener('change', function () {
    state.flow = flowToggle.checked; scheduleSave(); renderPreview(false);
  });
  mirrorToggle.addEventListener('change', function () {
    state.mirror = mirrorToggle.checked; scheduleSave(); renderPreview(false);
  });
  animToggle.addEventListener('change', function () {
    state.anim = animToggle.checked; scheduleSave();
  });

  bgMode.addEventListener('change', function () {
    state.bgMode = bgMode.value;
    bg2Row.classList.toggle('hidden', state.bgMode !== 'gradient');
    scheduleSave(); renderPreview(false);
  });

  rememberToggle.addEventListener('change', function () {
    state.remember = rememberToggle.checked;
    if (state.remember) {
      scheduleSave();
      notify('Settings will be remembered');
    } else {
      try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
      notify('Settings not remembered');
    }
  });

  sizeSelect.addEventListener('change', function () {
    state.sizeKey = sizeSelect.value; scheduleSave(); renderPreview(false);
  });
  qualitySel.addEventListener('change', function () {
    state.quality = parseInt(qualitySel.value, 10) || 1; scheduleSave();
  });

  seedInput.addEventListener('change', function () {
    const v = parseInt(seedInput.value, 10);
    if (!Number.isNaN(v)) {
      state.seed = Math.max(0, Math.min(999999, v));
      seedInput.value = String(state.seed);
      scheduleSave();
      renderPreview(true);
    } else {
      seedInput.value = String(state.seed);
    }
  });

  generateBtn.addEventListener('click', function () {
    renderPreview(true);
    notify('Generated — seed ' + state.seed);
  });

  newSeedBtn.addEventListener('click', function () {
    state.seed = (Math.random() * 999999) | 0;
    seedInput.value = String(state.seed);
    scheduleSave();
    renderPreview(true);
    notify('New seed ' + state.seed);
  });

  copySeedBtn.addEventListener('click', copySeed);

  pngBtn.addEventListener('click', function () { exportImage('png'); });
  jpgBtn.addEventListener('click', function () { exportImage('jpeg'); });

  window.addEventListener('resize', schedulePreview);
  window.addEventListener('orientationchange', function () {
    setTimeout(function () { renderPreview(false); }, 250);
  });

  /* ---------------------------------------------------------------------
     17. START
     --------------------------------------------------------------------- */
  restoreSettings();
  applyLook();
  syncAllControls();
  renderPreview(true);
  notify('Seed ' + state.seed);
  scheduleSave();

})();