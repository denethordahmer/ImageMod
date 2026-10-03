/* =========================================================================
   x-eromeno-x — x-eromeno-x.js
   Draws a seeded grid of polygons, colored by a noise field between
   two colors, with jittered placement and rotation.
   ========================================================================= */

(function () {
  "use strict";

  var canvas = document.getElementById("xEromEnoXCanvas");
  var ctx = canvas.getContext("2d");

  // --- seeded random (same seed => same image) ---------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- 2D Perlin noise ---------------------------------------------------
  function makePerlin(rand) {
    var perm = new Uint8Array(256);
    for (var i = 0; i < 256; i++) perm[i] = i;
    for (var i = 255; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    var p = new Uint8Array(512);
    for (var i = 0; i < 512; i++) p[i] = perm[i & 255];

    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(a, b, t) { return a + t * (b - a); }
    function grad(h, dx, dy) {
      switch (h & 7) {
        case 0: return dx + dy;
        case 1: return -dx + dy;
        case 2: return dx - dy;
        case 3: return -dx - dy;
        case 4: return dx;
        case 5: return -dx;
        case 6: return dy;
        default: return -dy;
      }
    }

    return function (x, y) {
      var X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      var u = fade(x), v = fade(y);
      var A = p[X] + Y, B = p[X + 1] + Y;
      return lerp(
        lerp(grad(p[A], x, y), grad(p[B], x - 1, y), u),
        lerp(grad(p[A + 1], x, y - 1), grad(p[B + 1], x - 1, y - 1), u),
        v
      );
    };
  }

  // --- color helpers -----------------------------------------------------
  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function lerpRgb(c1, c2, t) {
    return [
      Math.round(c1[0] + (c2[0] - c1[0]) * t),
      Math.round(c1[1] + (c2[1] - c1[1]) * t),
      Math.round(c1[2] + (c2[2] - c1[2]) * t)
    ];
  }

  // --- small utility -------------------------------------------------------
  function clampInt(val, min, max, fallback) {
    var n = parseInt(val, 10);
    if (isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  // --- read settings from the UI ----------------------------------------
  function readState() {
    return {
      seed: parseInt(document.getElementById("seed").value, 10) || 1,
      shapeComplexity: parseInt(document.getElementById("shapeComplexity").value, 10),
      color1: hexToRgb(document.getElementById("color1").value),
      color2: hexToRgb(document.getElementById("color2").value),
      bgColor: document.getElementById("bgColor").value,
      bgTransparent: document.getElementById("bgTransparent").checked,
      size: document.getElementById("size").value,
      customWidth: document.getElementById("customWidth").value,
      customHeight: document.getElementById("customHeight").value,
      patternDensity: parseFloat(document.getElementById("patternDensity").value),
      rotation: parseFloat(document.getElementById("rotation").value),
      outlineThickness: parseFloat(document.getElementById("outlineThickness").value)
    };
  }

  // --- draw a polygon with a given number of sides, rotated about (x,y) --
  function drawRotatedPolygon(ctx, x, y, radius, sides, rotationDeg) {
    var rot = rotationDeg * Math.PI / 180;
    ctx.beginPath();
    for (var i = 0; i < sides; i++) {
      var angle = (i / sides) * Math.PI * 2 + rot;
      var px = x + Math.cos(angle) * radius;
      var py = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // --- render ------------------------------------------------------------
  var rafPending = false;
  function schedule() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      render();
    });
  }

  function render() {
    var s = readState();

    var sizes = {
      square: [1500, 1500],
      portrait: [900, 1600],
      landscape: [1600, 900],
      a17: [1080, 2340],
      desktop: [1920, 1080]
    };
    var W, H;
    if (s.size === "custom") {
      W = clampInt(s.customWidth, 1, 8192, 1080);
      H = clampInt(s.customHeight, 1, 8192, 2340);
    } else {
      W = sizes[s.size][0];
      H = sizes[s.size][1];
    }
    canvas.width = W;
    canvas.height = H;

    // background
    if (s.bgTransparent) {
      ctx.clearRect(0, 0, W, H);
    } else {
      ctx.fillStyle = s.bgColor;
      ctx.fillRect(0, 0, W, H);
    }

    var rand = mulberry32(s.seed);
    var noise = makePerlin(rand);
    var noiseScale = 2.2 / Math.min(W, H);

    // Pattern Density (0.1-1) controls how many shapes fit across the
    // shorter side of the canvas, so the pattern scales with output size.
    var cellsAcross = Math.round(4 + s.patternDensity * 14); // 0.1 -> ~5, 1 -> ~18
    var cellSize = Math.min(W, H) / cellsAcross;
    var cols = Math.max(1, Math.round(W / cellSize));
    var rows = Math.max(1, Math.round(H / cellSize));
    var cellW = W / cols, cellH = H / rows;
    var baseRadius = cellSize * 0.42;

    ctx.lineWidth = s.outlineThickness;

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cx = c * cellW + cellW / 2 + (rand() - 0.5) * cellW * 0.5;
        var cy = r * cellH + cellH / 2 + (rand() - 0.5) * cellH * 0.5;

        // sample the noise field once per shape and reuse it for both
        // color and rotation jitter, so nearby shapes drift together
        // instead of looking like random static
        var n = noise(cx * noiseScale, cy * noiseScale); // ~ -1..1
        var t = (n + 1) / 2;

        var col = lerpRgb(s.color1, s.color2, t);
        ctx.strokeStyle = "rgb(" + col[0] + "," + col[1] + "," + col[2] + ")";

        var shapeRotation = s.rotation + n * 60;
        var shapeRadius = baseRadius * (0.7 + rand() * 0.6);

        drawRotatedPolygon(ctx, cx, cy, shapeRadius, s.shapeComplexity, shapeRotation);
        ctx.stroke();
      }
    }
  }

  // --- export ------------------------------------------------------------
  function exportPNG() {
    canvas.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "x-eromeno-x-" + readState().seed + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }, "image/png");
  }

  function randomSeed() {
    document.getElementById("seed").value = Math.floor(Math.random() * 900000) + 100000;
    schedule();
  }

  // --- wiring ------------------------------------------------------------
  var sliders = [
    ["shapeComplexity", "shapeComplexityVal"],
    ["patternDensity", "patternDensityVal"],
    ["rotation", "rotationVal"],
    ["outlineThickness", "outlineThicknessVal"]
  ];

  sliders.forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    el.addEventListener("input", function () {
      document.getElementById(pair[1]).textContent = el.value;
      schedule();
    });
  });

  ["color1", "color2", "bgColor", "size", "customWidth", "customHeight"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", function () {
      syncDynamicControls();
      schedule();
    });
  });

  document.getElementById("bgTransparent").addEventListener("change", schedule);
  document.getElementById("seed").addEventListener("input", schedule);
  document.getElementById("btnRandomize").addEventListener("click", randomSeed);
  document.getElementById("btnGenerate").addEventListener("click", schedule);
  document.getElementById("btnExport").addEventListener("click", exportPNG);

  function syncDynamicControls() {
    var size = document.getElementById("size").value;
    document.getElementById("customSizeRow").style.display = size === "custom" ? "flex" : "none";
  }

  syncDynamicControls();
  render();
})();
