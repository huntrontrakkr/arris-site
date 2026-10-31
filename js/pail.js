/* A takeout pail of noodles beside the noodle shop's sign, in WebGL.
 *
 * The pail is built as a real one is folded: a paperboard frustum, square
 * at the foot and wider at the mouth, its corners gusseted (each corner a
 * pleat, deepest at the top), four flaps standing open above the fold, a
 * wire handle hooked through the ends. The print is generic, red on the
 * board, set in Arris. Lo mein heaped in it, scallion and carrot on top, a pair of split wooden chopsticks stuck in.
 *
 * The canvas is transparent: two shadow catchers, a floor and a wall in the
 * sign's plane, put the pail's shadow on the page and across the sign. It
 * turns with the scroll and draws only when it is on screen and something
 * changed. Loaded by belt.js when the pail comes near. */
import * as THREE from './vendor/three.module.min.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ------------------------------------------------------------ the pail's measures, in centimetres */
const H = 9.0;                                     // the body, foot to fold
const FOOT = { a: 3.5, b: 3.1, c: 0.85, d: 0.0 };  // half-width, half-depth, corner cut, pleat depth
const MOUTH = { a: 5.4, b: 4.5, c: 1.35, d: 0.32 };
const T = 0.05;                                    // the board's thickness

// a seeded random, so the noodles fall the same way on every visit
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }

/* A mesh builder: triangles with flat normals, each faced the way it is
 * told (want: a vector on the side the face should look to), and UVs. */
class Mesher {
  constructor() { this.p = []; this.n = []; this.uv = []; }
  tri(a, b, c, want, ua = [0, 0], ub = [0, 0], uc = [0, 0]) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (want && n.dot(want) < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; n.negate(); }
    n.normalize();
    for (const [q, u] of [[a, ua], [b, ub], [c, uc]]) { this.p.push(q.x, q.y, q.z); this.n.push(n.x, n.y, n.z); this.uv.push(u[0], u[1]); }
  }
  poly(pts, want, uvs) {
    for (let i = 1; i < pts.length - 1; i++) this.tri(pts[0], pts[i], pts[i + 1], want, uvs?.[0], uvs?.[i], uvs?.[i + 1]);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    return g;
  }
}

/* A ring around the pail at height y: four sides and four pleated corners,
 * twelve points counter-clockwise seen from above, starting at the front
 * side's left end. Sides are [0,1] front, [3,4] right, [6,7] back, [9,10]
 * left; the points between are the pleats' creases. */
function ring({ a, b, c, d }, y, inset = 0) {
  a -= inset; b -= inset;
  const k = d / Math.SQRT2;
  return [
    V(-a + c, y, b), V(a - c, y, b), V(a - c / 2 - k, y, b - c / 2 - k),
    V(a, y, b - c), V(a, y, -b + c), V(a - c / 2 - k, y, -b + c / 2 + k),
    V(a - c, y, -b), V(-a + c, y, -b), V(-a + c / 2 + k, y, -b + c / 2 + k),
    V(-a, y, -b + c), V(-a, y, b - c), V(-a + c / 2 + k, y, b - c / 2 - k),
  ];
}
const SIDES = { front: [0, 1], right: [3, 4], back: [6, 7], left: [9, 10] };

// a side panel's frame: x along the fold, up the panel, its outward normal
function frame(bot, top, i, j) {
  const c0 = bot[i].clone().add(bot[j]).multiplyScalar(0.5), c1 = top[i].clone().add(top[j]).multiplyScalar(0.5);
  const e = top[j].clone().sub(top[i]).normalize(), u = c1.clone().sub(c0).normalize();
  const n = new THREE.Vector3().crossVectors(e, u).normalize();
  const out = c1.clone().setY(0);
  if (n.dot(out) < 0) n.negate();
  return { c0, c1, e, u, n, w: top[i].distanceTo(top[j]), len: c1.distanceTo(c0) };
}

