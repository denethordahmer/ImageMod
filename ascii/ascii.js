/* =========================================================================
   ASCII ENGINE — ascii.js
   Reads uploaded image → converts to ASCII → live preview → export PNG/JPG/text.
   Pure client-side. No dependencies. No CDN.
   ========================================================================= */

(function () {
  "use strict";

  /* =======================================================================
     DOM REFERENCES
     ======================================================================= */
  const fileInput      = document.getElementById("fileInput");
  const btnChooseImage = document.getElementById("btnChooseImage");
  const btnUploadTop   = document.getElementById("btnUploadTop");
  const emptyState     = document.getElementById("emptyState");
  const previewWrap    = document.getElementById("previewWrap");
  const previewCanvas  = document.getElementById("previewCanvas");
  const previewCtx     = previewCanvas.getContext("2d");

  // Controls
  const detailLevel    = document.getElementById("detailLevel");
  const charShape      = document.getElementById("charShape");
  const brightness     = document.getElementById("brightness");
  const contrast       = document.getElementById("contrast");
  const gamma          = document.getElementById("gamma");
  const invert         = document.getElementById("invert");
  const rampPreset     = document.getElementById("rampPreset");
  const customRampRow  = document.getElementById("customRampRow");
  const customRamp     = document.getElementById("customRamp");
  const weighting      = document.getElementById("weighting");
  const edgeEnhance    = document.getElementById("edgeEnhance");
  const dithering      = document.getElementById("dithering");
  const adaptive       = document.getElementById("adaptive");
  const sharpness      = document.getElementById("sharpness");
  const noiseReduction = document.getElementById("noiseReduction");
  const colorMode      = document.getElementById("colorMode");
  const theme          = document.getElementById("theme");
  const charColorRow   = document.getElementById("charColorRow");
  const charColor      = document.getElementById("charColor");
  const bgColorRow     = document.getElementById("bgColorRow");
  const bgColor        = document.getElementById("bgColor");
  const saturationRow  = document.getElementById("saturationRow");
  const saturation     = document.getElementById("saturation");
  const fontFamily     = document.getElementById("fontFamily");
  const fontSize       = document.getElementById("fontSize");
  const lineSpacing    = document.getElementById("lineSpacing");
  const bold           = document.getElementById("bold");
  const exportScale    = document.getElementById("exportScale");
  const exportBg       = document.getElementById("exportBg");
  const exportName     = document.getElementById("exportName");

  // Presets
  const presetList     = document.getElementById("presetList");
  const btnSavePreset  = document.getElementById("btnSavePreset");
  const btnLoadPreset  = document.getElementById("btnLoadPreset");
  const btnDeletePreset= document.getElementById("btnDeletePreset");

  // Export
  const btnExportPng   = document.getElementById("btnExportPng");
  const btnExportJpg   = document.getElementById("btnExportJpg");
  const btnCopyText    = document.getElementById("btnCopyText");

  // Value display spans
  const valBrightness    = document.getElementById("valBrightness");
  const valContrast      = document.getElementById("valContrast");
  const valGamma         = document.getElementById("valGamma");
  const valWeighting     = document.getElementById("valWeighting");
  const valSharpness     = document.getElementById("valSharpness");
  const valNoiseReduction= document.getElementById("valNoiseReduction");
  const valSaturation    = document.getElementById("valSaturation");
  const valFontSize      = document.getElementById("valFontSize");
  const valLineSpacing   = document.getElementById("valLineSpacing");

  /* =======================================================================
     STATE
     ======================================================================= */
  let sourceImage = null;        // HTMLImageElement
  let currentAscii = "";         // last generated ASCII string
  let currentGrid = null;        // { cols, rows, lines[], colorGrid[] } for output
  let renderTimer = null;

  /* =======================================================================
     RAMP TABLES
     ======================================================================= */
  const RAMPS = {
    standard: " .:-=+*#%@",
    dense:    " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
    blocks:   " ░▒▓█",
    katakana: " ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ",
    braille:  " ⠁⠂⠃⠄⠅⠆⠇⠈⠉⠊⠋⠌⠍⠎⠏⠐⠑⠒⠓⠔⠕⠖⠗⠘⠙⠚⠛⠜⠝⠞⠟⠠⠡⠢⠣⠤⠥⠦⠧⠨⠩⠪⠫⠬⠭⠮⠯⠰⠱⠲⠳⠴⠵⠶⠷⠸⠹⠺⠻⠼⠽⠾⠿",
    minimal:  " .:*#",
    photo:    "   ..''``^^\"\",,::;;IIll!!ii>><<~~++__--??]][[}}{{11))((||\\\\//ttffjjrrxxnnuuvvcczzXXYYUUJJCCLLQQ00OOZZmmwwqqppddbbkkhhaaoo**##MMWW&&88%%BB@@$$",
    letters:  " aAbBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsStTuUvVwWxXyYzZ",
    symbols:  " .!@#$%^&*()_+-=[]{}|;:,.<>/?"
  };

  function getRampChars() {
    const preset = rampPreset.value;
    if (preset === "custom") {
      const c = customRamp.value;
      return c && c.length >= 2 ? c : RAMPS.standard;
    }
    return RAMPS[preset] || RAMPS.standard;
  }

  /* =======================================================================
     DETAIL LEVEL → COLUMN COUNT
     ======================================================================= */
  const DETAIL_COLUMNS = {
    "very-low":  50,
    "low":       75,
    "medium":    100,
    "high":      150,
    "very-high": 200,
    "extreme":   300
  };

  /* =======================================================================
     CHARACTER SHAPE → VERTICAL SAMPLING FACTOR
     Lower values produce fewer rows (a wider final image).
     ======================================================================= */
  const SHAPE_ASPECT = {
    "tall":   0.55,
    "square": 0.95,
    "wide":   0.40
  };

  /* =======================================================================
     THEME PRESETS
     ======================================================================= */
  const THEMES = {
    neutral: { char: "#e6e8f0", bg: "#07080d" },
    terminal:{ char: "#4ade80", bg: "#050806" },
    amber:   { char: "#ffb347", bg: "#0a0705" },
    paper:   { char: "#101010", bg: "#f2efe8" },
    crimson: { char: "#ff5c6a", bg: "#0a0505" }
  };

  /* Update theme colors and all conditional control visibility. */
  function syncDynamicControls() {
    // Theme custom color rows
    if (theme.value === "custom") {
      charColorRow.style.display = "flex";
      bgColorRow.style.display = "flex";
    } else {
      charColorRow.style.display = "none";
      bgColorRow.style.display = "none";
      const preset = THEMES[theme.value];
      if (preset) {
        charColor.value = preset.char;
        bgColor.value = preset.bg;
      }
    }

    // Custom ramp row
    customRampRow.style.display = rampPreset.value === "custom" ? "flex" : "none";

    // Saturation row only matters in colored mode
    saturationRow.style.display = colorMode.value === "colored" ? "block" : "none";
  }

  /* =======================================================================
     IMAGE LOADING
     ======================================================================= */
  function openPicker() {
    fileInput.click();
  }

  btnChooseImage.addEventListener("click", openPicker);
  btnUploadTop.addEventListener("click", openPicker);

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        sourceImage = img;
        showPreview();
        scheduleRender();
      };
      img.onerror = () => {
        alert("Could not load that image.");
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  function showPreview() {
    emptyState.classList.add("hidden");
    previewWrap.classList.remove("hidden");
  }

  /* =======================================================================
     CORE: DOWN-SAMPLE IMAGE TO GRID OF AVERAGE BRIGHTNESS
     ======================================================================= */
  function sampleGrid(cols, cellH) {
    const rows = Math.max(1, Math.round(sourceImage.height / cellH));
    const grid = new Float32Array(cols * rows);

    // 1. Down-sample to a tiny canvas for speed
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = cols;
    sampleCanvas.height = rows;
    const sctx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    sctx.drawImage(sourceImage, 0, 0, cols, rows);
    const data = sctx.getImageData(0, 0, cols, rows).data;

    // 2. Compute perceptual luminance
    const noiseAmt = parseInt(noiseReduction.value, 10) / 100;
    const useAdaptive = adaptive.value === "on";

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        grid[y * cols + x] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
    }

    // 3. Simple box blur for noise reduction
    if (noiseAmt > 0) {
      const blurred = new Float32Array(grid.length);
      const radius = Math.max(1, Math.round(noiseAmt * 3));
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let sum = 0, count = 0;
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
              sum += grid[ny * cols + nx];
              count++;
            }
          }
          blurred[y * cols + x] = sum / count;
        }
      }
      for (let i = 0; i < grid.length; i++) grid[i] = blurred[i];
    }

    // 4. Sharpness (unsharp mask)
    const sharpAmt = parseInt(sharpness.value, 10) / 100;
    if (sharpAmt > 0) {
      const sharpened = new Float32Array(grid.length);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let sum = 0, count = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
              sum += grid[ny * cols + nx];
              count++;
            }
          }
          const avg = sum / count;
          const orig = grid[y * cols + x];
          sharpened[y * cols + x] = orig + (orig - avg) * sharpAmt * 2;
        }
      }
      for (let i = 0; i < grid.length; i++) {
        grid[i] = Math.max(0, Math.min(1, sharpened[i]));
      }
    }

    // 5. Adaptive sampling — reduce noise in low-variance regions
    if (useAdaptive) {
      for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
          const idx = y * cols + x;
          const n = grid[(y - 1) * cols + x];
          const s = grid[(y + 1) * cols + x];
          const e = grid[y * cols + x + 1];
          const w = grid[y * cols + x - 1];
          const variance = Math.abs(n - s) + Math.abs(e - w);
          if (variance < 0.05) {
            const mean = (n + s + e + w + grid[idx]) / 5;
            grid[idx] = grid[idx] * 0.7 + mean * 0.3;
          }
        }
      }
    }

    return { grid, cols, rows };
  }

  /* =======================================================================
     TONE ADJUSTMENTS
     ======================================================================= */
  function adjustTone(lum) {
    const b = parseInt(brightness.value, 10) / 100;
    let v = lum + b * 0.5;

    const c = parseInt(contrast.value, 10) / 100;
    v = (v - 0.5) * (1 + c) + 0.5;

    const g = parseFloat(gamma.value);
    v = Math.pow(Math.max(0, Math.min(1, v)), 1 / g);

    if (invert.value === "on") v = 1 - v;

    return Math.max(0, Math.min(1, v));
  }

  /* =======================================================================
     EDGE DETECTION
     ======================================================================= */
  function sobelEdge(grid, cols, rows, x, y) {
    const at = (xx, yy) => {
      if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) return 0;
      return grid[yy * cols + xx];
    };
    const gx =
      -at(x - 1, y - 1) + at(x + 1, y - 1) +
      -2 * at(x - 1, y) + 2 * at(x + 1, y) +
      -at(x - 1, y + 1) + at(x + 1, y + 1);
    const gy =
      -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) +
      at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
    return Math.sqrt(gx * gx + gy * gy);
  }

  /* =======================================================================
     BUILD ASCII
     ======================================================================= */
  function buildAscii() {
    if (!sourceImage) return;

    const cols = DETAIL_COLUMNS[detailLevel.value] || 100;
    const aspect = SHAPE_ASPECT[charShape.value] || 0.55;
    const cellW = sourceImage.width / cols;
    const cellH = cellW / aspect;

    const { grid, rows } = sampleGrid(cols, cellH);
    const chars = getRampChars();
    const rampLen = chars.length;
    const weightAmt = parseInt(weighting.value, 10) / 50; // -1..1
    const edgeStrength = { off: 0, low: 0.4, medium: 0.7, high: 1.0 }[edgeEnhance.value] || 0;
    const useDither = dithering.value === "on";
    const edgeChars = ["/", "\\", "|", "-", "+"];
    const lines = [];
    const colorGrid = [];
    const mode = colorMode.value;
    const satAmt = parseInt(saturation.value, 10) / 100;

    // Resample original colors once for colored mode
    let colorData = null;
    if (mode === "colored") {
      const cCanvas = document.createElement("canvas");
      cCanvas.width = cols;
      cCanvas.height = rows;
      const cctx = cCanvas.getContext("2d", { willReadFrequently: true });
      cctx.drawImage(sourceImage, 0, 0, cols, rows);
      colorData = cctx.getImageData(0, 0, cols, rows).data;
    }

    for (let y = 0; y < rows; y++) {
      let line = "";
      const colorLine = [];

      for (let x = 0; x < cols; x++) {
        let lum = grid[y * cols + x];
        lum = adjustTone(lum);

        // Bias the ramp toward its light or dark end
        if (weightAmt !== 0) {
          if (weightAmt > 0) lum = Math.pow(lum, 1 + weightAmt);
          else lum = Math.pow(lum, 1 / (1 + Math.abs(weightAmt)));
        }

        // Ordered Bayer 4x4 dithering
        if (useDither) {
          const bayer = [
            [ 0,  8,  2, 10],
            [12,  4, 14,  6],
            [ 3, 11,  1,  9],
            [15,  7, 13,  5]
          ];
          const threshold = (bayer[y % 4][x % 4] / 16) - 0.5;
          lum += threshold / rampLen;
        }

        let idx = Math.floor(lum * (rampLen - 1));
        idx = Math.max(0, Math.min(rampLen - 1, idx));

        // Pick the char, replacing it with a line char near strong edges
        let ch = chars[idx];
        if (edgeStrength > 0) {
          const edge = sobelEdge(grid, cols, rows, x, y);
          if (edge > edgeStrength) {
            const eIdx = Math.floor((edge / 2) * edgeChars.length) % edgeChars.length;
            ch = edgeChars[Math.abs(eIdx)];
          }
        }

        line += ch;

        if (mode === "colored" && colorData) {
          const ci = (y * cols + x) * 4;
          let r = colorData[ci];
          let g = colorData[ci + 1];
          let b = colorData[ci + 2];
          if (satAmt !== 1) {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            r = gray + (r - gray) * satAmt;
            g = gray + (g - gray) * satAmt;
            b = gray + (b - gray) * satAmt;
          }
          colorLine.push({ ch, r: Math.round(r), g: Math.round(g), b: Math.round(b) });
        } else if (mode === "duotone") {
          colorLine.push({ ch, lum });
        }
      }

      lines.push(line);
      colorGrid.push(colorLine);
    }

    currentAscii = lines.join("\n");
    currentGrid = { lines, colorGrid, cols, rows, mode };
    renderToCanvas();
  }

  /* =======================================================================
     RENDER TO CANVAS
     ======================================================================= */
  function renderToCanvas() {
    if (!currentGrid) return;

    const fontSizePx = parseInt(fontSize.value, 10);
    const lineSpacingVal = parseFloat(lineSpacing.value);
    const isBold = bold.value === "on";
    const fontStr = `${isBold ? "bold " : ""}${fontSizePx}px ${fontFamily.value}`;

    previewCtx.font = fontStr;
    const charW = previewCtx.measureText("M").width;
    const charH = fontSizePx * lineSpacingVal;

    const cols = currentGrid.cols;
    const rows = currentGrid.rows;
    const w = Math.ceil(charW * cols);
    const h = Math.ceil(charH * rows);

    previewCanvas.width = w;
    previewCanvas.height = h;
    previewCanvas.style.width = Math.min(w, window.innerWidth - 40) + "px";
    previewCanvas.style.height = "auto";

    previewCtx.fillStyle = bgColor.value;
    previewCtx.fillRect(0, 0, w, h);

    previewCtx.font = fontStr;
    previewCtx.textBaseline = "top";

    const mode = currentGrid.mode;

    if (mode === "colored") {
      for (let y = 0; y < rows; y++) {
        const colorLine = currentGrid.colorGrid[y];
        for (let x = 0; x < cols; x++) {
          const cell = colorLine[x];
          if (!cell || cell.ch === " ") continue;
          previewCtx.fillStyle = `rgb(${cell.r},${cell.g},${cell.b})`;
          previewCtx.fillText(cell.ch, x * charW, y * charH);
        }
      }
    } else if (mode === "duotone") {
      const dark = hexToRgb(charColor.value);
      const light = hexToRgb(bgColor.value);
      for (let y = 0; y < rows; y++) {
        const colorLine = currentGrid.colorGrid[y];
        for (let x = 0; x < cols; x++) {
          const cell = colorLine[x];
          if (!cell || cell.ch === " ") continue;
          const t = cell.lum;
          const r = Math.round(dark.r + (light.r - dark.r) * t);
          const g = Math.round(dark.g + (light.g - dark.g) * t);
          const b = Math.round(dark.b + (light.b - dark.b) * t);
          previewCtx.fillStyle = `rgb(${r},${g},${b})`;
          previewCtx.fillText(cell.ch, x * charW, y * charH);
        }
      }
    } else {
      previewCtx.fillStyle = charColor.value;
      const lines = currentGrid.lines;
      for (let y = 0; y < rows; y++) {
        const line = lines[y];
        for (let x = 0; x < cols; x++) {
          const ch = line[x];
          if (ch === " ") continue;
          previewCtx.fillText(ch, x * charW, y * charH);
        }
      }
    }
  }

  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16)
    };
  }

  /* =======================================================================
     SCHEDULED RE-RENDER
     ======================================================================= */
  function scheduleRender() {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      try {
        buildAscii();
      } catch (e) {
        console.warn("ASCII render failed:", e);
      }
    }, 80);
  }

  /* =======================================================================
     WIRE ALL CONTROLS
     ======================================================================= */
  function wireControls() {
    const sliderPairs = [
      [brightness, valBrightness],
      [contrast, valContrast],
      [gamma, valGamma],
      [weighting, valWeighting],
      [sharpness, valSharpness],
      [noiseReduction, valNoiseReduction],
      [saturation, valSaturation],
      [fontSize, valFontSize],
      [lineSpacing, valLineSpacing]
    ];
    sliderPairs.forEach(([input, span]) => {
      input.addEventListener("input", () => {
        span.textContent = input.value;
        scheduleRender();
      });
    });

    // Dropdowns — one listener each, all handled here
    [
      detailLevel, charShape, invert, rampPreset,
      edgeEnhance, dithering, adaptive, colorMode,
      theme, fontFamily, bold
    ].forEach(el => {
      el.addEventListener("change", () => {
        onDropdownChange();
        scheduleRender();
      });
    });

    // Color pickers rerender
    charColor.addEventListener("input", scheduleRender);
    bgColor.addEventListener("input", scheduleRender);

    // Custom ramp text rerenders
    customRamp.addEventListener("input", scheduleRender);
  }

  function onDropdownChange() {
    syncDynamicControls();
  }

  /* =======================================================================
     EXPORT
     ======================================================================= */
  function exportImage(format) {
    if (!currentGrid) {
      alert("Upload an image first.");
      return;
    }
    const scale = parseInt(exportScale.value, 10) || 1;
    const useTransparent = exportBg.value === "transparent";

    const fontSizePx = parseInt(fontSize.value, 10);
    const lineSpacingVal = parseFloat(lineSpacing.value);
    const isBold = bold.value === "on";
    const fontStr = `${isBold ? "bold " : ""}${fontSizePx * scale}px ${fontFamily.value}`;

    const tmpCtx = document.createElement("canvas").getContext("2d");
    tmpCtx.font = fontStr;
    const charW = tmpCtx.measureText("M").width;
    const charH = fontSizePx * scale * lineSpacingVal;

    const cols = currentGrid.cols;
    const rows = currentGrid.rows;
    const w = Math.ceil(charW * cols);
    const h = Math.ceil(charH * rows);

    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const octx = out.getContext("2d");

    if (!useTransparent) {
      octx.fillStyle = bgColor.value;
      octx.fillRect(0, 0, w, h);
    }

    octx.font = fontStr;
    octx.textBaseline = "top";

    const mode = currentGrid.mode;

    if (mode === "colored") {
      for (let y = 0; y < rows; y++) {
        const colorLine = currentGrid.colorGrid[y];
        for (let x = 0; x < cols; x++) {
          const cell = colorLine[x];
          if (!cell || cell.ch === " ") continue;
          octx.fillStyle = `rgb(${cell.r},${cell.g},${cell.b})`;
          octx.fillText(cell.ch, x * charW, y * charH);
        }
      }
    } else if (mode === "duotone") {
      const dark = hexToRgb(charColor.value);
      const light = hexToRgb(bgColor.value);
      for (let y = 0; y < rows; y++) {
        const colorLine = currentGrid.colorGrid[y];
        for (let x = 0; x < cols; x++) {
          const cell = colorLine[x];
          if (!cell || cell.ch === " ") continue;
          const t = cell.lum;
          const r = Math.round(dark.r + (light.r - dark.r) * t);
          const g = Math.round(dark.g + (light.g - dark.g) * t);
          const b = Math.round(dark.b + (light.b - dark.b) * t);
          octx.fillStyle = `rgb(${r},${g},${b})`;
          octx.fillText(cell.ch, x * charW, y * charH);
        }
      }
    } else {
      octx.fillStyle = charColor.value;
      const lines = currentGrid.lines;
      for (let y = 0; y < rows; y++) {
        const line = lines[y];
        for (let x = 0; x < cols; x++) {
          const ch = line[x];
          if (ch === " ") continue;
          octx.fillText(ch, x * charW, y * charH);
        }
      }
    }

    const mime = format === "jpg" ? "image/jpeg" : "image/png";
    const quality = format === "jpg" ? 0.92 : undefined;
    const dataUrl = out.toDataURL(mime, quality);

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = (exportName.value || "ascii-art") + "." + (format === "jpg" ? "jpg" : "png");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  btnExportPng.addEventListener("click", () => exportImage("png"));
  btnExportJpg.addEventListener("click", () => exportImage("jpg"));

  /* =======================================================================
     COPY AS TEXT
     ======================================================================= */
  btnCopyText.addEventListener("click", async () => {
    if (!currentAscii) {
      alert("Upload an image first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(currentAscii);
      const original = btnCopyText.textContent;
      btnCopyText.textContent = "Copied!";
      setTimeout(() => { btnCopyText.textContent = original; }, 1200);
    } catch (e) {
      prompt("Copy the ASCII text below:", currentAscii);
    }
  });

  /* =======================================================================
     PRESETS
     ======================================================================= */
  const PRESET_KEY = "ascii_engine_presets_v1";

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
      detailLevel: detailLevel.value,
      charShape: charShape.value,
      brightness: brightness.value,
      contrast: contrast.value,
      gamma: gamma.value,
      invert: invert.value,
      rampPreset: rampPreset.value,
      customRamp: customRamp.value,
      weighting: weighting.value,
      edgeEnhance: edgeEnhance.value,
      dithering: dithering.value,
      adaptive: adaptive.value,
      sharpness: sharpness.value,
      noiseReduction: noiseReduction.value,
      colorMode: colorMode.value,
      theme: theme.value,
      charColor: charColor.value,
      bgColor: bgColor.value,
      saturation: saturation.value,
      fontFamily: fontFamily.value,
      fontSize: fontSize.value,
      lineSpacing: lineSpacing.value,
      bold: bold.value
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
    syncDynamicControls();
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
    if (presets[name]) {
      applySettings(presets[name]);
      scheduleRender();
    }
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
    syncDynamicControls();
    refreshPresetList();

    valBrightness.textContent = brightness.value;
    valContrast.textContent = contrast.value;
    valGamma.textContent = gamma.value;
    valWeighting.textContent = weighting.value;
    valSharpness.textContent = sharpness.value;
    valNoiseReduction.textContent = noiseReduction.value;
    valSaturation.textContent = saturation.value;
    valFontSize.textContent = fontSize.value;
    valLineSpacing.textContent = lineSpacing.value;
  }

  init();

})();