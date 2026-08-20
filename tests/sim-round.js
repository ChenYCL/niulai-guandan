const Combo = require("../public/combo.js");
function playOnce() {
  const deck = Combo.shuffle(Combo.buildDeck());
  const hands = [0,1,2,3].map(i => deck.slice(i*27, (i+1)*27));
  let current = 0;
  for (let i = 0; i < 4; i++) if (hands[i].includes("S-3-0")) current = i;
  let last = null, lastSeat = -1, pass = 0;
  const finished = [];
  const level = "2";
  let turns = 0;
  while (finished.filter(Boolean).length < 2 && turns < 2500) {
    turns++;
    if (finished[current]) { current = (current+1)%4; continue; }
    const prev = last && lastSeat !== current ? last : null;
    let cards = null;
    if (!prev) cards = Combo.leadPlay(hands[current], level);
    else {
      const p = Combo.weakestBeating(hands[current], prev, level);
      cards = p ? p.cards : null;
    }
    if (!cards || !cards.length) {
      if (!prev) throw new Error("lead empty " + current + " " + hands[current]);
      pass++;
      const remain = [0,1,2,3].filter(s => !finished[s] && s !== lastSeat);
      if (pass >= remain.length) {
        last = null; pass = 0;
        current = finished[lastSeat] ? (function(){ for(let k=1;k<=4;k++){ const s=(lastSeat+k)%4; if(!finished[s]) return s;} return current;})() : lastSeat;
      } else current = (function(){ for(let k=1;k<=4;k++){ const s=(current+k)%4; if(!finished[s]) return s;} return current;})();
      continue;
    }
    const combo = Combo.classify(cards, level);
    if (!combo) throw new Error("bad combo " + cards);
    if (prev && !Combo.canBeat(prev, combo)) throw new Error("cannot beat");
    for (const id of cards) {
      const ix = hands[current].indexOf(id);
      if (ix < 0) throw new Error("missing " + id);
      hands[current].splice(ix, 1);
    }
    last = combo; lastSeat = current; pass = 0;
    if (hands[current].length === 0) finished[current] = finished.filter(Boolean).length + 1;
    current = (function(){ for(let k=1;k<=4;k++){ const s=(current+k)%4; if(!finished[s]) return s;} return current;})();
  }
  if (turns >= 2500) throw new Error("stuck");
  return { turns, finished: finished.slice(), remain: hands.map(h => h.length) };
}
for (let i = 0; i < 8; i++) {
  const r = playOnce();
  console.log("round", i, "turns", r.turns, "fin", r.finished, "left", r.remain);
}
const plane = Combo.classify(["S-3-0","H-3-0","C-3-0","S-4-0","H-4-0","C-4-0","S-5-0","H-5-0","S-6-0","H-6-0"], "2");
console.log("plane", plane && plane.name);
if (!plane) throw new Error("plane fail");
console.log("sim ok");
