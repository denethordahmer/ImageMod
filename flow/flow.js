/* =========================================================================
   FLOW FIELD — flow.js
   Draws particles flowing through a noise field as smooth line art.
   ========================================================================= */

(function () {
  "use strict";

  var canvas = document.getElementById("flowCanvas");
  var ctx = canvas.getContext("2d");

  var TWO_PI = Math.PI * 2;

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

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    var h = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) {
      var d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  }

  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      var hue = function (q, w, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return q + (w - q) * 6 * t;
        if (t < 1 / 2) return w;
        if (t < 2 / 3) return q + (w - q) * (2 / 3 - t) * 6;
        return q;
      };
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var w = 2 * l - q;
      r = hue(q, w, h + 1 / 3);
      g = hue(q, w, h);
      b = hue(q, w, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function lerpRgb(c1, c2, t) {
    return [
      Math.round(c1[0] + (c2[0] - c1[0]) * t),
      Math.round(c1[1] + (c2[1] - c1[1]) * t),
      Math.round(c1[2] + (c2[2] - c1[2]) * t)
    ];
  }

  // --- read settings from the UI ----------------------------------------
  function readState() {
    return {
      seed: parseInt(document.getElementById("seed").value, 10) || 1,
      particles: parseInt(document.getElementById("particles").value, 10),
      steps: parseInt(document.getElementById("steps").value, 10),
      stepSize: parseFloat(document.getElementById("stepSize").value),
      featureSize: parseInt(document.getElementById("featureSize").value, 10),
      curl: parseFloat(document.getElementById("curl").value),
      lineWidth: parseFloat(document.getElementById("lineWidth").value),
      opacity: parseFloat(document.getElementById("opacity").value),
      mode: document.getElementById("colorMode").value,
      color1: hexToRgb(document.getElementById("color1").value),
      color2: hexToRgb(document.getElementById("color2").value),
      bgColor: document.getElementById("bgColor").value,
      bgTransparent: document.getElementById("bgTransparent").checked,
      size: document.getElementById("size").value
    };
  }

  function noiseScaleFor(fs) {
    // featureSize 1  => fine/noisy,  100 => large smooth swirls
    return 0.0065 - (fs - 1) * (0.0065 - 0.0006) / 99;
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
    var W = sizes[s.size][0], H = sizes[s.size][1];
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
    var scale = noiseScaleFor(s.featureSize);

    // even-ish distribution: jittered grid
    var cols = Math.max(1, Math.ceil(Math.sqrt(s.particles * (W / H))));
    var rows = Math.max(1, Math.ceil(s.particles / cols));
    var cellW = W / cols, cellH = H / rows;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = s.lineWidth;
    ctx.globalAlpha = s.opacity;

    var baseHue = rgbToHsl(s.color1[0], s.color1[1], s.color1[2])[0];

    var c1 = s.color1, c2 = s.color2, mode = s.mode;

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var px = c * cellW + rand() * cellW;
        var py = r * cellH + rand() * cellH;
        var t = px / W; // color position 0..1

        var col;
        if (mode === "solid") {
          col = c1;
        } else if (mode === "gradient") {
          col = lerpRgb(c1, c2, t);
        } else { // spectrum
          col = hslToRgb((baseHue + t * 360 * 1.4) % 360, 72, 58);
        }

        ctx.strokeStyle = "rgb(" + col[0] + "," + col[1] + "," + col[2] + ")";
        ctx.beginPath();
        var x = px, y = py;
        ctx.moveTo(x, y);
        for (var i = 0; i < s.steps; i++) {
          var a = noise(x * scale, y * scale) * TWO_PI * s.curl;
          x += Math.cos(a) * s.stepSize;
          y += Math.sin(a) * s.stepSize;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
  }

  // --- export ------------------------------------------------------------
  function exportPNG() {
    var s = readState();
    canvas.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "flowfield-" + s.seed + ".png";
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
    ["particles", "particlesVal"],
    ["steps", "stepsVal"],
    ["stepSize", "stepSizeVal"],
    ["featureSize", "featureSizeVal"],
    ["curl", "curlVal"],
    ["lineWidth", "lineWidthVal"],
    ["opacity", "opacityVal"]
  ];

  sliders.forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    el.addEventListener("input", function () {
      document.getElementById(pair[1]).textContent = el.value;
      schedule();
    });
  });

  ["colorMode", "color1", "color2", "bgColor", "size"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", function () {
      syncColor2();
      schedule();
    });
  });

  document.getElementById("bgTransparent").addEventListener("change", schedule);
  document.getElementById("seed").addEventListener("input", schedule);
  document.getElementById("btnRandomize").addEventListener("click", randomSeed);
  document.getElementById("btnGenerate").addEventListener("click", schedule);
  document.getElementById("btnExport").addEventListener("click", exportPNG);

  function syncColor2() {
    var show = document.getElementById("colorMode").value === "gradient";
    document.getElementById("color2Row").classList.toggle("hidden", !show);
  }

  syncColor2();
  render();
})();
