/* Niulai club room — Three.js r160+ scenery (no fog, no DoF haze) */
(function (root) {
  "use strict";

  var renderer, scene, camera, ready = false, running = false;
  var canvas, tableEl;
  var sconceLightL, sconceLightR, lampLight;
  var observer;

  function $(id) { return document.getElementById(id); }

  function tableShown() {
    return tableEl && !tableEl.classList.contains("hidden");
  }

  function canvasTex(w, h, paint) {
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    paint(c.getContext("2d"), w, h);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }

  function woodPanels(w, h) {
    return canvasTex(w, h, function (ctx, W, H) {
      ctx.fillStyle = "#2a1810";
      ctx.fillRect(0, 0, W, H);
      var cols = 4, rows = 2;
      var cw = W / cols, ch = H / rows;
      var i, j, x, y, px, py, g, k;
      for (j = 0; j < rows; j++) {
        for (i = 0; i < cols; i++) {
          x = i * cw;
          y = j * ch;
          g = ctx.createLinearGradient(x, y, x + cw, y + ch);
          g.addColorStop(0, "#3d2416");
          g.addColorStop(0.45, "#4a2c18");
          g.addColorStop(1, "#2c180e");
          ctx.fillStyle = g;
          ctx.fillRect(x + 6, y + 6, cw - 12, ch - 12);
          ctx.strokeStyle = "rgba(90,60,30,.55)";
          ctx.lineWidth = 4;
          ctx.strokeRect(x + 14, y + 14, cw - 28, ch - 28);
          ctx.strokeStyle = "rgba(20,10,4,.55)";
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 20, y + 20, cw - 40, ch - 40);
          ctx.globalAlpha = 0.08;
          for (k = 0; k < 18; k++) {
            px = x + 10 + Math.random() * (cw - 20);
            ctx.strokeStyle = Math.random() > 0.5 ? "#6a4224" : "#1a0c06";
            ctx.lineWidth = 1 + Math.random() * 2;
            ctx.beginPath();
            ctx.moveTo(px, y + 8);
            ctx.bezierCurveTo(px + 6, y + ch * 0.4, px - 8, y + ch * 0.7, px + 3, y + ch - 8);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }
      ctx.fillStyle = "#1a0e08";
      ctx.fillRect(0, H * 0.62, W, H * 0.38);
      g = ctx.createLinearGradient(0, H * 0.62, 0, H);
      g.addColorStop(0, "#24140c");
      g.addColorStop(1, "#160c06");
      ctx.fillStyle = g;
      ctx.fillRect(0, H * 0.64, W, H * 0.36);
      ctx.strokeStyle = "rgba(180,130,60,.28)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, H * 0.635);
      ctx.lineTo(W, H * 0.635);
      ctx.stroke();
    });
  }

  function woodPlanks(w, h) {
    return canvasTex(w, h, function (ctx, W, H) {
      var plank = 28, i, y, shade;
      for (y = 0, i = 0; y < H; y += plank, i++) {
        shade = 28 + (i % 5) * 6 + Math.floor(Math.random() * 8);
        ctx.fillStyle = "rgb(" + (shade + 22) + "," + (shade + 4) + "," + Math.floor(shade * 0.45) + ")";
        ctx.fillRect(0, y, W, plank - 1.4);
        ctx.fillStyle = "rgba(10,6,2,.45)";
        ctx.fillRect(0, y + plank - 1.6, W, 1.6);
        ctx.globalAlpha = 0.12;
        var k, x;
        for (k = 0; k < 7; k++) {
          x = Math.random() * W;
          ctx.strokeStyle = "#6a3e1c";
          ctx.beginPath();
          ctx.moveTo(x, y + 2);
          ctx.lineTo(x + (Math.random() - 0.5) * 40, y + plank - 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    });
  }

  function woodGrain(w, h) {
    return canvasTex(w, h, function (ctx, W, H) {
      var g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#6b4018");
      g.addColorStop(0.35, "#8a5624");
      g.addColorStop(0.7, "#5a3514");
      g.addColorStop(1, "#3d220c");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      var i, x;
      ctx.globalAlpha = 0.16;
      for (i = 0; i < 50; i++) {
        x = (i / 50) * W + Math.sin(i) * 8;
        ctx.strokeStyle = i % 2 ? "#2a1408" : "#c4924a";
        ctx.lineWidth = 1 + (i % 3);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 10, H * 0.3, x - 12, H * 0.65, x + 4, H);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  }

  function feltTex(w, h) {
    return canvasTex(w, h, function (ctx, W, H) {
      var g = ctx.createRadialGradient(W * 0.5, H * 0.42, 8, W * 0.5, H * 0.5, W * 0.62);
      g.addColorStop(0, "#1f8a62");
      g.addColorStop(0.45, "#146b4a");
      g.addColorStop(1, "#0a3a28");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      var i;
      for (i = 0; i < 2200; i++) {
        ctx.fillStyle = Math.random() > 0.5
          ? "rgba(255,255,255," + (Math.random() * 0.05) + ")"
          : "rgba(0,20,10," + (Math.random() * 0.07) + ")";
        ctx.fillRect(Math.random() * W, Math.random() * H, 1.2, 1);
      }
    });
  }

  function ovalCylinder(rTop, rBot, height, segs) {
    var g = new THREE.CylinderGeometry(rTop, rBot, height, segs || 72);
    g.scale(1, 1, 0.72);
    return g;
  }

  function ellipseRing(outerX, outerZ, innerX, innerZ, depth) {
    var shape = new THREE.Shape();
    shape.absellipse(0, 0, outerX, outerZ, 0, Math.PI * 2, false, 0);
    var hole = new THREE.Path();
    hole.absellipse(0, 0, innerX, innerZ, 0, Math.PI * 2, true, 0);
    shape.holes.push(hole);
    var g = new THREE.ExtrudeGeometry(shape, {
      depth: depth,
      bevelEnabled: false,
      curveSegments: 72
    });
    g.rotateX(-Math.PI / 2);
    return g;
  }

  function addRoom() {
    var wallMap = woodPanels(1024, 512);
    wallMap.repeat.set(2, 1);
    var wallMat = new THREE.MeshStandardMaterial({
      map: wallMap,
      roughness: 0.72,
      metalness: 0.04,
      color: 0xffffff
    });
    var floorMap = woodPlanks(512, 512);
    floorMap.repeat.set(6, 8);
    var floorMat = new THREE.MeshStandardMaterial({
      map: floorMap,
      roughness: 0.58,
      metalness: 0.06,
      color: 0xffffff
    });
    var ceilMat = new THREE.MeshStandardMaterial({
      color: 0x1c120c,
      roughness: 0.9,
      metalness: 0
    });

    var floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    var ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 3.55;
    scene.add(ceil);

    function wall(w, h, x, y, z, ry) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
      m.position.set(x, y, z);
      m.rotation.y = ry || 0;
      m.receiveShadow = true;
      scene.add(m);
      return m;
    }
    wall(14, 3.6, 0, 1.8, -6.9, 0);
    wall(14, 3.6, 0, 1.8, 6.9, Math.PI);
    wall(14, 3.6, -6.9, 1.8, 0, Math.PI / 2);
    wall(14, 3.6, 6.9, 1.8, 0, -Math.PI / 2);

    var trimMat = new THREE.MeshStandardMaterial({
      color: 0x3a2412,
      roughness: 0.55,
      metalness: 0.08
    });
    var crown = new THREE.Mesh(new THREE.BoxGeometry(14.1, 0.1, 14.1), trimMat);
    crown.position.y = 3.48;
    scene.add(crown);
    var base = new THREE.Mesh(new THREE.BoxGeometry(13.95, 0.14, 13.95), trimMat);
    base.position.y = 0.07;
    scene.add(base);

    addPainting(-2.4, 2.15, -6.86);
    addPainting(2.4, 2.15, -6.86);
  }

  function addPainting(x, y, z) {
    var frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.85, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x5a3a16, roughness: 0.45, metalness: 0.15 })
    );
    frame.position.set(x, y, z);
    scene.add(frame);
    var art = canvasTex(256, 192, function (ctx, W, H) {
      var g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#6b3a18");
      g.addColorStop(0.5, "#c48a3a");
      g.addColorStop(1, "#2a1810");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,220,140,.18)";
      ctx.beginPath();
      ctx.ellipse(W * 0.5, H * 0.4, 50, 28, 0, 0, 6.3);
      ctx.fill();
    });
    var canvasMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.7),
      new THREE.MeshStandardMaterial({ map: art, roughness: 0.8 })
    );
    canvasMesh.position.set(x, y, z + 0.03);
    scene.add(canvasMesh);
  }

  function addTable() {
    var rimMap = woodGrain(512, 256);
    var rimMat = new THREE.MeshStandardMaterial({
      map: rimMap,
      roughness: 0.42,
      metalness: 0.08,
      color: 0xffffff
    });
    var feltMat = new THREE.MeshStandardMaterial({
      map: feltTex(512, 512),
      roughness: 0.92,
      metalness: 0,
      color: 0xffffff
    });
    var goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.28,
      metalness: 0.65,
      emissive: 0x3a2a08,
      emissiveIntensity: 0.25
    });
    var legMat = new THREE.MeshStandardMaterial({
      color: 0x3a220e,
      roughness: 0.5,
      metalness: 0.06
    });

    var body = new THREE.Mesh(ovalCylinder(1.48, 1.46, 0.09, 80), rimMat);
    body.position.y = 0.72;
    body.castShadow = true;
    body.receiveShadow = true;
    scene.add(body);

    var apron = new THREE.Mesh(ovalCylinder(1.44, 1.40, 0.12, 80), rimMat);
    apron.position.y = 0.64;
    apron.castShadow = true;
    scene.add(apron);

    var gold = new THREE.Mesh(ellipseRing(1.38, 0.995, 1.30, 0.935, 0.01), goldMat);
    gold.position.y = 0.766;
    scene.add(gold);

    var felt = new THREE.Mesh(ovalCylinder(1.30, 1.30, 0.012, 80), feltMat);
    felt.position.y = 0.768;
    felt.receiveShadow = true;
    scene.add(felt);

    var pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.58, 24), legMat);
    pedestal.position.y = 0.29;
    pedestal.castShadow = true;
    scene.add(pedestal);
    var foot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.58, 0.07, 24), legMat);
    foot.position.y = 0.035;
    scene.add(foot);

    addChair(0, -1.42, 0);
    addChair(-1.78, 0.05, Math.PI / 2);
    addChair(1.78, 0.05, -Math.PI / 2);
  }

  function addChair(x, z, rotY) {
    var leather = new THREE.MeshStandardMaterial({
      color: 0x2a1410,
      roughness: 0.62,
      metalness: 0.04
    });
    var wood = new THREE.MeshStandardMaterial({
      color: 0x4a2a12,
      roughness: 0.5,
      metalness: 0.05
    });
    var group = new THREE.Group();
    var seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.48), leather);
    seat.position.y = 0.46;
    seat.castShadow = true;
    group.add(seat);
    var back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.56, 0.07), leather);
    back.position.set(0, 0.76, -0.22);
    back.castShadow = true;
    group.add(back);
    var i, lx;
    for (i = 0; i < 4; i++) {
      lx = (i % 2 ? 0.18 : -0.18);
      var lz = (i < 2 ? 0.16 : -0.16);
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.43, 8), wood);
      leg.position.set(lx, 0.215, lz);
      group.add(leg);
    }
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    scene.add(group);
  }

  function addSconce(x, y, z) {
    var brass = new THREE.MeshStandardMaterial({
      color: 0xc9a227,
      roughness: 0.32,
      metalness: 0.7
    });
    var glow = new THREE.MeshStandardMaterial({
      color: 0xffe7b0,
      emissive: 0xffd089,
      emissiveIntensity: 2.4,
      roughness: 0.3
    });
    var plate = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 16), brass);
    plate.rotation.x = Math.PI / 2;
    plate.position.set(x, y, z);
    scene.add(plate);
    var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8), brass);
    arm.position.set(x, y - 0.02, z + 0.08);
    arm.rotation.x = 0.6;
    scene.add(arm);
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), glow);
    bulb.position.set(x, y - 0.05, z + 0.14);
    scene.add(bulb);
    var shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.1, 0.08, 16, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xf3d56b,
        emissive: 0xc9a227,
        emissiveIntensity: 0.55,
        side: THREE.DoubleSide,
        roughness: 0.45
      })
    );
    shade.position.set(x, y - 0.02, z + 0.14);
    scene.add(shade);
    var light = new THREE.PointLight(0xffc878, 22, 9, 2);
    light.position.set(x, y - 0.04, z + 0.18);
    scene.add(light);
    return light;
  }

  function addLights() {
    scene.add(new THREE.AmbientLight(0xffe2b8, 0.32));
    var hemi = new THREE.HemisphereLight(0xffe6c0, 0x2a160c, 0.42);
    scene.add(hemi);

    var lamp = new THREE.SpotLight(0xffd89a, 38, 12, 0.72, 0.45, 1.4);
    lamp.position.set(0, 3.2, 0.15);
    lamp.target.position.set(0, 0.76, -0.1);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024);
    lamp.shadow.bias = -0.0008;
    scene.add(lamp);
    scene.add(lamp.target);
    lampLight = lamp;

    var fixture = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.28, 0.12, 24),
      new THREE.MeshStandardMaterial({
        color: 0x8a6a2a,
        emissive: 0x5a4010,
        emissiveIntensity: 0.4,
        roughness: 0.4,
        metalness: 0.35
      })
    );
    fixture.position.set(0, 3.28, 0.1);
    scene.add(fixture);
    var rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.7, roughness: 0.3 })
    );
    rod.position.set(0, 3.44, 0.1);
    scene.add(rod);

    sconceLightL = addSconce(-2.15, 2.05, -6.82);
    sconceLightR = addSconce(2.15, 2.05, -6.82);

    var fill = new THREE.PointLight(0xffc090, 10, 10, 2);
    fill.position.set(0, 1.6, 2.2);
    scene.add(fill);
  }

  function init() {
    if (ready || !root.THREE) return;
    canvas = $("room-gl");
    if (!canvas) return;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance"
      });
    } catch (err) {
      document.body.classList.add("no-webgl");
      return;
    }
    if (!renderer.getContext()) {
      document.body.classList.add("no-webgl");
      return;
    }
    renderer.setClearColor(0x1a1008, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.fog = null;
    scene.background = new THREE.Color(0x1a1008);

    camera = new THREE.PerspectiveCamera(54, 1, 0.08, 40);
    camera.position.set(0, 1.22, 1.48);
    camera.lookAt(0, 0.73, -0.22);

    addRoom();
    addTable();
    addLights();

    ready = true;
    resize();
  }

  function resize() {
    if (!renderer || !camera) return;
    var w = window.innerWidth || 1;
    var h = window.innerHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    if (tableShown()) renderer.render(scene, camera);
  }

  function frame(t) {
    if (sconceLightL) sconceLightL.intensity = 20 + Math.sin(t * 0.0017) * 1.6;
    if (sconceLightR) sconceLightR.intensity = 20 + Math.sin(t * 0.0017 + 1.1) * 1.6;
    if (lampLight) lampLight.intensity = 36 + Math.sin(t * 0.0009) * 1.2;
    renderer.render(scene, camera);
  }

  function start() {
    if (!ready) init();
    if (!ready || running) return;
    running = true;
    renderer.setAnimationLoop(frame);
  }

  function stop() {
    if (!renderer || !running) return;
    running = false;
    renderer.setAnimationLoop(null);
  }

  function sync() {
    if (tableShown()) start();
    else stop();
  }

  function boot() {
    tableEl = $("table");
    canvas = $("room-gl");
    if (!tableEl || !canvas) return;
    if (!root.THREE) {
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
    sync();
  }

  root.NiulaiRoom3D = {
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
