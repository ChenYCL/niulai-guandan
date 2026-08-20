#!/usr/bin/env node
"use strict";

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { randomUUID } = require("crypto");
const Combo = require("./public/combo.js");

const PORT = process.env.PORT || 8787;
const TURN_SOFT_MS = 15000;
const TURN_FORCE_MS = 30000;
const TURN_MS = TURN_FORCE_MS;
const DEAL_MS = 5200;
const BOT_MIN = 400;
const BOT_MAX = 750;
const SETTLE_AUTO_MS = 8000;

const BOT_NAMES = ["阿强", "小美", "老张", "阿福", "小周", "大头", "阿珍", "铁蛋"];
const PLACE_NAME = ["", "头游", "二游", "三游", "末游"];

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const rooms = new Map();

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  if (rooms.has(code)) return makeCode();
  return code;
}

function now() {
  return Date.now();
}

function teamOf(seat) {
  return seat % 2;
}

function emptySeat() {
  return {
    id: null,
    name: "",
    isBot: false,
    ready: false,
    online: false,
    muted: true,
    speaking: false,
    auto: false,
    autoTakeover: false,
    hand: [],
    finishedRank: 0,
    socketId: null
  };
}

function newRoom(code, hostId) {
  return {
    code,
    hostId,
    createdAt: now(),
    phase: "lobby",
    level: "2",
    teamLevels: ["2", "2"],
    bankerTeam: 0,
    match: 0,
    round: 0,
    firstMatchRound: true,
    seats: [emptySeat(), emptySeat(), emptySeat(), emptySeat()],
    currentSeat: 0,
    turnDeadline: 0,
    turnSoftDeadline: 0,
    pendingSwap: null,
    lastPlay: null,
    passCount: 0,
    lastPlaySeat: -1,
    finishes: [],
    tribute: null,
    needTribute: false,
    lastPlaces: null,
    settle: null,
    matchWinner: null,
    dealUntil: 0,
    firstLeadSeat: 0,
    chat: [],
    turnTimer: null,
    softTimer: null,
    botTimer: null,
    settleTimer: null,
    humans: new Map()
  };
}

