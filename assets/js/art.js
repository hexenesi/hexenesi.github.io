/* Generative canvas art: Clifford attractor hero + per-project thumbnails.
   Every renderer reads its palette from CSS custom properties, so the art
   follows the active theme. */
(function () {
  'use strict';

  var registry = [];
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- palette ---------- */

  function hexToRgb(hex) {
    hex = (hex || '').trim().replace('#', '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    var n = parseInt(hex, 16);
    if (isNaN(n)) return [0, 0, 0];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    return {
      bg: hexToRgb(cs.getPropertyValue('--art-bg')),
      c1: hexToRgb(cs.getPropertyValue('--art-c1')),
      c2: hexToRgb(cs.getPropertyValue('--art-c2')),
      c3: hexToRgb(cs.getPropertyValue('--art-c3'))
    };
  }

  function rgb(c, alpha) {
    if (alpha === undefined) return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')';
  }

  /* Maps 0..1 through bg -> c1 -> c2 -> c3. */
  function ramp(pal, t, out) {
    var from, to, k;
    if (t < 0.45) { from = pal.bg; to = pal.c1; k = t / 0.45; }
    else if (t < 0.8) { from = pal.c1; to = pal.c2; k = (t - 0.45) / 0.35; }
    else { from = pal.c2; to = pal.c3; k = (t - 0.8) / 0.2; }
    out[0] = from[0] + (to[0] - from[0]) * k;
    out[1] = from[1] + (to[1] - from[1]) * k;
    out[2] = from[2] + (to[2] - from[2]) * k;
    return out;
  }

  /* ---------- canvas sizing ---------- */

  function sizeCanvas(canvas, maxWidth) {
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(rect.width * dpr);
    var h = Math.round(rect.height * dpr);
    if (w > maxWidth) {
      h = Math.round(h * (maxWidth / w));
      w = maxWidth;
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { w: w, h: h };
  }

  /* ---------- Clifford attractor ---------- */

  function cliffordParams(time) {
    return {
      a: -1.7 + 0.32 * Math.sin(time * 0.00029),
      b: 1.76 + 0.3 * Math.cos(time * 0.00021),
      c: -1.9 + 0.26 * Math.sin(time * 0.00017),
      d: -0.45 + 0.3 * Math.cos(time * 0.00031)
    };
  }

  function createAttractor(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d', { alpha: false });
    var pal = readPalette();
    var size = null;
    var density = null;
    var img = null;
    var x = 0.1;
    var y = 0.1;
    var rafId = 0;
    var visible = false;
    var onParams = opts.onParams;
    var lastLabel = 0;
    var pointsPerFrame = opts.points || 40000;
    var fadeFactor = opts.fade || 0.97;
    var peak = 0;

    function allocate() {
      var s = sizeCanvas(canvas, opts.maxWidth || 900);
      if (!s) return false;
      if (!size || s.w !== size.w || s.h !== size.h) {
        size = s;
        density = new Float32Array(s.w * s.h);
        img = ctx.createImageData(s.w, s.h);
      }
      return true;
    }

    function accumulate(p, count) {
      var w = size.w, h = size.h;
      /* The attractor is wider than it is tall, so fit each axis to its own
         extent and keep the aspect honest by taking the tighter of the two. */
      var scale = Math.min(w / (2 * (1 + Math.abs(p.c))), h / (2 * (1 + Math.abs(p.d)))) * 0.94;
      var cx = w / 2, cy = h / 2;
      for (var i = 0; i < count; i++) {
        var nx = Math.sin(p.a * y) + p.c * Math.cos(p.a * x);
        var ny = Math.sin(p.b * x) + p.d * Math.cos(p.b * y);
        x = nx;
        y = ny;
        var px = (cx + x * scale) | 0;
        var py = (cy + y * scale) | 0;
        if (px >= 0 && px < w && py >= 0 && py < h) {
          var v = density[py * w + px] + 1;
          density[py * w + px] = v;
          if (v > peak) peak = v;
        }
      }
    }

    function fade(f) {
      for (var i = 0; i < density.length; i++) density[i] *= f;
      peak *= f;
    }

    function paint() {
      var data = img.data;
      var out = [0, 0, 0];
      /* Log density against the running peak, then gamma — the same tone
         mapping fractal flames use, and it stays correct as params drift. */
      var invLogPeak = peak > 0 ? 1 / Math.log(1 + peak) : 0;
      for (var i = 0, p = 0; i < density.length; i++, p += 4) {
        var v = density[i];
        var t = v > 0 ? Math.pow(Math.log(1 + v) * invLogPeak, 0.55) : 0;
        ramp(pal, t, out);
        data[p] = out[0];
        data[p + 1] = out[1];
        data[p + 2] = out[2];
        data[p + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }

    function label(p, time) {
      if (!onParams || time - lastLabel < 220) return;
      lastLabel = time;
      onParams(p);
    }

    function frame(time) {
      rafId = 0;
      if (!visible || document.hidden) return;
      if (!allocate()) return;
      var p = cliffordParams(time);
      fade(fadeFactor);
      accumulate(p, pointsPerFrame);
      paint();
      label(p, time);
      rafId = requestAnimationFrame(frame);
    }

    function still() {
      if (!allocate()) return;
      /* A fixed, known-strange parameter set. Sampling the drift function
         instead can land on values that collapse to a point attractor. */
      var p = opts.stillParams || { a: -1.4, b: 1.6, c: 1.0, d: 0.7 };
      density.fill(0);
      peak = 0;
      x = 0.1;
      y = 0.1;
      accumulate(p, opts.stillPoints || size.w * size.h * 1.6);
      paint();
      if (onParams) onParams(p);
    }

    function prime(time) {
      /* Fill the buffer to roughly its steady state before the first paint so
         the canvas never shows up empty. */
      var p = cliffordParams(time);
      var budget = Math.round(pointsPerFrame / (1 - fadeFactor));
      accumulate(p, Math.min(budget, 900000));
    }

    function start() {
      visible = true;
      if (reduceMotion) {
        still();
        return;
      }
      if (!rafId) {
        if (allocate() && peak === 0) prime(performance.now());
        rafId = requestAnimationFrame(frame);
      }
    }

    function stop() {
      visible = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    return {
      canvas: canvas,
      start: start,
      stop: stop,
      refresh: function () {
        pal = readPalette();
        if (reduceMotion || !visible) still();
      },
      resize: function () {
        size = null;
        if (reduceMotion || !visible) still();
      },
      animated: true
    };
  }

  /* ---------- Mandelbrot ---------- */

  function createMandelbrot(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d', { alpha: false });
    var pal = readPalette();
    var maxIter = opts.maxIter || 260;
    var centerX = opts.cx !== undefined ? opts.cx : -0.748;
    var centerY = opts.cy !== undefined ? opts.cy : 0.1;
    var span = opts.span || 0.08;
    var rafId = 0;

    function render() {
      var s = sizeCanvas(canvas, opts.maxWidth || 560);
      if (!s) return;
      var w = s.w, h = s.h;
      var img = ctx.createImageData(w, h);
      var data = img.data;
      var out = [0, 0, 0];
      var scale = span / w;
      var row = 0;
      var rowsPerChunk = 48;
      /* The body of the set reads as solid: void on a dark theme, ink on a
         paper one. Pick whichever end of the ramp contrasts with the page. */
      var paper = (pal.bg[0] * 0.299 + pal.bg[1] * 0.587 + pal.bg[2] * 0.114) > 128;
      var interior = paper ? pal.c3 : pal.bg;

      /* An alpha:false canvas starts opaque white, so lay down the background
         before the chunked render reaches the lower rows. */
      ctx.fillStyle = rgb(pal.bg);
      ctx.fillRect(0, 0, w, h);

      function chunk() {
        rafId = 0;
        var start = row;
        var end = Math.min(row + rowsPerChunk, h);
        for (; row < end; row++) {
          var ci = centerY + (row - h / 2) * scale;
          for (var col = 0; col < w; col++) {
            var cr = centerX + (col - w / 2) * scale;
            var zr = 0, zi = 0, zr2 = 0, zi2 = 0, n = 0;
            while (zr2 + zi2 <= 16 && n < maxIter) {
              zi = 2 * zr * zi + ci;
              zr = zr2 - zi2 + cr;
              zr2 = zr * zr;
              zi2 = zi * zi;
              n++;
            }
            var p = (row * w + col) * 4;
            if (n >= maxIter) {
              out[0] = interior[0];
              out[1] = interior[1];
              out[2] = interior[2];
            } else {
              var mu = n + 1 - Math.log(Math.log(Math.sqrt(zr2 + zi2))) / Math.LN2;
              ramp(pal, Math.pow(Math.max(mu, 0) / maxIter, 0.42), out);
            }
            data[p] = out[0];
            data[p + 1] = out[1];
            data[p + 2] = out[2];
            data[p + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0, 0, start, w, end - start);
        if (row < h) rafId = requestAnimationFrame(chunk);
      }

      if (rafId) cancelAnimationFrame(rafId);
      chunk();
    }

    return {
      canvas: canvas,
      start: render,
      stop: function () {
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      },
      refresh: function () { pal = readPalette(); render(); },
      resize: render
    };
  }

  /* ---------- ASCII rendering of an escape-time field ---------- */

  function createAscii(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d', { alpha: false });
    var pal = readPalette();
    var chars = opts.chars || ' .:-=+*#%@';

    function render() {
      var s = sizeCanvas(canvas, opts.maxWidth || 560);
      if (!s) return;
      var w = s.w, h = s.h;
      var cols = opts.cols || 46;
      var cellW = w / cols;
      var cellH = cellW * 1.85;
      var rows = Math.max(1, Math.floor(h / cellH));

      ctx.fillStyle = rgb(pal.bg);
      ctx.fillRect(0, 0, w, h);
      ctx.font = Math.round(cellH * 0.95) + 'px "Fira Code", ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

      var maxIter = 90;
      var span = 3.1;
      var out = [0, 0, 0];
      var offsetY = (h - rows * cellH) / 2;

      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var cr = -0.62 + (c / cols - 0.5) * span;
          var ci = (r / rows - 0.5) * span * (rows * cellH) / w;
          var zr = 0, zi = 0, zr2 = 0, zi2 = 0, n = 0;
          while (zr2 + zi2 <= 4 && n < maxIter) {
            zi = 2 * zr * zi + ci;
            zr = zr2 - zi2 + cr;
            zr2 = zr * zr;
            zi2 = zi * zi;
            n++;
          }
          var t = n >= maxIter ? 1 : Math.pow(n / maxIter, 0.55);
          var idx = Math.min(chars.length - 1, Math.round(t * (chars.length - 1)));
          var ch = chars[idx];
          if (ch === ' ') continue;
          ramp(pal, 0.42 + t * 0.56, out);
          ctx.fillStyle = 'rgb(' + (out[0] | 0) + ',' + (out[1] | 0) + ',' + (out[2] | 0) + ')';
          ctx.fillText(ch, (c + 0.5) * cellW, offsetY + (r + 0.5) * cellH);
        }
      }
    }

    return {
      canvas: canvas,
      start: render,
      stop: function () {},
      refresh: function () { pal = readPalette(); render(); },
      resize: render
    };
  }

  /* ---------- Diagram-style thumbnails ---------- */

  function createDiagram(canvas, draw, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d', { alpha: false });
    var pal = readPalette();

    function render() {
      var s = sizeCanvas(canvas, opts.maxWidth || 560);
      if (!s) return;
      ctx.fillStyle = rgb(pal.bg);
      ctx.fillRect(0, 0, s.w, s.h);
      ctx.save();
      draw(ctx, s.w, s.h, pal);
      ctx.restore();
    }

    return {
      canvas: canvas,
      start: render,
      stop: function () {},
      refresh: function () { pal = readPalette(); render(); },
      resize: render
    };
  }

  /* Cascading thumbnails — ImageThumbnailer */
  function drawThumbs(ctx, w, h, pal) {
    var unit = Math.min(w, h);
    var x = w * 0.09;
    var y = h * 0.5;
    var side = unit * 0.52;
    ctx.lineWidth = Math.max(1, unit * 0.007);
    for (var i = 0; i < 5; i++) {
      var t = i / 4;
      ctx.strokeStyle = rgb(pal.c2, 0.85 - t * 0.5);
      ctx.fillStyle = rgb(pal.c1, 0.4 - t * 0.28);
      ctx.beginPath();
      ctx.rect(x, y - side / 2, side, side);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + side, y);
      ctx.lineTo(x + side + unit * 0.045, y);
      ctx.strokeStyle = rgb(pal.c1, 0.5);
      ctx.stroke();
      x += side + unit * 0.045;
      side *= 0.62;
    }
  }

  /* Tile grid — HexeFlick */
  function drawGrid(ctx, w, h, pal) {
    var cols = 4, rows = 3;
    var pad = Math.min(w, h) * 0.08;
    var gap = Math.min(w, h) * 0.045;
    var cw = (w - pad * 2 - gap * (cols - 1)) / cols;
    var ch = (h - pad * 2 - gap * (rows - 1)) / rows;
    var weights = [0.5, 0.22, 0.75, 0.3, 0.18, 0.62, 0.38, 0.85, 0.28, 0.46, 0.2, 0.58];
    ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.005);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var i = r * cols + c;
        var t = weights[i % weights.length];
        var x = pad + c * (cw + gap);
        var y = pad + r * (ch + gap);
        ctx.fillStyle = rgb(pal.c1, 0.25 + t * 0.4);
        ctx.fillRect(x, y, cw, ch);
        if (t > 0.7) {
          ctx.strokeStyle = rgb(pal.c2, 0.9);
          ctx.strokeRect(x, y, cw, ch);
        }
      }
    }
  }

  /* Lens rings — Optica */
  function drawLens(ctx, w, h, pal) {
    var cx = w / 2, cy = h / 2;
    var unit = Math.min(w, h);
    ctx.lineWidth = Math.max(1, unit * 0.006);
    for (var i = 6; i >= 1; i--) {
      var r = unit * 0.07 * i;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = rgb(i % 2 ? pal.c2 : pal.c1, 0.3 + (6 - i) * 0.11);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, unit * 0.42, -0.5, 0.9);
    ctx.strokeStyle = rgb(pal.c3, 0.75);
    ctx.lineWidth = Math.max(1, unit * 0.012);
    ctx.stroke();
    ctx.strokeStyle = rgb(pal.c1, 0.55);
    ctx.lineWidth = Math.max(1, unit * 0.004);
    ctx.beginPath();
    ctx.moveTo(cx - unit * 0.46, cy);
    ctx.lineTo(cx + unit * 0.46, cy);
    ctx.moveTo(cx, cy - unit * 0.46);
    ctx.lineTo(cx, cy + unit * 0.46);
    ctx.stroke();
  }

  /* ---------- wiring ---------- */

  function build(canvas) {
    var kind = canvas.getAttribute('data-art');
    switch (kind) {
      case 'attractor-hero':
        var paramsEl = document.querySelector('[data-art-params]');
        var captionEl = document.querySelector('[data-art-caption]');
        if (reduceMotion && captionEl) {
          captionEl.textContent = 'Clifford attractor — rendered in your browser';
        }
        return createAttractor(canvas, {
          maxWidth: 900,
          points: 24000,
          onParams: paramsEl ? function (p) {
            paramsEl.textContent =
              'a ' + p.a.toFixed(3) + '  b ' + p.b.toFixed(3) +
              '  c ' + p.c.toFixed(3) + '  d ' + p.d.toFixed(3);
          } : null
        });
      case 'mandelbrot':
        return createMandelbrot(canvas, { cx: -0.7436, cy: 0.1320, span: 0.018, maxIter: 420 });
      case 'mandelbrot-wide':
        return createMandelbrot(canvas, { cx: -0.6, cy: 0, span: 3.0, maxIter: 160 });
      case 'ascii':
        return createAscii(canvas, {});
      case 'thumbs':
        return createDiagram(canvas, drawThumbs);
      case 'grid':
        return createDiagram(canvas, drawGrid);
      case 'lens':
        return createDiagram(canvas, drawLens);
      default:
        return null;
    }
  }

  function init() {
    var canvases = document.querySelectorAll('canvas[data-art]');
    if (!canvases.length) return;

    Array.prototype.forEach.call(canvases, function (canvas) {
      var art = build(canvas);
      if (art) registry.push(art);
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var art = registry.find(function (a) { return a.canvas === entry.target; });
          if (!art) return;
          if (entry.isIntersecting) {
            art.start();
            if (!art.animated) io.unobserve(entry.target);
          } else if (art.animated) {
            art.stop();
          }
        });
      }, { rootMargin: '150px' });
      registry.forEach(function (art) { io.observe(art.canvas); });
    } else {
      registry.forEach(function (art) { art.start(); });
    }

    document.addEventListener('visibilitychange', function () {
      registry.forEach(function (art) {
        if (!art.animated) return;
        if (document.hidden) art.stop();
        else art.start();
      });
    });

    document.addEventListener('themechange', function () {
      registry.forEach(function (art) { art.refresh(); });
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        registry.forEach(function (art) { art.resize(); });
      }, 200);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