/* ------------------------------------------------------------ textures, drawn in Arris */
function paperCanvas(w, h, base) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const r = rng(7), img = g.getImageData(0, 0, w, h), px = img.data;
  for (let i = 0; i < px.length; i += 4) {            // the board's grain: a faint fleck
    const v = (r() - 0.5) * 9;
    px[i] += v; px[i + 1] += v; px[i + 2] += v;
  }
  g.putImageData(img, 0, 0);
  return [cv, g];
}

function printTexture(f, footW, renderer) {
  // the panel's own proportions: u across the mouth, v up the panel
  const W = 1024, Hh = Math.round(1024 * f.len / f.w);
  const [cv, g] = paperCanvas(W, Hh, '#f4f1ea');
  const red = '#c8202a';
  const at = v => Hh * (1 - v);                       // v (0 at the foot) to canvas y
  const widthAt = v => (footW + (f.w - footW) * v) / f.w * W;     // the panel's width at v, in pixels
  g.fillStyle = red; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const fit = (text, weight, v, share, spacing = 0.06) => {
    let size = 200;
    g.font = `${weight} ${size}px Arris`;
    g.letterSpacing = `${spacing * size}px`;
    const m = g.measureText(text).width;
    size *= widthAt(v) * share / m;
    g.font = `${weight} ${size}px Arris`; g.letterSpacing = `${spacing * size}px`;
    g.fillText(text, W / 2 + spacing * size / 2, at(v));
    return size;
  };
  // the bag's refrain, three times, heaviest first
  fit('THANK YOU', 900, 0.80, 0.76);
  fit('THANK YOU', 500, 0.67, 0.70);
  fit('THANK YOU', 200, 0.555, 0.64);
  // a rule, ENJOY, a rule
  const v1 = 0.42, rw = widthAt(v1) * 0.16;
  g.fillRect(W / 2 - widthAt(v1) * 0.33, at(v1) - 22, rw, 7);
  g.fillRect(W / 2 + widthAt(v1) * 0.33 - rw, at(v1) - 22, rw, 7);
  fit('ENJOY', 700, v1, 0.30, 0.2);
  // the small print the real ones carry
  g.font = '500 23px Arris'; g.letterSpacing = '2px';
  g.fillText('REMOVE WIRE HANDLE BEFORE MICROWAVING', W / 2, at(0.12));
  g.font = '500 20px Arris';
  g.fillText('PLEASE RECYCLE  ·  16 OZ', W / 2, at(0.075));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
function plainTexture(renderer, base) {
  const [cv] = paperCanvas(256, 256, base);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function woodTexture(renderer) {
  const w = 64, h = 512, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), r = rng(11);
  g.fillStyle = '#d8bb8c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {                      // grain along the stick
    const x = r() * w, a = 0.05 + r() * 0.12;
    g.strokeStyle = `rgba(120, 82, 40, ${a})`; g.lineWidth = 0.6 + r() * 1.6;
    g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y <= h; y += 32) g.lineTo(x + Math.sin(y / 70 + i) * 1.5, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

/* ------------------------------------------------------------ the pail */
function buildPail(renderer) {
  const group = new THREE.Group();
  const bot = ring(FOOT, 0), top = ring(MOUTH, H);
  const botIn = ring(FOOT, T, T), topIn = ring(MOUTH, H, T);
  const footW = bot[0].distanceTo(bot[1]);

  const paperTex = plainTexture(renderer, '#f4f1ea'), insideTex = plainTexture(renderer, '#eae2d3');
  const paper = new THREE.MeshStandardMaterial({ color: '#ffffff', map: paperTex, roughness: 0.52 });
  const inside = new THREE.MeshStandardMaterial({ color: '#ffffff', map: insideTex, roughness: 0.82 });
  const edge = new THREE.MeshStandardMaterial({ color: '#e4ddd0', roughness: 0.8 });

  // the panels: planar UVs in each panel's own frame, so the print is not
  // stretched by the flare (u across, v up; a texture's repeat for plain board)
  const outer = new Mesher(), innerM = new Mesher(), rim = new Mesher();
  const printed = {};
  const n = bot.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const quad = [bot[i], bot[j], top[j], top[i]];
    const mid = quad.reduce((s, q) => s.add(q), V(0, 0, 0)).multiplyScalar(0.25);
    const out = mid.clone().setY(0);
    const f = frame(bot, top, i, j);
    const uv = q => { const d = q.clone().sub(f.c0); return [d.dot(f.e) / f.w + 0.5, d.dot(f.u) / f.len]; };
    const side = Object.entries(SIDES).find(([, [a, b]]) => a === i && b === j)?.[0];
    if (side === 'front' || side === 'back') {
      const m = new Mesher(); m.poly(quad, out, quad.map(uv));
      printed[side] = { mesh: m, f };
    } else {
      outer.poly(quad, out, quad.map(q => uv(q).map(x => x * 0.25)));
    }
    const qi = [botIn[i], botIn[j], topIn[j], topIn[i]];
    innerM.poly(qi, out.clone().negate(), qi.map(q => uv(q).map(x => x * 0.25)));
    rim.poly([top[i], top[j], topIn[j], topIn[i]], V(0, 1, 0));
  }
  outer.poly(bot.slice().reverse(), V(0, -1, 0), bot.slice().reverse().map(q => [q.x * 0.05, q.z * 0.05]));
  innerM.poly(botIn, V(0, 1, 0), botIn.map(q => [q.x * 0.05, q.z * 0.05]));

  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; group.add(m); return m; };
  add(outer.geometry(), paper);
  add(innerM.geometry(), inside);
  add(rim.geometry(), edge);
  for (const side of ['front', 'back']) {
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: printTexture(printed[side].f, footW, renderer), roughness: 0.5 });
    add(printed[side].mesh.geometry(), mat);
  }

  /* the flaps: hinged on the fold, standing open. Each is a thin slab: its
     outer face board, its inner face the inside, its edges cut board */
  const fo = new Mesher(), fi = new Mesher(), fe = new Mesher();
  const flap = (side, open, shape) => {
    const [i, j] = SIDES[side];
    const f = frame(bot, top, i, j);
    const up = f.u.clone().multiplyScalar(Math.cos(open)).addScaledVector(f.n, Math.sin(open));
    const nOut = f.n.clone().multiplyScalar(Math.cos(open)).addScaledVector(f.u, -Math.sin(open));
    const base = top[i].clone().add(top[j]).multiplyScalar(0.5);
    for (const poly of shape(f.w)) {
      const P = poly.map(([x, y]) => base.clone().addScaledVector(f.e, x).addScaledVector(up, y));
      const I = P.map(p => p.clone().addScaledVector(nOut, -T));
      fo.poly(P, nOut, poly.map(([x, y]) => [x * 0.25, y * 0.25]));
      fi.poly(I, nOut.clone().negate(), poly.map(([x, y]) => [x * 0.25, y * 0.25]));
      const c = P.reduce((s, q) => s.add(q), V(0, 0, 0)).multiplyScalar(1 / P.length);
      for (let k = 0; k < P.length; k++) {
        const l = (k + 1) % P.length, m = P[k].clone().add(P[l]).multiplyScalar(0.5).sub(c);
        fe.poly([P[k], P[l], I[l], I[k]], m);
      }
    }
  };
  // the long flaps: tapered, their top corners cut; the front one has the tongue
  const long = (h, tongue) => w => {
    const s = [[-w / 2, 0], [w / 2, 0], [w / 2 - 0.85, h - 0.55], [w / 2 - 1.4, h], [-w / 2 + 1.4, h], [-w / 2 + 0.85, h - 0.55]];
    return tongue ? [s, [[-0.75, h - 0.01], [0.75, h - 0.01], [0.5, h + 0.75], [-0.5, h + 0.75]]] : [s];
  };
  const end = h => w => [[[-w / 2, 0], [w / 2, 0], [w / 2 - 0.7, h - 0.5], [w / 2 - 1.2, h], [-w / 2 + 1.2, h], [-w / 2 + 0.7, h - 0.5]]];
  flap('front', 0.62, long(3.1, true));
  flap('back', 0.34, long(3.1, false));
  flap('left', 0.30, end(2.4));
  flap('right', 0.42, end(2.4));
  add(fo.geometry(), paper);
  add(fi.geometry(), inside);
  add(fe.geometry(), edge);

  /* the wire handle: hooked through each end panel below the fold, arching
     over the mouth, leant back off the noodles */
  const yA = H - 1.0, xA = FOOT.a + (MOUTH.a - FOOT.a) * yA / H;
  const lean = 0.62, rx = xA + 0.35, ry = 6.2, pts = [];
  pts.push(V(-xA + 0.35, yA - 0.25, 0), V(-xA + 0.1, yA, 0), V(-xA - 0.25, yA + 0.05, 0));
  for (let k = 0; k <= 24; k++) {
    const th = Math.PI - (k / 24) * Math.PI;
    const s = Math.sin(th);
    pts.push(V(rx * Math.cos(th), yA + 0.35 + ry * s * Math.cos(lean), -ry * s * Math.sin(lean)));
  }
  pts.push(V(xA + 0.25, yA + 0.05, 0), V(xA - 0.1, yA, 0), V(xA - 0.35, yA - 0.25, 0));
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 160, 0.045, 8, false),
    new THREE.MeshStandardMaterial({ color: '#b9bcc0', metalness: 1, roughness: 0.28 }));
  wire.castShadow = true;
  group.add(wire);

  group.add(buildNoodles(top));
  group.add(buildChopsticks(renderer));
  return group;
}

