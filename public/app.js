(function () {
  "use strict";

  var socket = io({ transports: ["websocket", "polling"], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 500 });
  var state = null;
  var selected = {};
  var animLock = false;
  var dealPending = false;
  var sfxOn = true;
  var bgmOn = false;
  var takeoverOn = false;
  try { bgmOn = localStorage.getItem("nl-bgm") === "1"; } catch (e0) {}
  try { takeoverOn = localStorage.getItem("nl-takeover") === "1"; } catch (e1) {}
  var audioCtx = null;
  var localStream = null;
  var pcs = {};
  var micOn = false;
  var timerRaf = 0;
  var lastPlaySig = "";

  var $ = function (id) { return document.getElementById(id); };
  function T(key, vars) { return (window.I18N && I18N.t) ? I18N.t(key, vars) : key; }
  function comboLabel(c) { return (window.I18N && I18N.comboName) ? I18N.comboName(c) : ((c && c.name) || ""); }
  function placeLabel(place, title) { return (window.I18N && I18N.placeName) ? I18N.placeName(place, title) : (title || ""); }
  function kindLabel(kind) { return (window.I18N && I18N.kindName) ? I18N.kindName(kind) : (kind || ""); }
  function errLabel(msg) { return (window.I18N && I18N.err) ? I18N.err(msg) : (msg || ""); }
  var lobby = $("lobby");
  var table = $("table");
  var handEl = $("hand");
  var lastPlayEl = $("last-play");
  var comboNameEl = $("combo-name");

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function nick() {
    var n = $("nick").value.trim() || localStorage.getItem("gd-nick") || "";
    if (!n) n = T("nick.default", { n: Math.floor(Math.random() * 90 + 10) });
    localStorage.setItem("gd-nick", n);
    $("nick").value = n;
    return n;
  }

  $("nick").value = localStorage.getItem("gd-nick") || "";

  function qsRoom() {
    var m = /[?&]room=([A-Za-z0-9]+)/.exec(location.search);
    return m ? m[1].toUpperCase() : "";
  }
  if (qsRoom()) $("room-code").value = qsRoom();

  function ensureAudio() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  var Sfx = {
    play: function (fn) {
      if (!sfxOn) return;
      var ctx = ensureAudio();
      if (!ctx) return;
      try { fn(ctx); } catch (e) {}
    },
    noise: function (ctx, dur, vol, freq) {
      var n = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      var d = n.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      var src = ctx.createBufferSource();
      src.buffer = n;
      var f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = freq || 1200;
      var g = ctx.createGain();
      g.gain.value = vol || 0.15;
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      src.start();
    },
    tone: function (ctx, freq, dur, vol, type) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = type || "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + dur);
    },
    deal: function () { this.play(function (c) { Sfx.noise(c, 0.05, 0.08, 1800); }); },
    shuffle: function () { this.play(function (c) { Sfx.noise(c, 0.28, 0.12, 900); Sfx.tone(c, 180, 0.2, 0.04, "triangle"); }); },
    slap: function () { this.play(function (c) { Sfx.noise(c, 0.08, 0.18, 600); Sfx.tone(c, 220, 0.08, 0.08, "square"); }); },
    pass: function () { this.play(function (c) { Sfx.tone(c, 520, 0.09, 0.07, "sine"); }); },
    bomb: function () {
      this.play(function (c) {
        Sfx.noise(c, 0.38, 0.16, 220);
        Sfx.tone(c, 98, 0.36, 0.09, "sine");
        Sfx.tone(c, 147, 0.3, 0.06, "triangle");
      });
    },
    sting: function (kind) {
      this.play(function (c) {
        var notes = kind === "joker4" ? [196, 294, 392, 294, 392]
          : kind === "joker3" ? [196, 247, 294, 392]
          : kind === "special" ? [196, 247, 294, 392]
          : [196, 294, 247, 392];
        notes.forEach(function (f, i) {
          setTimeout(function () { Sfx.tone(c, f, 0.26, kind === "special" ? 0.07 : 0.08, "triangle"); }, i * 70);
        });
        Sfx.noise(c, 0.22, 0.08, kind === "special" ? 480 : 260);
      });
    },
    win: function () {
      this.play(function (c) {
        [523, 659, 784, 1046].forEach(function (f, i) {
          setTimeout(function () { Sfx.tone(c, f, 0.22, 0.1, "triangle"); }, i * 110);
        });
      });
    }
  };

  var Bgm = {
    running: false,
    nodes: [],
    _tick: 0,
    pluck: function (ctx, dest, freq, dur, vol) {
      try {
        var o = ctx.createOscillator();
        var f = ctx.createBiquadFilter();
        var g = ctx.createGain();
        o.type = "triangle";
        o.frequency.value = freq;
        f.type = "lowpass";
        f.frequency.value = 2200;
        f.Q.value = 0.8;
        g.gain.setValueAtTime(vol || 0.03, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        o.connect(f); f.connect(g); g.connect(dest);
        o.start(); o.stop(ctx.currentTime + dur);
      } catch (e) {}
    },
    start: function () {
      var ctx = ensureAudio();
      if (!ctx || this.running) return;
      this.running = true;
      var master = ctx.createGain();
      master.gain.value = 0.48;
      master.connect(ctx.destination);
      function pad(freq, type, detune, vol) {
        var o = ctx.createOscillator();
        o.type = type || "sine";
        o.frequency.value = freq;
        o.detune.value = detune || 0;
        var f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 420;
        f.Q.value = 0.7;
        var g = ctx.createGain();
        g.gain.value = vol || 0.22;
        var lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 0.05;
        var lg = ctx.createGain();
        lg.gain.value = 36;
        lfo.connect(lg); lg.connect(f.frequency);
        o.connect(f); f.connect(g); g.connect(master);
        o.start(); lfo.start();
        Bgm.nodes.push(o, lfo);
      }
      pad(146.8, "sine", -4, 0.22);
      pad(220, "sine", 5, 0.16);
      pad(293.7, "triangle", 3, 0.12);
      this.nodes.push(master);
      this._master = master;
      this._seq = 0;
      // Original festive pentatonic homage (喜洋洋 / 步步高 character — not a licensed recording).
      // D–E–F#–A–B, 16th pickups + rising steps, ~128 BPM bounce.
      var grid = [
        440, 494, 587, 0, 740, 0, 659, 0,
        587, 0, 494, 0, 440, 0, 0, 0,
        587, 659, 740, 0, 880, 0, 740, 0,
        659, 0, 587, 0, 494, 0, 0, 0,
        659, 740, 880, 0, 988, 0, 880, 0,
        740, 0, 659, 0, 587, 0, 0, 0,
        740, 880, 988, 0, 1175, 0, 880, 0,
        740, 0, 587, 0, 440, 0, 0, 0
      ];
      var bass = [294, 294, 220, 294, 330, 294, 220, 247];
      var sixteenthMs = Math.round((60 / 128) * 250);
      this._tick = setInterval(function () {
        if (!Bgm.running || !Bgm._master) return;
        var i = Bgm._seq;
        var f = grid[i % grid.length];
        if (f) Bgm.pluck(ctx, Bgm._master, f, 0.22, 0.18);
        if (i % 4 === 0) Bgm.pluck(ctx, Bgm._master, bass[(i / 4 | 0) % bass.length], 0.28, 0.12);
        if (i % 8 === 0) {
          try {
            var n = ctx.createBuffer(1, ctx.sampleRate * 0.035, ctx.sampleRate);
            var d = n.getChannelData(0);
            var k;
            for (k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / d.length);
            var src = ctx.createBufferSource();
            src.buffer = n;
            var bp = ctx.createBiquadFilter();
            bp.type = "highpass";
            bp.frequency.value = 2200;
            var gg = ctx.createGain();
            gg.gain.value = 0.09;
            src.connect(bp); bp.connect(gg); gg.connect(Bgm._master);
            src.start();
          } catch (e2) {}
        }
        Bgm._seq++;
      }, sixteenthMs);
    },
    stop: function () {
      this.running = false;
      if (this._tick) { clearInterval(this._tick); this._tick = 0; }
      this.nodes.forEach(function (n) {
        try { if (n.stop) n.stop(); } catch (e) {}
        try { n.disconnect(); } catch (e2) {}
      });
      this.nodes = [];
      this._master = null;
    },
    syncBtn: function () {
      var btn = $("btn-bgm");
      if (!btn) return;
      btn.classList.toggle("on", !!bgmOn);
      btn.classList.toggle("muted", !bgmOn);
    },
    set: function (on) {
      bgmOn = !!on;
      try { localStorage.setItem("nl-bgm", bgmOn ? "1" : "0"); } catch (e) {}
      this.syncBtn();
      if (bgmOn) this.start();
      else this.stop();
    }
  };

  function toast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove("show"); }, 1400);
  }

  function relOf(seat) {
    if (!state || state.selfSeat < 0) return "south";
    var d = (seat - state.selfSeat + 4) % 4;
    return ["south", "east", "north", "west"][d];
  }

  function seatEl(rel) { return $("seat-" + rel); }

  function cardHTML(id, extraClass, small) {
    var c = GDCombo.parseCard(id);
    extraClass = extraClass || "";
    if (!c) return "";
    var red = c.suit === "H" || c.suit === "D" || c.joker === "b";
    var suitKey = c.joker ? ("joker-" + c.joker) : ("suit-" + c.suit);
    var faceExtra = (window.NiulaiTheme && NiulaiTheme.faceClass) ? NiulaiTheme.faceClass(c) : "";
    var cls = "card " + extraClass + (red ? " red" : "") + (c.joker ? " joker" : "") + " " + suitKey +
      (faceExtra ? " " + faceExtra : "");
    var mark = "";
    if (state && !c.joker) {
      if (GDCombo.isWild(c, state.level)) mark = '<span class="mark wild">配</span>';
      else if (c.rank === state.level) mark = '<span class="mark level">级</span>';
    }
    var rk, st;
    if (c.joker) {
      rk = c.joker === "b" ? T("card.big") : T("card.small");
      st = T("card.joker");
    } else {
      rk = GDCombo.RANK_LABEL[c.rank] || c.rank;
      st = GDCombo.SUIT_GLYPH[c.suit] || "";
    }
    return '<div class="' + cls + '" data-id="' + id + '"><div class="face">' +
      '<div class="rk">' + rk + (st ? '<div class="st">' + st + "</div>" : "") + "</div>" +
      '<div class="pip"></div>' +
      '<div class="rk br">' + rk + (st ? '<div class="st">' + st + "</div>" : "") + "</div>" +
      mark +
      "</div></div>";
  }

  function cardNode(id, extraClass) {
    var d = document.createElement("div");
    d.innerHTML = cardHTML(id, extraClass);
    return d.firstChild;
  }

  function idsEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var i;
    for (i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function backHTML(cls) {
    return '<div class="card facedown ' + (cls || "") + '"><div class="back"></div><div class="face"></div></div>';
  }

  function rectOf(el) {
    if (!el) return { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 40, height: 56 };
    return el.getBoundingClientRect();
  }

  function quadPt(a, b, c, t) {
    var u = 1 - t;
    return {
      x: u * u * a.x + 2 * u * t * b.x + t * t * c.x,
      y: u * u * a.y + 2 * u * t * b.y + t * t * c.y
    };
  }

  function dealArc(rel) {
    if (rel === "south") return { side: 1, bulge: 78 };
    if (rel === "north") return { side: -1, bulge: 92 };
    if (rel === "west") return { side: 1, bulge: 74 };
    return { side: -1, bulge: 74 };
  }

  function flyFromTo(html, from, to, dur, rot, opts) {
    opts = opts || {};
    var layer = $("fly-layer");
    if (!layer) return;
    var wrap = document.createElement("div");
    wrap.className = "fly-card" + (opts.trail === false ? "" : " with-trail");
    wrap.innerHTML = html;
    wrap.style.left = from.left + "px";
    wrap.style.top = from.top + "px";
    wrap.style.width = (from.width || 52) + "px";
    wrap.style.height = (from.height || 74) + "px";
    layer.appendChild(wrap);
    var dx = to.left - from.left;
    var dy = to.top - from.top;
    var len = Math.hypot(dx, dy) || 1;
    var bulge = opts.bulge != null ? opts.bulge : Math.min(110, Math.max(36, len * 0.28));
    var side = opts.side != null ? opts.side : (dx >= 0 ? 1 : -1);
    var nx = (-dy / len) * bulge * side;
    var ny = (dx / len) * bulge * side;
    var cx = dx * 0.46 + nx;
    var cy = dy * 0.36 + ny;
    var r = rot != null ? rot : (Math.random() * 18 - 9);
    var frames = [];
    var steps = 10;
    var i, t, p, lift, sc;
    for (i = 0; i <= steps; i++) {
      t = i / steps;
      p = quadPt({ x: 0, y: 0 }, { x: cx, y: cy }, { x: dx, y: dy }, t);
      lift = Math.sin(t * Math.PI) * 0.1;
      sc = 1 + lift - t * 0.06;
      frames.push({
        transform: "translate(" + p.x.toFixed(1) + "px," + p.y.toFixed(1) + "px) rotate(" + (r * t).toFixed(1) + "deg) scale(" + sc.toFixed(3) + ")",
        offset: t
      });
    }
    var ms = dur || 420;
    wrap.animate(frames, { duration: ms, easing: "cubic-bezier(.18,.78,.12,1)", fill: "forwards" });
    if (opts.trail !== false) {
      var streak = document.createElement("div");
      streak.className = "fly-streak";
      streak.style.left = (from.left + (from.width || 52) / 2) + "px";
      streak.style.top = (from.top + (from.height || 74) / 2) + "px";
      layer.appendChild(streak);
      var sFrames = [];
      for (i = 0; i <= steps; i++) {
        t = i / steps;
        p = quadPt({ x: 0, y: 0 }, { x: cx, y: cy }, { x: dx, y: dy }, t);
        var look = quadPt({ x: 0, y: 0 }, { x: cx, y: cy }, { x: dx, y: dy }, Math.min(1, t + 0.05));
        var ang = Math.atan2(look.y - p.y, look.x - p.x) * 180 / Math.PI;
        var trailLen = 20 + Math.sin(t * Math.PI) * Math.min(90, len * 0.24);
        sFrames.push({
          transform: "translate(" + p.x.toFixed(1) + "px," + p.y.toFixed(1) + "px) rotate(" + ang.toFixed(1) + "deg) scaleX(" + (trailLen / 40).toFixed(3) + ")",
          opacity: String((0.12 + Math.sin(t * Math.PI) * 0.58).toFixed(3)),
          offset: t
        });
      }
      streak.animate(sFrames, { duration: ms, easing: "cubic-bezier(.18,.78,.12,1)", fill: "forwards" });
      setTimeout(function () { streak.remove(); }, ms + 50);
    }
    setTimeout(function () { wrap.remove(); }, ms + 50);
  }

  function centerTarget() {
    var el = $("center-stack");
    var r = rectOf(el);
    return { left: r.left + r.width / 2 - 26, top: r.top + 8, width: 52, height: 74 };
  }

  function seatTarget(rel) {
    var av = seatEl(rel) && seatEl(rel).querySelector(".avatar");
    return rectOf(av || seatEl(rel));
  }

  async function playShuffle() {
    var pile = $("deck-pile");
    pile.classList.add("show", "shuffling");
    Sfx.shuffle();
    await sleep(800);
    pile.classList.remove("shuffling");
  }

  function handLanding() {
    var hw = $("hand-wrap") || handEl;
    var r = rectOf(hw);
    var row = handEl.querySelector(".hand-row:last-child") || hw;
    var last = row.querySelector(".hand-card:last-child");
    if (last) {
      var lr = rectOf(last);
      return { left: lr.left + Math.min(18, lr.width * 0.35), top: lr.top, width: lr.width || 54, height: lr.height || 76 };
    }
    return {
      left: r.left + r.width / 2 - 22,
      top: r.top + 10,
      width: 54,
      height: 76
    };
  }

  async function playDeal(hand) {
    animLock = true;
    setActionsLocked(true);
    $("deck-pile").classList.add("show");
    await playShuffle();
    var pileFrom = rectOf($("deck-pile"));
    var sorted = GDCombo.sortCards(hand.slice(), state.level);
    handEl.innerHTML = "";
    var lead = state.firstLeadSeat || 0;
    for (var i = 0; i < 108; i++) {
      var seat = (lead + i) % 4;
      var rel = relOf(seat);
      var from = pileFrom;
      var to = rel === "south" ? handLanding() : seatTarget(rel);
      var arc = dealArc(rel);
      flyFromTo(backHTML(), from, to, 380, (rel === "south" ? 8 : 18) * (Math.random() > 0.5 ? 1 : -1), {
        side: arc.side,
        bulge: Math.min(56, arc.bulge * 0.7) + (Math.random() * 12 - 6)
      });
      if (i % 3 === 0) Sfx.deal();
      await sleep(28);
    }
    await sleep(280);
    $("deck-pile").classList.remove("show");
    renderHand(sorted);
    var cards = handEl.querySelectorAll(".hand-card");
    for (var k = 0; k < cards.length; k++) cards[k].classList.add("flip-in");
    animLock = false;
    setActionsLocked(false);
  }

  function animatePlay(fx) {
    var cards = fx.cards || [];
    var rel = relOf(fx.seat);
    var dest = centerTarget();
    var old = lastPlayEl.querySelector(".play-group");
    if (old) {
      old.classList.add("old");
      setTimeout(function () { if (old.parentNode) old.remove(); }, 320);
    }
    cards.forEach(function (id, i) {
      var srcEl = handEl.querySelector('.card[data-id="' + id + '"]');
      var from = srcEl ? rectOf(srcEl) : seatTarget(rel);
      setTimeout(function () {
        flyFromTo(cardHTML(id, "play-card"), from, { left: dest.left + i * 22, top: dest.top, width: 52, height: 74 }, 440, i * 3 - 4, { bulge: 56, side: 1 });
      }, i * 30);
    });
    Sfx.slap();
    if (fx.bomb) bombFX(fx.bomb);
    else if (fx.special || isSpecialCombo(fx.combo)) specialFX(fx.combo);
    setTimeout(function () {
      renderLastPlay({ seat: fx.seat, cards: cards, combo: fx.combo });
    }, 430);
  }

  function isOrdinaryCombo(c) {
    if (!c) return true;
    if (window.GDCombo && GDCombo.isOrdinaryType) return GDCombo.isOrdinaryType(c);
    var t = c.type;
    return t === "single" || t === "pair" || t === "straight" || t === "fullhouse" || t === "plane";
  }
  function isSpecialCombo(c) {
    return !!(c && !isOrdinaryCombo(c));
  }

  var FX_CLIP = {
    special: "/fx/niulai-special.webm?v=nl44",
    bomb: "/fx/niulai-bomb.webm?v=nl44",
    king: "/fx/niulai-king.webm?v=nl44"
  };
  var fxClipCache = {};

  function preloadFxClips() {
    Object.keys(FX_CLIP).forEach(function (k) {
      var v = document.createElement("video");
      v.muted = true;
      v.defaultMuted = true;
      v.preload = "auto";
      v.playsInline = true;
      v.setAttribute("muted", "");
      v.setAttribute("playsinline", "");
      v.setAttribute("webkit-playsinline", "");
      v.src = FX_CLIP[k];
      try { v.load(); } catch (e) {}
      fxClipCache[k] = v;
    });
  }
  preloadFxClips();

  function spawnFxClip(kind) {
    var layer = $("fx-layer");
    var src = FX_CLIP[kind];
    if (!layer || !src) return null;
    var wrap = document.createElement("div");
    wrap.className = "fx-clip-wrap kind-" + kind;
    var vid = document.createElement("video");
    vid.className = "fx-clip";
    vid.muted = true;
    vid.defaultMuted = true;
    vid.autoplay = true;
    vid.playsInline = true;
    vid.setAttribute("muted", "");
    vid.setAttribute("autoplay", "");
    vid.setAttribute("playsinline", "");
    vid.setAttribute("webkit-playsinline", "");
    vid.preload = "auto";
    vid.src = src;
    vid.addEventListener("error", function () {
      if (wrap.parentNode) wrap.remove();
    });
    wrap.appendChild(vid);
    var veil = document.createElement("div");
    veil.className = "fx-clip-veil";
    wrap.appendChild(veil);
    layer.appendChild(wrap);
    var playP = vid.play();
    if (playP && playP.catch) {
      playP.catch(function () {
        if (wrap.parentNode) wrap.remove();
      });
    }
    return wrap;
  }

  function bombFX(kind) {
    var layer = $("fx-layer");
    document.body.classList.add("shake-screen", "shake-hard");
    setTimeout(function () { document.body.classList.remove("shake-screen", "shake-hard"); }, 650);
    if (kind === "joker4") {
      var fl = document.createElement("div");
      fl.className = "flash";
      layer.appendChild(fl);
      setTimeout(function () { fl.remove(); }, 400);
    }
    var clipKind = kind === "joker4" ? "king" : "bomb";
    var clip = spawnFxClip(clipKind);
    var ink = document.createElement("div");
    ink.className = "fx-ink " + (kind === "joker4" ? "king" : kind === "joker3" ? "triple" : "gold");
    layer.appendChild(ink);
    var w1 = document.createElement("div");
    w1.className = "shockwave" + (kind === "joker4" || kind === "joker3" ? " red" : "");
    layer.appendChild(w1);
    var word = document.createElement("div");
    word.className = "fx-word special" + (kind === "joker4" ? " king" : "");
    word.textContent = kind === "joker4" ? T("fx.joker4") : kind === "joker3" ? T("fx.joker3") : T("fx.bomb");
    layer.appendChild(word);
    Sfx.bomb();
    Sfx.sting(kind);
    setTimeout(function () {
      w1.remove();
      word.remove();
      ink.remove();
      if (clip && clip.parentNode) clip.remove();
    }, 1200);
  }

  function specialFX(combo) {
    var layer = $("fx-layer");
    if (!layer) return;
    document.body.classList.add("shake-hard");
    setTimeout(function () { document.body.classList.remove("shake-hard"); }, 650);
    var clip = spawnFxClip("special");
    var ink = document.createElement("div");
    ink.className = "fx-ink gold";
    layer.appendChild(ink);
    var word = document.createElement("div");
    word.className = "fx-word special";
    word.textContent = comboLabel(combo) || T("fx.special");
    layer.appendChild(word);
    Sfx.sting("special");
    setTimeout(function () {
      ink.remove();
      word.remove();
      if (clip && clip.parentNode) clip.remove();
    }, 1200);
  }

  function finishFX(fx) {
    var rel = relOf(fx.seat);
    var origin = seatTarget(rel);
    var b = document.createElement("div");
    b.className = "finish-banner";
    b.textContent = placeLabel(fx.place, fx.name) || T("place.1");
    b.style.left = origin.left + "px";
    b.style.top = origin.top + "px";
    $("fx-layer").appendChild(b);
    Sfx.win();
    setTimeout(function () { b.remove(); }, 1900);
  }

  function passFX(seat) {
    var rel = relOf(seat);
    var host = seatEl(rel);
    if (!host) return;
    var p = document.createElement("div");
    p.className = "pass-bubble";
    p.textContent = T("fx.pass");
    host.appendChild(p);
    Sfx.pass();
    setTimeout(function () { p.remove(); }, 1300);
  }

  function canClaimNow() {
    return !!(state && (state.phase === "lobby" || state.phase === "settle" || state.phase === "matchover"));
  }

  function tryClaim(seatIdx) {
    if (!state) return;
    if (!canClaimNow()) { toast(T("err.swap_unsafe")); return; }
    if (seatIdx === state.selfSeat) return;
    var s = state.seats[seatIdx];
    if (s && s.occupied && !s.isBot) {
      toast(T("toast.swap_sent", { name: s.name || T("turn.opponent") }));
      socket.emit("requestSwap", { seat: seatIdx });
      return;
    }
    socket.emit("claimSeat", { seat: seatIdx });
  }

  function bindSeatClick(el, rel, seatIdx) {
    var claim = canClaimNow() && rel !== "south";
    el.classList.toggle("claimable", !!claim);
    el.onclick = claim ? function () { tryClaim(seatIdx); } : null;
  }

  var COW_FACE = [
    "/art/niulai.png?v=nl31",
    "/art/diamonds.png?v=nl31",
    "/art/clubs.png?v=nl31",
    "/art/dad.png?v=nl31"
  ];

  function cowIndex(seatIdx) {
    return ((seatIdx % 4) + 4) % 4;
  }

  function cowAvatar(seatIdx, extraClass, inner) {
    var i = cowIndex(seatIdx);
    return '<div class="avatar cow cow-' + i + (extraClass || "") + '">' +
      '<img class="cow-face" src="' + COW_FACE[i] + '" alt="" draggable="false" />' +
      (inner || "") +
      "</div>";
  }

  function seatSnap(rel, seatIdx, s) {
    var occ = !!(s && s.occupied);
    return {
      occupied: occ,
      seatIdx: seatIdx,
      cow: cowIndex(seatIdx),
      name: occ ? (s.name || "") : "",
      cardCount: occ ? (s.cardCount || 0) : 0,
      auto: !!(occ && s.auto),
      isBot: !!(occ && s.isBot),
      online: !!(occ && s.online),
      ready: !!(occ && s.ready),
      finishedRank: occ ? (s.finishedRank || 0) : 0,
      speaking: !!(occ && s.speaking),
      currentSeat: !!(state && state.phase === "playing" && state.currentSeat === seatIdx),
      partner: !!(occ && state && ((seatIdx % 2) === (state.selfSeat % 2)) && seatIdx !== state.selfSeat),
      phase: state ? state.phase : "",
      claim: canClaimNow() && rel !== "south",
      lang: (window.I18N && I18N.lang) || ""
    };
  }

  function snapEq(a, b) {
    if (!a || !b) return false;
    return a.occupied === b.occupied && a.seatIdx === b.seatIdx && a.cow === b.cow &&
      a.name === b.name && a.cardCount === b.cardCount && a.auto === b.auto &&
      a.isBot === b.isBot && a.online === b.online && a.ready === b.ready &&
      a.finishedRank === b.finishedRank && a.speaking === b.speaking &&
      a.currentSeat === b.currentSeat && a.partner === b.partner &&
      a.phase === b.phase && a.claim === b.claim && a.lang === b.lang;
  }

  function syncCowImg(av, seatIdx) {
    var url = COW_FACE[cowIndex(seatIdx)];
    var img = av.querySelector("img.cow-face");
    if (!img) {
      img = document.createElement("img");
      img.className = "cow-face";
      img.alt = "";
      img.draggable = false;
      img.src = url;
      av.insertBefore(img, av.firstChild);
      return img;
    }
    if (img.getAttribute("src") !== url) img.src = url;
    return img;
  }

  function setAvatarMods(av, snap) {
    av.classList.toggle("empty", !snap.occupied);
    av.classList.toggle("bot", !!(snap.occupied && snap.isBot));
    av.classList.toggle("speaking", !!(snap.occupied && snap.speaking));
    var i = snap.cow;
    av.classList.toggle("cow-0", i === 0);
    av.classList.toggle("cow-1", i === 1);
    av.classList.toggle("cow-2", i === 2);
    av.classList.toggle("cow-3", i === 3);
    if (!av.classList.contains("cow")) av.classList.add("cow");
    if (!av.classList.contains("avatar")) av.classList.add("avatar");
  }

  function setCountBadge(av, snap, rel) {
    var show = snap.occupied && rel !== "south" && state && state.phase !== "lobby";
    var cnt = av.querySelector(".cnt");
    if (!show) {
      if (cnt) cnt.remove();
      return;
    }
    if (!cnt) {
      cnt = document.createElement("span");
      cnt.className = "cnt";
      av.appendChild(cnt);
    }
    var n = String(snap.cardCount);
    if (cnt.textContent !== n) cnt.textContent = n;
  }

  function setBackStack(el, rel, snap) {
    var face = el.querySelector(".seat-face");
    var n = (rel !== "south" && snap.occupied && snap.cardCount > 0 && state && state.phase !== "lobby")
      ? Math.min(snap.cardCount, 4) : 0;
    var stack = el.querySelector(".back-stack");
    if (n === 0) {
      if (stack) stack.remove();
      return;
    }
    if (!face) return;
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "back-stack";
      face.appendChild(stack);
    }
    while (stack.children.length > n) stack.removeChild(stack.lastChild);
    var i;
    for (i = 0; i < n; i++) {
      var m = stack.children[i];
      if (!m) {
        m = document.createElement("div");
        m.className = "mini-back";
        stack.appendChild(m);
      }
      m.style.left = (i * 3) + "px";
      m.style.top = (i * -2) + "px";
    }
  }

  function seatSubText(snap) {
    if (!snap.occupied) return T("seat.claim");
    var sub = snap.isBot ? T("seat.bot") : (snap.auto ? T("seat.auto") : (snap.online ? T("seat.online") : T("seat.offline")));
    if (state && state.phase === "lobby" && snap.ready) sub += " · " + T("seat.ready");
    if (snap.finishedRank) sub += " · " + placeLabel(snap.finishedRank);
    if (canClaimNow()) sub += " · " + (snap.isBot ? T("seat.claim") : T("seat.swap"));
    return sub;
  }

  function patchSeat(el, rel, seatIdx, s, snap) {
    var av = el.querySelector(".avatar");
    if (!av) return;
    setAvatarMods(av, snap);
    syncCowImg(av, seatIdx);
    setCountBadge(av, snap, rel);
    if (rel === "south" && snap.occupied) {
      var chip = el.querySelector(".you-chip");
      if (chip) {
        var dot = chip.querySelector(".dot");
        var label = (s.name || T("seat.you")) + (snap.auto ? " · " + T("seat.auto") : "");
        chip.textContent = "";
        if (!dot) {
          dot = document.createElement("span");
          dot.className = "dot";
        }
        chip.appendChild(dot);
        chip.appendChild(document.createTextNode(label));
      }
    } else {
      var nm = el.querySelector(".nm");
      var sub = el.querySelector(".sub");
      if (nm) {
        nm.textContent = snap.occupied ? (s.name || "") : T("seat.empty");
        if (snap.occupied && snap.partner) {
          var tag = document.createElement("span");
          tag.className = "partner-tag";
          tag.textContent = T("seat.partner");
          nm.appendChild(tag);
        }
      }
      if (sub) sub.textContent = seatSubText(snap);
      setBackStack(el, rel, snap);
    }
  }

  function buildSeat(el, rel, seatIdx, s, snap) {
    var html;
    if (!snap.occupied) {
      html = '<div class="seat-card">' + cowAvatar(seatIdx, " empty") +
        '<div class="seat-meta"><div class="nm">' + T("seat.empty") + '</div><div class="sub">' + T("seat.claim") + "</div></div></div>";
    } else if (rel === "south") {
      html = '<div class="seat-card">' + cowAvatar(seatIdx, snap.speaking ? " speaking" : "") +
        '<div class="you-chip"><span class="dot"></span>' +
        escapeHtml(s.name || T("seat.you")) +
        (snap.auto ? " · " + T("seat.auto") : "") +
        "</div></div>";
    } else {
      var countBadge = state && state.phase !== "lobby"
        ? '<span class="cnt">' + snap.cardCount + "</span>"
        : "";
      var stacks = "";
      var n = Math.min(snap.cardCount, 4);
      if (snap.cardCount > 0 && state && state.phase !== "lobby") {
        stacks = '<div class="back-stack">';
        var i;
        for (i = 0; i < n; i++) stacks += '<div class="mini-back" style="left:' + (i * 3) + 'px;top:' + (i * -2) + 'px"></div>';
        stacks += "</div>";
      }
      html = '<div class="seat-card">' +
        '<div class="seat-face">' +
          cowAvatar(seatIdx, (snap.isBot ? " bot" : "") + (snap.speaking ? " speaking" : ""), countBadge) +
          stacks +
        "</div>" +
        '<div class="seat-meta"><div class="nm">' + escapeHtml(s.name) +
          (snap.partner ? '<span class="partner-tag">' + T("seat.partner") + "</span>" : "") + "</div>" +
          '<div class="sub">' + seatSubText(snap) + "</div></div>" +
      "</div>";
    }
    var old = el.querySelector(".seat-card");
    var wrap = document.createElement("div");
    wrap.innerHTML = html;
    var neu = wrap.firstChild;
    if (old) el.replaceChild(neu, old);
    else el.insertBefore(neu, el.firstChild);
    el.setAttribute("data-seat", String(seatIdx));
    el.setAttribute("data-cow", String(snap.cow));
    el.setAttribute("data-occ", snap.occupied ? "1" : "0");
  }

  function renderSeat(rel, seatIdx, s) {
    var el = seatEl(rel);
    if (!el) return;
    var snap = seatSnap(rel, seatIdx, s);
    var prev = el._seatSnap;
    if (snapEq(prev, snap)) {
      bindSeatClick(el, rel, seatIdx);
      updateTimerRing(el, seatIdx);
      return;
    }
    var needRebuild = !prev || !el.querySelector(".avatar") ||
      prev.occupied !== snap.occupied || prev.seatIdx !== snap.seatIdx || prev.cow !== snap.cow;
    if (needRebuild) buildSeat(el, rel, seatIdx, s, snap);
    else patchSeat(el, rel, seatIdx, s, snap);
    el._seatSnap = snap;
    el.classList.toggle("turn", !!snap.currentSeat);
    bindSeatClick(el, rel, seatIdx);
    updateTimerRing(el, seatIdx);
  }

  function updateTimerRing(el, seatIdx) {
    var av = el.querySelector(".avatar");
    if (!av) return;
    if (state.phase === "playing" && state.currentSeat === seatIdx && state.turnDeadline) {
      var left = Math.max(0, state.turnDeadline - Date.now());
      var span = (state.turnMs || 90000);
      av.style.setProperty("--t", String(left / span));
    } else {
      av.style.setProperty("--t", "0");
    }
  }

  function tickTimers() {
    if (!state || state.phase !== "playing") return;
    ["north", "south", "east", "west"].forEach(function (rel) {
      var el = seatEl(rel);
      var idx = relSeatIndex(rel);
      if (idx >= 0) updateTimerRing(el, idx);
    });
    updateTurnBanner();
  }

  function relSeatIndex(rel) {
    if (!state) return -1;
    var map = { south: 0, east: 1, north: 2, west: 3 };
    return (state.selfSeat + map[rel]) % 4;
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function handCardId(node) {
    if (!node) return null;
    var wrap = node.closest ? node.closest(".hand-card") : null;
    if (!wrap) return null;
    return wrap.getAttribute("data-id") || (wrap.querySelector(".card") && wrap.querySelector(".card").getAttribute("data-id"));
  }

  function applyHandSelection() {
    if (!handEl) return;
    handEl.querySelectorAll(".hand-card").forEach(function (n, i) {
      var cid = handCardId(n);
      n.classList.toggle("selected", !!selected[cid]);
      n.classList.remove("hinted");
      n.style.zIndex = selected[cid] ? "20" : String(i + 1);
    });
  }

  function makeHandCard(id, z) {
    var wrap = document.createElement("div");
    wrap.className = "hand-card" + (selected[id] ? " selected" : "");
    wrap.setAttribute("data-id", id);
    wrap.style.zIndex = selected[id] ? "20" : String((z || 0) + 1);
    wrap.innerHTML = cardHTML(id);
    return wrap;
  }
  function fanRow(row) {
    if (!row) return;
    var cards = row.children;
    var n = cards.length;
    var spread = Math.min(28, 2.4 * n);
    var i, t, deg, y;
    for (i = 0; i < n; i++) {
      t = n <= 1 ? 0 : (i / (n - 1) - 0.5);
      deg = t * spread;
      y = Math.abs(t) * 12;
      cards[i].style.setProperty("--fan", deg.toFixed(2) + "deg");
      cards[i].style.setProperty("--fan-y", y.toFixed(1) + "px");
    }
  }
  function renderHand(ids) {
    var list = ids || [];
    var existing = Object.create(null);
    var cur = [];
    handEl.querySelectorAll(".hand-card").forEach(function (n) {
      var id = n.getAttribute("data-id");
      if (!id) return;
      existing[id] = n;
      cur.push(id);
    });
    if (idsEqual(cur, list) && handEl.querySelector(".hand-row")) {
      applyHandSelection();
      return;
    }
    var mid = Math.ceil(list.length / 2) || 1;
    var keep = Object.create(null);
    list.forEach(function (id) { keep[id] = true; });
    Object.keys(existing).forEach(function (id) {
      if (!keep[id]) {
        existing[id].remove();
        delete existing[id];
      }
    });
    var r1 = handEl.querySelector(".hand-row");
    var rows = handEl.querySelectorAll(".hand-row");
    var r2 = rows[1] || null;
    if (!r1) {
      r1 = document.createElement("div");
      r1.className = "hand-row";
      handEl.appendChild(r1);
    }
    if (list.length > mid && !r2) {
      r2 = document.createElement("div");
      r2.className = "hand-row";
      handEl.appendChild(r2);
    }
    list.forEach(function (id, i) {
      var node = existing[id];
      if (!node) {
        node = makeHandCard(id, i);
        existing[id] = node;
      } else {
        node.classList.toggle("selected", !!selected[id]);
        node.classList.remove("hinted");
        node.style.zIndex = selected[id] ? "20" : String(i + 1);
      }
      (i < mid ? r1 : r2).appendChild(node);
    });
    if (list.length <= mid && r2) r2.remove();
    rows = handEl.querySelectorAll(".hand-row");
    var extraFrom = list.length > mid ? 2 : 1;
    var ri;
    for (ri = extraFrom; ri < rows.length; ri++) rows[ri].remove();
    fanRow(r1);
    if (list.length > mid) {
      r2 = handEl.querySelectorAll(".hand-row")[1];
      if (r2) fanRow(r2);
    }
  }

  function renderLastPlay(lp) {
    var cards = (lp && lp.cards) || [];
    comboNameEl.textContent = cards.length ? comboLabel(lp.combo) : "";
    if (!cards.length) {
      lastPlayEl.innerHTML = "";
      lastPlaySig = "";
      return;
    }
    var g = lastPlayEl.querySelector(".play-group:not(.old)");
    var cur = [];
    if (g) {
      Array.prototype.forEach.call(g.children, function (n) {
        cur.push(n.getAttribute("data-id") || "");
      });
    }
    if (g && idsEqual(cur, cards)) {
      lastPlaySig = cards.join(",");
      return;
    }
    if (!g) {
      g = document.createElement("div");
      g.className = "play-group";
      lastPlayEl.appendChild(g);
    }
    var existing = Object.create(null);
    Array.prototype.slice.call(g.children).forEach(function (n) {
      var id = n.getAttribute("data-id");
      if (id) existing[id] = n;
    });
    var keep = Object.create(null);
    cards.forEach(function (id) { keep[id] = true; });
    Object.keys(existing).forEach(function (id) {
      if (!keep[id]) {
        existing[id].remove();
        delete existing[id];
      }
    });
    cards.forEach(function (id) {
      var node = existing[id];
      if (!node) {
        node = cardNode(id, "play-card");
        existing[id] = node;
      }
      g.appendChild(node);
    });
    lastPlaySig = cards.join(",");
  }

  function toggleSelect(id) {
    if (animLock) return;
    if (state && state.phase === "tribute" && state.tribute && state.tribute.to === state.selfSeat) {
      selected = {};
      selected[id] = true;
      renderHand(state.hand);
      return;
    }
    if (selected[id]) delete selected[id];
    else selected[id] = true;
    applyHandSelection();
  }

  function paintSelect(id, on) {
    if (animLock) return;
    if (state && state.phase === "tribute" && state.tribute && state.tribute.to === state.selfSeat) {
      toggleSelect(id);
      return;
    }
    if (on) selected[id] = true;
    else delete selected[id];
    applyHandSelection();
  }

  var swipe = {
    active: false,
    dragging: false,
    pointerId: null,
    lastId: null,
    paintOn: true,
    startX: 0,
    startY: 0,
    seen: Object.create(null)
  };

  function cardAtPoint(x, y) {
    if (!handEl) return null;
    var rows = handEl.querySelectorAll(".hand-row");
    var row = null;
    var best = 1e9;
    var i, rr, cards, cr, left, right, next, top, bot, d;
    for (i = 0; i < rows.length; i++) {
      rr = rows[i].getBoundingClientRect();
      top = rr.top - 48;
      bot = rr.bottom + 12;
      if (y < top || y > bot) continue;
      d = Math.abs(y - (rr.top + rr.bottom) / 2);
      if (d < best) { best = d; row = rows[i]; }
    }
    if (!row) return handCardId(document.elementFromPoint(x, y));
    cards = row.querySelectorAll(".hand-card");
    var hit = null;
    for (i = 0; i < cards.length; i++) {
      cr = cards[i].getBoundingClientRect();
      left = cr.left;
      if (i + 1 < cards.length) {
        next = cards[i + 1].getBoundingClientRect().left;
        right = next > left + 6 ? next : left + 10;
      } else {
        right = cr.right;
      }
      if (x >= left && x < right) hit = cards[i];
    }
    return hit ? handCardId(hit) : null;
  }

  function endSwipe(e) {
    if (!swipe.active) return;
    if (e && swipe.pointerId != null && e.pointerId !== swipe.pointerId) return;
    swipe.active = false;
    swipe.dragging = false;
    swipe.pointerId = null;
    swipe.lastId = null;
    swipe.seen = Object.create(null);
  }

  function swipePaintAt(id) {
    if (!id || id === swipe.lastId) return;
    if (swipe.seen[id]) toggleSelect(id);
    else {
      paintSelect(id, swipe.paintOn);
      swipe.seen[id] = 1;
    }
    swipe.lastId = id;
  }

  function onHandPointerDown(e) {
    if (animLock) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    var id = handCardId(e.target);
    if (!id) return;
    e.preventDefault();
    swipe.active = true;
    swipe.dragging = false;
    swipe.pointerId = e.pointerId;
    swipe.lastId = id;
    swipe.startX = e.clientX;
    swipe.startY = e.clientY;
    swipe.seen = Object.create(null);
    swipe.seen[id] = 1;
    toggleSelect(id);
    swipe.paintOn = !!selected[id];
    var wrap = $("hand-wrap") || handEl;
    if (wrap && wrap.setPointerCapture) {
      try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
    }
  }

  function onHandPointerMove(e) {
    if (!swipe.active || e.pointerId !== swipe.pointerId) return;
    e.preventDefault();
    if (!swipe.dragging) {
      var dx = e.clientX - swipe.startX;
      var dy = e.clientY - swipe.startY;
      if (dx * dx + dy * dy < 64) return;
      swipe.dragging = true;
    }
    swipePaintAt(cardAtPoint(e.clientX, e.clientY));
  }

  function bindHandSwipe() {
    var wrap = $("hand-wrap") || handEl;
    if (!wrap || wrap._nlSwipe) return;
    wrap._nlSwipe = true;
    wrap.addEventListener("pointerdown", onHandPointerDown, { passive: false });
    wrap.addEventListener("pointermove", onHandPointerMove, { passive: false });
    wrap.addEventListener("pointerup", endSwipe);
    wrap.addEventListener("pointercancel", endSwipe);
    window.addEventListener("pointerup", endSwipe);
    window.addEventListener("pointercancel", endSwipe);
  }
  bindHandSwipe();

  function selectedIds() {
    return Object.keys(selected);
  }

  function setActionsLocked(on) {
    ["btn-play", "btn-pass", "btn-hint", "btn-start", "btn-ready", "btn-return"].forEach(function (id) {
      var b = $(id);
      if (b) b.disabled = on;
    });
  }

  function meSeat() {
    return state && state.seats && state.seats[state.selfSeat] ? state.seats[state.selfSeat] : null;
  }

  function renderActions() {
    var phase = state ? state.phase : "lobby";
    var myTurn = state && state.phase === "playing" && state.currentSeat === state.selfSeat;
    var me = meSeat();
    $("btn-play").classList.toggle("hidden", phase !== "playing");
    $("btn-pass").classList.toggle("hidden", phase !== "playing");
    $("btn-hint").classList.toggle("hidden", phase !== "playing");
    $("btn-ready").classList.toggle("hidden", phase !== "lobby");
    $("btn-start").classList.toggle("hidden", phase !== "lobby" && phase !== "matchover");
    $("btn-return").classList.toggle("hidden", phase !== "tribute");
    if ($("btn-auto")) $("btn-auto").classList.toggle("hidden", phase !== "playing" && phase !== "tribute");
    if ($("btn-autotake")) $("btn-autotake").classList.toggle("hidden", !state);
    $("btn-play").disabled = animLock || !myTurn;
    $("btn-pass").disabled = animLock || !myTurn || !state.lastPlay || state.lastPlay.seat === state.selfSeat;
    $("btn-hint").disabled = animLock || !myTurn;
    $("btn-start").disabled = animLock;
    if (me) {
      $("btn-ready").textContent = me.ready ? T("act.unready") : T("act.ready");
      if ($("btn-auto")) $("btn-auto").textContent = me.auto ? T("act.unauto") : T("act.auto");
      if ($("btn-autotake")) {
        $("btn-autotake").textContent = me.autoTakeover ? T("act.autotake_on") : T("act.autotake_off");
        $("btn-autotake").classList.toggle("on", !!me.autoTakeover);
      }
    }
  }

  function remainSec(deadline) {
    if (!deadline) return 0;
    return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  }

  function updateTurnBanner() {
    var el = document.getElementById("turn-banner");
    if (!el || !state) return;
    if (state.phase !== "playing") { el.classList.add("hidden"); return; }
    var mine = state.currentSeat === state.selfSeat;
    var me = meSeat();
    var sec = remainSec(state.turnDeadline);
    var extra = T("turn.left", { s: sec });
    if (mine && me && me.autoTakeover && state.turnSoftDeadline && Date.now() < state.turnSoftDeadline) {
      extra = T("turn.soft", { s: remainSec(state.turnSoftDeadline) });
    }
    el.classList.remove("hidden");
    el.innerHTML = (mine ? T("turn.yours") : T("turn.wait", { name: state.turnName || T("turn.opponent") })) +
      '<span class="cd">' + extra + "</span>";
    el.classList.toggle("mine", !!mine);
    el.classList.toggle("warn", sec <= 10);
  }

  function showSwapModal(info) {
    var box = $("swap-modal");
    if (!box || !info || !state) return;
    if (info.to !== state.selfSeat) return;
    $("swap-text").textContent = T("swap.ask", { name: info.fromName || T("turn.opponent") });
    box.classList.remove("hidden");
  }
  function hideSwapModal() {
    var box = $("swap-modal");
    if (box) box.classList.add("hidden");
  }
  function syncSwapModal() {
    if (!state || !state.pendingSwap || state.pendingSwap.to !== state.selfSeat) hideSwapModal();
    else showSwapModal(state.pendingSwap);
  }

  function renderHUD() {
    if (!state) return;
    $("hud-code").textContent = state.code;
    $("hud-level").textContent = state.level;
    $("hud-wild").textContent = T("hud.wild", { n: state.level });
    var t0 = state.teamLevels[0], t1 = state.teamLevels[1];
    var myTeam = state.selfSeat % 2;
    $("team-lv").textContent = T("hud.team", { us: myTeam === 0 ? t0 : t1, them: myTeam === 0 ? t1 : t0 });
  }

  function render(st) {
    if (!st) return;
    state = st;
    lobby.classList.add("hidden");
    table.classList.remove("hidden");
    if (window.NiulaiRoom2D && NiulaiRoom2D.sync) NiulaiRoom2D.sync();
    renderHUD();
    ["south", "east", "north", "west"].forEach(function (rel) {
      var idx = relSeatIndex(rel);
      renderSeat(rel, idx, st.seats[idx]);
    });
    if (!animLock) {
      renderHand(st.hand);
      renderLastPlay(st.lastPlay);
    }
    renderActions();
    if (st.phase !== "dealing") {
      var pile = $("deck-pile");
      if (pile && !animLock) pile.classList.remove("show", "shuffling");
    }
    if (st.phase === "settle" || st.phase === "matchover") showSettle(st.settle);
    else hideSettle();
    syncSwapModal();
  }

  function showSettle(s) {
    if (!s) return;
    var box = $("settle");
    var rows = (s.places || []).map(function (p) {
      return '<div class="row"><span>' + placeLabel(p.place, p.title) + "</span><b>" + escapeHtml(p.name) + "</b></div>";
    }).join("");
    var extra = s.matchOver
      ? '<div class="up">' + T("settle.champion") + "</div>"
      : '<div class="up">' + T("settle.up", { kind: kindLabel(s.kind), up: s.up, next: s.nextLevel }) + "</div>";
    box.innerHTML = '<div class="panel"><h2>' + T("settle.title") + "</h2>" + rows + extra +
      '<button class="btn gold" id="btn-continue">' + T("act.continue") + "</button></div>";
    box.classList.remove("hidden");
    $("btn-continue").onclick = function () { socket.emit("continue"); hideSettle(); };
    if (s.matchOver) Sfx.win();
  }
  function hideSettle() { $("settle").classList.add("hidden"); }


  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function enterFullscreen() {
    var el = document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen;
    if (req) {
      var p = req.call(el);
      if (p && p.catch) p.catch(function () {});
    }
    document.body.classList.add("forced-fs");
    syncFsBtn();
  }
  function exitFullscreen() {
    var ex = document.exitFullscreen || document.webkitExitFullscreen;
    if (ex && isFullscreen()) {
      var p = ex.call(document);
      if (p && p.catch) p.catch(function () {});
    }
    document.body.classList.remove("forced-fs");
    try {
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    } catch (e) {}
    syncFsBtn();
  }
  function syncFsBtn() {
    var b = $("btn-fs");
    if (!b) return;
    var on = isFullscreen() || document.body.classList.contains("forced-fs");
    b.textContent = on ? "✕" : "⛶";
    b.title = on ? T("hud.fs_exit") : T("hud.fs_enter");
  }
  function checkOrient() {
    var gate = $("orient-gate");
    if (gate) gate.classList.add("hidden");
    document.body.classList.toggle("portrait", window.innerHeight > window.innerWidth);
  }
  document.addEventListener("fullscreenchange", syncFsBtn);
  document.addEventListener("webkitfullscreenchange", syncFsBtn);
  window.addEventListener("resize", checkOrient);
  window.addEventListener("orientationchange", checkOrient);
  if ($("btn-enter-fs")) $("btn-enter-fs").onclick = function () { enterFullscreen(); };
  if ($("btn-fs")) $("btn-fs").onclick = function () {
    if (isFullscreen() || document.body.classList.contains("forced-fs")) exitFullscreen();
    else enterFullscreen();
  };
  document.addEventListener("pointerdown", function once() {
    enterFullscreen();
    checkOrient();
  }, { once: true });
  checkOrient();

  /* ===== events ===== */
  $("btn-create").onclick = function () {
    ensureAudio();
    enterFullscreen();
    socket.emit("join", { name: nick(), autoTakeover: takeoverOn });
  };
  $("btn-join").onclick = function () {
    ensureAudio();
    var code = $("room-code").value.trim().toUpperCase();
    if (!code) { toast(T("toast.need_code")); return; }
    enterFullscreen();
    socket.emit("join", { name: nick(), room: code, autoTakeover: takeoverOn });
  };
  $("btn-copy").onclick = function () {
    if (!state) return;
    var url = location.origin + "?room=" + state.code;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast(T("toast.copied")); });
    } else {
      toast(url);
    }
  };
  function ensureInRoom() {
    if (!socket.connected) { toast(T("toast.offline_reconnecting")); socket.connect(); return false; }
    if (!state || !state.code) { toast(T("toast.not_in_room")); return false; }
    return true;
  }
  $("btn-ready").onclick = function () {
    if (!ensureInRoom()) return;
    toast(T("toast.ready"));
    socket.emit("ready");
  };
  $("btn-start").onclick = function () {
    ensureAudio();
    if (!ensureInRoom()) return;
    toast(T("toast.starting"));
    socket.emit("start");
  };
  $("btn-pass").onclick = function () { socket.emit("pass"); };
  $("btn-hint").onclick = function () {
    socket.emit("hint");
    if (!state) return;
    var last = state.lastPlay && state.lastPlay.seat !== state.selfSeat ? state.lastPlay.combo : null;
    var pick = last
      ? GDCombo.weakestBeating(state.hand, last, state.level)
      : { cards: GDCombo.leadPlay(state.hand, state.level) };
    selected = {};
    if (pick && pick.cards) pick.cards.forEach(function (id) { selected[id] = true; });
    renderHand(state.hand);
    handEl.querySelectorAll(".hand-card").forEach(function (n) {
      var cid = n.querySelector(".card") && n.querySelector(".card").getAttribute("data-id");
      if (selected[cid]) n.classList.add("hinted");
    });
    if (!pick || !pick.cards || !pick.cards.length) toast(T("toast.only_pass"));
  };
  $("btn-play").onclick = function () {
    var ids = selectedIds();
    if (!ids.length) { toast(T("toast.pick_cards")); return; }
    var combo = GDCombo.classify(ids, state.level);
    if (!combo) {
      $("btn-play").classList.remove("shake");
      void $("btn-play").offsetWidth;
      $("btn-play").classList.add("shake");
      toast(T("toast.illegal"));
      return;
    }
    var prev = state.lastPlay && state.lastPlay.seat !== state.selfSeat ? state.lastPlay.combo : null;
    if (prev && !GDCombo.canBeat(prev, combo)) {
      $("btn-play").classList.remove("shake");
      void $("btn-play").offsetWidth;
      $("btn-play").classList.add("shake");
      toast(T("toast.cannot_beat"));
      return;
    }
    socket.emit("play", { cards: ids });
    selected = {};
  };
  $("btn-return").onclick = function () {
    var ids = selectedIds();
    if (ids.length !== 1) { toast(T("toast.pick_return")); return; }
    socket.emit("tribute-return", { card: ids[0] });
    selected = {};
  };
  $("btn-sfx").onclick = function () {
    sfxOn = !sfxOn;
    $("btn-sfx").textContent = sfxOn ? "🔊" : "🔇";
    $("btn-sfx").classList.toggle("muted", !sfxOn);
    if (sfxOn) ensureAudio();
  };
  if ($("btn-bgm")) {
    Bgm.syncBtn();
    $("btn-bgm").onclick = function () {
      ensureAudio();
      Bgm.set(!bgmOn);
    };
  }
  if ($("btn-auto")) {
    $("btn-auto").onclick = function () {
      if (!ensureInRoom()) return;
      var me = meSeat();
      var on = !(me && me.auto);
      socket.emit("setAuto", { on: on });
      toast(on ? T("toast.auto_on") : T("toast.auto_off"));
    };
  }
  if ($("btn-autotake")) {
    $("btn-autotake").onclick = function () {
      if (!ensureInRoom()) return;
      var me = meSeat();
      var on = !(me && me.autoTakeover);
      takeoverOn = on;
      try { localStorage.setItem("nl-takeover", on ? "1" : "0"); } catch (e) {}
      socket.emit("setAutoTakeover", { on: on });
      toast(on ? T("toast.autotake_on") : T("toast.autotake_off"));
    };
  }
  if ($("btn-swap-yes")) {
    $("btn-swap-yes").onclick = function () {
      socket.emit("respondSwap", { accept: true });
      hideSwapModal();
    };
  }
  if ($("btn-swap-no")) {
    $("btn-swap-no").onclick = function () {
      socket.emit("respondSwap", { accept: false });
      hideSwapModal();
    };
  }

  $("btn-mic").onclick = async function () {
    ensureAudio();
    if (!micOn) {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        micOn = true;
        $("btn-mic").classList.add("on");
        socket.emit("voice-join");
        socket.emit("voice-mute", { muted: false });
        watchSpeaking(localStream, true);
        Object.keys(pcs).forEach(function (k) {
          localStream.getTracks().forEach(function (t) { pcs[k].addTrack(t, localStream); });
        });
      } catch (e) {
        toast(T("toast.mic_fail"));
      }
    } else {
      micOn = false;
      $("btn-mic").classList.remove("on");
      socket.emit("voice-mute", { muted: true });
      if (localStream) localStream.getTracks().forEach(function (t) { t.enabled = false; });
    }
  };

  function rejoinIfNeeded() {
    var code = (state && state.code) || qsRoom() || ($("room-code").value || "").trim().toUpperCase();
    if (code && table && !table.classList.contains("hidden")) {
      socket.emit("join", { name: nick(), room: code, autoTakeover: takeoverOn });
    }
  }
  socket.on("connect", function () { rejoinIfNeeded(); });
  socket.on("disconnect", function () { toast(T("toast.reconnecting")); });

  /* ===== socket ===== */
  socket.on("joined", function (d) {
    history.replaceState(null, "", "?room=" + d.code);
    if (takeoverOn) socket.emit("setAutoTakeover", { on: true });
  });

  socket.on("room-state", function (st) {
    state = st;
    renderHUD();
    updateTurnBanner();
    if (dealPending && st.hand && st.hand.length) {
      dealPending = false;
      playDeal(st.hand).then(function () { render(state); });
      ["south", "east", "north", "west"].forEach(function (rel) {
        var idx = relSeatIndex(rel);
        renderSeat(rel, idx, st.seats[idx]);
      });
      return;
    }
    if (animLock) {
      ["south", "east", "north", "west"].forEach(function (rel) {
        var idx = relSeatIndex(rel);
        renderSeat(rel, idx, st.seats[idx]);
      });
      return;
    }
    render(st);
  });

  socket.on("fx", function (fx) {
    if (fx.type === "deal") {
      dealPending = true;
      animLock = true;
      selected = {};
      lastPlayEl.innerHTML = "";
      comboNameEl.textContent = "";
      hideSettle();
      return;
    }
    if (fx.type === "play") {
      animLock = true;
      if (state && fx.seat === state.selfSeat) {
        fx.cards.forEach(function (id) { delete selected[id]; });
      }
      animatePlay(fx);
      setTimeout(function () {
        animLock = false;
        if (state) render(state);
      }, 480);
      return;
    }
    if (fx.type === "pass") passFX(fx.seat);
    if (fx.type === "finish") finishFX(fx);
    if (fx.type === "settle") {
      /* render will show panel */
    }
    if (fx.type === "tribute-give") {
      toast(T("toast.tribute_give", { name: (state && state.seats[fx.from] ? state.seats[fx.from].name : T("place.4")) }));
    }
    if (fx.type === "tribute-back") toast(T("toast.tribute_back"));
    if (fx.type === "seat-claim" && state && fx.to === state.selfSeat) toast(T("toast.claimed"));
  });

  socket.on("hint", function (d) {
    if (!d || !d.cards) return;
    selected = {};
    d.cards.forEach(function (id) { selected[id] = true; });
    if (state) renderHand(state.hand);
    handEl.querySelectorAll(".hand-card").forEach(function (n) {
      var cid = n.querySelector(".card") && n.querySelector(".card").getAttribute("data-id");
      if (selected[cid]) n.classList.add("hinted");
    });
  });

  socket.on("error-msg", function (e) {
    var raw = (e && e.message) || "";
    var msg = errLabel(raw || "操作无效");
    toast(msg);
    if (raw === "管不上" || raw === "牌型不合法") {
      $("btn-play").classList.remove("shake");
      void $("btn-play").offsetWidth;
      $("btn-play").classList.add("shake");
    }
  });

  socket.on("chat", function () {});

  socket.on("swap-request", function (info) {
    if (!info || !state) return;
    if (info.to === state.selfSeat) showSwapModal(info);
    else if (info.from === state.selfSeat) toast(T("toast.swap_sent", { name: info.toName || T("turn.opponent") }));
  });
  socket.on("swap-result", function (info) {
    hideSwapModal();
    if (!info) return;
    var other = "";
    if (state) {
      if (info.from === state.selfSeat) other = (state.seats[info.to] && state.seats[info.to].name) || "";
      if (info.to === state.selfSeat) other = (state.seats[info.from] && state.seats[info.from].name) || "";
    }
    if (info.from === (state && state.selfSeat) || info.to === (state && state.selfSeat)) {
      toast(info.accept ? T("toast.swap_accept", { name: other || T("turn.opponent") }) : T("toast.swap_decline", { name: other || T("turn.opponent") }));
    }
  });

  socket.on("voice-peers", function (info) {
    (info.peers || []).forEach(function (p) {
      connectPeer(p.seat, state && state.selfSeat < p.seat);
    });
  });

  socket.on("signal", async function (msg) {
    var from = msg.from;
    var data = msg.data || {};
    var pc = await ensurePC(from, false);
    if (data.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      if (data.sdp.type === "offer") {
        var ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        socket.emit("signal", { to: from, data: { sdp: pc.localDescription } });
      }
    }
    if (data.candidate) {
      try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {}
    }
  });

  socket.on("speaking", function (d) {
    if (!state || !state.seats[d.seat]) return;
    state.seats[d.seat].speaking = d.on;
    var rel = relOf(d.seat);
    var av = seatEl(rel) && seatEl(rel).querySelector(".avatar");
    if (av) av.classList.toggle("speaking", !!d.on);
  });

  async function ensurePC(seat, initiator) {
    if (pcs[seat]) return pcs[seat];
    var pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pcs[seat] = pc;
    if (localStream) localStream.getTracks().forEach(function (t) { pc.addTrack(t, localStream); });
    pc.onicecandidate = function (e) {
      if (e.candidate) socket.emit("signal", { to: seat, data: { candidate: e.candidate } });
    };
    pc.ontrack = function (e) {
      var a = document.createElement("audio");
      a.autoplay = true;
      a.playsInline = true;
      a.srcObject = e.streams[0];
      $("remote-box").appendChild(a);
      watchSpeaking(e.streams[0], false);
    };
    if (initiator) {
      var offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("signal", { to: seat, data: { sdp: pc.localDescription } });
    }
    return pc;
  }

  function connectPeer(seat, initiator) {
    ensurePC(seat, initiator);
  }

  function watchSpeaking(stream, local) {
    var ctx = ensureAudio();
    if (!ctx) return;
    try {
      var src = ctx.createMediaStreamSource(stream);
      var an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      var buf = new Uint8Array(an.frequencyBinCount);
      var last = false;
      (function loop() {
        an.getByteFrequencyData(buf);
        var sum = 0;
        for (var i = 0; i < buf.length; i++) sum += buf[i];
        var on = sum / buf.length > 18;
        if (local && on !== last) {
          last = on;
          socket.emit("speaking", { on: on });
        }
        requestAnimationFrame(loop);
      })();
    } catch (e) {}
  }

  function loop() {
    tickTimers();
    timerRaf = requestAnimationFrame(loop);
  }
  loop();

  window.addEventListener("pointerdown", function () {
    ensureAudio();
    if (bgmOn) Bgm.set(true);
  }, { once: true });
  Bgm.syncBtn();

  window.__gdRefreshLang = function () {
    if (window.I18N) I18N.apply();
    syncFsBtn();
    if (!state) return;
    renderHUD();
    updateTurnBanner();
    renderActions();
    ["south", "east", "north", "west"].forEach(function (rel) {
      var idx = relSeatIndex(rel);
      renderSeat(rel, idx, state.seats[idx]);
    });
    if (!animLock) {
      renderHand(state.hand);
      if (state.lastPlay) renderLastPlay(state.lastPlay);
    } else if (state.lastPlay) {
      comboNameEl.textContent = comboLabel(state.lastPlay.combo);
    }
    if (state.phase === "settle" || state.phase === "matchover") showSettle(state.settle);
    syncSwapModal();
  };
})();
