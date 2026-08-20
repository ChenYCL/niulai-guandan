
const { spawn } = require("child_process");
const { io } = require("/workspace/guandan/node_modules/socket.io-client");
const p = spawn("node", ["/workspace/guandan/server.js"], { stdio: ["ignore", "pipe", "pipe"] });
setTimeout(() => {
  const s = io("http://127.0.0.1:8787", { transports: ["websocket"] });
  let gotDeal = false;
  let hand = 0;
  s.on("joined", d => { console.log("joined", d.code, d.seat); s.emit("start"); });
  s.on("fx", fx => { if (fx.type === "deal") { gotDeal = true; console.log("deal fx"); } });
  s.on("room-state", st => {
    hand = (st.hand || []).length;
    console.log("state", st.phase, "hand", hand, "seats", st.seats.map(x => x.name+ (x.isBot?"*":"")).join(","));
    if (st.phase === "playing" && hand === 27) {
      console.log("SMOKE_OK", st.code);
      s.close();
      p.kill("SIGTERM");
      setTimeout(() => process.exit(0), 200);
    }
  });
  s.on("error-msg", e => console.log("err", e));
  s.emit("join", { name: "测试员" });
  setTimeout(() => { console.log("timeout fail", gotDeal, hand); s.close(); p.kill(); process.exit(1); }, 8000);
}, 500);