/* ------------------------------------------------------------ the noodles */
function mergeGeometries(list) {
  const out = { position: [], normal: [], uv: [], color: [] }, index = [];
  let base = 0;
  for (const [g, col] of list) {
    const p = g.attributes.position.array, nn = g.attributes.normal.array, uv = g.attributes.uv.array, idx = g.index.array;
    for (let i = 0; i < p.length; i++) { out.position.push(p[i]); out.normal.push(nn[i]); }
    for (let i = 0; i < uv.length; i++) out.uv.push(uv[i]);
    for (let i = 0; i < p.length / 3; i++) out.color.push(col.r, col.g, col.b);
    for (let i = 0; i < idx.length; i++) index.push(idx[i] + base);
    base += p.length / 3;
    g.dispose();
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(out.position, 3));
  m.setAttribute('normal', new THREE.Float32BufferAttribute(out.normal, 3));
  m.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  m.setAttribute('color', new THREE.Float32BufferAttribute(out.color, 3));
  m.setIndex(index);
  return m;
}

function buildNoodles(top) {
  const group = new THREE.Group(), r = rng(3);
  const A = MOUTH.a - 0.5, B = MOUTH.b - 0.5, lim = MOUTH.a + MOUTH.b - MOUTH.c - 1.1;
  const inside = (x, z) => Math.abs(x) < A && Math.abs(z) < B && Math.abs(x) + Math.abs(z) < lim;
  const level = H - 0.55;                              // where the heap meets the walls
  const dome = (x, z) => level + 1.5 * Math.max(0, 1 - (x / (A + 0.4)) ** 2 - (z / (B + 0.4)) ** 2) ** 0.75;

  // the heap under the strands, so nothing shows through between them
  const bed = new THREE.PlaneGeometry(2 * A + 0.6, 2 * B + 0.6, 40, 40);
  bed.rotateX(-Math.PI / 2);
  const bp = bed.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    let x = bp.getX(i), z = bp.getZ(i);
    const over = Math.abs(x) + Math.abs(z) - (lim + 0.2);
    if (over > 0) { const s = (lim + 0.2) / (Math.abs(x) + Math.abs(z)); x *= s; z *= s; }
    bp.setXYZ(i, x, dome(x, z) - 0.3, z);
  }
  bed.computeVertexNormals();
  const bedMesh = new THREE.Mesh(bed, new THREE.MeshStandardMaterial({ color: '#9c6a33', roughness: 0.55 }));
  bedMesh.receiveShadow = true;
  group.add(bedMesh);

  const tones = ['#e7bd72', '#deb067', '#e9c47f', '#d6a45b', '#e3b66a', '#cf9a52'].map(c => new THREE.Color(c));
  const strands = [];
  const tube = (pts, radius = 0.12) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), pts.length * 9, radius, 7, false);
  for (let s = 0; s < 150; s++) {
    let x = (r() * 2 - 1) * (A - 0.4), z = (r() * 2 - 1) * (B - 0.4), th = r() * Math.PI * 2;
    if (!inside(x, z)) { x *= 0.7; z *= 0.7; }
    const layer = r(), pts = [], count = 6 + Math.floor(r() * 7);
    for (let k = 0; k < count; k++) {
      pts.push(V(x, dome(x, z) - 0.45 + layer * 0.55 + (r() - 0.5) * 0.18, z));
      th += (r() - 0.5) * 1.5;
      let nx = x + Math.cos(th) * 0.8, nz = z + Math.sin(th) * 0.8;
      if (!inside(nx, nz)) {
        th += Math.PI * (0.55 + r() * 0.9);
        nx = x + Math.cos(th) * 0.8; nz = z + Math.sin(th) * 0.8;
        if (!inside(nx, nz)) { nx = x * 0.85; nz = z * 0.85; }
      }
      x = nx; z = nz;
    }
    strands.push([tube(pts, 0.11 + r() * 0.03), tones[Math.floor(r() * tones.length)]]);
  }
  const noodles = new THREE.Mesh(mergeGeometries(strands),
    new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.36, clearcoat: 0.55, clearcoatRoughness: 0.3 }));
  noodles.castShadow = noodles.receiveShadow = true;
  group.add(noodles);

  // scallion rings and carrot, on top
  const scallion = new THREE.MeshStandardMaterial({ color: '#5f9a3c', roughness: 0.45 });
  const scallionLight = new THREE.MeshStandardMaterial({ color: '#a7cf6b', roughness: 0.45 });
  const carrot = new THREE.MeshStandardMaterial({ color: '#e0731f', roughness: 0.5 });
  const ringGeo = new THREE.TorusGeometry(0.2, 0.055, 6, 14);
  for (let k = 0; k < 26; k++) {
    let x = (r() * 2 - 1) * (A - 0.8), z = (r() * 2 - 1) * (B - 0.8);
    if (!inside(x, z)) continue;
    const m = new THREE.Mesh(ringGeo, r() < 0.6 ? scallion : scallionLight);
    m.position.set(x, dome(x, z) + 0.2, z);
    m.rotation.set(Math.PI / 2 + (r() - 0.5) * 0.9, 0, r() * Math.PI);
    m.castShadow = true;
    group.add(m);
  }
  const stick = new THREE.BoxGeometry(1.0, 0.09, 0.09);
  for (let k = 0; k < 12; k++) {
    let x = (r() * 2 - 1) * (A - 1), z = (r() * 2 - 1) * (B - 1);
    if (!inside(x, z)) continue;
    const m = new THREE.Mesh(stick, carrot);
    m.position.set(x, dome(x, z) + 0.18, z);
    m.rotation.set((r() - 0.5) * 0.5, r() * Math.PI, (r() - 0.5) * 0.4);
    m.castShadow = true;
    group.add(m);
  }
  return group;
}

