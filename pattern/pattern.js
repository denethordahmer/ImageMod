/* =========================================================================
   PATTERN WEAVER — pattern.js
   Four pattern styles: Islamic geometry, Celtic knotwork, repeating motif,
   procedural rules. Seeded RNG, live preview, PNG/JPG export.
   Pure client-side. No dependencies.
   ========================================================================= */

(function () {
  "use strict";

  /* =======================================================================
     DOM REFERENCES
     ======================================================================= */
  const canvas = document.getElementById("patternCanvas");
  const ctx = canvas.getContext("2d");

  const patternStyle  = document.getElementById("patternStyle");
  const seed          = document.getElementById("seed");
  const btnRandomizeSeed = document.getElementById("btnRandomizeSeed");
  const btnRandomizeAll  = document.getElementById("btnRandomizeAll");
  const btnRandomizeTop  = document.getElementById("btnRandomizeTop");

  const palette       = document.getElementById("palette");
  const primaryColor  = document.getElementById("primaryColor");
  const secondaryColor= document.getElementById("secondaryColor");
  const accentColor   = document.getElementById("accentColor");
  const bgColor       = document.getElementById("bgColor");

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

  // Presets
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
     PALETTES
     ======================================================================= */
  const PALETTES = {
    mono:     { primary: "#eef0f7", secondary: "#8b90a6", accent: "#5d6379", bg: "#07080d" },
    duotone:  { primary: "#7c5cff", secondary: "#a58bff", accent: "#1c2130", bg: "#07080d" },
    triad:    { primary: "#7c5cff", secondary: "#ffd257", accent: "#4ade80", bg: "#07080d" },
    warm:     { primary: "#ff5c6a", secondary: "#ffb347", accent: "#ffd257", bg: "#1a0a08" },
    cool:     { primary: "#4ade80", secondary: "#38bdf8", accent: "#a58bff", bg: "#050a12" },
    neon:     { primary: "#ff00e5", secondary: "#00ffd5", accent: "#faff00", bg: "#000000" },
    earthy:   { primary: "#b87333", secondary: "#7a5a3a", accent: "#d9c5a0", bg: "#1a140e" },
    custom:   null
  };

  function applyPalettePreset() {
    const p = palette.value;
    const preset = PALETTES[p];
    if (preset) {
      primaryColor.value = preset.primary;
      secondaryColor.value = preset.secondary;
      accentColor.value = preset.accent;
      bgColor.value = preset.bg;
    }
  }

  /* =======================================================================
     DRAW HELPERS
     ======================================================================= */
  function clear(bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  function hexToRgba(hex, alpha) {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
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

    // Draw concentric ring of stars
    for (let r = 1; r <= rings; r++) {
      const radius = baseRadius * (r / rings);
      const ringPoints = sym * r;

      for (let i = 0; i < ringPoints; i++) {
        const angle = (i / ringPoints) * Math.PI * 2 + rot;
        const sx = cx + Math.cos(angle) * radius;
        const sy = cy + Math.sin(angle) * radius;
        const starR = radius * 0.35 * (1 - dens * 0.4) * (1 + rng() * 0.15);
        drawStar(sx, sy, points, starR, points * 1.5, lw,
          pickColor(0.6, 0.9));
      }
    }

    // Central star cluster
    drawStar(cx, cy, points * 2, baseRadius * 0.45, points * 3, lw * 1.5, primaryColor.value);

    // Tessellation lines connecting ring stars
    if (tess !== "star") {
      ctx.strokeStyle = hexToRgba(secondaryColor.value, 0.35);
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

  function pickColor(minA, maxA) {
    const alpha = minA + rng() * (maxA - minA);
    const choice = rng();
    if (choice < 0.4) return hexToRgba(primaryColor.value, alpha);
    if (choice < 0.75) return hexToRgba(secondaryColor.value, alpha);
    return hexToRgba(accentColor.value, alpha);
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

    // Draw N overlapping circular ribbons
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

    // Center knot
    const centerR = baseRadius * 0.25;
    drawKnotRing(cx, cy, centerR, ribbonW * 1.2, weave, 999, 0);
  }

  function drawKnotRing(cx, cy, radius, width, weaveStyle, index, loopIdx) {
    // Base ring
    const colorA = hexToRgba(primaryColor.value, 0.85);
    const colorB = hexToRgba(secondaryColor.value, 0.85);

    // Draw the ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.lineWidth = width;
    ctx.strokeStyle = index % 2 === 0 ? colorA : colorB;
    ctx.stroke();

    // Over-under illusion: draw small arcs on top to break the line
    if (weaveStyle !== "balanced" || loopIdx % 2 === 0) {
      const segments = 8;
      for (let s = 0; s < segments; s++) {
        const startAngle = (s / segments) * Math.PI * 2 + rng() * 0.3;
        const endAngle = startAngle + (Math.PI * 2 / segments) * 0.4;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.lineWidth = width * 1.15;
        ctx.strokeStyle = hexToRgba(accentColor.value, 0.9);
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

        // Tile offset
        if (toff === "brick" && y % 2 === 1) cx += cell / 2;
        if (toff === "diagonal") { cx += (y % 2) * cell / 2; cy += (x % 2) * cell / 2; }

        let tileRot = rot;
        if (trot === "90") tileRot += (x + y) * Math.PI / 2;
        else if (trot === "180") tileRot += (x + y) * Math.PI;
        else if (trot === "mirror") {
          if ((x + y) % 2 === 1) tileRot += Math.PI;
        }

        const size = cell * 0.35 * (0.7 + rng() * 0.6) * (1 - dens * 0.3);
        const col = pickColor(0.55, 0.95);

        drawMotifShape(cx, cy, size, tileRot, mtype, lw, col);
      }
    }
  }

  function drawMotifShape(cx, cy, size, rot, type, lw, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.strokeStyle = color;
    ctx.fillStyle = hexToRgba(color.startsWith("rgba") ? "#ffffff" : color, 0.15);
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
        // Simple flow field via sines
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
    const treeCount = Math.max(3, Math.round(4 + sc * 3));

    for (let t = 0; t < treeCount; t++) {
      const startX = CANVAS_SIZE * (0.2 + (t + 0.5) / treeCount * 0.6);
      const startY = CANVAS_SIZE * 0.9;
      const angle = -Math.PI / 2 + (rng() - 0.5) * 0.3;
      branch(startX, startY, angle, CANVAS_SIZE * 0.22 * sc, steps, lw, mut, dens);
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

    const children = 2 + Math.round(rng() * 2);
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
  function render() {
    reseed();
    clear(bgColor.value);

    const style = patternStyle.value;
    if (style === "islamic") drawIslamic();
    else if (style === "celtic") drawCeltic();
    else if (style === "motif") drawMotif();
    else if (style === "procedural") drawProcedural();
  }

  /* =======================================================================
     DEBOUNCED RENDER
     ======================================================================= */
  let renderTimer = null;
  function scheduleRender() {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 60);
  }

  /* =======================================================================
     WIRE CONTROLS
     ======================================================================= */
  function wireControls() {
    // Sliders
    [[scale, valScale], [density, valDensity], [lineWeight, valLineWeight], [mutationRate, valMutationRate]]
      .forEach(([input, span]) => {
        input.addEventListener("input", () => {
          span.textContent = input.value;
          scheduleRender();
        });
      });

    // Dropdowns
    [
      patternStyle, palette, symmetry, rotation,
      starPoints, ringCount, tessellation,
      weaveStyle, loopCount, ribbonWidth,
      motifType, tileRotation, tileOffset,
      ruleSet, growthSteps
    ].forEach(el => {
      el.addEventListener("change", () => {
        if (el === patternStyle) updateStyleGroups();
        if (el === palette) applyPalettePreset();
        scheduleRender();
      });
    });

    // Colors
    [primaryColor, secondaryColor, accentColor, bgColor].forEach(el => {
      el.addEventListener("input", scheduleRender);
    });

    // Seed input
    seed.addEventListener("input", scheduleRender);

    // Randomize
    btnRandomizeSeed.addEventListener("click", () => {
      seed.value = randomSeedString();
      scheduleRender();
    });
    btnRandomizeAll.addEventListener("click", randomizeAll);
    btnRandomizeTop.addEventListener("click", randomizeAll);
  }

  function randomSeedString() {
    const words = ["vorifex", "tithe", "ember", "ashen", "silent", "crown", "iron", "crimson", "veil", "stone", "shadow", "hollow", "gilded", "oath"];
    const w = words[Math.floor(Math.random() * words.length)];
    const n = Math.floor(Math.random() * 9999);
    return w + "-" + n;
  }

  function randomizeAll() {
    seed.value = randomSeedString();
    // Also randomize a couple of style-specifics
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
    const mult = parseInt(exportScale.value, 10) || 1;
    const useTransparent = exportBg.value === "transparent";

    // Render at final scale into an offscreen canvas
    const out = document.createElement("canvas");
    out.width = CANVAS_SIZE * mult;
    out.height = CANVAS_SIZE * mult;
    const octx = out.getContext("2d");

    if (!useTransparent) {
      octx.fillStyle = bgColor.value;
      octx.fillRect(0, 0, out.width, out.height);
    }

    octx.drawImage(canvas, 0, 0, out.width, out.height);

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
     PRESETS
     ======================================================================= */
  const PRESET_KEY = "pattern_weaver_presets_v1";

  function loadPresets() {
    try {
      const raw = localStorage.getItem(PRESET_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
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
      palette: palette.value,
      primaryColor: primaryColor.value,
      secondaryColor: secondaryColor.value,
      accentColor: accentColor.value,
      bgColor: bgColor.value,
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
      growthSteps: growthSteps.value
    };
  }

  function applySettings(s) {
    if (!s) return;
    Object.keys(s).forEach(k => {
      const el = document.getElementById(k);
      if (!el) return;
      el.value = s[k];
      const span = document.getElementById("val" + k.charAt(0).toUpperCase() + k.slice(1));
      if (span && el.type === "range") span.textContent = s[k];
    });
    updateStyleGroups();
    scheduleRender();
  }

  btnSavePreset.addEventListener("click", () => {
    const name = prompt("Name this preset:");
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
     INIT
     ======================================================================= */
  function init() {
    wireControls();
    updateStyleGroups();
    refreshPresetList();
    valScale.textContent = scale.value;
    valDensity.textContent = density.value;
    valLineWeight.textContent = lineWeight.value;
    valMutationRate.textContent = mutationRate.value;
    render();
  }

  init();

})();