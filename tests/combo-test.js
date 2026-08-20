const C = require("../public/combo.js");
let fails = 0;
function assert(cond, msg) {
  if (!cond) { fails++; console.log("FAIL", msg); }
  else console.log("OK  ", msg);
}
function cls(ids, lv) { return C.classify(ids, lv || "2"); }

// deck size
assert(C.buildDeck().length === 108, "108 cards");

// singles
assert(cls(["S-3-0"]).name === "单张", "single");
assert(cls(["J-b-0"]).power > cls(["J-s-0"]).power, "big joker > small");
assert(cls(["H-5-0"], "5").power === cls(["S-5-0"], "5").power, "wild single = 级牌");

// pair / triple / fullhouse
assert(cls(["S-4-0", "H-4-0"]).name === "对子", "pair");
assert(cls(["S-4-0", "H-5-0"], "5").name === "对子", "pair with wild");
assert(cls(["S-7-0", "H-7-0", "C-7-0"]).name === "三张", "triple");
assert(cls(["S-7-0", "H-7-0", "C-7-0", "S-3-0", "D-3-1"]).name === "三带二", "fullhouse");
assert(cls(["S-7-0", "H-7-0", "C-7-0", "H-2-0", "H-2-1"], "2").name === "三带二", "fullhouse wild pair");

// straight
assert(cls(["S-3-0","S-4-0","S-5-0","S-6-0","S-7-0"]).name === "顺子", "straight");
assert(cls(["S-3-0","S-4-0","H-2-0","S-6-0","S-7-0"], "2").name === "顺子", "straight wild fill");
assert(!cls(["S-3-0","S-4-0","S-5-0","S-6-0","S-2-0"]), "straight no 2");

// connpair
assert(cls(["S-3-0","H-3-0","S-4-0","H-4-0","S-5-0","H-5-0"]).name === "连对", "connpair");

// plate
assert(cls(["S-3-0","H-3-0","C-3-0","S-4-0","H-4-0","C-4-0"]).name === "钢板", "plate");

// bomb
assert(cls(["S-8-0","H-8-0","C-8-0","D-8-0"]).name === "四个炸", "4 bomb");
assert(cls(["S-8-0","H-8-0","C-8-0","D-8-0","S-8-1"]).name === "五个炸", "5 bomb");
assert(cls(["J-s-0","J-s-1","J-b-0"]).name === "三王炸", "3 joker");
assert(cls(["J-s-0","J-s-1","J-b-0","J-b-1"]).name === "天王炸", "4 joker");
assert(C.isOrdinaryType(cls(["S-3-0"])), "single ordinary");
assert(C.isSpecialType(cls(["S-8-0","H-8-0","C-8-0","D-8-0"])), "bomb special");
assert(C.isSpecialType(cls(["S-3-0","H-3-0","C-3-0","S-4-0","H-4-0","C-4-0"])), "plate special");

// beat
const a = cls(["S-8-0","H-8-0","C-8-0","D-8-0"]);
const b = cls(["S-9-0","H-9-0","C-9-0","D-9-0"]);
assert(C.canBeat(a, b), "higher 4bomb beats");
assert(C.canBeat(cls(["S-3-0"]), a), "bomb beats single");
assert(!C.canBeat(a, cls(["S-K-0"])), "single cannot beat bomb");
assert(C.canBeat(cls(["S-3-0"]), cls(["S-4-0"])), "4>3");
assert(!C.canBeat(cls(["S-4-0"]), cls(["S-3-0"])), "3 not >4");

// follow same length straight
const s1 = cls(["S-3-0","S-4-0","S-5-0","S-6-0","S-7-0"]);
const s2 = cls(["S-4-0","S-5-0","S-6-0","S-7-0","S-8-0"]);
assert(C.canBeat(s1, s2), "higher straight");

// hint
const hand = ["S-3-0","H-3-0","C-9-0","D-9-0","S-9-1","H-9-1","J-b-0"];
const prev = cls(["S-4-0","H-4-0"]);
const w = C.weakestBeating(hand, prev, "2");
assert(w && w.combo.name === "对子", "hint pair " + (w && w.combo.name));

const lead = C.leadPlay(["S-5-0","H-7-0"], "2");
assert(lead && lead[0] === "S-5-0", "lead smallest");

if (fails) { console.log(fails + " failed"); process.exit(1); }
console.log("all passed");
