(function () {
  "use strict";

  var socket = io({ transports: ["websocket", "polling"], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 500 });
  var state = null;
  var selected = {};
  var animLock = false;
  var dealPending = false;
  var sfxOn = true;
  var audioCtx = null;
  var localStream = null;
  var pcs = {};
  var micOn = false;
  var timerRaf = 0;
  var lastPlaySig = "";

  var $ = function (id) { return document.getElementById(id); };
  var lobby = $("lobby");
  var table = $("table");
  var handEl = $("hand");
  var lastPlayEl = $("last-play");
  var comboNameEl = $("combo-name");

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function nick() {
    var n = $("nick").value.trim() || localStorage.getItem("gd-nick") || "";
    if (!n) n = "玩家" + Math.floor(Math.random() * 90 + 10);
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
        Sfx.noise(c, 0.45, 0.28, 180);
        Sfx.tone(c, 70, 0.4, 0.2, "sawtooth");
        Sfx.tone(c, 140, 0.3, 0.1, "square");
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
    var art = (window.NiulaiTheme && NiulaiTheme.cardArt(c)) || { name: "", svg: "" };
    var suitKey = c.joker ? ("joker-" + c.joker) : ("suit-" + c.suit);
    var cls = "card " + extraClass + (red ? " red" : "") + (c.joker ? " joker" : "") + " " + suitKey;
    if (state) {
      if (GDCombo.isWild(c, state.level)) cls += " wild-badge";
      else if (c.rank === state.level) cls += " level-badge";
    }
    var rk, st;
    if (c.joker) {
      rk = c.joker === "b" ? "大" : "小";
      st = "王";
    } else {
      rk = GDCombo.RANK_LABEL[c.rank] || c.rank;
      st = GDCombo.SUIT_GLYPH[c.suit] || "";
    }
    return '<div class="' + cls + '" data-id="' + id + '"><div class="face">' +
      '<div class="rk">' + rk + (st ? '<div class="st">' + st + "</div>" : "") + "</div>" +
      '<div class="pip">' + art.svg + "</div>" +
      '<div class="rk br">' + rk + (st ? '<div class="st">' + st + "</div>" : "") + "</div>" +
      "</div></div>";
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
    setTimeout(function () {
      renderLastPlay({ seat: fx.seat, cards: cards, combo: fx.combo });
    }, 430);
  }

  function bombFX(kind) {
    var layer = $("fx-layer");
    document.body.classList.add("shake-screen");
    setTimeout(function () { document.body.classList.remove("shake-screen"); }, 450);
    if (kind === "joker4") {
      var fl = document.createElement("div");
      fl.className = "flash";
      layer.appendChild(fl);
      setTimeout(function () { fl.remove(); }, 400);
    }
    var w1 = document.createElement("div");
    w1.className = "shockwave" + (kind === "joker4" || kind === "joker3" ? " red" : "");
    layer.appendChild(w1);
    var word = document.createElement("div");
    word.className = "fx-word" + (kind === "joker4" ? " king" : "");
    word.textContent = kind === "joker4" ? "天王炸" : kind === "joker3" ? "三王炸" : "炸弹";
    layer.appendChild(word);
    Sfx.bomb();
    setTimeout(function () { w1.remove(); word.remove(); }, 1000);
  }

  function finishFX(fx) {
    var rel = relOf(fx.seat);
    var origin = seatTarget(rel);
    var b = document.createElement("div");
    b.className = "finish-banner";
    b.textContent = fx.name || "头游";
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
    p.textContent = "不出";
    host.appendChild(p);
    Sfx.pass();
    setTimeout(function () { p.remove(); }, 1300);
  }

  function renderSeat(rel, seatIdx, s) {
    var el = seatEl(rel);
    if (!el) return;
    if (!s || !s.occupied) {
      el.innerHTML = '<div class="seat-card"><div class="avatar">空</div><div class="seat-meta"><div class="nm">空位</div></div></div>';
      el.classList.remove("turn");
      return;
    }
    var init = (s.name || "?").slice(0, 1);
    var partner = state && ((seatIdx % 2) === (state.selfSeat % 2)) && seatIdx !== state.selfSeat;
    var stacks = "";
    var n = Math.min(s.cardCount, 4);
    if (rel !== "south" && s.cardCount > 0 && state.phase !== "lobby") {
      stacks = '<div class="back-stack">';
      for (var i = 0; i < n; i++) stacks += '<div class="mini-back" style="left:' + (i * 2) + 'px;top:' + (i * -1) + 'px"></div>';
      stacks += "</div>";
    }
    el.innerHTML =
      '<div class="seat-card">' +
        '<div class="seat-face">' +
          '<div class="avatar' + (s.isBot ? " bot" : "") + (s.speaking ? " speaking" : "") + '">' + init + "</div>" +
          stacks +
        "</div>" +
        '<div class="seat-meta"><div class="nm">' + escapeHtml(s.name) +
          (partner ? '<span class="partner-tag">队友</span>' : "") + "</div>" +
          '<div class="sub">' + (s.isBot ? "机器人" : (s.auto ? "托管" : (s.online ? "在线" : "离线"))) +
          (state.phase !== "lobby" ? " · " + s.cardCount + "张" : (s.ready ? " · 已准备" : "")) +
          (s.finishedRank ? " · " + ["", "头游", "二游", "三游", "末游"][s.finishedRank] : "") +
          "</div></div>" +
      "</div>";
    el.classList.toggle("turn", state.phase === "playing" && state.currentSeat === seatIdx);
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

  function makeHandCard(id, z) {
    var wrap = document.createElement("div");
    wrap.className = "hand-card" + (selected[id] ? " selected" : "");
    wrap.style.zIndex = selected[id] ? "20" : String((z || 0) + 1);
    wrap.innerHTML = cardHTML(id);
    wrap.onclick = function () { toggleSelect(id); };
    return wrap;
  }
  function renderHand(ids) {
    handEl.innerHTML = "";
    var list = ids || [];
    var mid = Math.ceil(list.length / 2) || 1;
    var r1 = document.createElement("div");
    r1.className = "hand-row";
    var r2 = document.createElement("div");
    r2.className = "hand-row";
    list.forEach(function (id, i) {
      (i < mid ? r1 : r2).appendChild(makeHandCard(id, i));
    });
    handEl.appendChild(r1);
    if (list.length > mid) handEl.appendChild(r2);
  }

  function renderLastPlay(lp) {
    lastPlayEl.innerHTML = "";
    comboNameEl.textContent = "";
    if (!lp || !lp.cards || !lp.cards.length) return;
    var g = document.createElement("div");
    g.className = "play-group";
    lp.cards.forEach(function (id) {
      var d = document.createElement("div");
      d.innerHTML = cardHTML(id, "play-card");
      g.appendChild(d.firstChild);
    });
    lastPlayEl.appendChild(g);
    comboNameEl.textContent = (lp.combo && lp.combo.name) || "";
    lastPlaySig = (lp.cards || []).join(",");
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
    var nodes = handEl.querySelectorAll(".hand-card");
    nodes.forEach(function (n) {
      var cid = n.querySelector(".card") && n.querySelector(".card").getAttribute("data-id");
      n.classList.toggle("selected", !!selected[cid]);
      n.classList.remove("hinted");
      n.style.zIndex = selected[cid] ? "20" : "";
    });
  }

  function selectedIds() {
    return Object.keys(selected);
  }

  function setActionsLocked(on) {
    ["btn-play", "btn-pass", "btn-hint", "btn-start", "btn-ready", "btn-return"].forEach(function (id) {
      var b = $(id);
      if (b) b.disabled = on;
    });
  }

  function renderActions() {
    var phase = state ? state.phase : "lobby";
    var myTurn = state && state.phase === "playing" && state.currentSeat === state.selfSeat;
    var isHost = state && state.host === state.selfSeat;
    $("btn-play").classList.toggle("hidden", phase !== "playing");
    $("btn-pass").classList.toggle("hidden", phase !== "playing");
    $("btn-hint").classList.toggle("hidden", phase !== "playing");
    $("btn-ready").classList.toggle("hidden", phase !== "lobby");
    $("btn-start").classList.toggle("hidden", phase !== "lobby" && phase !== "matchover");
    $("btn-return").classList.toggle("hidden", phase !== "tribute");
    $("btn-play").disabled = animLock || !myTurn;
    $("btn-pass").disabled = animLock || !myTurn || !state.lastPlay || state.lastPlay.seat === state.selfSeat;
    $("btn-hint").disabled = animLock || !myTurn;
    $("btn-start").disabled = animLock;
    if (state && state.seats[state.selfSeat]) {
      $("btn-ready").textContent = state.seats[state.selfSeat].ready ? "取消准备" : "准备";
    }
  }

  function updateTurnBanner() {
    var el = document.getElementById("turn-banner");
    if (!el || !state) return;
    if (state.phase !== "playing") { el.classList.add("hidden"); return; }
    var mine = state.currentSeat === state.selfSeat;
    el.classList.remove("hidden");
    el.textContent = mine ? "轮到你出牌" : ("等待 " + (state.turnName || "对手") + " 出牌");
    el.classList.toggle("mine", !!mine);
  }

  function renderHUD() {
    if (!state) return;
    $("hud-code").textContent = state.code;
    $("hud-level").textContent = state.level;
    $("hud-wild").textContent = "逢人配 红心" + state.level;
    var t0 = state.teamLevels[0], t1 = state.teamLevels[1];
    var myTeam = state.selfSeat % 2;
    $("team-lv").textContent = "我方 " + (myTeam === 0 ? t0 : t1) + " 级  ·  对方 " + (myTeam === 0 ? t1 : t0) + " 级";
  }

  function render(st) {
    if (!st) return;
    state = st;
    lobby.classList.add("hidden");
    table.classList.remove("hidden");
    renderHUD();
    ["south", "east", "north", "west"].forEach(function (rel) {
      var idx = relSeatIndex(rel);
      renderSeat(rel, idx, st.seats[idx]);
    });
    if (!animLock) {
      renderHand(st.hand);
      var sig = st.lastPlay && st.lastPlay.cards ? st.lastPlay.cards.join(",") : "";
      if (sig !== lastPlaySig) renderLastPlay(st.lastPlay);
    }
    renderActions();
    if (st.phase !== "dealing") {
      var pile = $("deck-pile");
      if (pile && !animLock) pile.classList.remove("show", "shuffling");
    }
    if (st.phase === "settle" || st.phase === "matchover") showSettle(st.settle);
    else hideSettle();
  }

  function showSettle(s) {
    if (!s) return;
    var box = $("settle");
    var rows = (s.places || []).map(function (p) {
      return '<div class="row"><span>' + p.title + "</span><b>" + escapeHtml(p.name) + "</b></div>";
    }).join("");
    var extra = s.matchOver
      ? '<div class="up">打到 A 再胜 · 本队夺冠</div>'
      : '<div class="up">' + s.kind + " · 升 " + s.up + " 级 → 下一级 " + s.nextLevel + "</div>";
    box.innerHTML = '<div class="panel"><h2>本局结算</h2>' + rows + extra +
      '<button class="btn gold" id="btn-continue">继续</button></div>';
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
    b.title = on ? "退出全屏" : "进入全屏";
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
    socket.emit("join", { name: nick() });
  };
  $("btn-join").onclick = function () {
    ensureAudio();
    var code = $("room-code").value.trim().toUpperCase();
    if (!code) { toast("输入房间码"); return; }
    enterFullscreen();
    socket.emit("join", { name: nick(), room: code });
  };
  $("btn-copy").onclick = function () {
    if (!state) return;
    var url = location.origin + "?room=" + state.code;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast("邀请链接已复制"); });
    } else {
      toast(url);
    }
  };
  function ensureInRoom() {
    if (!socket.connected) { toast("掉线了，正在重连"); socket.connect(); return false; }
    if (!state || !state.code) { toast("还没进房间"); return false; }
    return true;
  }
  $("btn-ready").onclick = function () {
    if (!ensureInRoom()) return;
    toast("已准备");
    socket.emit("ready");
  };
  $("btn-start").onclick = function () {
    ensureAudio();
    if (!ensureInRoom()) return;
    toast("正在开局，空位补机器人");
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
    if (!pick || !pick.cards || !pick.cards.length) toast("管不上，只能不出");
  };
  $("btn-play").onclick = function () {
    var ids = selectedIds();
    if (!ids.length) { toast("请先选牌"); return; }
    var combo = GDCombo.classify(ids, state.level);
    if (!combo) {
      $("btn-play").classList.remove("shake");
      void $("btn-play").offsetWidth;
      $("btn-play").classList.add("shake");
      toast("牌型不合法");
      return;
    }
    var prev = state.lastPlay && state.lastPlay.seat !== state.selfSeat ? state.lastPlay.combo : null;
    if (prev && !GDCombo.canBeat(prev, combo)) {
      $("btn-play").classList.remove("shake");
      void $("btn-play").offsetWidth;
      $("btn-play").classList.add("shake");
      toast("管不上");
      return;
    }
    socket.emit("play", { cards: ids });
    selected = {};
  };
  $("btn-return").onclick = function () {
    var ids = selectedIds();
    if (ids.length !== 1) { toast("选一张还贡"); return; }
    socket.emit("tribute-return", { card: ids[0] });
    selected = {};
  };
  $("btn-sfx").onclick = function () {
    sfxOn = !sfxOn;
    $("btn-sfx").textContent = sfxOn ? "🔊" : "🔇";
    $("btn-sfx").classList.toggle("muted", !sfxOn);
    if (sfxOn) ensureAudio();
  };

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
        toast("麦克风不可用，游戏照常");
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
      socket.emit("join", { name: nick(), room: code });
    }
  }
  socket.on("connect", function () { rejoinIfNeeded(); });
  socket.on("disconnect", function () { toast("连接断开，正在重连"); });

  /* ===== socket ===== */
  socket.on("joined", function (d) {
    history.replaceState(null, "", "?room=" + d.code);
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
      toast((state && state.seats[fx.from] ? state.seats[fx.from].name : "末游") + " 进贡");
    }
    if (fx.type === "tribute-back") toast("还贡完成");
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
    var msg = (e && e.message) || "操作无效";
    toast(msg);
    if (msg === "管不上" || msg === "牌型不合法") {
      $("btn-play").classList.remove("shake");
      void $("btn-play").offsetWidth;
      $("btn-play").classList.add("shake");
    }
  });

  socket.on("chat", function () {});

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

  window.addEventListener("pointerdown", function () { ensureAudio(); }, { once: true });
})();
