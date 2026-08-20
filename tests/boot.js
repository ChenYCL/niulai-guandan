
const { spawn } = require("child_process");
const http = require("http");
const p = spawn("node", ["/workspace/guandan/server.js"], { stdio: ["ignore", "pipe", "pipe"] });
let out = "";
p.stdout.on("data", d => { out += d; });
p.stderr.on("data", d => { out += d; });
function get(path) {
  return new Promise((resolve, reject) => {
    http.get("http://127.0.0.1:8787" + path, res => {
      let b = "";
      res.on("data", c => b += c);
      res.on("end", () => resolve({ status: res.statusCode, body: b }));
    }).on("error", reject);
  });
}
setTimeout(async () => {
  try {
    const home = await get("/");
    const css = await get("/style.css");
    const js = await get("/app.js");
    const combo = await get("/combo.js");
    console.log("home", home.status, home.body.includes("掼蛋"));
    console.log("css", css.status, css.body.length);
    console.log("js", js.status, js.body.length);
    console.log("combo", combo.status, combo.body.includes("GDCombo"));
    console.log("listen", out.trim());
    if (home.status !== 200 || !home.body.includes("掼蛋")) process.exitCode = 1;
  } catch (e) {
    console.error("boot fail", e);
    process.exitCode = 1;
  } finally {
    p.kill("SIGTERM");
    setTimeout(() => process.exit(process.exitCode || 0), 200);
  }
}, 700);
