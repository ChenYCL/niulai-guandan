/* Shared Guandan combo engine — used by server and client */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GDCombo = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SUITS = ["S", "H", "C", "D"];
  var RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
  var SEQ_RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  var LADDER = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  var RANK_IDX = {};
  RANKS.forEach(function (r, i) { RANK_IDX[r] = i; });
  var SEQ_IDX = {};
  SEQ_RANKS.forEach(function (r, i) { SEQ_IDX[r] = i; });

  var SUIT_GLYPH = { S: "♠", H: "♥", C: "♣", D: "♦", J: "★" };
  var SUIT_RED = { H: true, D: true, J: false };
  var RANK_LABEL = { "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9", "10": "10", J: "J", Q: "Q", K: "K", A: "A", "2": "2", s: "小王", b: "大王" };

  function parseCard(id) {
    if (!id || typeof id !== "string") return null;
    var p = id.split("-");
    if (p.length < 3) return null;
    if (p[0] === "J") return { id: id, suit: "J", rank: p[1], deck: +p[2], joker: p[1] };
    return { id: id, suit: p[0], rank: p[1], deck: +p[2], joker: null };
  }

  function isWild(card, level) {
    return card && card.suit === "H" && card.rank === level;
  }

  function isJoker(card) {
    return card && card.suit === "J";
  }

  function rankPower(rank, level) {
    if (rank === "s") return 50;
    if (rank === "b") return 51;
    if (rank === level) return 40;
    if (rank === "2") return 30;
    return RANK_IDX[rank] != null ? RANK_IDX[rank] : -1;
  }

  function singlePower(card, level) {
    if (!card) return -1;
    if (card.joker === "s") return 50;
    if (card.joker === "b") return 51;
    if (card.rank === level) return 40;
    if (card.rank === "2") return 30;
    return RANK_IDX[card.rank] != null ? RANK_IDX[card.rank] : -1;
  }

  function frequencies(cards, level) {
    var freq = {};
    var wilds = 0;
    var jokers = { s: 0, b: 0, total: 0 };
    var list = cards.slice();
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.suit === "J") {
        jokers[c.rank] = (jokers[c.rank] || 0) + 1;
        jokers.total++;
      } else if (isWild(c, level)) {
        wilds++;
      } else {
        freq[c.rank] = (freq[c.rank] || 0) + 1;
      }
    }
    return { freq: freq, wilds: wilds, jokers: jokers };
  }

  function bombName(n) {
    var map = { 4: "四个炸", 5: "五个炸", 6: "六个炸", 7: "七个炸", 8: "八个炸", 9: "九个炸", 10: "十个炸" };
    return map[n] || n + "个炸";
  }

  function mk(type, len, power, name, extra) {
    var o = { type: type, len: len, power: power, name: name };
    if (extra) {
      for (var k in extra) o[k] = extra[k];
    }
    return o;
  }

  function isBombType(c) {
    return c && (c.type === "bomb" || c.type === "joker3" || c.type === "joker4");
  }

  var ORDINARY_TYPES = { single: 1, pair: 1, straight: 1, fullhouse: 1, plane: 1 };
  function isOrdinaryType(c) {
    return !!(c && ORDINARY_TYPES[c.type]);
  }
  function isSpecialType(c) {
    return !!(c && !isOrdinaryType(c));
  }

  function tryJokerBomb(n, jokers) {
    if (jokers.total !== n) return null;
    if (n === 4) return mk("joker4", 4, 9000, "天王炸");
    if (n === 3) return mk("joker3", 3, 8000, "三王炸");
    return null;
  }

  function tryBomb(n, freq, wilds, jokers, level) {
    if (jokers.total || wilds) return null;
    if (n < 4) return null;
    var ranks = Object.keys(freq);
    if (ranks.length !== 1) return null;
    if (freq[ranks[0]] !== n) return null;
    var r = ranks[0];
    return mk("bomb", n, 2000 + n * 50 + rankPower(r, level), bombName(n), { rank: r });
  }

  function trySingle(n, cards, level) {
    if (n !== 1) return null;
    return mk("single", 1, singlePower(cards[0], level), "单张", { rank: cards[0].joker ? cards[0].joker : cards[0].rank });
  }

  function tryPair(n, freq, wilds, jokers, level) {
    if (n !== 2 || jokers.total) return null;
    var ranks = Object.keys(freq);
    if (ranks.length === 1 && freq[ranks[0]] + wilds === 2) {
      return mk("pair", 2, rankPower(ranks[0], level), "对子", { rank: ranks[0] });
    }
    if (ranks.length === 0 && wilds === 2) {
      return mk("pair", 2, rankPower(level, level), "对子", { rank: level });
    }
    return null;
  }

  function tryTriple(n, freq, wilds, jokers, level) {
    if (n !== 3 || jokers.total) return null;
    var ranks = Object.keys(freq);
    if (ranks.length === 1 && freq[ranks[0]] + wilds === 3) {
      return mk("triple", 3, rankPower(ranks[0], level), "三张", { rank: ranks[0] });
    }
    if (ranks.length === 0 && wilds === 3) {
      return mk("triple", 3, rankPower(level, level), "三张", { rank: level });
    }
    return null;
  }

  function tryFullHouse(n, freq, wilds, jokers, level) {
    if (n !== 5 || jokers.total) return null;
    var ranks = Object.keys(freq);
    if (ranks.length > 2) return null;

    function ok(tRank, pRank, needT, needP) {
      if (tRank === pRank) return null;
      var haveT = tRank === "__wild__" ? 0 : (freq[tRank] || 0);
      var haveP = pRank === "__wild__" ? 0 : (freq[pRank] || 0);
      var w = wilds;
      if (haveT > needT) return null;
      if (haveP > needP) return null;
      var use = (needT - haveT) + (needP - haveP);
      if (use !== w) return null;
      var pr = tRank === "__wild__" ? level : tRank;
      return mk("fullhouse", 5, rankPower(pr, level), "三带二", { rank: pr, pair: pRank === "__wild__" ? level : pRank });
    }

    if (ranks.length === 2) {
      var a = ranks[0], b = ranks[1];
      return ok(a, b, 3, 2) || ok(b, a, 3, 2);
    }
    if (ranks.length === 1) {
      var r = ranks[0];
      var have = freq[r];
      if (have === 3 && wilds === 2) return ok(r, "__wild__", 3, 2);
      if (have === 2 && wilds === 3) return ok("__wild__", r, 3, 2);
      if (have === 1 && wilds === 4) return null;
      if (have === 3 && wilds === 2) return ok(r, "__wild__", 3, 2);
      if (have === 4 && wilds === 1) return null;
      if (have === 2 && wilds === 3) return ok(r, "__wild__", 3, 2) || ok("__wild__", r, 3, 2);
      if (have === 1 && wilds === 4) return ok(r, "__wild__", 3, 2);
      /* 3 naturals + 2 wild already handled; 5 naturals same rank is bomb, not here */
      if (have === 3 && wilds === 2) return ok(r, "__wild__", 3, 2);
      /* 4+1: 4 of rank + 1 wild cannot be 三带二 using all */
      if (have === 5 && wilds === 0) return null;
      /* 3+0 already n!=5; try 1+2 wilds as pair of wild + wait n=5 means 3+2 only if have=3 */
      if (have + wilds === 5) {
        if (have <= 3 && wilds >= 3 - have && wilds - (3 - have) === 2) return ok(r, "__wild__", 3, 2);
        if (have <= 2 && wilds >= 2 - have && wilds - (2 - have) === 3) return ok("__wild__", r, 3, 2);
      }
    }
    if (ranks.length === 0 && wilds === 5) return null;
    return null;
  }

  function tryStraight(n, freq, wilds, jokers) {
    if (n < 5 || jokers.total) return null;
    if (freq["2"]) return null;
    var used = 0;
    var occ = [];
    for (var r in freq) {
      if (freq[r] !== 1) return null;
      if (SEQ_IDX[r] == null) return null;
      occ.push(SEQ_IDX[r]);
      used += freq[r];
    }
    if (used + wilds !== n) return null;
    occ.sort(function (a, b) { return a - b; });
    /* window of length n in 0..11 must cover all occ */
    for (var start = 0; start + n <= SEQ_RANKS.length; start++) {
      var end = start + n - 1;
      var ok = true;
      for (var i = 0; i < occ.length; i++) {
        if (occ[i] < start || occ[i] > end) { ok = false; break; }
      }
      if (!ok) continue;
      return mk("straight", n, start + n - 1, "顺子", { high: SEQ_RANKS[end] });
    }
    return null;
  }

  function tryConnPairs(n, freq, wilds, jokers) {
    if (n < 6 || n % 2 || jokers.total) return null;
    if (freq["2"]) return null;
    var k = n / 2;
    if (k < 3) return null;
    var need = {};
    var totalNat = 0;
    for (var r in freq) {
      if (freq[r] > 2) return null;
      if (SEQ_IDX[r] == null) return null;
      need[r] = freq[r];
      totalNat += freq[r];
    }
    if (totalNat + wilds !== n) return null;
    for (var start = 0; start + k <= SEQ_RANKS.length; start++) {
      var w = wilds;
      var good = true;
      for (var i = 0; i < k; i++) {
        var rr = SEQ_RANKS[start + i];
        var have = need[rr] || 0;
        if (have > 2) { good = false; break; }
        w -= 2 - have;
        if (w < 0) { good = false; break; }
      }
      if (!good) continue;
      /* leftover naturals outside window? */
      var extra = false;
      for (var r2 in need) {
        var idx = SEQ_IDX[r2];
        if (idx < start || idx >= start + k) { extra = true; break; }
      }
      if (extra) continue;
      if (w !== 0) continue;
      return mk("connpair", n, start + k - 1, "连对", { high: SEQ_RANKS[start + k - 1] });
    }
    return null;
  }

  function tryPlate(n, freq, wilds, jokers) {
    if (n < 6 || n % 3 || jokers.total) return null;
    if (freq["2"]) return null;
    var k = n / 3;
    if (k < 2) return null;
    var totalNat = 0;
    for (var r in freq) {
      if (freq[r] > 3) return null;
      if (SEQ_IDX[r] == null) return null;
      totalNat += freq[r];
    }
    if (totalNat + wilds !== n) return null;
    for (var start = 0; start + k <= SEQ_RANKS.length; start++) {
      var w = wilds;
      var good = true;
      for (var i = 0; i < k; i++) {
        var rr = SEQ_RANKS[start + i];
        var have = freq[rr] || 0;
        if (have > 3) { good = false; break; }
        w -= 3 - have;
        if (w < 0) { good = false; break; }
      }
      if (!good) continue;
      var extra = false;
      for (var r2 in freq) {
        var idx = SEQ_IDX[r2];
        if (idx < start || idx >= start + k) { extra = true; break; }
      }
      if (extra) continue;
      if (w !== 0) continue;
      return mk("plate", n, start + k - 1, "钢板", { high: SEQ_RANKS[start + k - 1] });
    }
    return null;
  }

  function tryPlane(n, freq, wilds, jokers, level) {
    if (n < 10 || n % 5 || jokers.total) return null;
    var k = n / 5;
    if (k < 2) return null;
    var ranks = Object.keys(freq);
    /* choose consecutive k triples from SEQ, remaining form k pairs (pairs may include 2 / level) */
    for (var start = 0; start + k <= SEQ_RANKS.length; start++) {
      var body = {};
      var i, rr;
      for (i = 0; i < k; i++) body[SEQ_RANKS[start + i]] = true;
      var w = wilds;
      var ok = true;
      var remain = {};
      for (rr in freq) remain[rr] = freq[rr];
      for (i = 0; i < k; i++) {
        rr = SEQ_RANKS[start + i];
        var have = remain[rr] || 0;
        if (have >= 3) {
          remain[rr] = have - 3;
        } else {
          w -= 3 - have;
          remain[rr] = 0;
          if (w < 0) { ok = false; break; }
        }
      }
      if (!ok) continue;
      /* remaining + leftover wilds must form exactly k pairs */
      var pairSlots = 0;
      var leftoverCards = w;
      for (rr in remain) {
        var c = remain[rr];
        leftoverCards += c;
        if (c > 2) { ok = false; break; }
        if (c === 1) pairSlots++; /* need 1 wild each */
        /* c===2 is a finished pair */
      }
      if (!ok) continue;
      if (leftoverCards !== 2 * k) continue;
      /* leftover wilds after filling singleton pairs must make whole pairs (0 or 2) */
      if (w < pairSlots) continue;
      if ((w - pairSlots) % 2 !== 0) continue;
      return mk("plane", n, start + k - 1, "飞机", { high: SEQ_RANKS[start + k - 1] });
    }
    return null;
  }

  function classify(ids, level) {
    if (!ids || !ids.length) return null;
    var cards = [];
    for (var i = 0; i < ids.length; i++) {
      var c = typeof ids[i] === "string" ? parseCard(ids[i]) : ids[i];
      if (!c) return null;
      cards.push(c);
    }
    var n = cards.length;
    var f = frequencies(cards, level);
    if (f.jokers.total && f.jokers.total !== n) return null;

    return (
      tryJokerBomb(n, f.jokers) ||
      tryBomb(n, f.freq, f.wilds, f.jokers, level) ||
      tryPlane(n, f.freq, f.wilds, f.jokers, level) ||
      tryPlate(n, f.freq, f.wilds, f.jokers) ||
      tryConnPairs(n, f.freq, f.wilds, f.jokers) ||
      tryStraight(n, f.freq, f.wilds, f.jokers) ||
      tryFullHouse(n, f.freq, f.wilds, f.jokers, level) ||
      tryTriple(n, f.freq, f.wilds, f.jokers, level) ||
      tryPair(n, f.freq, f.wilds, f.jokers, level) ||
      trySingle(n, cards, level)
    );
  }

  function canBeat(prev, next) {
    if (!next) return false;
    if (!prev) return true;
    if (isBombType(next)) {
      if (!isBombType(prev)) return true;
      return next.power > prev.power;
    }
    if (isBombType(prev)) return false;
    return next.type === prev.type && next.len === prev.len && next.power > prev.power;
  }

  function sortCards(ids, level) {
    var cards = ids.map(function (id) { return typeof id === "string" ? parseCard(id) : id; }).filter(Boolean);
    var suitOrder = { S: 0, H: 1, C: 2, D: 3, J: 4 };
    cards.sort(function (a, b) {
      var pa = singlePower(a, level);
      var pb = singlePower(b, level);
      if (pa !== pb) return pa - pb;
      if (a.suit !== b.suit) return (suitOrder[a.suit] || 0) - (suitOrder[b.suit] || 0);
      return (a.deck || 0) - (b.deck || 0);
    });
    return cards.map(function (c) { return c.id; });
  }

  function groupHand(hand, level) {
    var groups = {};
    var wilds = [];
    var jokers = [];
    for (var i = 0; i < hand.length; i++) {
      var c = parseCard(hand[i]);
      if (!c) continue;
      if (isJoker(c)) jokers.push(c.id);
      else if (isWild(c, level)) wilds.push(c.id);
      else {
        if (!groups[c.rank]) groups[c.rank] = [];
        groups[c.rank].push(c.id);
      }
    }
    return { groups: groups, wilds: wilds, jokers: jokers };
  }

  function take(arr, n) {
    return arr.slice(0, n);
  }

  function generateBeating(hand, prev, level) {
    var out = [];
    var g = groupHand(hand, level);
    var seen = {};

    function push(ids) {
      var key = ids.slice().sort().join(",");
      if (seen[key]) return;
      var combo = classify(ids, level);
      if (!combo) return;
      if (prev && !canBeat(prev, combo)) return;
      if (!prev && !combo) return;
      seen[key] = true;
      out.push({ cards: ids, combo: combo });
    }

    function bombs() {
      var r, ids, i;
      for (r in g.groups) {
        if (g.groups[r].length >= 4) {
          for (i = 4; i <= g.groups[r].length; i++) push(g.groups[r].slice(0, i));
        }
      }
      if (g.jokers.length >= 3) {
        push(g.jokers.slice(0, 3));
        if (g.jokers.length >= 4) push(g.jokers.slice(0, 4));
      }
    }

    if (!prev) {
      /* lead: smallest single, plus a few simple options */
      var sorted = sortCards(hand, level);
      if (sorted.length) push([sorted[0]]);
      var r;
      for (r in g.groups) {
        if (g.groups[r].length >= 2) push(g.groups[r].slice(0, 2));
        if (g.groups[r].length >= 3) push(g.groups[r].slice(0, 3));
      }
      if (g.wilds.length && Object.keys(g.groups).length) {
        var any = Object.keys(g.groups)[0];
        push([g.groups[any][0], g.wilds[0]]);
      }
      bombs();
      return out;
    }

    bombs();

    if (isBombType(prev)) return out;

    var needType = prev.type;
    var needLen = prev.len;

    if (needType === "single") {
      hand.forEach(function (id) { push([id]); });
    } else if (needType === "pair") {
      Object.keys(g.groups).forEach(function (r) {
        if (g.groups[r].length >= 2) push(g.groups[r].slice(0, 2));
        else if (g.groups[r].length === 1 && g.wilds.length) push([g.groups[r][0], g.wilds[0]]);
      });
      if (g.wilds.length >= 2) push(g.wilds.slice(0, 2));
    } else if (needType === "triple") {
      Object.keys(g.groups).forEach(function (r) {
        var arr = g.groups[r];
        if (arr.length >= 3) push(arr.slice(0, 3));
        else if (arr.length === 2 && g.wilds.length >= 1) push([arr[0], arr[1], g.wilds[0]]);
        else if (arr.length === 1 && g.wilds.length >= 2) push([arr[0], g.wilds[0], g.wilds[1]]);
      });
    } else if (needType === "fullhouse") {
      genFullHouses(g, level, push);
    } else if (needType === "straight") {
      genSequence(g, needLen, 1, push);
    } else if (needType === "connpair") {
      genSequence(g, needLen / 2, 2, push);
    } else if (needType === "plate") {
      genSequence(g, needLen / 3, 3, push);
    } else if (needType === "plane") {
      genPlanes(g, needLen / 5, push);
    }
    return out;
  }

  function genFullHouses(g, level, push) {
    var ranks = Object.keys(g.groups);
    var i, j, r, s, trip, pair, w;
    for (i = 0; i < ranks.length; i++) {
      for (j = 0; j < ranks.length; j++) {
        if (i === j) continue;
        r = ranks[i];
        s = ranks[j];
        w = g.wilds.slice();
        trip = g.groups[r].slice();
        pair = g.groups[s].slice();
        var needT = Math.max(0, 3 - trip.length);
        var needP = Math.max(0, 2 - pair.length);
        if (needT + needP > w.length) continue;
        if (trip.length > 3 || pair.length > 2) {
          trip = trip.slice(0, 3);
          pair = pair.slice(0, 2);
          needT = 0;
          needP = 0;
        }
        var usedW = w.slice(0, needT + needP);
        if (trip.length + pair.length + usedW.length !== 5) {
          trip = trip.slice(0, Math.min(3, trip.length));
          pair = pair.slice(0, Math.min(2, pair.length));
          if (trip.length + pair.length + usedW.length !== 5) continue;
        }
        push(trip.slice(0, 3 - needT).concat(pair.slice(0, 2 - needP), usedW));
      }
    }
    /* triple + wild pair */
    for (i = 0; i < ranks.length; i++) {
      r = ranks[i];
      if (g.groups[r].length >= 3 && g.wilds.length >= 2) {
        push(g.groups[r].slice(0, 3).concat(g.wilds.slice(0, 2)));
      }
      if (g.groups[r].length === 2 && g.wilds.length >= 3) {
        push(g.groups[r].slice(0, 2).concat(g.wilds.slice(0, 3)));
      }
    }
  }

  function genSequence(g, count, per, push) {
    var start, i, rr, have, need, cards, wIdx, takeN;
    for (start = 0; start + count <= SEQ_RANKS.length; start++) {
      cards = [];
      var wildPool = g.wilds.slice();
      var ok = true;
      for (i = 0; i < count; i++) {
        rr = SEQ_RANKS[start + i];
        have = (g.groups[rr] || []).slice();
        if (have.length >= per) {
          cards = cards.concat(have.slice(0, per));
        } else {
          need = per - have.length;
          if (wildPool.length < need) { ok = false; break; }
          cards = cards.concat(have, wildPool.splice(0, need));
        }
      }
      if (ok) push(cards);
    }
  }

  function genPlanes(g, k, push) {
    var start, i, rr, have, need, cards, wildPool, remRanks, j, s, pairCards, ok;
    for (start = 0; start + k <= SEQ_RANKS.length; start++) {
      cards = [];
      wildPool = g.wilds.slice();
      ok = true;
      var used = {};
      for (i = 0; i < k; i++) {
        rr = SEQ_RANKS[start + i];
        used[rr] = 3;
        have = (g.groups[rr] || []).slice();
        if (have.length >= 3) cards = cards.concat(have.slice(0, 3));
        else {
          need = 3 - have.length;
          if (wildPool.length < need) { ok = false; break; }
          cards = cards.concat(have, wildPool.splice(0, need));
        }
      }
      if (!ok) continue;
      remRanks = Object.keys(g.groups).filter(function (r) {
        var avail = g.groups[r].length - (used[r] || 0);
        return avail > 0;
      });
      /* pick k pair ranks */
      function pickPairs(idx, picked, pool) {
        if (picked.length === k) {
          push(cards.concat(picked));
          return;
        }
        if (idx >= remRanks.length) {
          /* use remaining wilds as pairs */
          var left = k - picked.length;
          if (pool.length >= left * 2) {
            push(cards.concat(picked, pool.slice(0, left * 2)));
          }
          return;
        }
        pickPairs(idx + 1, picked, pool);
        var r = remRanks[idx];
        var avail = g.groups[r].slice(used[r] || 0);
        if (avail.length >= 2) {
          pickPairs(idx + 1, picked.concat(avail.slice(0, 2)), pool);
        } else if (avail.length === 1 && pool.length >= 1) {
          pickPairs(idx + 1, picked.concat([avail[0], pool[0]]), pool.slice(1));
        }
      }
      pickPairs(0, [], wildPool);
    }
  }

  function weakestBeating(hand, prev, level) {
    var all = generateBeating(hand, prev, level);
    if (!all.length) return null;
    all.sort(function (a, b) {
      var ba = isBombType(a.combo) ? 1 : 0;
      var bb = isBombType(b.combo) ? 1 : 0;
      if (ba !== bb) return ba - bb;
      if (a.combo.power !== b.combo.power) return a.combo.power - b.combo.power;
      return a.cards.length - b.cards.length;
    });
    return all[0];
  }

  function leadPlay(hand, level) {
    var sorted = sortCards(hand, level);
    if (!sorted.length) return null;
    var g = groupHand(hand, level);
    /* prefer a small pair if we have many of a low rank, else smallest single */
    var r, bestPair = null;
    for (r of ["3", "4", "5", "6", "7"]) {
      if (g.groups[r] && g.groups[r].length >= 2) {
        bestPair = g.groups[r].slice(0, 2);
        break;
      }
    }
    if (bestPair && g.groups[parseCard(sorted[0]).rank] && g.groups[parseCard(sorted[0]).rank].length === 1) {
      return bestPair;
    }
    return [sorted[0]];
  }

  function highestNonJoker(hand, level) {
    var cards = hand.map(parseCard).filter(function (c) { return c && !isJoker(c); });
    if (!cards.length) {
      var js = hand.map(parseCard).filter(Boolean);
      js.sort(function (a, b) { return singlePower(b, level) - singlePower(a, level); });
      return js[0] ? js[0].id : hand[0];
    }
    cards.sort(function (a, b) { return singlePower(b, level) - singlePower(a, level); });
    return cards[0].id;
  }

  function lowestCard(hand, level) {
    var s = sortCards(hand, level);
    return s[0];
  }

  function buildDeck() {
    var ids = [];
    for (var d = 0; d < 2; d++) {
      for (var s = 0; s < SUITS.length; s++) {
        for (var r = 0; r < RANKS.length; r++) {
          ids.push(SUITS[s] + "-" + RANKS[r] + "-" + d);
        }
      }
      ids.push("J-s-" + d);
      ids.push("J-b-" + d);
    }
    return ids;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function upgradeLevel(cur, n) {
    var i = LADDER.indexOf(cur);
    if (i < 0) i = 0;
    return LADDER[Math.min(LADDER.length - 1, i + n)];
  }

  function cardLabel(id) {
    var c = parseCard(id);
    if (!c) return "";
    if (c.joker === "s") return "小王";
    if (c.joker === "b") return "大王";
    return (SUIT_GLYPH[c.suit] || "") + (RANK_LABEL[c.rank] || c.rank);
  }

  return {
    SUITS: SUITS,
    RANKS: RANKS,
    SEQ_RANKS: SEQ_RANKS,
    LADDER: LADDER,
    SUIT_GLYPH: SUIT_GLYPH,
    SUIT_RED: SUIT_RED,
    RANK_LABEL: RANK_LABEL,
    parseCard: parseCard,
    isWild: isWild,
    isJoker: isJoker,
    singlePower: singlePower,
    rankPower: rankPower,
    classify: classify,
    canBeat: canBeat,
    isBombType: isBombType,
    isOrdinaryType: isOrdinaryType,
    isSpecialType: isSpecialType,
    sortCards: sortCards,
    generateBeating: generateBeating,
    weakestBeating: weakestBeating,
    leadPlay: leadPlay,
    highestNonJoker: highestNonJoker,
    lowestCard: lowestCard,
    buildDeck: buildDeck,
    shuffle: shuffle,
    upgradeLevel: upgradeLevel,
    cardLabel: cardLabel,
    bombName: bombName
  };
});
