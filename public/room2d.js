/* Niulai meadow — PixiJS 7 2.5D sit-down table */
(function (root) {
  "use strict";

  var app, ready = false, running = false, built = false;
  var canvas, tableEl, observer;
  var time = 0;
  var clouds = [];
  var tufts = [];
  var bands = [];
  var flowers = [];
  var logoSprite = null;
  var skySprite = null;
  var cache = {};
  var lastW = 0, lastH = 0;

  function $(id) { return document.getElementById(id); }

  function tableShown() {
    return tableEl && !tableEl.classList.contains("hidden");
  }

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function canvasTex(w, h, paint, key) {
    if (key && cache[key]) return cache[key];
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    paint(c.getContext("2d"), w, h);
    var tex = PIXI.Texture.from(c, { resolution: 1 });
    tex.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
    tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    if (key) cache[key] = tex;
    return tex;
  }

  function woodGrain() {
    return canvasTex(512, 256, function (ctx, W, H) {
      var g = ctx.createLinearGradient(0, 0, W * 0.15, H);
      g.addColorStop(0, "#4a2410");
      g.addColorStop(0.18, "#8a4a1c");
      g.addColorStop(0.38, "#c48438");
      g.addColorStop(0.55, "#6e3814");
      g.addColorStop(0.72, "#a86a28");
      g.addColorStop(0.88, "#3e1c0a");
      g.addColorStop(1, "#2a1206");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      var i, x, y, r;
      for (i = 0; i < 90; i++) {
        x = (i / 90) * W + Math.sin(i * 1.7) * 14;
        ctx.globalAlpha = 0.18 + (i % 5) * 0.04;
        ctx.strokeStyle = i % 3 === 0 ? "#1a0c04" : (i % 3 === 1 ? "#e0a85a" : "#5a2a10");
        ctx.lineWidth = 0.8 + (i % 4) * 0.7;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 18, H * 0.28, x - 22, H * 0.62, x + 8, H);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.22;
      for (i = 0; i < 7; i++) {
        x = 40 + (i * 67) % (W - 80);
        y = 30 + (i * 41) % (H - 60);
        r = 8 + (i % 3) * 5;
        var kg = ctx.createRadialGradient(x, y, 1, x, y, r);
        kg.addColorStop(0, "#2a1408");
        kg.addColorStop(0.45, "#6a3814");
        kg.addColorStop(1, "rgba(80,40,16,0)");
        ctx.fillStyle = kg;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.4, r * 0.7, i * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.12;
      for (i = 0; i < 900; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? "#f0c878" : "#1a0c04";
        ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
      }
      ctx.globalAlpha = 1;
    }, "wood");
  }

  function feltTex() {
    return canvasTex(512, 512, function (ctx, W, H) {
      var g = ctx.createRadialGradient(W * 0.5, H * 0.42, 8, W * 0.5, H * 0.5, W * 0.62);
      g.addColorStop(0, "#2cb478");
      g.addColorStop(0.42, "#178056");
      g.addColorStop(1, "#0a3e2a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      var i, x, y, a, len, ang;
      for (i = 0; i < 2800; i++) {
        x = Math.random() * W;
        y = Math.random() * H;
        a = 0.04 + Math.random() * 0.08;
        ctx.strokeStyle = Math.random() > 0.5
          ? "rgba(220,255,210," + a + ")"
          : "rgba(0,30,16," + (a * 1.15) + ")";
        ctx.lineWidth = 0.7 + Math.random() * 0.8;
        len = 2 + Math.random() * 4;
        ang = (x * 0.04 + y * 0.03) % 1 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len * 0.45);
        ctx.stroke();
      }
    }, "felt");
  }

  function skyTex(w, h) {
    var key = "sky-" + w + "x" + h;
    return canvasTex(w, h, function (ctx, W, H) {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#1e3d82");
      g.addColorStop(0.28, "#3d6aaa");
      g.addColorStop(0.48, "#8aa0c4");
      g.addColorStop(0.58, "#e0a868");
      g.addColorStop(0.66, "#f0b86a");
      g.addColorStop(0.74, "#7aaa4a");
      g.addColorStop(1, "#2f6a32");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      var sx = W * 0.16, sy = H * 0.20;
      var sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, W * 0.28);
      sg.addColorStop(0, "rgba(255,248,210,1)");
      sg.addColorStop(0.08, "rgba(255,220,130,.85)");
      sg.addColorStop(0.22, "rgba(255,150,60,.28)");
      sg.addColorStop(0.55, "rgba(255,110,40,.08)");
      sg.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, H);
    }, key);
  }

  function cloudTex(kind) {
    return canvasTex(320, 150, function (ctx, W, H) {
      ctx.clearRect(0, 0, W, H);
      var i, x, y, rx, ry, g;
      var blobs = kind === 1 ? 6 : 8;
      for (i = 0; i < blobs; i++) {
        x = 36 + (i * 37 + kind * 19) % (W - 72);
        y = 36 + (i * 23 + kind * 11) % (H - 64);
        rx = 26 + (i % 4) * 12;
        ry = 13 + (i % 3) * 8;
        g = ctx.createRadialGradient(x, y, 2, x, y, rx);
        g.addColorStop(0, "rgba(255,250,240,.92)");
        g.addColorStop(0.5, "rgba(255,214,170,.38)");
        g.addColorStop(1, "rgba(255,180,120,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }, "cloud-" + kind);
  }

  function tuftTex(kind) {
    return canvasTex(96, 128, function (ctx, W, H) {
      ctx.clearRect(0, 0, W, H);
      var blades = 8 + kind * 2;
      var i, x, ht, lean, col, mid;
      var cols = [
        ["#245818", "#3d8a28", "#6ec040"],
        ["#1e4c16", "#4a9a2c", "#7ed048"],
        ["#2a6018", "#56a832", "#8ad850"],
        ["#163814", "#2e701c", "#58a030"]
      ][kind % 4];
      for (i = 0; i < blades; i++) {
        x = W * 0.5 + (i - (blades - 1) / 2) * (6.2 + kind);
        ht = H * (0.52 + Math.abs(Math.sin(i * 1.7 + kind)) * 0.42);
        lean = (i - (blades - 1) / 2) * (2.4 + kind * 0.4);
        col = cols[i % 3];
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5 + (i % 3) * 0.55;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, H - 2);
        mid = H - ht * 0.52;
        ctx.quadraticCurveTo(x + lean * 0.35, mid, x + lean, H - ht);
        ctx.stroke();
        if (i % 3 === 1) {
          ctx.strokeStyle = "rgba(210,255,140,.35)";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(x + 0.6, H - 4);
          ctx.quadraticCurveTo(x + lean * 0.35 + 0.6, mid, x + lean + 0.6, H - ht + 3);
          ctx.stroke();
        }
      }
    }, "tuft-" + kind);
  }

  function meadowBand(kind) {
    return canvasTex(1024, 256, function (ctx, W, H) {
      ctx.clearRect(0, 0, W, H);
      var i, x, base, ht, lean, pal;
      pal = kind === 0
        ? ["#1a4818", "#2e6a22", "#4a882c"]
        : kind === 1
          ? ["#24601c", "#3d8a28", "#62b038"]
          : ["#2e781e", "#56a832", "#7ed048"];
      for (i = 0; i < 1400; i++) {
        x = (i * 47.3) % W;
        base = H * (0.42 + ((i * 13) % 80) / 200);
        ht = 16 + ((i * 17) % 36);
        lean = ((i * 11) % 17) - 8;
        ctx.strokeStyle = pal[i % 3];
        ctx.globalAlpha = 0.55 + (i % 5) * 0.08;
        ctx.lineWidth = 1 + (i % 3) * 0.4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.quadraticCurveTo(x + lean * 0.4, base - ht * 0.5, x + lean, base - ht);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }, "band-" + kind);
  }

  function flowerTex(kind) {
    return canvasTex(48, 56, function (ctx, W, H) {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "#2a6a1c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W * 0.5, H);
      ctx.quadraticCurveTo(W * 0.42, H * 0.6, W * 0.5, H * 0.42);
      ctx.stroke();
      var petals = kind === 0 ? 5 : 6;
      var col = kind === 0 ? "#f2d24a" : (kind === 1 ? "#fff6e8" : "#f0a0c0");
      var i, a, px, py;
      for (i = 0; i < petals; i++) {
        a = (i / petals) * Math.PI * 2 - Math.PI / 2;
        px = W * 0.5 + Math.cos(a) * 9;
        py = H * 0.36 + Math.sin(a) * 8;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(px, py, 5.2, 3.6, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = kind === 1 ? "#f0c040" : "#fff2a0";
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.36, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }, "flower-" + kind);
  }

  function logoTex() {
    if (cache.logo) {
      cache.logo.destroy(true);
      cache.logo = null;
    }
    return canvasTex(760, 220, function (ctx, W, H) {
      ctx.clearRect(0, 0, W, H);
      var words = [
        { t: "牛", fill: "#f6cc6e", stroke: "#5a1e08" },
        { t: "来", fill: "#ffe38a", stroke: "#6a3208" },
        { t: "掼", fill: "#efc04a", stroke: "#4a2208" },
        { t: "蛋", fill: "#d8a828", stroke: "#3a4010" }
      ];
      ctx.font = "900 124px 'Noto Serif SC','Noto Serif JP','STKaiti','KaiTi',serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      var i, x, y;
      for (i = 0; i < 4; i++) {
        x = W * 0.145 + i * (W * 0.237);
        y = H * 0.52 + (i % 2 ? 7 : -5);
        ctx.lineWidth = 14;
        ctx.strokeStyle = words[i].stroke;
        ctx.strokeText(words[i].t, x, y);
        ctx.lineWidth = 5;
        ctx.strokeStyle = "rgba(255,236,180,.35)";
        ctx.strokeText(words[i].t, x, y);
        ctx.fillStyle = words[i].fill;
        ctx.fillText(words[i].t, x, y);
      }
    }, "logo");
  }

  function fillPoly(g, tex, pts, sx, sy) {
    var m = new PIXI.Matrix();
    m.scale(sx || 1, sy || 1);
    g.beginTextureFill({ texture: tex, matrix: m });
    g.drawPolygon(pts);
    g.endFill();
  }

  function trap(cx, farY, nearY, farH, nearH) {
    return [
      cx - farH, farY,
      cx + farH, farY,
      cx + nearH, nearY,
      cx - nearH, nearY
    ];
  }

  function addHills(stage, W, H, horizon) {
    var layers = [
      { y: horizon - H * 0.10, amp: H * 0.055, col: 0x2a4a38, seed: 11 },
      { y: horizon - H * 0.04, amp: H * 0.07, col: 0x3a6a32, seed: 23 },
      { y: horizon + H * 0.02, amp: H * 0.08, col: 0x4a8a38, seed: 41 }
    ];
    var L, i, g, x, y, rand, steps;
    for (L = 0; L < layers.length; L++) {
      rand = rng(layers[L].seed);
      g = new PIXI.Graphics();
      g.beginFill(layers[L].col);
      g.moveTo(0, H);
      g.lineTo(0, layers[L].y);
      steps = 8;
      for (i = 0; i <= steps; i++) {
        x = (i / steps) * W;
        y = layers[L].y - Math.sin(i * 1.15 + L) * layers[L].amp
          - rand() * layers[L].amp * 0.45;
        g.bezierCurveTo(
          x - W / steps * 0.4, y + layers[L].amp * 0.15,
          x - W / steps * 0.15, y,
          x, y
        );
      }
      g.lineTo(W, H);
      g.closePath();
      g.endFill();
      g.alpha = 0.92 - L * 0.04;
      stage.addChild(g);
    }
  }

  function addTree(stage, x, y, s, deep) {
    var g = new PIXI.Graphics();
    var bark = deep ? 0x3a2410 : 0x4a3214;
    var leaf = deep ? 0x12351a : 0x1a4a22;
    var leaf2 = deep ? 0x1a4820 : 0x2a6a28;
    g.beginFill(bark);
    g.drawRect(x - 6 * s, y - 52 * s, 12 * s, 56 * s);
    g.endFill();
    g.beginFill(leaf);
    g.drawEllipse(x, y - 78 * s, 34 * s, 42 * s);
    g.endFill();
    g.beginFill(leaf2);
    g.drawEllipse(x - 16 * s, y - 58 * s, 22 * s, 20 * s);
    g.drawEllipse(x + 18 * s, y - 62 * s, 20 * s, 18 * s);
    g.endFill();
    g.beginFill(leaf);
    g.moveTo(x, y - 118 * s);
    g.lineTo(x + 28 * s, y - 70 * s);
    g.lineTo(x - 28 * s, y - 70 * s);
    g.closePath();
    g.endFill();
    stage.addChild(g);
  }

  function addBush(stage, x, y, s) {
    var g = new PIXI.Graphics();
    g.beginFill(0x164820);
    g.drawEllipse(x, y, 28 * s, 16 * s);
    g.endFill();
    g.beginFill(0x2a6a28);
    g.drawEllipse(x - 12 * s, y - 6 * s, 16 * s, 12 * s);
    g.drawEllipse(x + 10 * s, y - 8 * s, 14 * s, 11 * s);
    g.endFill();
    stage.addChild(g);
  }

  function addSky(stage, W, H) {
    var tex = skyTex(Math.max(8, W | 0), Math.max(8, H | 0));
    skySprite = new PIXI.Sprite(tex);
    skySprite.width = W;
    skySprite.height = H;
    stage.addChild(skySprite);

    var spots = [
      [0.12, 0.14, 0.28, 0.11, 0.18],
      [0.42, 0.10, 0.34, 0.12, -0.12],
      [0.68, 0.16, 0.26, 0.10, 0.08],
      [0.86, 0.12, 0.30, 0.11, -0.16],
      [0.28, 0.20, 0.22, 0.08, 0.22]
    ];
    var i, spr, spec;
    for (i = 0; i < spots.length; i++) {
      spec = spots[i];
      spr = new PIXI.Sprite(cloudTex(i % 2));
      spr.anchor.set(0.5);
      spr.x = W * spec[0];
      spr.y = H * spec[1];
      spr.width = W * spec[2];
      spr.height = H * spec[3];
      spr.rotation = spec[4];
      spr.alpha = 0.82;
      spr._spd = 0.08 + i * 0.025;
      spr._baseY = spr.y;
      spr._ph = i * 1.3;
      stage.addChild(spr);
      clouds.push(spr);
    }
  }

  function addGrass(stage, W, H, table) {
    var i, spr, rand, x, y, sc, kind, band, amp;
    var horizon = table.farY - H * 0.02;

    for (i = 0; i < 3; i++) {
      band = new PIXI.TilingSprite(meadowBand(i), W + 80, Math.max(70, H * (0.10 + i * 0.04)));
      band.x = -40;
      band.y = horizon + H * (0.01 + i * 0.055);
      band.alpha = 0.88 - i * 0.06;
      band.tileScale.set(1 + i * 0.15, 0.85 + i * 0.2);
      band._spd = 6 + i * 4;
      band._ph = i * 0.9;
      stage.addChild(band);
      bands.push(band);
    }

    rand = rng(20260820);
    var count = W < 700 ? 160 : 240;
    var tufs = [tuftTex(0), tuftTex(1), tuftTex(2), tuftTex(3)];
    for (i = 0; i < count; i++) {
      kind = i % 4;
      spr = new PIXI.Sprite(tufs[kind]);
      spr.anchor.set(0.5, 1);
      if (i < count * 0.38) {
        x = rand() * W;
        y = horizon + 20 + rand() * (table.farY - horizon + 30);
        sc = 0.28 + rand() * 0.28;
        amp = 0.06;
      } else if (i < count * 0.72) {
        if (rand() < 0.5) {
          x = rand() * (table.cx - table.nearH - 10);
        } else {
          x = table.cx + table.nearH + 10 + rand() * Math.max(20, W - table.cx - table.nearH - 10);
        }
        y = table.farY + rand() * (table.nearY - table.farY + 20);
        sc = 0.45 + rand() * 0.4;
        amp = 0.10;
      } else {
        x = rand() * W;
        y = table.nearY + 8 + rand() * Math.max(24, H - table.nearY - 8);
        if (y > H - 8) y = H - 8;
        sc = 0.7 + rand() * 0.7;
        amp = 0.14;
      }
      if (insideTable(x, y, table, 18)) continue;
      spr.x = x;
      spr.y = y;
      spr.scale.set(sc * (0.85 + rand() * 0.3), sc);
      spr._spd = 1.35 + rand() * 1.1;
      spr._ph = rand() * Math.PI * 2;
      spr._amp = amp * (0.8 + rand() * 0.5);
      spr.zIndex = y | 0;
      stage.addChild(spr);
      tufts.push(spr);
    }

    var flTex = [flowerTex(0), flowerTex(1), flowerTex(2)];
    var fc = W < 700 ? 28 : 46;
    for (i = 0; i < fc; i++) {
      spr = new PIXI.Sprite(flTex[i % 3]);
      spr.anchor.set(0.5, 1);
      x = rand() * W;
      y = table.farY + rand() * (H - table.farY - 10);
      if (insideTable(x, y, table, 28)) {
        if (rand() < 0.5) x = 12 + rand() * Math.max(8, table.cx - table.nearH - 20);
        else x = table.cx + table.nearH + 12 + rand() * 40;
      }
      spr.x = x;
      spr.y = y;
      sc = 0.55 + rand() * 0.55;
      spr.scale.set(sc, sc);
      spr._spd = 1.1 + rand() * 0.8;
      spr._ph = rand() * 6.28;
      spr._amp = 0.08;
      stage.addChild(spr);
      flowers.push(spr);
    }
  }

  function insideTable(x, y, t, pad) {
    if (y < t.farY - pad || y > t.nearY + pad) return false;
    var u = (y - t.farY) / Math.max(1, t.nearY - t.farY);
    var half = t.farH + (t.nearH - t.farH) * u + pad;
    return Math.abs(x - t.cx) < half;
  }

  function tableLayout(W, H) {
    var portrait = H > W * 1.05;
    var farY = portrait ? H * 0.34 : H * 0.29;
    var nearY = portrait ? H * 0.62 : H * 0.73;
    var farH = Math.min(W * 0.27, portrait ? 220 : 340);
    var nearH = Math.min(W * 0.455, portrait ? 360 : 540);
    return {
      cx: W * 0.5,
      farY: farY,
      nearY: nearY,
      farH: farH,
      nearH: nearH,
      thick: Math.max(16, H * 0.026),
      rimN: Math.max(18, W * 0.028),
      rimF: Math.max(11, W * 0.016)
    };
  }

  function addTable(stage, W, H, t) {
    var wood = woodGrain();
    var felt = feltTex();
    var g, pts, innerFar, innerNear, goldFar, goldNear, face;

    g = new PIXI.Graphics();
    g.beginFill(0x0a1808, 0.42);
    g.drawEllipse(t.cx, t.nearY + t.thick * 0.55, t.nearH * 0.92, t.thick * 1.8);
    g.endFill();
    g.beginFill(0x0a1808, 0.22);
    g.drawEllipse(t.cx, (t.farY + t.nearY) * 0.5 + 8, (t.farH + t.nearH) * 0.42, (t.nearY - t.farY) * 0.38);
    g.endFill();
    stage.addChild(g);

    face = [
      t.cx - t.nearH, t.nearY,
      t.cx + t.nearH, t.nearY,
      t.cx + t.nearH * 0.96, t.nearY + t.thick,
      t.cx - t.nearH * 0.96, t.nearY + t.thick
    ];
    g = new PIXI.Graphics();
    fillPoly(g, wood, face, 0.55, 0.55);
    g.beginFill(0x1a0c04, 0.28);
    g.drawPolygon(face);
    g.endFill();
    stage.addChild(g);

    var leftSide = [
      t.cx - t.farH, t.farY,
      t.cx - t.nearH, t.nearY,
      t.cx - t.nearH * 0.96, t.nearY + t.thick,
      t.cx - t.farH * 0.98, t.farY + t.thick * 0.35
    ];
    var rightSide = [
      t.cx + t.farH, t.farY,
      t.cx + t.nearH, t.nearY,
      t.cx + t.nearH * 0.96, t.nearY + t.thick,
      t.cx + t.farH * 0.98, t.farY + t.thick * 0.35
    ];
    g = new PIXI.Graphics();
    fillPoly(g, wood, leftSide, 0.4, 0.4);
    fillPoly(g, wood, rightSide, 0.4, 0.4);
    g.beginFill(0x000000, 0.18);
    g.drawPolygon(leftSide);
    g.drawPolygon(rightSide);
    g.endFill();
    stage.addChild(g);

    pts = trap(t.cx, t.farY, t.nearY, t.farH, t.nearH);
    g = new PIXI.Graphics();
    fillPoly(g, wood, pts, 0.7, 0.55);
    stage.addChild(g);

    g = new PIXI.Graphics();
    g.lineStyle(Math.max(2.5, W * 0.003), 0xf2d060, 0.95);
    g.drawPolygon(pts);
    g.endFill();
    stage.addChild(g);

    innerFar = t.farH - t.rimF;
    innerNear = t.nearH - t.rimN;
    goldFar = innerFar + 3;
    goldNear = innerNear + 4;
    g = new PIXI.Graphics();
    g.beginFill(0xf0cc58);
    g.drawPolygon(trap(t.cx, t.farY + 3, t.nearY - 4, goldFar, goldNear));
    g.endFill();
    stage.addChild(g);

    var feltPts = trap(t.cx, t.farY + 6, t.nearY - 8, innerFar, innerNear);
    g = new PIXI.Graphics();
    fillPoly(g, felt, feltPts, 0.85, 0.7);
    stage.addChild(g);

    g = new PIXI.Graphics();
    g.beginFill(0xffffff, 0.07);
    g.drawPolygon(trap(t.cx, t.farY + 10, (t.farY + t.nearY) * 0.48, innerFar * 0.72, innerNear * 0.55));
    g.endFill();
    g.beginFill(0x042010, 0.16);
    g.drawPolygon(trap(t.cx, (t.farY + t.nearY) * 0.62, t.nearY - 8, innerFar * 0.9, innerNear));
    g.endFill();
    stage.addChild(g);

    logoSprite = new PIXI.Sprite(logoTex());
    logoSprite.anchor.set(0.5);
    logoSprite.x = t.cx;
    logoSprite.y = t.farY + (t.nearY - t.farY) * 0.40;
    logoSprite.scale.set(
      Math.min(0.78, (innerFar + innerNear) / 760),
      Math.min(0.36, (t.nearY - t.farY) / 620)
    );
    logoSprite.alpha = 0.72;
    stage.addChild(logoSprite);
  }

  function clearStage() {
    clouds.length = 0;
    tufts.length = 0;
    bands.length = 0;
    flowers.length = 0;
    logoSprite = null;
    skySprite = null;
    if (!app) return;
    var ch = app.stage.children.slice();
    var i;
    for (i = 0; i < ch.length; i++) {
      app.stage.removeChild(ch[i]);
      if (ch[i].destroy) ch[i].destroy({ children: true, texture: false, baseTexture: false });
    }
  }

  function buildScene() {
    if (!app) return;
    var W = (app.screen && app.screen.width) || window.innerWidth || 1;
    var H = (app.screen && app.screen.height) || window.innerHeight || 1;
    if (W < 8 || H < 8) return;
    clearStage();
    var t = tableLayout(W, H);
    addSky(app.stage, W, H);
    addHills(app.stage, W, H, t.farY - H * 0.04);
    addTree(app.stage, W * 0.10, t.farY - H * 0.02, 1.15, true);
    addTree(app.stage, W * 0.88, t.farY - H * 0.01, 1.35, true);
    addTree(app.stage, W * 0.22, t.farY - H * 0.06, 0.82, false);
    addTree(app.stage, W * 0.74, t.farY - H * 0.07, 0.95, true);
    addTree(app.stage, W * 0.48, t.farY - H * 0.11, 0.7, true);
    addGrass(app.stage, W, H, t);
    addBush(app.stage, W * 0.16, t.farY + 18, 1.1);
    addBush(app.stage, W * 0.84, t.farY + 22, 1.25);
    addTable(app.stage, W, H, t);
    addBush(app.stage, W * 0.08, t.nearY - 8, 0.95);
    addBush(app.stage, W * 0.93, t.nearY - 4, 1.05);
    addBush(app.stage, t.cx - t.nearH - 28, t.nearY + 6, 0.8);
    addBush(app.stage, t.cx + t.nearH + 26, t.nearY + 8, 0.85);
    var nearGrass = new PIXI.Container();
    var i;
    for (i = tufts.length - 1; i >= 0; i--) {
      if (tufts[i].y > t.nearY - 6) {
        app.stage.removeChild(tufts[i]);
        nearGrass.addChild(tufts[i]);
      }
    }
    for (i = flowers.length - 1; i >= 0; i--) {
      if (flowers[i].y > t.nearY - 4) {
        app.stage.removeChild(flowers[i]);
        nearGrass.addChild(flowers[i]);
      }
    }
    app.stage.addChild(nearGrass);
    built = true;
    lastW = W;
    lastH = H;
  }

  function onTick(delta) {
    time += delta * 0.01666;
    var i, s, W;
    W = lastW || 1;
    for (i = 0; i < clouds.length; i++) {
      s = clouds[i];
      s.x += s._spd * delta * 0.35;
      s.y = s._baseY + Math.sin(time * 0.22 + s._ph) * 4;
      if (s.x > W + s.width * 0.5) s.x = -s.width * 0.5;
    }
    for (i = 0; i < bands.length; i++) {
      s = bands[i];
      s.tilePosition.x = Math.sin(time * 0.55 + s._ph) * s._spd;
    }
    for (i = 0; i < tufts.length; i++) {
      s = tufts[i];
      s.rotation = Math.sin(time * s._spd + s._ph) * s._amp
        + Math.sin(time * s._spd * 1.73 + s._ph * 1.4) * s._amp * 0.42;
    }
    for (i = 0; i < flowers.length; i++) {
      s = flowers[i];
      s.rotation = Math.sin(time * s._spd + s._ph) * s._amp;
    }
  }

  function resize() {
    if (!app) return;
    var w = window.innerWidth || 1;
    var h = window.innerHeight || 1;
    app.renderer.resolution = Math.min(window.devicePixelRatio || 1, 2);
    app.renderer.resize(w, h);
    if (canvas) {
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
    }
    buildScene();
    if (tableShown() && app.renderer) app.renderer.render(app.stage);
  }

  function init() {
    if (ready || !root.PIXI) return;
    canvas = $("room-gl");
    if (!canvas) return;
    try {
      app = new PIXI.Application({
        view: canvas,
        width: window.innerWidth || 320,
        height: window.innerHeight || 240,
        antialias: true,
        backgroundColor: 0x3d6aaa,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        powerPreference: "high-performance",
        autoStart: false
      });
    } catch (err) {
      document.body.classList.add("no-webgl");
      return;
    }
    if (!app.renderer) {
      document.body.classList.add("no-webgl");
      return;
    }
    app.ticker.autoStart = false;
    app.ticker.stop();
    app.ticker.add(onTick);
    ready = true;
    resize();
  }

  function start() {
    if (!ready) init();
    if (!ready || running) return;
    running = true;
    if (!built) buildScene();
    app.ticker.start();
  }

  function stop() {
    if (!app || !running) return;
    running = false;
    app.ticker.stop();
  }

  function sync() {
    if (tableShown()) start();
    else stop();
  }

  function boot() {
    tableEl = $("table");
    canvas = $("room-gl");
    if (!tableEl || !canvas) return;
    if (!root.PIXI) {
      document.body.classList.add("no-webgl");
      return;
    }
    observer = new MutationObserver(sync);
    observer.observe(tableEl, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", function () {
      clearTimeout(resize._t);
      resize._t = setTimeout(resize, 60);
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else sync();
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (cache.logo) {
          cache.logo.destroy(true);
          cache.logo = null;
        }
        if (ready && built) buildScene();
      });
    }
    sync();
  }

  root.NiulaiRoom2D = {
    sync: sync,
    start: start,
    stop: stop
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