function clearTimers(room) {
  if (room.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
  if (room.softTimer) { clearTimeout(room.softTimer); room.softTimer = null; }
  if (room.botTimer) { clearTimeout(room.botTimer); room.botTimer = null; }
  if (room.settleTimer) { clearTimeout(room.settleTimer); room.settleTimer = null; }
}

function canSwapPhase(room) {
  return room.phase === "lobby" || room.phase === "settle" || room.phase === "matchover";
}

function rebindHumanSeats(room) {
  for (const [sid, info] of room.humans) {
    const idx = room.seats.findIndex((s) => s.socketId === sid);
    if (idx >= 0) {
      info.seat = idx;
      const sock = io.sockets.sockets.get(sid);
      if (sock) sock.data.seat = idx;
    }
  }
}

function mapSeatPair(x, a, b) {
  if (x === a) return b;
  if (x === b) return a;
  return x;
}

function remapSeatPair(room, a, b) {
  room.currentSeat = mapSeatPair(room.currentSeat, a, b);
  room.firstLeadSeat = mapSeatPair(room.firstLeadSeat, a, b);
  room.lastPlaySeat = mapSeatPair(room.lastPlaySeat, a, b);
  if (room.lastPlay) room.lastPlay.seat = mapSeatPair(room.lastPlay.seat, a, b);
  if (room.finishes) room.finishes.forEach((f) => { f.seat = mapSeatPair(f.seat, a, b); });
  if (room.lastPlaces) room.lastPlaces.forEach((pl) => { pl.seat = mapSeatPair(pl.seat, a, b); });
  if (room.tribute) {
    room.tribute.from = mapSeatPair(room.tribute.from, a, b);
    room.tribute.to = mapSeatPair(room.tribute.to, a, b);
  }
  if (room.settle && room.settle.places) {
    room.settle.places.forEach((pl) => { pl.seat = mapSeatPair(pl.seat, a, b); });
  }
  if (room.pendingSwap) {
    room.pendingSwap.from = mapSeatPair(room.pendingSwap.from, a, b);
    room.pendingSwap.to = mapSeatPair(room.pendingSwap.to, a, b);
  }
}

function swapSeats(room, a, b) {
  if (a === b || a < 0 || b < 0 || a > 3 || b > 3) return false;
  const tmp = room.seats[a];
  room.seats[a] = room.seats[b];
  room.seats[b] = tmp;
  remapSeatPair(room, a, b);
  rebindHumanSeats(room);
  return true;
}

function seatOfSocket(room, socketId) {
  return room.seats.findIndex((s) => s.socketId === socketId);
}

function humanCount(room) {
  return room.seats.filter((s) => s.id && !s.isBot).length;
}

function activeSeats(room) {
  return [0, 1, 2, 3].filter((i) => !room.seats[i].finishedRank);
}

function nextActive(room, seat) {
  for (let i = 1; i <= 4; i++) {
    const s = (seat + i) % 4;
    if (!room.seats[s].finishedRank) return s;
  }
  return seat;
}

function snapshot(room, forSeat) {
  return {
    code: room.code,
    phase: room.phase,
    level: room.level,
    teamLevels: room.teamLevels.slice(),
    bankerTeam: room.bankerTeam,
    match: room.match,
    round: room.round,
    currentSeat: room.currentSeat,
    turnDeadline: room.turnDeadline,
    turnSoftDeadline: room.turnSoftDeadline,
    turnMs: TURN_FORCE_MS,
    turnSoftMs: TURN_SOFT_MS,
    pendingSwap: room.pendingSwap
      ? {
          from: room.pendingSwap.from,
          to: room.pendingSwap.to,
          fromName: room.seats[room.pendingSwap.from] ? room.seats[room.pendingSwap.from].name : "",
          toName: room.seats[room.pendingSwap.to] ? room.seats[room.pendingSwap.to].name : ""
        }
      : null,
    dealUntil: room.dealUntil,
    lastPlay: room.lastPlay
      ? { seat: room.lastPlay.seat, cards: room.lastPlay.cards, combo: room.lastPlay.combo }
      : null,
    passCount: room.passCount,
    finishes: room.finishes.map((f) => ({ seat: f.seat, place: f.place })),
    tribute: room.tribute,
    settle: room.settle,
    matchWinner: room.matchWinner,
    firstLeadSeat: room.firstLeadSeat,
    selfSeat: forSeat,
    host: room.seats.findIndex((s) => s.id === room.hostId),
    seats: room.seats.map((s, i) => ({
      occupied: !!(s.id || s.isBot),
      name: s.name,
      isBot: s.isBot,
      ready: s.ready,
      online: s.online,
      muted: s.muted,
      speaking: s.speaking,
      auto: !!s.auto,
      autoTakeover: !!s.autoTakeover,
      cardCount: s.hand.length,
      finishedRank: s.finishedRank,
      isSelf: i === forSeat,
      team: teamOf(i)
    })),
    hand: forSeat >= 0 && room.seats[forSeat] ? Combo.sortCards(room.seats[forSeat].hand.slice(), room.level) : [],
    needTribute: room.needTribute,
    turnName: room.seats[room.currentSeat] ? room.seats[room.currentSeat].name : ""
  };
}

function emitRoom(room) {
  for (const [sid, info] of room.humans) {
    const sock = io.sockets.sockets.get(sid);
    if (!sock) continue;
    sock.emit("room-state", snapshot(room, info.seat));
  }
}

function emitTo(room, event, payload) {
  for (const [sid] of room.humans) {
    const sock = io.sockets.sockets.get(sid);
    if (sock) sock.emit(event, payload);
  }
}

function errorTo(socket, msg) {
  socket.emit("error-msg", { message: msg });
}

function fillBots(room) {
  for (let i = 0; i < 4; i++) {
    const s = room.seats[i];
    if (!s.id) {
      const used = new Set(room.seats.map((x) => x.name));
      let name = BOT_NAMES[i];
      let n = 1;
      while (used.has(name)) name = BOT_NAMES[(i + n++) % BOT_NAMES.length] + n;
      room.seats[i] = {
        id: "bot-" + randomUUID().slice(0, 8),
        name,
        isBot: true,
        ready: true,
        online: true,
        muted: true,
        speaking: false,
        auto: false,
        autoTakeover: false,
        hand: [],
        finishedRank: 0,
        socketId: null
      };
    }
  }
}

function dealHands(room) {
  const deck = Combo.shuffle(Combo.buildDeck());
  for (let i = 0; i < 4; i++) {
    room.seats[i].hand = deck.slice(i * 27, (i + 1) * 27);
    room.seats[i].finishedRank = 0;
  }
}

function findSpade3(room) {
  for (let i = 0; i < 4; i++) {
    if (room.seats[i].hand.includes("S-3-0")) return i;
  }
  for (let i = 0; i < 4; i++) {
    if (room.seats[i].hand.includes("S-3-1")) return i;
  }
  return 0;
}

function isAutoSeat(player) {
  return !player || player.isBot || !player.online || player.auto;
}

function startTurnClock(room) {
  if (room.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
  if (room.softTimer) { clearTimeout(room.softTimer); room.softTimer = null; }
  if (room.botTimer) { clearTimeout(room.botTimer); room.botTimer = null; }
  if (room.phase !== "playing") return;
  const seat = room.currentSeat;
  const player = room.seats[seat];
  const auto = isAutoSeat(player);
  room.turnDeadline = now() + (auto ? 2500 : TURN_FORCE_MS);
  room.turnSoftDeadline = auto ? 0 : now() + TURN_SOFT_MS;
  if (auto) {
    const delay = BOT_MIN + Math.floor(Math.random() * (BOT_MAX - BOT_MIN));
    room.botTimer = setTimeout(() => {
      try { botAct(room, seat); } catch (e) { console.error("bot", e); timeoutAct(room, seat, { force: true }); }
    }, delay);
  } else {
    room.softTimer = setTimeout(() => {
      try { timeoutAct(room, seat, { soft: true }); } catch (e) { console.error("soft", e); }
    }, TURN_SOFT_MS);
  }
  room.turnTimer = setTimeout(() => {
    try { timeoutAct(room, seat, { force: true }); } catch (e) { console.error("timeout", e); }
  }, auto ? 2500 : TURN_FORCE_MS);
}

function timeoutAct(room, seat, opts) {
  opts = opts || {};
  if (room.phase !== "playing" || room.currentSeat !== seat) return;
  const p = room.seats[seat];
  if (opts.soft) {
    if (!p || p.isBot || p.auto || !p.online || !p.autoTakeover) return;
    botAct(room, seat);
    return;
  }
  if (p && !p.isBot) p.auto = true;
  botAct(room, seat);
}

function botAct(room, seat) {
  if (room.phase !== "playing" || room.currentSeat !== seat) return;
  const hand = room.seats[seat].hand;
  if (!hand || !hand.length) { doPass(room, seat, true); return; }
  const last = room.lastPlay && room.lastPlay.seat !== seat ? room.lastPlay.combo : null;
  let r;
  if (!last) {
    const cards = Combo.leadPlay(hand, room.level) || [Combo.lowestCard(hand, room.level)];
    r = doPlay(room, seat, cards, true);
    if (!r.ok) r = doPlay(room, seat, [Combo.lowestCard(hand, room.level)], true);
    if (!r.ok) console.error("bot lead fail", r.err);
    return;
  }
  const pick = Combo.weakestBeating(hand, last, room.level);
  if (!pick) {
    r = doPass(room, seat, true);
    if (!r.ok) console.error("bot pass fail", r.err);
  } else {
    r = doPlay(room, seat, pick.cards, true);
    if (!r.ok) doPass(room, seat, true);
  }
}

function beginDeal(room, leadSeat, afterTribute) {
  room.phase = "dealing";
  room.lastPlay = null;
  room.passCount = 0;
  room.lastPlaySeat = -1;
  room.finishes = [];
  room.settle = null;
  room.tribute = null;
  room.currentSeat = leadSeat;
  room.firstLeadSeat = leadSeat;
  room.dealUntil = now() + DEAL_MS;
  dealHands(room);
  if (afterTribute && room.needTribute && room.lastPlaces) {
    applyTributeGive(room);
  } else {
    room.needTribute = false;
  }
  emitTo(room, "fx", { type: "deal", leadSeat, level: room.level });
  emitRoom(room);
  setTimeout(() => {
    if (!rooms.has(room.code)) return;
    if (room.tribute && room.tribute.waitingReturn) {
      room.phase = "tribute";
      emitRoom(room);
      const to = room.tribute.to;
      if (room.seats[to].isBot) {
        setTimeout(() => botReturnTribute(room), 600);
      } else {
        room.turnTimer = setTimeout(() => {
          try { botReturnTribute(room); } catch (e) { console.error(e); }
        }, TURN_MS);
      }
      return;
    }
    room.phase = "playing";
    emitRoom(room);
    startTurnClock(room);
  }, DEAL_MS);
}

function applyTributeGive(room) {
  const places = room.lastPlaces;
  const first = places.find((p) => p.place === 1);
  const last = places.find((p) => p.place === 4);
  if (!first || !last) { room.needTribute = false; return; }
  const from = last.seat;
  const to = first.seat;
  const card = Combo.highestNonJoker(room.seats[from].hand, room.level);
  const idx = room.seats[from].hand.indexOf(card);
  if (idx < 0) { room.needTribute = false; return; }
  room.seats[from].hand.splice(idx, 1);
  room.seats[to].hand.push(card);
  room.tribute = { from, to, given: card, waitingReturn: true };
  emitTo(room, "fx", { type: "tribute-give", from, to, card });
}

function botReturnTribute(room) {
  if (!room.tribute || !room.tribute.waitingReturn) return;
  const to = room.tribute.to;
  const card = Combo.lowestCard(room.seats[to].hand, room.level);
  finishTribute(room, card);
}

function finishTribute(room, cardId) {
  if (!room.tribute || !room.tribute.waitingReturn) return;
  const to = room.tribute.to;
  const from = room.tribute.from;
  const idx = room.seats[to].hand.indexOf(cardId);
  if (idx < 0) return false;
  room.seats[to].hand.splice(idx, 1);
  room.seats[from].hand.push(cardId);
  room.tribute.returned = cardId;
  room.tribute.waitingReturn = false;
  room.needTribute = false;
  room.phase = "playing";
  room.currentSeat = to;
  emitTo(room, "fx", { type: "tribute-back", from: to, to: from, card: cardId });
  emitRoom(room);
  startTurnClock(room);
  return true;
}

function startRound(room) {
  room.round += 1;
  room.phase = "dealing";
  let lead;
  if (room.firstMatchRound) {
    dealHands(room);
    lead = findSpade3(room);
    room.currentSeat = lead;
    room.firstLeadSeat = lead;
    room.lastPlay = null;
    room.passCount = 0;
    room.lastPlaySeat = -1;
    room.finishes = [];
    room.settle = null;
    room.tribute = null;
    room.dealUntil = now() + DEAL_MS;
    emitTo(room, "fx", { type: "deal", leadSeat: lead, level: room.level });
    emitRoom(room);
    setTimeout(() => {
      if (!rooms.has(room.code)) return;
      room.phase = "playing";
      emitRoom(room);
      startTurnClock(room);
    }, DEAL_MS);
    return;
  }
  lead = 0;
  if (room.lastPlaces) {
    const first = room.lastPlaces.find((p) => p.place === 1);
    if (first) lead = first.seat;
  }
  beginDeal(room, lead, true);
}

function startMatchRound(room) {
  room.match += 1;
  if (room.match === 1) room.round = 0;
  room.level = room.teamLevels[room.bankerTeam];
  startRound(room);
}

function doPlay(room, seat, cardIds, auto) {
  if (!auto && room.seats[seat] && !room.seats[seat].isBot) room.seats[seat].auto = false;
  if (room.phase !== "playing") return { ok: false, err: "还没开始出牌" };
  if (now() < room.dealUntil) return { ok: false, err: "正在发牌" };
  if (room.currentSeat !== seat) return { ok: false, err: "还没轮到你" };
  if (room.seats[seat].finishedRank) return { ok: false, err: "你已经打完了" };
  if (!Array.isArray(cardIds) || !cardIds.length) return { ok: false, err: "请先选牌" };

  const uniq = Array.from(new Set(cardIds));
  const hand = room.seats[seat].hand;
  for (const id of uniq) {
    if (!hand.includes(id)) return { ok: false, err: "手里没有这些牌" };
  }

  const combo = Combo.classify(uniq, room.level);
  if (!combo) return { ok: false, err: "牌型不合法" };

  const mustFollow = room.lastPlay && room.lastPlay.seat !== seat;
  if (mustFollow && !Combo.canBeat(room.lastPlay.combo, combo)) {
    return { ok: false, err: "管不上" };
  }

  room.seats[seat].hand = hand.filter((id) => !uniq.includes(id));
  room.lastPlay = { seat, cards: uniq, combo };
  room.lastPlaySeat = seat;
  room.passCount = 0;

  const emptied = room.seats[seat].hand.length === 0;
  let place = 0;
  if (emptied) {
    place = room.finishes.length + 1;
    room.seats[seat].finishedRank = place;
    room.finishes.push({ seat, place });
    emitTo(room, "fx", { type: "finish", seat, place, name: PLACE_NAME[place] });
  }

  const fx = { type: "play", seat, cards: uniq, combo, auto: !!auto };
  if (Combo.isBombType(combo)) {
    fx.bomb = combo.type === "joker4" ? "joker4" : combo.type === "joker3" ? "joker3" : "bomb";
    fx.special = true;
  } else if (Combo.isSpecialType(combo)) {
    fx.special = true;
  }
  emitTo(room, "fx", fx);

  if (checkRoundEnd(room)) return { ok: true };

  room.currentSeat = nextActive(room, seat);
  startTurnClock(room);
  emitRoom(room);
  return { ok: true };
}

function doPass(room, seat, auto) {
  if (!auto && room.seats[seat] && !room.seats[seat].isBot) room.seats[seat].auto = false;
  if (room.phase !== "playing") return { ok: false, err: "还没开始" };
  if (room.currentSeat !== seat) return { ok: false, err: "还没轮到你" };
  if (!room.lastPlay || room.lastPlay.seat === seat) {
    return { ok: false, err: "首家出牌不能不出" };
  }
  room.passCount += 1;
  emitTo(room, "fx", { type: "pass", seat, auto: !!auto });

  const remaining = activeSeats(room);
  const others = remaining.filter((s) => s !== room.lastPlay.seat);
  if (room.passCount >= others.length) {
    const leader = room.seats[room.lastPlay.seat].finishedRank
      ? nextActive(room, room.lastPlay.seat)
      : room.lastPlay.seat;
    room.lastPlay = null;
    room.passCount = 0;
    room.currentSeat = leader;
  } else {
    room.currentSeat = nextActive(room, seat);
  }
  startTurnClock(room);
  emitRoom(room);
  return { ok: true };
}

function checkRoundEnd(room) {
  const finished = room.finishes;
  if (finished.length < 2) return false;
  const t0 = finished.filter((f) => teamOf(f.seat) === 0).length;
  const t1 = finished.filter((f) => teamOf(f.seat) === 1).length;
  const threeDone = finished.length >= 3;
  const teamDone = t0 >= 2 || t1 >= 2;
  if (!teamDone && !threeDone) return false;

  if (finished.length < 4) {
    const left = [0, 1, 2, 3].filter((i) => !room.seats[i].finishedRank);
    left.sort((a, b) => room.seats[a].hand.length - room.seats[b].hand.length);
    for (const s of left) {
      const place = room.finishes.length + 1;
      room.seats[s].finishedRank = place;
      room.finishes.push({ seat: s, place });
    }
  }

  finishRound(room);
  return true;
}

function finishRound(room) {
  clearTimers(room);
  const places = room.finishes.slice().sort((a, b) => a.place - b.place);
  const firstTeam = teamOf(places[0].seat);
  const secondTeam = teamOf(places[1].seat);
  let up = 1;
  let kind = "一四";
  if (secondTeam === firstTeam) {
    up = 3;
    kind = "双下";
  } else {
    const thirdTeam = places[2] ? teamOf(places[2].seat) : 1 - firstTeam;
    if (thirdTeam === firstTeam) {
      up = 2;
      kind = "一三";
    } else {
      up = 1;
      kind = "一四";
    }
  }

  const prevLevel = room.teamLevels[firstTeam];
  let matchOver = false;
  if (prevLevel === "A") {
    matchOver = true;
  } else {
    room.teamLevels[firstTeam] = Combo.upgradeLevel(prevLevel, up);
  }
  room.bankerTeam = firstTeam;
  room.level = room.teamLevels[firstTeam];
  room.lastPlaces = places.map((p) => ({ seat: p.seat, place: p.place }));
  room.needTribute = !room.firstMatchRound && kind !== "双下";
  room.firstMatchRound = false;

  room.settle = {
    places: places.map((p) => ({
      seat: p.seat,
      place: p.place,
      name: room.seats[p.seat].name,
      title: PLACE_NAME[p.place]
    })),
    up,
    kind,
    winnerTeam: firstTeam,
    nextLevel: room.teamLevels[firstTeam],
    teamLevels: room.teamLevels.slice(),
    matchOver
  };
  room.phase = "settle";
  if (matchOver) {
    room.matchWinner = firstTeam;
    room.phase = "matchover";
  }
  emitTo(room, "fx", { type: "settle", settle: room.settle });
  emitRoom(room);

  if (!matchOver) {
    room.settleTimer = setTimeout(() => {
      if (!rooms.has(room.code)) return;
      if (room.phase === "settle") continueNext(room);
    }, SETTLE_AUTO_MS);
  }
}

function continueNext(room) {
  if (room.phase !== "settle" && room.phase !== "matchover") return;
  if (room.matchWinner != null && room.phase === "matchover") {
    resetMatch(room);
  }
  room.settle = null;
  room.level = room.teamLevels[room.bankerTeam];
  startRound(room);
}

function resetMatch(room) {
  room.teamLevels = ["2", "2"];
  room.bankerTeam = 0;
  room.level = "2";
  room.matchWinner = null;
  room.firstMatchRound = true;
  room.lastPlaces = null;
  room.needTribute = false;
  room.round = 0;
  room.match += 1;
}

function startGame(room) {
  fillBots(room);
  room.teamLevels = ["2", "2"];
  room.bankerTeam = 0;
  room.level = "2";
  room.match = 0;
  room.round = 0;
  room.firstMatchRound = true;
  room.matchWinner = null;
  room.lastPlaces = null;
  room.needTribute = false;
  room.settle = null;
  for (const s of room.seats) s.finishedRank = 0;
  startMatchRound(room);
}

function cleanupRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  if (humanCount(room) === 0) {
    clearTimers(room);
    rooms.delete(code);
  }
}

io.on("connection", (socket) => {
  socket.on("join", (data) => {
    try {
      const name = String((data && data.name) || "玩家").slice(0, 10) || "玩家";
      let code = String((data && data.room) || "").trim().toUpperCase();
      let room;
      if (!code) {
        code = makeCode();
        room = newRoom(code, null);
        rooms.set(code, room);
      } else {
        room = rooms.get(code);
        if (!room) {
          room = newRoom(code, null);
          rooms.set(code, room);
        }
      }
      let seat = room.seats.findIndex((s) => s.socketId === socket.id);
      if (seat < 0) {
        seat = room.seats.findIndex((s) => s.id && !s.isBot && s.name === name && !s.online);
      }
      if (seat < 0) {
        seat = room.seats.findIndex((s) => !s.id);
        if (seat < 0) {
          seat = room.seats.findIndex((s) => s.isBot);
          if (seat < 0) {
            errorTo(socket, "房间已满");
            return;
          }
        }
      }
      if (!room.hostId) room.hostId = socket.id;
      const prev = room.seats[seat] || emptySeat();
      room.seats[seat] = {
        id: socket.id,
        name,
        isBot: false,
        ready: room.phase !== "lobby",
        auto: false,
        autoTakeover: !!(data && data.autoTakeover) || !!prev.autoTakeover,
        online: true,
        muted: true,
        speaking: false,
        hand: prev.hand || [],
        finishedRank: prev.finishedRank || 0,
        socketId: socket.id
      };
      room.humans.set(socket.id, { seat, name });
      socket.join(code);
      socket.data.room = code;
      socket.data.seat = seat;
      socket.emit("joined", { code, seat });
      emitRoom(room);
    } catch (e) {
      console.error(e);
      errorTo(socket, "加入失败");
    }
  });

  socket.on("ready", () => {
    try {
      const room = rooms.get(socket.data.room);
      if (!room) { errorTo(socket, "还没进房间，请刷新再进"); return; }
      const seat = seatOfSocket(room, socket.id);
      if (seat < 0) { errorTo(socket, "你不在这桌"); return; }
      room.seats[seat].ready = true;
      emitRoom(room);
    } catch (e) {
      console.error("ready", e);
    }
  });

  socket.on("start", () => {
    try {
      const room = rooms.get(socket.data.room);
      if (!room) { errorTo(socket, "还没进房间，请刷新再进"); return; }
      if (room.phase !== "lobby" && room.phase !== "matchover") {
        errorTo(socket, "已经在打了");
        return;
      }
      const seat = seatOfSocket(room, socket.id);
      if (seat < 0) { errorTo(socket, "你不在这桌"); return; }
      room.seats[seat].ready = true;
      startGame(room);
    } catch (e) {
      console.error("start", e);
      errorTo(socket, "开局失败，请再点一次开始");
    }
  });

  socket.on("play", (data) => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    const seat = seatOfSocket(room, socket.id);
    if (seat < 0) return;
    const r = doPlay(room, seat, (data && data.cards) || [], false);
    if (!r.ok) errorTo(socket, r.err);
  });

  socket.on("pass", () => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    const seat = seatOfSocket(room, socket.id);
    if (seat < 0) return;
    const r = doPass(room, seat, false);
    if (!r.ok) errorTo(socket, r.err);
  });

  socket.on("hint", () => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    const seat = seatOfSocket(room, socket.id);
    if (seat < 0) return;
    const last = room.lastPlay && room.lastPlay.seat !== seat ? room.lastPlay.combo : null;
    const pick = last
      ? Combo.weakestBeating(room.seats[seat].hand, last, room.level)
      : { cards: Combo.leadPlay(room.seats[seat].hand, room.level), combo: null };
    socket.emit("hint", { cards: pick && pick.cards ? pick.cards : [] });
  });

  socket.on("tribute-return", (data) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.phase !== "tribute" || !room.tribute) return;
    const seat = seatOfSocket(room, socket.id);
    if (seat !== room.tribute.to) return;
    const card = data && data.card;
    if (!finishTribute(room, card)) errorTo(socket, "选一张还贡的牌");
  });


  socket.on("claimSeat", (data) => {
    try {
      const room = rooms.get(socket.data.room);
      if (!room) { errorTo(socket, "还没进房间，请刷新再进"); return; }
      const from = seatOfSocket(room, socket.id);
      const to = data && Number(data.seat);
      if (from < 0) { errorTo(socket, "你不在这桌"); return; }
      if (!Number.isInteger(to) || to < 0 || to > 3) { errorTo(socket, "座位无效"); return; }
      if (from === to) return;
      if (!canSwapPhase(room)) { errorTo(socket, "现在换座不安全"); return; }
      const target = room.seats[to];
      if (!target.id || target.isBot) {
        room.pendingSwap = null;
        swapSeats(room, from, to);
        emitTo(room, "fx", { type: "seat-claim", from, to });
        emitRoom(room);
        return;
      }
      room.pendingSwap = { from, to, t: now() };
      emitTo(room, "swap-request", {
        from, to,
        fromName: room.seats[from].name,
        toName: room.seats[to].name
      });
      emitRoom(room);
    } catch (e) {
      console.error("claimSeat", e);
    }
  });

  socket.on("requestSwap", (data) => {
    try {
      const room = rooms.get(socket.data.room);
      if (!room) { errorTo(socket, "还没进房间，请刷新再进"); return; }
      const from = seatOfSocket(room, socket.id);
      const to = data && Number(data.seat);
      if (from < 0) { errorTo(socket, "你不在这桌"); return; }
      if (!Number.isInteger(to) || to < 0 || to > 3) { errorTo(socket, "座位无效"); return; }
      if (from === to) return;
      if (!canSwapPhase(room)) { errorTo(socket, "现在换座不安全"); return; }
      const target = room.seats[to];
      if (!target.id || target.isBot) {
        room.pendingSwap = null;
        swapSeats(room, from, to);
        emitTo(room, "fx", { type: "seat-claim", from, to });
        emitRoom(room);
        return;
      }
      room.pendingSwap = { from, to, t: now() };
      emitTo(room, "swap-request", {
        from, to,
        fromName: room.seats[from].name,
        toName: room.seats[to].name
      });
      emitRoom(room);
    } catch (e) {
      console.error("requestSwap", e);
    }
  });

  socket.on("respondSwap", (data) => {
    try {
      const room = rooms.get(socket.data.room);
      if (!room) return;
      const seat = seatOfSocket(room, socket.id);
      if (!room.pendingSwap) { errorTo(socket, "没有换座请求"); return; }
      if (seat !== room.pendingSwap.to) { errorTo(socket, "没有换座请求"); return; }
      const accept = !!(data && data.accept);
      const from = room.pendingSwap.from;
      const to = room.pendingSwap.to;
      room.pendingSwap = null;
      if (accept) {
        if (!canSwapPhase(room)) { errorTo(socket, "现在换座不安全"); emitRoom(room); return; }
        swapSeats(room, from, to);
      }
      emitTo(room, "swap-result", { accept, from, to });
      emitRoom(room);
    } catch (e) {
      console.error("respondSwap", e);
    }
  });

  socket.on("setAuto", (data) => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    const seat = seatOfSocket(room, socket.id);
    if (seat < 0) return;
    const p = room.seats[seat];
    p.auto = !!(data && data.on);
    if (room.phase === "playing" && room.currentSeat === seat) startTurnClock(room);
    emitRoom(room);
  });

  socket.on("setAutoTakeover", (data) => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    const seat = seatOfSocket(room, socket.id);
    if (seat < 0) return;
    room.seats[seat].autoTakeover = !!(data && data.on);
    emitRoom(room);
  });

  socket.on("continue", () => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    if (room.phase === "settle" || room.phase === "matchover") continueNext(room);
  });

  socket.on("chat", (data) => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    const seat = seatOfSocket(room, socket.id);
    if (seat < 0) return;
    const text = String((data && data.text) || "").slice(0, 80);
    if (!text) return;
    const msg = { seat, name: room.seats[seat].name, text, t: now() };
    room.chat.push(msg);
    if (room.chat.length > 50) room.chat.shift();
    emitTo(room, "chat", msg);
  });

  socket.on("voice-join", () => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    const seat = seatOfSocket(room, socket.id);
    if (seat < 0) return;
    room.seats[seat].muted = false;
    emitTo(room, "voice-peers", {
      from: seat,
      peers: room.seats
        .map((s, i) => ({ seat: i, id: s.socketId, name: s.name }))
        .filter((p) => p.id && p.id !== socket.id && !room.seats[p.seat].isBot)
    });
    emitRoom(room);
  });

  socket.on("voice-mute", (data) => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    const seat = seatOfSocket(room, socket.id);
    if (seat < 0) return;
    room.seats[seat].muted = !!(data && data.muted);
    emitRoom(room);
  });

  socket.on("speaking", (data) => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    const seat = seatOfSocket(room, socket.id);
    if (seat < 0) return;
    room.seats[seat].speaking = !!(data && data.on);
    emitTo(room, "speaking", { seat, on: room.seats[seat].speaking });
  });

  socket.on("signal", (data) => {
    const room = rooms.get(socket.data.room);
    if (!room || !data) return;
    const target = room.seats[data.to];
    if (!target || !target.socketId) return;
    const sock = io.sockets.sockets.get(target.socketId);
    const from = seatOfSocket(room, socket.id);
    if (sock) sock.emit("signal", { from, data: data.data });
  });

  socket.on("disconnect", () => {
    const code = socket.data.room;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    const seat = seatOfSocket(room, socket.id);
    room.humans.delete(socket.id);
    if (seat >= 0) {
      const s = room.seats[seat];
      s.online = false;
      s.speaking = false;
      if (room.phase === "playing" || room.phase === "tribute") s.auto = true;
      if (room.hostId === socket.id) {
        const other = room.seats.find((x) => x.socketId && x.socketId !== socket.id);
        if (other) room.hostId = other.socketId;
      }
      if (room.pendingSwap && (room.pendingSwap.from === seat || room.pendingSwap.to === seat)) {
        const ps = room.pendingSwap;
        room.pendingSwap = null;
        emitTo(room, "swap-result", { accept: false, from: ps.from, to: ps.to });
      }
    }
    if (room.phase === "playing" && seat >= 0 && room.currentSeat === seat) startTurnClock(room);
    emitRoom(room);
    setTimeout(() => cleanupRoom(code), 15000);
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.phase !== "playing") continue;
    if (room.turnDeadline && now() > room.turnDeadline + 400) {
      try { timeoutAct(room, room.currentSeat); } catch (e) { console.error("watchdog", e); }
    }
  }
}, 800);

server.listen(PORT, "0.0.0.0", () => {
  console.log("guandan listening on 0.0.0.0:" + PORT);
});
