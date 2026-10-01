/* =========================================================================
   PATTERN WEAVER — pattern.js
   Four pattern styles: Islamic geometry, Celtic knotwork, repeating motif,
   procedural rules. Seeded RNG, live preview, PNG/JPG export.
   Color system: 4 pattern colors + background(s), per-color opacity,
   HSL editing, harmony generation, gradient backgrounds, saved palettes.
   Pure client-side. No dependencies.
   ========================================================================= */

(function () {
  "use strict";

  /* =======================================================================
     DOM REFERENCES
     ======================================================================= */
  const canvas = document.getElementById("patternCanvas");
  let ctx = canvas.getContext("2d");

  const patternStyle  = document.getElementById("patternStyle");
  const seed          = document.getElementById("seed");
  const btnRandomizeSeed = document.getElementById("btnRandomizeSeed");
  const btnRandomizeAll  = document.getElementById("btnRandomizeAll");
  const btnRandomizeTop  = document.getElementById("btnRandomizeTop");

  // Harmony generator
  const harmonyBase   = document.getElementById("harmonyBase");
  const harmonyRule   = document.getElementById("harmonyRule");
  const btnApplyHarmony = document.getElementById("btnApplyHarmony");

  // Active color editor
  const colorTabs     = Array.from(document.querySelectorAll(".colorTab"));
  const activeColorLabel = document.getElementById("activeColorLabel");
  const activeColorInput = document.getElementById("activeColorInput");
  const hueSlider     = document.getElementById("hueSlider");
  const satSlider     = document.getElementById("satSlider");
  const lightSlider   = document.getElementById("lightSlider");
  const opacitySlider = document.getElementById("opacitySlider");
  const valHue        = document.getElementById("valHue");
  const valSat        = document.getElementById("valSat");
  const valLight      = document.getElementById("valLight");
  const valOpacity    = document.getElementById("valOpacity");

  // Background
  const bgStyle       = document.getElementById("bgStyle");
  const bgDir         = document.getElementById("bgDir");
  const bgDirRow      = document.getElementById("bgDirRow");

  // Saved custom palettes
  const palettePresetList = document.getElementById("palettePresetList");
  const btnSavePalette    = document.getElementById("btnSavePalette");
  const btnLoadPalette    = document.getElementById("btnLoadPalette");
  const btnDeletePalette  = document.getElementById("btnDeletePalette");

  const symmetry      = document.getElementById("symmetry");
  const scale         = document.getElementById("scale");
  const density       = document.getElementById("density");
  const lineWeight    = document.getElementById("lineWeight");
  const rotation      = document.getElementById("rotation");

  // Islamic
  const starPoints    = document.getElementById("starPoints");
  const ringCount     = document.getElementById("ringCount");
  const tessellation  = document.getElementById("tessellation");

  // Celtic
  const weaveStyle    = document.getElementById("weaveStyle");
  const loopCount     = document.getElementById("loopCount");
  const ribbonWidth   = document.getElementById("ribbonWidth");

  // Motif
  const motifType     = document.getElementById("motifType");
  const tileRotation  = document.getElementById("tileRotation");
  const tileOffset    = document.getElementById("tileOffset");

  // Procedural
  const ruleSet       = document.getElementById("ruleSet");
  const mutationRate  = document.getElementById("mutationRate");
  const growthSteps   = document.getElementById("growthSteps");

  // Export
  const exportScale   = document.getElementById("exportScale");
  const exportBg      = document.getElementById("exportBg");
  const exportName    = document.getElementById("exportName");
  const btnExportPng  = document.getElementById("btnExportPng");
  const btnExportJpg  = document.getElementById("btnExportJpg");
  const btnCopySeed   = document.getElementById("btnCopySeed");

  // Full-settings presets
  const presetList    = document.getElementById("presetList");
  const btnSavePreset = document.getElementById("btnSavePreset");
  const btnLoadPreset = document.getElementById("btnLoadPreset");
  const btnDeletePreset = document.getElementById("btnDeletePreset");

  // Style groups
  const styleIslamic  = document.getElementById("styleIslamic");
  const styleCeltic   = document.getElementById("styleCeltic");
  const styleMotif    = document.getElementById("styleMotif");
  const styleProcedural = document.getElementById("styleProcedural");

  // Value displays
  const valScale        = document.getElementById("valScale");
  const valDensity      = document.getElementById("valDensity");
  const valLineWeight   = document.getElementById("valLineWeight");
  const valMutationRate = document.getElementById("valMutationRate");

  /* =======================================================================
     CANVAS SIZE
     ======================================================================= */
  const CANVAS_SIZE = 900;
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  /* =======================================================================
     COLOR STATE
     ======================================================================= */
  const PATTERN_SLOTS = ["color1", "color2", "color3", "color4"];
  const ALL_SLOTS = ["color1", "color2", "color3", "color4", "bg", "bg2"];

  const colors = {
    color1: "#7c5cff",
    color2: "#38bdf8",
    color3: "#f472b6",
    color4: "#ffd257",
    bg:     "#07080d",
    bg2:    "#1c2130"
  };

  const opacities = {
    color1: 100,
    color2: 100,
    color3: 100,
    color4: 100,
    bg:     100,
    bg2:    100
  };

  let activeSlot = "color1";

  /* =======================================================================
     COLOR HELPERS
     ======================================================================= */
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function hexToRgb(hex) {
    let h = String(hex || "").replace("#", "");
    if (h.length === 3) {
      h = h.split("").map(c => c + c).join("");
    }
    const num = parseInt(h, 16);
    if (isNaN(num)) return { r: 124, g: 92, b: 255 };
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function rgbToHex(r, g, b) {
    const to = v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
    return "#" + to(r) + to(g) + to(b);
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: clamp(h, 0, 360), s: clamp(s * 100, 0, 100), l: clamp(l * 100, 0, 100) };
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s /= 100; l /= 100;

    if (s === 0) {
      const v = l * 255;
      return { r: v, g: v, b: v };
    }

    const hue = h / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const hue2rgb = t => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    return {
      r: hue2rgb(hue + 1 / 3) * 255,
      g: hue2rgb(hue) * 255,
      b: hue2rgb(hue - 1 / 3) * 255
    };
  }

  function hexToHsl(hex) {
    const c = hexToRgb(hex);
    return rgbToHsl(c.r, c.g, c.b);
  }

  function hslToHex(h, s, l) {
    const c = hslToRgb(h, s, l);
    return rgbToHex(c.r, c.g, c.b);
  }

  function hexToRgba(hex, alpha) {
    const c = hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${clamp(alpha, 0, 1)})`;
  }

  // Returns a color string with the slot's own opacity applied on top of alpha.
  function rgbaOf(slot, alpha) {
    const hex = colors[slot] || "#ffffff";
    const op = (opacities[slot] == null ? 100 : opacities[slot]) / 100;
    return hexToRgba(hex, alpha * op);
  }

  function pickColor(minA, maxA) {
    const slot = PATTERN_SLOTS[Math.floor(rng() * PATTERN_SLOTS.length)];
    const alpha = minA + rng() * (maxA - minA);
    return rgbaOf(slot, alpha);
  }

  // Returns both stroke and matching fill, so motif fills honor the palette.
  function pickColorInfo(minA, maxA) {
    const slot = PATTERN_SLOTS[Math.floor(rng() * PATTERN_SLOTS.length)];
    const alpha = minA + rng() * (maxA - minA);
    return {
      slot: slot,
      color: rgbaOf(slot, alpha),
      fill: rgbaOf(slot, alpha * 0.22)
    };
  }

  /* =======================================================================
     HARMONY GENERATOR
     ======================================================================= */
  function harmonyColors(baseHex, rule) {
    const base = hexToHsl(baseHex);
    const h = base.h;
    const s = base.s;
    const l = base.l;
    const hue = deg => (((h + deg) % 360) + 360) % 360;

    let arr = [];
    if (rule === "complementary") {
      arr = [
        { h: h,        s: s,                      l: l },
        { h: hue(180), s: s,                      l: l },
        { h: h,        s: Math.max(0, s - 15),    l: Math.min(100, l + 15) },
        { h: hue(180), s: Math.max(0, s - 15),    l: Math.min(100, l + 15) }
      ];
    } else if (rule === "analogous") {
      arr = [
        { h: hue(-40), s: s, l: l },
        { h: hue(-20), s: s, l: l },
        { h: hue(20),  s: s, l: l },
        { h: hue(40),  s: s, l: l }
      ];
    } else if (rule === "triadic") {
      arr = [
        { h: h,        s: s,                      l: l },
        { h: hue(120), s: s,                      l: l },
        { h: hue(240), s: s,                      l: l },
        { h: h,        s: Math.max(0, s - 10),    l: Math.min(100, l + 18) }
      ];
    } else if (rule === "split") {
      arr = [
        { h: h,        s: s,                      l: l },
        { h: hue(150), s: s,                      l: l },
        { h: hue(210), s: s,                      l: l },
        { h: hue(-15), s: Math.max(0, s - 10),    l: Math.min(100, l + 12) }
      ];
    }

    return arr.map(c => hslToHex(c.h, clamp(c.s, 0, 100), clamp(c.l, 0, 100)));
  }

  function applyHarmony() {
    const generated = harmonyColors(harmonyBase.value, harmonyRule.value);
    generated.forEach((hex, i) => {
      colors[PATTERN_SLOTS[i]] = hex;
      opacities[PATTERN_SLOTS[i]] = 100;
    });
    updateColorEditor();
  }

  /* =======================================================================
     COLOR UI
     ======================================================================= */
  const SLOT_LABELS = {
    color1: "Color 1",
    color2: "Color 2",
    color3: "Color 3",
    color4: "Color 4",
    bg:     "Background",
    bg2:    "Background 2"
  };

  function setActiveSlot(slot) {
    if (!colors[slot]) return;
    activeSlot = slot;
    updateColorEditor();
  }

  function updateColorEditor() {
    const isGradient = bgStyle.value !== "solid";
    const bg2Btn = document.getElementById("tab_bg2");
    if (bg2Btn) bg2Btn.classList.toggle("hidden", !isGradient);
    if (!isGradient && activeSlot === "bg2") activeSlot = "bg";

    colorTabs.forEach(btn => {
      const slot = btn.dataset.slot;
      btn.style.background = colors[slot] || "#ffffff";
      btn.classList.toggle("active", slot === activeSlot);
    });

    activeColorLabel.textContent = SLOT_LABELS[activeSlot] || activeSlot;

    const hex = colors[activeSlot];
    const hsl = hexToHsl(hex);
    activeColorInput.value = hex;

    hueSlider.value = Math.round(hsl.h);
    satSlider.value = Math.round(hsl.s);
    lightSlider.value = Math.round(hsl.l);
    valHue.textContent = Math.round(hsl.h);
    valSat.textContent = Math.round(hsl.s);
    valLight.textContent = Math.round(hsl.l);

    opacitySlider.value = opacities[activeSlot] == null ? 100 : opacities[activeSlot];
    valOpacity.textContent = opacitySlider.value;
  }

  function updateBgControls() {
    const dirRow = document.getElementById("bgDirRow");
    if (dirRow) dirRow.classList.toggle("hidden", bgStyle.value !== "linear");
    updateColorEditor();
  }

  /* =======================================================================
     SEEDED RNG (mulberry32)
     ======================================================================= */
  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    const s = String(str || "");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  let rng = mulberry32(hashSeed(seed.value));

  function reseed() {
    rng = mulberry32(hashSeed(seed.value || "default"));
  }

  /* =======================================================================
     DRAW HELPERS
     ======================================================================= */
  function prepareContext(c) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.lineCap = "butt";
    c.lineJoin = "miter";
    c.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  function resetDrawingState(c) {
    c.lineCap = "butt";
    c.lineJoin = "miter";
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
  }

  function paintBackground(c) {
    const style = bgStyle.value;

    if (style === "solid") {
      c.fillStyle = rgbaOf("bg", 1);
      c.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      return;
    }

    let g;
    if (style === "radial") {
      g = c.createRadialGradient(
        CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0,
        CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE * 0.62
      );
    } else {
      const dir = bgDir.value;
      const coords = {
        "to-bottom":       [0, 0, 0, CANVAS_SIZE],
        "to-top":          [0, CANVAS_SIZE, 0, 0],
        "to-right":        [0, 0, CANVAS_SIZE, 0],
        "to-left":         [CANVAS_SIZE, 0, 0, 0],
        "to-bottom-right": [0, 0, CANVAS_SIZE, CANVAS_SIZE],
        "to-bottom-left":  [CANVAS_SIZE, 0, 0, CANVAS_SIZE],
        "to-top-right":    [0, CANVAS_SIZE, CANVAS_SIZE, 0],
        "to-top-left":     [CANVAS_SIZE, CANVAS_SIZE, 0, 0]
      };
      const d = coords[dir] || coords["to-bottom"];
      g = c.createLinearGradient(d[0], d[1], d[2], d[3]);
    }

    g.addColorStop(0, rgbaOf("bg", 1));
    g.addColorStop(1, rgbaOf("bg2", 1));
    c.fillStyle = g;
    c.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  /* =======================================================================
     STYLE 1 — ISLAMIC GEOMETRY
     ======================================================================= */
  function drawIslamic() {
    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;
    const points = parseInt(starPoints.value, 10);
    const rings = parseInt(ringCount.value, 10);
    const sym = parseInt(symmetry.value, 10);
    const sc = parseFloat(scale.value);
    const dens = parseInt(density.value, 10) / 100;
    const lw = parseInt(lineWeight.value, 10);
    const rot = parseInt(rotation.value, 10) * Math.PI / 180;
    const tess = tessellation.value;

    const baseRadius = (CANVAS_SIZE / 2) * 0.42 * sc;

    for (let r = 1; r <= rings; r++) {
      const radius = baseRadius * (r / rings);
      const ringPoints = sym * r;

      for (let i = 0; i < ringPoints; i++) {
        const angle = (i / ringPoints) * Math.PI * 2 + rot;
        const sx = cx + Math.cos(angle) * radius;
        const sy = cy + Math.sin(angle) * radius;
        const starR = radius * 0.35 * (1 - dens * 0.4) * (1 + rng() * 0.15);
        drawStar(sx, sy, points, starR, points * 1.5, lw, pickColor(0.6, 0.9));
      }
    }

    drawStar(cx, cy, points * 2, baseRadius * 0.45, points * 3, lw * 1.5, rgbaOf("color1", 1));

    if (tess !== "star") {
      ctx.strokeStyle = rgbaOf("color2", 0.35);
      ctx.lineWidth = Math.max(1, lw * 0.5);
      for (let r = 0; r < rings; r++) {
        const radius = baseRadius * ((r + 1) / rings);
        const ringPoints = sym * (r + 1);
        ctx.beginPath();
        for (let i = 0; i <= ringPoints; i++) {
          const angle = (i / ringPoints) * Math.PI * 2 + rot;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  }

  function drawStar(cx, cy, points, outerR, innerR, lw, color) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  /* =======================================================================
     STYLE 2 — CELTIC KNOTWORK
     ======================================================================= */
  function drawCeltic() {
    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;
    const loops = parseInt(loopCount.value, 10);
    const sym = parseInt(symmetry.value, 10);
    const sc = parseFloat(scale.value);
    const dens = parseInt(density.value, 10) / 100;
    const lw = parseInt(lineWeight.value, 10);
    const rot = parseInt(rotation.value, 10) * Math.PI / 180;
    const weave = weaveStyle.value;
    const widthChoice = ribbonWidth.value;
    const ribbonW = widthChoice === "thin" ? lw : widthChoice === "medium" ? lw * 1.8 : lw * 3;

    const baseRadius = (CANVAS_SIZE / 2) * 0.42 * sc;

    for (let i = 0; i < sym; i++) {
      const angle = (i / sym) * Math.PI * 2 + rot;
      const offset = baseRadius * 0.55 * (1 - dens * 0.3);
      const ox = cx + Math.cos(angle) * offset;
      const oy = cy + Math.sin(angle) * offset;

      for (let l = 0; l < loops; l++) {
        const r = baseRadius * (0.35 + l * 0.2) * (1 + rng() * 0.1);
        drawKnotRing(ox, oy, r, ribbonW, weave, i, l);
      }
    }

    const centerR = baseRadius * 0.25;
    drawKnotRing(cx, cy, centerR, ribbonW * 1.2, weave, 999, 0);
  }

  function drawKnotRing(cx, cy, radius, width, weaveStyle, index, loopIdx) {
    const colorA = rgbaOf("color1", 0.85);
    const colorB = rgbaOf("color2", 0.85);
    const accent = rgbaOf("color3", 0.9);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.lineWidth = width;
    ctx.strokeStyle = index % 2 === 0 ? colorA : colorB;
    ctx.stroke();

    if (weaveStyle !== "balanced" || loopIdx % 2 === 0) {
      const segments = 8;
      for (let s = 0; s < segments; s++) {
        const startAngle = (s / segments) * Math.PI * 2 + rng() * 0.3;
        const endAngle = startAngle + (Math.PI * 2 / segments) * 0.4;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.lineWidth = width * 1.15;
        ctx.strokeStyle = accent;
        ctx.stroke();
      }
    }
  }

  /* =======================================================================
     STYLE 3 — REPEATING MOTIF
     ======================================================================= */
  function drawMotif() {
    const sc = parseFloat(scale.value);
    const dens = parseInt(density.value, 10) / 100;
    const lw = parseInt(lineWeight.value, 10);
    const rot = parseInt(rotation.value, 10) * Math.PI / 180;
    const mtype = motifType.value;
    const trot = tileRotation.value;
    const toff = tileOffset.value;

    const gridSize = Math.max(3, Math.round(6 + sc * 6));
    const cell = CANVAS_SIZE / gridSize;

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        let cx = x * cell + cell / 2;
        let cy = y * cell + cell / 2;

        if (toff === "brick" && y % 2 === 1) cx += cell / 2;
        if (toff === "diagonal") {
          cx += (y % 2) * cell / 2;
          cy += (x % 2) * cell / 2;
        }

        let tileRot = rot;
        if (trot === "90") tileRot += (x + y) * Math.PI / 2;
        else if (trot === "180") tileRot += (x + y) * Math.PI;
        else if (trot === "mirror") {
          if ((x + y) % 2 === 1) tileRot += Math.PI;
        }

        const size = cell * 0.35 * (0.7 + rng() * 0.6) * (1 - dens * 0.3);
        const info = pickColorInfo(0.55, 0.95);

        drawMotifShape(cx, cy, size, tileRot, mtype, lw, info.color, info.fill);
      }
    }
  }

  function drawMotifShape(cx, cy, size, rot, type, lw, color, fillColor) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.strokeStyle = color;
    ctx.fillStyle = fillColor;
    ctx.lineWidth = lw;

    if (type === "dot") {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    } else if (type === "diamond") {
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    } else if (type === "petal") {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(
          Math.cos(a) * size, Math.sin(a) * size,
          Math.cos(a + Math.PI / 2) * size, Math.sin(a + Math.PI / 2) * size
        );
      }
      ctx.stroke();
    } else if (type === "arrow") {
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.6, size * 0.6);
      ctx.lineTo(0, size * 0.3);
      ctx.lineTo(-size * 0.6, size * 0.6);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    } else if (type === "eye") {
      ctx.beginPath();
      ctx.ellipse(0, 0, size, size * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* =======================================================================
     STYLE 4 — PROCEDURAL RULES
     ======================================================================= */
  function drawProcedural() {
    const rule = ruleSet.value;
    const mut = parseInt(mutationRate.value, 10) / 100;
    const steps = parseInt(growthSteps.value, 10);
    const lw = parseInt(lineWeight.value, 10);
    const sc = parseFloat(scale.value);
    const dens = parseInt(density.value, 10) / 100;

    if (rule === "truchet") drawTruchet(mut, lw, sc, dens);
    else if (rule === "cellular") drawCellular(mut, lw, sc, dens);
    else if (rule === "flow") drawFlow(mut, lw, sc, dens);
    else if (rule === "branch") drawBranching(mut, lw, sc, dens, steps);
  }

  function drawTruchet(mut, lw, sc, dens) {
    const grid = Math.max(4, Math.round(6 + sc * 6));
    const cell = CANVAS_SIZE / grid;
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const ox = x * cell;
        const oy = y * cell;
        const flip = rng() < 0.5;
        const color = pickColor(0.4, 0.9);
        ctx.strokeStyle = color;
        ctx.lineWidth = lw * (0.6 + dens * 0.8);

        ctx.beginPath();
        if (flip) {
          ctx.arc(ox, oy, cell, 0, Math.PI / 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(ox + cell, oy + cell, cell, Math.PI, Math.PI * 1.5);
          ctx.stroke();
        } else {
          ctx.arc(ox + cell, oy, cell, Math.PI / 2, Math.PI);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(ox, oy + cell, cell, 0, Math.PI / 2);
          ctx.stroke();
        }
      }
    }
  }

  function drawCellular(mut, lw, sc, dens) {
    const grid = Math.max(8, Math.round(10 + sc * 12));
    const cell = CANVAS_SIZE / grid;
    const alive = new Uint8Array(grid * grid);
    for (let i = 0; i < alive.length; i++) alive[i] = rng() < (0.4 + dens * 0.3) ? 1 : 0;

    for (let step = 0; step < 3 + Math.round(dens * 4); step++) {
      const next = new Uint8Array(alive.length);
      for (let y = 0; y < grid; y++) {
        for (let x = 0; x < grid; x++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = (x + dx + grid) % grid;
              const ny = (y + dy + grid) % grid;
              n += alive[ny * grid + nx];
            }
          }
          next[y * grid + x] = (alive[y * grid + x] ? (n === 2 || n === 3) : n === 3) ? 1 : 0;
          if (rng() < mut * 0.15) next[y * grid + x] ^= 1;
        }
      }
      for (let i = 0; i < alive.length; i++) alive[i] = next[i];
    }

    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        if (alive[y * grid + x]) {
          ctx.fillStyle = pickColor(0.5, 0.95);
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }
  }

  function drawFlow(mut, lw, sc, dens) {
    const count = Math.round(40 + sc * 80);
    const steps = Math.round(30 + dens * 60);
    ctx.lineWidth = lw * 0.4;

    for (let i = 0; i < count; i++) {
      let x = rng() * CANVAS_SIZE;
      let y = rng() * CANVAS_SIZE;
      const seedA = rng() * 6;
      const seedB = rng() * 6;
      const color = pickColor(0.3, 0.8);
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y);

      for (let s = 0; s < steps; s++) {
        const angle = Math.sin(x * 0.004 + seedA) + Math.cos(y * 0.004 + seedB) + (rng() - 0.5) * mut;
        x += Math.cos(angle) * 3;
        y += Math.sin(angle) * 3;
        if (x < 0 || x > CANVAS_SIZE || y < 0 || y > CANVAS_SIZE) break;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function drawBranching(mut, lw, sc, dens, steps) {
    ctx.lineCap = "round";
    const safeSteps = Math.min(parseInt(steps, 10) || 5, 8);
    const treeCount = Math.max(3, Math.round(4 + sc * 3));

    for (let t = 0; t < treeCount; t++) {
      const startX = CANVAS_SIZE * (0.2 + (t + 0.5) / treeCount * 0.6);
      const startY = CANVAS_SIZE * 0.9;
      const angle = -Math.PI / 2 + (rng() - 0.5) * 0.3;
      branch(startX, startY, angle, CANVAS_SIZE * 0.22 * sc, safeSteps, lw, mut, dens);
    }
  }

  function branch(x, y, angle, length, depth, lw, mut, dens) {
    if (depth <= 0 || length < 3) return;
    const ex = x + Math.cos(angle) * length;
    const ey = y + Math.sin(angle) * length;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = pickColor(0.5, 0.95);
    ctx.lineWidth = Math.max(1, lw * (depth / 6));
    ctx.stroke();

    // Capped branching prevents exponential freezes on phones.
    const children = 2 + (rng() < 0.4 ? 1 : 0);
    for (let i = 0; i < children; i++) {
      const spread = (i - (children - 1) / 2) * (0.5 + rng() * 0.4) + (rng() - 0.5) * mut;
      branch(ex, ey, angle + spread, length * (0.65 + rng() * 0.2), depth - 1, lw, mut, dens);
    }
  }

  /* =======================================================================
     STYLE-SPECIFIC GROUP VISIBILITY
     ======================================================================= */
  function updateStyleGroups() {
    const style = patternStyle.value;
    styleIslamic.classList.toggle("hidden", style !== "islamic");
    styleCeltic.classList.toggle("hidden", style !== "celtic");
    styleMotif.classList.toggle("hidden", style !== "motif");
    styleProcedural.classList.toggle("hidden", style !== "procedural");
  }

  /* =======================================================================
     RENDER
     ======================================================================= */
  function drawCurrentStyle() {
    const style = patternStyle.value;
    if (style === "islamic") drawIslamic();
    else if (style === "celtic") drawCeltic();
    else if (style === "motif") drawMotif();
    else if (style === "procedural") drawProcedural();
  }

  function renderPreview() {
    reseed();
    prepareContext(ctx);
    paintBackground(ctx);
    drawCurrentStyle();
    resetDrawingState(ctx);
  }

  function renderForExport(withBackground) {
    const mult = parseInt(exportScale.value, 10) || 1;
    const out = document.createElement("canvas");
    out.width = CANVAS_SIZE * mult;
    out.height = CANVAS_SIZE * mult;
    const octx = out.getContext("2d");

    // Clear in device pixels before scaling to logical 900x900 units.
    octx.clearRect(0, 0, out.width, out.height);

    const savedCtx = ctx;
    ctx = octx;
    reseed();
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.globalAlpha = 1;
    octx.globalCompositeOperation = "source-over";
    octx.lineCap = "butt";
    octx.lineJoin = "miter";
    octx.scale(mult, mult);

    if (withBackground) paintBackground(ctx);
    drawCurrentStyle();
    resetDrawingState(ctx);

    ctx = savedCtx;
    return out;
  }

  let renderTimer = null;
  function scheduleRender() {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(renderPreview, 60);
  }

  /* =======================================================================
     WIRE CONTROLS
     ======================================================================= */
  function wireControls() {
    // Composition / mutation sliders
    [
      [scale, valScale],
      [density, valDensity],
      [lineWeight, valLineWeight],
      [mutationRate, valMutationRate]
    ].forEach(([input, span]) => {
      input.addEventListener("input", () => {
        span.textContent = input.value;
        scheduleRender();
      });
    });

    // Dropdowns
    [
      patternStyle, symmetry, rotation,
      starPoints, ringCount, tessellation,
      weaveStyle, loopCount, ribbonWidth,
      motifType, tileRotation, tileOffset,
      ruleSet, growthSteps, bgDir
    ].forEach(el => {
      el.addEventListener("change", () => {
        if (el === patternStyle) updateStyleGroups();
        scheduleRender();
      });
    });

    bgStyle.addEventListener("change", () => {
      updateBgControls();
      scheduleRender();
    });

    // Color tabs
    colorTabs.forEach(btn => {
      btn.addEventListener("click", () => setActiveSlot(btn.dataset.slot));
    });

    // Active color native input
    activeColorInput.addEventListener("input", () => {
      colors[activeSlot] = activeColorInput.value;
      updateColorEditor();
      scheduleRender();
    });

    // HSL sliders
    hueSlider.addEventListener("input", applyHslUpdate);
    satSlider.addEventListener("input", applyHslUpdate);
    lightSlider.addEventListener("input", applyHslUpdate);

    // Opacity
    opacitySlider.addEventListener("input", () => {
      opacities[activeSlot] = parseInt(opacitySlider.value, 10);
      valOpacity.textContent = opacitySlider.value;
      scheduleRender();
    });

    // Harmony
    btnApplyHarmony.addEventListener("click", () => {
      applyHarmony();
      scheduleRender();
    });

    // Seed
    seed.addEventListener("input", scheduleRender);

    // Randomize
    btnRandomizeSeed.addEventListener("click", () => {
      seed.value = randomSeedString();
      scheduleRender();
    });

    btnRandomizeTop.addEventListener("click", () => {
      seed.value = randomSeedString();
      scheduleRender();
    });

    btnRandomizeAll.addEventListener("click", randomizeAll);
  }

  function applyHslUpdate() {
    const h = parseInt(hueSlider.value, 10);
    const s = parseInt(satSlider.value, 10);
    const l = parseInt(lightSlider.value, 10);

    valHue.textContent = h;
    valSat.textContent = s;
    valLight.textContent = l;

    colors[activeSlot] = hslToHex(h, s, l);
    activeColorInput.value = colors[activeSlot];
    updateColorEditor();
    scheduleRender();
  }

  function randomSeedString() {
    const words = ["vorifex", "tithe", "ember", "ashen", "silent", "crown", "iron", "crimson", "veil", "stone", "shadow", "hollow", "gilded", "oath"];
    const w = words[Math.floor(Math.random() * words.length)];
    const n = Math.floor(Math.random() * 9999);
    return w + "-" + n;
  }

  function randomizeAll() {
    seed.value = randomSeedString();
    const styles = ["islamic", "celtic", "motif", "procedural"];
    patternStyle.value = styles[Math.floor(Math.random() * styles.length)];
    symmetry.value = ["4", "6", "8", "12", "16"][Math.floor(Math.random() * 5)];
    scale.value = (0.6 + Math.random() * 1.6).toFixed(2);
    valScale.textContent = scale.value;
    density.value = Math.round(20 + Math.random() * 60);
    valDensity.textContent = density.value;
    updateStyleGroups();
    scheduleRender();
  }

  /* =======================================================================
     EXPORT
     ======================================================================= */
  function exportImage(format) {
    const useTransparent = format === "png" && exportBg.value === "transparent";
    const out = renderForExport(!useTransparent);

    const mime = format === "jpg" ? "image/jpeg" : "image/png";
    const quality = format === "jpg" ? 0.92 : undefined;
    const dataUrl = out.toDataURL(mime, quality);

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = (exportName.value || "pattern") + "." + (format === "jpg" ? "jpg" : "png");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  btnExportPng.addEventListener("click", () => exportImage("png"));
  btnExportJpg.addEventListener("click", () => exportImage("jpg"));

  btnCopySeed.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(seed.value);
      const original = btnCopySeed.textContent;
      btnCopySeed.textContent = "Copied!";
      setTimeout(() => { btnCopySeed.textContent = original; }, 1200);
    } catch (e) {
      prompt("Copy the seed below:", seed.value);
    }
  });

  /* =======================================================================
     FULL-SETTINGS PRESETS
     ======================================================================= */
  const PRESET_KEY = "pattern_weaver_presets_v2";
  const OLD_PRESET_KEY = "pattern_weaver_presets_v1";

  function sanitizeColors(obj) {
    const out = Object.assign({}, colors);
    if (!obj) return out;
    ALL_SLOTS.forEach(slot => {
      const v = obj[slot];
      if (typeof v === "string" && /^#[0-9a-fA-F]{3,6}$/.test(v)) out[slot] = v;
    });
    return out;
  }

  function sanitizeOpacities(obj) {
    const out = Object.assign({}, opacities);
    if (!obj) return out;
    ALL_SLOTS.forEach(slot => {
      const v = obj[slot];
      if (typeof v === "number" && isFinite(v)) out[slot] = clamp(Math.round(v), 0, 100);
    });
    return out;
  }

  function migrateOldPreset(old) {
    const script = {};
    const fields = [
      "patternStyle", "seed", "symmetry", "scale", "density", "lineWeight",
      "rotation", "starPoints", "ringCount", "tessellation", "weaveStyle",
      "loopCount", "ribbonWidth", "motifType", "tileRotation", "tileOffset",
      "ruleSet", "mutationRate", "growthSteps"
    ];
    fields.forEach(f => {
      if (old[f] !== undefined) script[f] = old[f];
    });

    script.colors = {
      color1: old.primaryColor || "#7c5cff",
      color2: old.secondaryColor || "#38bdf8",
      color3: old.accentColor || "#f472b6",
      color4: old.accentColor || "#ffd257",
      bg: old.bgColor || "#07080d",
      bg2: "#1c2130"
    };
    script.opacities = { color1: 100, color2: 100, color3: 100, color4: 100, bg: 100, bg2: 100 };
    script.bgStyle = "solid";
    script.bgDir = "to-bottom";
    return script;
  }

  function loadPresets() {
    try {
      const raw = localStorage.getItem(PRESET_KEY);
      if (raw) return JSON.parse(raw);

      const oldRaw = localStorage.getItem(OLD_PRESET_KEY);
      if (oldRaw) {
        const old = JSON.parse(oldRaw);
        const migrated = {};
        Object.keys(old).forEach(name => {
          migrated[name] = migrateOldPreset(old[name]);
        });
        savePresets(migrated);
        return migrated;
      }
    } catch (e) {}
    return {};
  }

  function savePresets(obj) {
    try {
      localStorage.setItem(PRESET_KEY, JSON.stringify(obj));
    } catch (e) {}
  }

  function refreshPresetList() {
    const presets = loadPresets();
    presetList.innerHTML = '<option value="">— none —</option>';
    Object.keys(presets).forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      presetList.appendChild(opt);
    });
  }

  function collectCurrentSettings() {
    return {
      patternStyle: patternStyle.value,
      seed: seed.value,
      symmetry: symmetry.value,
      scale: scale.value,
      density: density.value,
      lineWeight: lineWeight.value,
      rotation: rotation.value,
      starPoints: starPoints.value,
      ringCount: ringCount.value,
      tessellation: tessellation.value,
      weaveStyle: weaveStyle.value,
      loopCount: loopCount.value,
      ribbonWidth: ribbonWidth.value,
      motifType: motifType.value,
      tileRotation: tileRotation.value,
      tileOffset: tileOffset.value,
      ruleSet: ruleSet.value,
      mutationRate: mutationRate.value,
      growthSteps: growthSteps.value,
      bgStyle: bgStyle.value,
      bgDir: bgDir.value,
      colors: Object.assign({}, colors),
      opacities: Object.assign({}, opacities)
    };
  }

  function applySettings(s) {
    if (!s) return;

    const scalarFields = [
      "patternStyle", "seed", "symmetry", "scale", "density", "lineWeight",
      "rotation", "starPoints", "ringCount", "tessellation", "weaveStyle",
      "loopCount", "ribbonWidth", "motifType", "tileRotation", "tileOffset",
      "ruleSet", "mutationRate", "growthSteps", "bgStyle", "bgDir"
    ];

    scalarFields.forEach(f => {
      const el = document.getElementById(f);
      if (el && s[f] !== undefined) {
        el.value = s[f];
        const span = document.getElementById("val" + f.charAt(0).toUpperCase() + f.slice(1));
        if (span && el.type === "range") span.textContent = s[f];
      }
    });

    Object.assign(colors, sanitizeColors(s.colors));
    Object.assign(opacities, sanitizeOpacities(s.opacities));

    updateBgControls();
    updateStyleGroups();
    scheduleRender();
  }

  btnSavePreset.addEventListener("click", () => {
    const name = prompt("Name this full preset:");
    if (!name) return;
    const presets = loadPresets();
    presets[name] = collectCurrentSettings();
    savePresets(presets);
    refreshPresetList();
    presetList.value = name;
  });

  btnLoadPreset.addEventListener("click", () => {
    const name = presetList.value;
    if (!name) return;
    const presets = loadPresets();
    if (presets[name]) applySettings(presets[name]);
  });

  btnDeletePreset.addEventListener("click", () => {
    const name = presetList.value;
    if (!name) return;
    if (!confirm(`Delete preset "${name}"?`)) return;
    const presets = loadPresets();
    delete presets[name];
    savePresets(presets);
    refreshPresetList();
  });

  /* =======================================================================
     CUSTOM COLOR PALETTES
     ======================================================================= */
  const PALETTE_KEY = "pattern_weaver_palettes_v1";

  function loadPalettes() {
    try {
      const raw = localStorage.getItem(PALETTE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function savePalettes(obj) {
    try {
      localStorage.setItem(PALETTE_KEY, JSON.stringify(obj));
    } catch (e) {}
  }

  function refreshPaletteList() {
    const palettes = loadPalettes();
    palettePresetList.innerHTML = '<option value="">— none —</option>';
    Object.keys(palettes).forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      palettePresetList.appendChild(opt);
    });
  }

  function collectCurrentPalette() {
    return {
      colors: Object.assign({}, colors),
      opacities: Object.assign({}, opacities),
      bgStyle: bgStyle.value,
      bgDir: bgDir.value
    };
  }

  function applyPalette(p) {
    if (!p) return;
    Object.assign(colors, sanitizeColors(p.colors));
    Object.assign(opacities, sanitizeOpacities(p.opacities));
    if (p.bgStyle && bgStyle) bgStyle.value = p.bgStyle;
    if (p.bgDir && bgDir) bgDir.value = p.bgDir;
    updateBgControls();
    scheduleRender();
  }

  btnSavePalette.addEventListener("click", () => {
    const name = prompt("Name this color palette:");
    if (!name) return;
    const palettes = loadPalettes();
    palettes[name] = collectCurrentPalette();
    savePalettes(palettes);
    refreshPaletteList();
    palettePresetList.value = name;
  });

  btnLoadPalette.addEventListener("click", () => {
    const name = palettePresetList.value;
    if (!name) return;
    const palettes = loadPalettes();
    if (palettes[name]) applyPalette(palettes[name]);
  });

  btnDeletePalette.addEventListener("click", () => {
    const name = palettePresetList.value;
    if (!name) return;
    if (!confirm(`Delete palette "${name}"?`)) return;
    const palettes = loadPalettes();
    delete palettes[name];
    savePalettes(palettes);
    refreshPaletteList();
  });

  /* =======================================================================
     INIT
     ======================================================================= */
  function init() {
    wireControls();
    updateStyleGroups();
    refreshPresetList();
    refreshPaletteList();
    updateBgControls();

    valScale.textContent = scale.value;
    valDensity.textContent = density.value;
    valLineWeight.textContent = lineWeight.value;
    valMutationRate.textContent = mutationRate.value;

    renderPreview();
  }

  init();

})();