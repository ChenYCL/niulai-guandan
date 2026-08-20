/* Niulai meadow — Three.js r160+ outdoor grassland (no fog, no DoF haze) */
(function (root) {
  "use strict";

  var renderer, scene, camera, ready = false, running = false;
  var canvas, tableEl;
  var grassMat;
  var observer;

  var GRASS_COUNT = 4200;
  var FLOWER_COUNT = 340;

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
      g.addColorStop(0, "#2aa572");
      g.addColorStop(0.45, "#178056");
      g.addColorStop(1, "#0c4a32");
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

  function meadowTex(w, h) {
    return canvasTex(w, h, function (ctx, W, H) {
      ctx.fillStyle = "#2f7a38";
      ctx.fillRect(0, 0, W, H);
      var i, g;
      for (i = 0; i < 80; i++) {
        g = ctx.createRadialGradient(
          Math.random() * W, Math.random() * H, 4,
          Math.random() * W, Math.random() * H, 40 + Math.random() * 70
        );
        g.addColorStop(0, Math.random() > 0.5 ? "rgba(90,170,55,.42)" : "rgba(28,90,32,.4)");
        g.addColorStop(1, "rgba(40,110,40,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      for (i = 0; i < 5200; i++) {
        ctx.fillStyle = Math.random() > 0.55
          ? "rgba(180,230,90," + (0.05 + Math.random() * 0.14) + ")"
          : "rgba(12,48,16," + (0.06 + Math.random() * 0.16) + ")";
        ctx.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 1 + Math.random() * 2);
      }
    });
  }

  function dirtTex(w, h) {
    return canvasTex(w, h, function (ctx, W, H) {
      ctx.fillStyle = "#6b4a28";
      ctx.fillRect(0, 0, W, H);
      var i;
      for (i = 0; i < 1800; i++) {
        ctx.fillStyle = Math.random() > 0.5
          ? "rgba(120,82,40," + (0.15 + Math.random() * 0.25) + ")"
          : "rgba(40,24,10," + (0.12 + Math.random() * 0.22) + ")";
        ctx.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 1 + Math.random() * 2);
      }
    });
  }

  function cloudTex() {
    return canvasTex(256, 128, function (ctx, W, H) {
      ctx.clearRect(0, 0, W, H);
      var i, x, y, rx, ry;
      for (i = 0; i < 7; i++) {
        x = 40 + Math.random() * (W - 80);
        y = 40 + Math.random() * (H - 70);
        rx = 28 + Math.random() * 46;
        ry = 14 + Math.random() * 22;
        var g = ctx.createRadialGradient(x, y, 2, x, y, rx);
        g.addColorStop(0, "rgba(255,252,246,.88)");
        g.addColorStop(0.55, "rgba(255,244,220,.38)");
        g.addColorStop(1, "rgba(255,240,210,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
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

  function hillY(x, z) {
    var r = Math.sqrt(x * x + z * z);
    if (r < 3.4) return 0;
    var fade = Math.min(1, (r - 3.4) / 9);
    var h = Math.sin(x * 0.17) * 0.42
      + Math.cos(z * 0.13) * 0.34
      + Math.sin((x + z) * 0.09) * 0.26
      + Math.cos(x * 0.31 - z * 0.19) * 0.12;
    return h * fade;
  }

  function onTablePad(x, z) {
    return (x * x) / (1.72 * 1.72) + (z * z) / (1.28 * 1.28) < 1;
  }

  function addSky() {
    var skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {},
      vertexShader: [
        "varying vec3 vDir;",
        "void main() {",
        "  vDir = position;",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "varying vec3 vDir;",
        "void main() {",
        "  vec3 n = normalize(vDir);",
        "  float h = n.y;",
        "  vec3 zenith = vec3(0.30, 0.58, 0.88);",
        "  vec3 mid = vec3(0.48, 0.74, 0.86);",
        "  vec3 horizon = vec3(0.78, 0.86, 0.72);",
        "  vec3 col = mix(horizon, mid, smoothstep(-0.06, 0.22, h));",
        "  col = mix(col, zenith, smoothstep(0.18, 0.78, h));",
        "  vec3 sunD = normalize(vec3(-0.62, 0.58, 0.28));",
        "  float sun = pow(max(0.0, dot(n, sunD)), 42.0);",
        "  col += vec3(1.0, 0.82, 0.42) * sun * 0.85;",
        "  col += vec3(1.0, 0.72, 0.32) * pow(max(0.0, dot(n, sunD)), 8.0) * 0.18;",
        "  gl_FragColor = vec4(col, 1.0);",
        "}"
      ].join("\n")
    });
    var sky = new THREE.Mesh(new THREE.SphereGeometry(64, 28, 18), skyMat);
    sky.renderOrder = -2;
    sky.frustumCulled = false;
    scene.add(sky);

    var ctex = cloudTex();
    ctex.wrapS = THREE.ClampToEdgeWrapping;
    ctex.wrapT = THREE.ClampToEdgeWrapping;
    var cmat = new THREE.MeshBasicMaterial({
      map: ctex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false
    });
    var spots = [
      [-10, 20, -22, 9, 3.2, 0.18],
      [8, 18.5, -28, 11, 3.6, -0.12],
      [-18, 22, -16, 7.5, 2.6, 0.28],
      [16, 19, -20, 8.5, 2.8, -0.22],
      [2, 24, -34, 12, 3.8, 0.05]
    ];
    var i, m;
    for (i = 0; i < spots.length; i++) {
      m = new THREE.Mesh(new THREE.PlaneGeometry(spots[i][3], spots[i][4]), cmat);
      m.position.set(spots[i][0], spots[i][1], spots[i][2]);
      m.rotation.y = spots[i][5];
      m.rotation.x = -0.12;
      m.renderOrder = -1;
      scene.add(m);
    }
  }

  function addTerrain() {
    var map = meadowTex(512, 512);
    map.repeat.set(10, 10);
    var mat = new THREE.MeshStandardMaterial({
      map: map,
      roughness: 0.94,
      metalness: 0,
      color: 0xc8e8a8
    });
    var geo = new THREE.PlaneGeometry(78, 78, 96, 96);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var i, x, z;
    for (i = 0; i < pos.count; i++) {
      x = pos.getX(i);
      z = pos.getZ(i);
      pos.setY(i, hillY(x, z));
    }
    geo.computeVertexNormals();
    var ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    scene.add(ground);

    var dmap = dirtTex(256, 256);
    var dirtMat = new THREE.MeshStandardMaterial({
      map: dmap,
      roughness: 0.92,
      metalness: 0,
      color: 0xffffff
    });
    var pad = new THREE.Mesh(new THREE.CircleGeometry(1.62, 48), dirtMat);
    pad.scale.set(1, 0.74, 1);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.012;
    pad.receiveShadow = true;
    scene.add(pad);

    var path = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 7.2), dirtMat);
    path.rotation.x = -Math.PI / 2;
    path.rotation.z = 0.18;
    path.position.set(-0.85, 0.01, 2.6);
    path.receiveShadow = true;
    scene.add(path);
  }

  function makeBladeGeo() {
    var geo = new THREE.BufferGeometry();
    var w0 = 0.017, w1 = 0.011, h = 0.22;
    var pos = new Float32Array([
      -w0, 0, 0,   w0, 0, 0,   -w1, h * 0.46, 0.006,   w1, h * 0.46, 0.006,   0, h, 0.016,
      0, 0, -w0,   0, 0, w0,   0.006, h * 0.46, -w1,   0.006, h * 0.46, w1,   0.016, h, 0
    ]);
    var nrm = new Float32Array([
      0, 0.15, 1,  0, 0.15, 1,  0, 0.2, 1,  0, 0.2, 1,  0, 0.35, 1,
      1, 0.15, 0,  1, 0.15, 0,  1, 0.2, 0,  1, 0.2, 0,  1, 0.35, 0
    ]);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
    geo.setIndex([
      0, 1, 2,  1, 3, 2,  2, 3, 4,
      5, 6, 7,  6, 8, 7,  7, 8, 9
    ]);
    return geo;
  }

  function addGrass() {
    grassMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        sunDir: { value: new THREE.Vector3(-0.62, 0.72, 0.28).normalize() }
      },
      side: THREE.DoubleSide,
      lights: false,
      fog: false,
      vertexShader: [
        "uniform float time;",
        "varying float vLift;",
        "varying vec3 vTint;",
        "varying vec3 vWorldNormal;",
        "#ifdef USE_INSTANCING",
        "attribute mat4 instanceMatrix;",
        "#endif",
        "float hash12(vec2 p) {",
        "  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);",
        "}",
        "void main() {",
        "  vec3 pos = position;",
        "  float h = clamp(position.y / 0.22, 0.0, 1.0);",
        "  vLift = h;",
        "  mat4 inst = mat4(1.0);",
        "  #ifdef USE_INSTANCING",
        "  inst = instanceMatrix;",
        "  #endif",
        "  vec3 world0 = (modelMatrix * inst * vec4(0.0, 0.0, 0.0, 1.0)).xyz;",
        "  float gust = sin(time * 1.38 + world0.x * 0.74 + world0.z * 0.52);",
        "  gust += 0.48 * sin(time * 2.18 + world0.z * 1.16 + world0.x * 0.31);",
        "  gust += 0.16 * sin(time * 4.7 + hash12(world0.xz) * 6.2831);",
        "  float amp = 0.17 * h * h;",
        "  pos.x += gust * amp;",
        "  pos.z += (0.55 * gust + 0.14 * sin(time * 1.72 + world0.x)) * amp;",
        "  vec4 world = modelMatrix * inst * vec4(pos, 1.0);",
        "  vec3 n = normal;",
        "  #ifdef USE_INSTANCING",
        "  n = mat3(inst) * n;",
        "  #endif",
        "  vWorldNormal = normalize(mat3(modelMatrix) * n);",
        "  float hv = hash12(world0.xz);",
        "  vTint = mix(vec3(0.18, 0.46, 0.14), vec3(0.50, 0.78, 0.22), hv);",
        "  vTint = mix(vTint, vec3(0.14, 0.36, 0.12), hash12(world0.zx) * 0.38);",
        "  gl_Position = projectionMatrix * viewMatrix * world;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 sunDir;",
        "varying float vLift;",
        "varying vec3 vTint;",
        "varying vec3 vWorldNormal;",
        "void main() {",
        "  vec3 col = mix(vTint * 0.70, vTint * 1.18, vLift);",
        "  float ndl = 0.40 + 0.60 * max(0.0, dot(normalize(vWorldNormal), normalize(sunDir)));",
        "  gl_FragColor = vec4(col * ndl, 1.0);",
        "}"
      ].join("\n")
    });

    var mesh = new THREE.InstancedMesh(makeBladeGeo(), grassMat, GRASS_COUNT);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    var dummy = new THREE.Object3D();
    var placed = 0;
    var tries = 0;
    var x, z, y, s, roll;
    while (placed < GRASS_COUNT && tries < GRASS_COUNT * 10) {
      tries++;
      roll = Math.random();
      if (roll < 0.64) {
        x = (Math.random() - 0.5) * 30;
        z = -1.12 - Math.random() * 22;
      } else if (roll < 0.86) {
        x = (Math.random() < 0.5 ? -1 : 1) * (1.52 + Math.random() * 14);
        z = (Math.random() - 0.52) * 16;
      } else {
        x = (Math.random() - 0.5) * 12;
        z = 1.18 + Math.random() * 7;
      }
      if (onTablePad(x, z)) continue;
      y = hillY(x, z);
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.18);
      s = 0.72 + Math.random() * 0.78;
      dummy.scale.set(s, s * (0.82 + Math.random() * 0.55), s);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }

  function addFlowers() {
    var geo = new THREE.CircleGeometry(0.032, 7);
    var mat = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      vertexColors: false
    });
    var mesh = new THREE.InstancedMesh(geo, mat, FLOWER_COUNT);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FLOWER_COUNT * 3), 3);
    var dummy = new THREE.Object3D();
    var placed = 0;
    var tries = 0;
    var x, z, y, col, yellow;
    while (placed < FLOWER_COUNT && tries < FLOWER_COUNT * 12) {
      tries++;
      x = (Math.random() - 0.5) * 26;
      z = (Math.random() - 0.62) * 24;
      if (onTablePad(x, z)) continue;
      if (Math.abs(z) < 1.05 && Math.abs(x) < 2.1) continue;
      y = hillY(x, z);
      dummy.position.set(x, y + 0.045, z);
      dummy.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.4, Math.random() * 6.28, 0);
      dummy.scale.setScalar(0.7 + Math.random() * 0.8);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      yellow = Math.random() > 0.38;
      col = yellow
        ? [0.95 + Math.random() * 0.05, 0.78 + Math.random() * 0.16, 0.18 + Math.random() * 0.18]
        : [0.94 + Math.random() * 0.06, 0.94 + Math.random() * 0.05, 0.88 + Math.random() * 0.1];
      mesh.setColorAt(placed, new THREE.Color(col[0], col[1], col[2]));
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
  }

  function addEcology() {
    var leaf = new THREE.MeshStandardMaterial({
      color: 0x1a4a22,
      roughness: 0.86,
      metalness: 0
    });
    var leafDeep = new THREE.MeshStandardMaterial({
      color: 0x12351a,
      roughness: 0.88,
      metalness: 0
    });
    var bark = new THREE.MeshStandardMaterial({
      color: 0x4a3218,
      roughness: 0.82,
      metalness: 0
    });
    var rockMat = new THREE.MeshStandardMaterial({
      color: 0x6a655c,
      roughness: 0.78,
      metalness: 0.04
    });

    function tree(x, z, s, deep) {
      var y = hillY(x, z);
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.11 * s, 1.05 * s, 6), bark);
      trunk.position.set(x, y + 0.52 * s, z);
      trunk.castShadow = true;
      scene.add(trunk);
      var cone = new THREE.Mesh(new THREE.ConeGeometry(0.62 * s, 1.55 * s, 7), deep ? leafDeep : leaf);
      cone.position.set(x, y + 1.38 * s, z);
      cone.castShadow = true;
      scene.add(cone);
      var ball = new THREE.Mesh(new THREE.SphereGeometry(0.38 * s, 8, 6), deep ? leafDeep : leaf);
      ball.position.set(x + 0.12 * s, y + 1.05 * s, z - 0.08 * s);
      scene.add(ball);
    }

    function bush(x, z, s) {
      var y = hillY(x, z);
      var m = new THREE.Mesh(new THREE.SphereGeometry(0.42 * s, 8, 6), leafDeep);
      m.scale.set(1.15, 0.72, 1.05);
      m.position.set(x, y + 0.26 * s, z);
      m.castShadow = true;
      scene.add(m);
    }

    function rock(x, z, s) {
      var y = hillY(x, z);
      var m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18 * s, 0), rockMat);
      m.scale.set(1.1 + Math.random() * 0.4, 0.55 + Math.random() * 0.35, 0.9 + Math.random() * 0.4);
      m.position.set(x, y + 0.07 * s, z);
      m.rotation.set(Math.random(), Math.random() * 6, Math.random());
      m.castShadow = true;
      scene.add(m);
    }

    tree(-7.2, -11.5, 1.8, true);
    tree(8.4, -13.2, 2.1, true);
    tree(-11.5, -7.4, 1.5, false);
    tree(12.2, -8.8, 1.7, true);
    tree(-4.8, -18.5, 2.4, true);
    tree(5.6, -20.2, 2.0, false);
    tree(-16.5, -14.0, 1.9, true);
    tree(15.8, -16.4, 2.2, true);
    tree(2.2, -24.0, 2.6, true);

    bush(-3.4, -4.6, 1.1);
    bush(3.8, -5.1, 0.95);
    bush(-5.6, -3.2, 0.8);
    bush(6.2, -6.4, 1.2);
    bush(-8.4, -9.0, 1.4);
    bush(9.1, -4.8, 1.0);
    bush(-2.2, -8.6, 0.75);
    bush(4.4, -9.8, 1.15);

    rock(-1.9, 1.55, 1.1);
    rock(1.7, 1.85, 0.85);
    rock(-2.6, -2.4, 1.3);
    rock(2.9, -3.1, 1.0);
    rock(-6.4, -5.8, 1.6);
    rock(5.2, -7.2, 1.4);
    rock(0.9, -6.4, 0.7);
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
      color: 0xe8c247,
      roughness: 0.26,
      metalness: 0.68,
      emissive: 0x4a3408,
      emissiveIntensity: 0.32
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

  function addLights() {
    scene.add(new THREE.AmbientLight(0xc8dce8, 0.42));
    var hemi = new THREE.HemisphereLight(0x9ed2ff, 0x3d6a28, 0.92);
    scene.add(hemi);

    var sun = new THREE.DirectionalLight(0xffe2b0, 3.15);
    sun.position.set(-16, 18, 9);
    sun.target.position.set(0, 0.6, -1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0007;
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 8;
    sun.shadow.camera.bottom = -8;
    sun.shadow.camera.near = 4;
    sun.shadow.camera.far = 46;
    scene.add(sun);
    scene.add(sun.target);

    var fill = new THREE.DirectionalLight(0xfff3dc, 0.95);
    fill.position.set(0.6, 2.4, 2.6);
    scene.add(fill);

    var tableFill = new THREE.PointLight(0xfff0d4, 8.5, 9, 1.8);
    tableFill.position.set(0, 2.05, 0.35);
    scene.add(tableFill);
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
    renderer.setClearColor(0x6eb8cc, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.42;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.fog = null;
    scene.background = new THREE.Color(0x6eb8cc);

    camera = new THREE.PerspectiveCamera(54, 1, 0.08, 90);
    camera.position.set(0, 1.22, 1.48);
    camera.lookAt(0, 0.73, -0.22);

    addSky();
    addTerrain();
    addGrass();
    addFlowers();
    addEcology();
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
    if (grassMat) grassMat.uniforms.time.value = t * 0.001;
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
