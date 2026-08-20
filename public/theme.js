/* 牛来掼蛋 visual theme */
(function (root) {
  "use strict";

  var ART_V = "nl42";
  var ART = {
    H: "/art/niulai.png?v=" + ART_V,
    D: "/art/diamonds.png?v=" + ART_V,
    C: "/art/clubs.png?v=" + ART_V,
    S: "/art/dad.png?v=" + ART_V,
    s: "/art/joker-s.png?v=" + ART_V,
    b: "/art/joker-b.png?v=" + ART_V,
    mom: "/art/mom.png?v=" + ART_V,
    niu2: "/art/niu2.png?v=" + ART_V
  };

  /* 按正片：黄身粉鼻直立小牛 / 云雀 / 豹拉 / 狼 / 小绳头=草蛇
     Faces are CSS background-image on .pip — never <img>, so remounts cannot flash. */
  var MOTIF = {
    H: { name: "", key: "H", src: ART.H },
    D: { name: "", key: "D", src: ART.D },
    C: { name: "", key: "C", src: ART.C },
    S: { name: "", key: "S", src: ART.S },
    s: { name: "", key: "s", src: ART.s },
    b: { name: "", key: "b", src: ART.b },
    mom: { name: "", key: "mom", src: ART.mom },
    niu2: { name: "", key: "niu2", src: ART.niu2 }
  };

  [ART.H, ART.D, ART.C, ART.S, ART.s, ART.b, ART.mom, ART.niu2].forEach(function (src) {
    var im = new Image();
    im.src = src;
  });

  function cardArt(c) {
    if (c.joker) return MOTIF[c.joker];
    if (c.suit === "H" && c.rank === "K") return MOTIF.mom;
    if (c.suit === "H" && (c.rank === "Q" || c.rank === "J")) return MOTIF.niu2;
    return MOTIF[c.suit] || MOTIF.H;
  }

  function faceClass(c) {
    if (!c || c.joker) return "";
    if (c.suit === "H" && c.rank === "K") return "face-mom";
    if (c.suit === "H" && (c.rank === "Q" || c.rank === "J")) return "face-niu2";
    return "";
  }

  function drawPictorialWord(ctx, text, x, y, size, theme) {
    ctx.save();
    ctx.translate(x, y);
    ctx.font = "900 " + size + "px 'Noto Serif SC','STKaiti','KaiTi',serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, size / 10);
    ctx.strokeStyle = theme.stroke;
    ctx.fillStyle = theme.fill;
    ctx.shadowColor = theme.shadow;
    ctx.shadowBlur = size / 18;
    ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function decorate(ctx, kind, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    if (kind === "cow") {
      ctx.fillStyle = "#f3d7a0";
      ctx.beginPath(); ctx.ellipse(-s * 0.38, -s * 0.42, s * 0.12, s * 0.2, -0.5, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * 0.38, -s * 0.42, s * 0.12, s * 0.2, 0.5, 0, 6.3); ctx.fill();
    } else if (kind === "bird") {
      ctx.strokeStyle = "#ffe08a";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.15); ctx.quadraticCurveTo(0, -s * 0.5, s * 0.4, -s * 0.1); ctx.stroke();
    } else if (kind === "spot") {
      ctx.fillStyle = "rgba(90,50,10,.35)";
      ctx.beginPath(); ctx.arc(-s * 0.2, s * 0.18, s * 0.06, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.18, -s * 0.12, s * 0.05, 0, 6.3); ctx.fill();
    } else if (kind === "coil") {
      ctx.strokeStyle = "#7dce7a";
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(s * 0.28, s * 0.22, s * 0.16, 0.2, 5.4); ctx.stroke();
    }
    ctx.restore();
  }

  function paintLogo(canvas, opts) {
    if (!canvas || !canvas.getContext) return;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || canvas.width;
    var h = canvas.clientHeight || canvas.height;
    if (!w || !h) { w = canvas.width; h = canvas.height; }
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    var ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    var words = [
      { t: "牛", k: "cow", fill: "#f6cc6e", stroke: "#5a1e08", shadow: "rgba(60,20,0,.35)" },
      { t: "来", k: "bird", fill: "#ffe38a", stroke: "#6a3208", shadow: "rgba(70,30,0,.3)" },
      { t: "掼", k: "spot", fill: "#efc04a", stroke: "#4a2208", shadow: "rgba(50,20,0,.32)" },
      { t: "蛋", k: "coil", fill: "#d8a828", stroke: "#3a4010", shadow: "rgba(20,30,8,.3)" }
    ];
    var size = Math.min(w / 4.6, h * 0.72);
    var gap = size * 1.12;
    var start = w / 2 - gap * 1.5;
    words.forEach(function (wrd, i) {
      var x = start + i * gap;
      var y = h / 2 + (i % 2 === 0 ? -2 : 4);
      drawPictorialWord(ctx, wrd.t, x, y, size, wrd);
      decorate(ctx, wrd.k, x, y, size);
    });
    if (opts && opts.sub) {
      ctx.font = "600 " + Math.max(11, size * 0.18) + "px 'Noto Sans SC',sans-serif";
      ctx.fillStyle = "rgba(245,230,160,.55)";
      ctx.textAlign = "center";
      ctx.fillText(opts.sub, w / 2, h - 8);
    }
  }

  function paintFeltGrain(canvas) {
    if (!canvas || !canvas.getContext) return;
    var w = 640, h = 360;
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    var i, x, y, a;
    for (i = 0; i < 2400; i++) {
      x = Math.random() * w;
      y = Math.random() * h;
      a = Math.random() * 0.09;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255," + a + ")" : "rgba(0,20,10," + (a * 1.2) + ")";
      ctx.fillRect(x, y, 1 + Math.random() * 1.4, 1);
    }
  }

  function bindLogos() {
    paintLogo(document.getElementById("felt-logo"), { sub: "" });
    paintLogo(document.getElementById("lobby-logo"), { sub: "" });
    paintFeltGrain(document.getElementById("felt-grain"));
  }

  root.NiulaiTheme = {
    MOTIF: MOTIF,
    ART: ART,
    cardArt: cardArt,
    faceClass: faceClass,
    paintLogo: paintLogo,
    bindLogos: bindLogos
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindLogos);
  } else {
    bindLogos();
  }
  window.addEventListener("resize", function () {
    clearTimeout(bindLogos._t);
    bindLogos._t = setTimeout(bindLogos, 120);
  });
})(window);