/* ------------------------------------------------------------ the chopsticks: split wood, square, tapered */
function buildChopsticks(renderer) {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(renderer), roughness: 0.68, flatShading: true });
  const len = 20;
  for (const [tip, dir, roll] of [[V(0.2, H - 1.7, 0.8), V(0.8, 1, 0.42), 0.08], [V(1.2, H - 1.4, 0.0), V(0.95, 1, 0.16), -0.05]]) {
    const g = new THREE.CylinderGeometry(0.31, 0.15, len, 4, 1);
    g.rotateY(Math.PI / 4 + roll);
    const m = new THREE.Mesh(g, wood);
    const d = dir.normalize();
    m.quaternion.setFromUnitVectors(V(0, 1, 0), d);
    m.position.copy(tip).addScaledVector(d, len / 2);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

/* ------------------------------------------------------------ the stage */
export async function mount(stage) {
  const canvas = stage.querySelector('canvas');
  // the print is set in Arris: its weights in hand before the board is printed
  await Promise.all([200, 500, 700, 900].map(w => document.fonts.load(`${w} 100px Arris`, 'THANK YOU ENJOY')));
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    stage.classList.add('no-gl');
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;          // soft: a shadow on a sign, not a cut-out

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  // the key from up and right, so the shadow falls left, across the sign
  const key = new THREE.DirectionalLight('#fff4e6', 2.6);
  key.position.set(20, 11, 22);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
  key.shadow.radius = 6; key.shadow.blurSamples = 20;
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
  scene.add(key);
  const rimLight = new THREE.DirectionalLight('#cfe2ff', 0.9);         // a cool edge from behind
  rimLight.position.set(-18, 14, -22);
  scene.add(rimLight);
  const glow = new THREE.PointLight('#f2cc61', 40, 40, 1.6);            // the sign's own light, on the pail's left
  glow.position.set(-14, 7, 2);
  scene.add(glow);

  const pail = buildPail(renderer);
  scene.add(pail);

  // the shadow on the page: a wall in the sign's plane catches the pail's
  // shadow, and a soft patch under its foot sets it down
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(140, 90), new THREE.ShadowMaterial({ opacity: 0.5 }));
  wall.position.set(0, 15, -6.0); wall.receiveShadow = true;
  scene.add(wall);
  const blob = document.createElement('canvas'); blob.width = blob.height = 128;
  const bg = blob.getContext('2d'), grad = bg.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)'); grad.addColorStop(0.55, 'rgba(0,0,0,0.35)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  bg.fillStyle = grad; bg.fillRect(0, 0, 128, 128);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(14, 11),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blob), transparent: true, depthWrite: false, opacity: 0.7 }));
  contact.rotation.x = -Math.PI / 2; contact.position.y = -0.02;
  scene.add(contact);

  const camera = new THREE.PerspectiveCamera(24, 1, 1, 300);
  const look = V(5.2, 9.6, 0);
  const place = () => {
    // wide, the pail stands left of centre, over the sign's edge; tall (a
    // phone, the sign above it), nearer the middle
    look.x = camera.aspect > 1.1 ? 5.2 : 2.6;
    wall.material.opacity = camera.aspect > 1.1 ? 0.5 : 0.18;     // on a phone the sign is above, not behind
    const el = THREE.MathUtils.degToRad(19), dist = camera.aspect > 1.1 ? 66 : 72;
    camera.position.set(look.x, look.y + dist * Math.sin(el), dist * Math.cos(el));
    camera.lookAt(look);
  };
  place();

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let size = [0, 0], queued = false, visible = true;
  const draw = () => {
    queued = false;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w !== size[0] || h !== size[1]) {
      size = [w, h];
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix(); place();
    }
    const r = stage.getBoundingClientRect();
    const t = reduce ? 0.4 : THREE.MathUtils.clamp((innerHeight - r.top) / (innerHeight + r.height), 0, 1);
    pail.rotation.y = THREE.MathUtils.degToRad(-38 + 44 * t);
    renderer.render(scene, camera);
  };
  const ask = () => { if (visible && !queued) { queued = true; requestAnimationFrame(draw); } };
  addEventListener('scroll', ask, { passive: true });
  addEventListener('resize', () => { size = [0, 0]; ask(); });
  new IntersectionObserver(es => { visible = es[0].isIntersecting; ask(); }, { rootMargin: '100px' }).observe(stage);
  draw();
  stage.classList.add('ready');
}
