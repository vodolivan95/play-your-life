// Авторские 3D-модели острова. Референс задаёт архитектуру; изображение не встраивается в GLB.
import * as T from 'three';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { log } from 'node:console';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mkdir, writeFile } from 'node:fs/promises';
// GLTFExporter uses the browser FileReader API for its binary container, not for textures.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }); }
};
const out = new URL('../public/models/city/', import.meta.url); await mkdir(out, { recursive: true });
const mat = (name, color, roughness = .6, metalness = 0, extra = {}) => { const m = new T.MeshStandardMaterial({ color, roughness, metalness, ...extra }); m.name = name; return m; };
const m = {
  white: mat('ivory-stucco', '#f5f2df', .65), roof: mat('snow-roof', '#edeedf', .65),
  glass: mat('weather-glass', '#399bbe', .18, .38, { emissive: '#b7c8b3', emissiveIntensity: .03 }),
  frame: mat('window-mullions', '#edf4ed', .35, .25), blue: mat('ocean-blue', '#187dd1', .22, .35),
  cyan: mat('water', '#27c4d5', .16, .35), dark: mat('charcoal', '#263c46', .5, .2),
  green: mat('leaves', '#3d9049', .8), lime: mat('leaves-light', '#83b950', .8), trunk: mat('palm-bark', '#ad8858', .9),
  gold: mat('polished-gold', '#e7b443', .22, .65), red: mat('heart-red', '#fa484e', .24, .15),
  pink: mat('flowers', '#e071b1', .65), orange: mat('track', '#cd6943', .85), turf: mat('lawn', '#6c9b62', .85),
  paving: mat('wet-pavement', '#e1d7bb', .85, .05), road: mat('wet-road', '#657079', .9, .05),
  rock: mat('granite', '#a8a696', .92), sand: mat('sand', '#e9d9a9', 1), water: mat('pool', '#35bed7', .15, .2),
};
function add(root, geometry, material, p = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const mesh = new T.Mesh(geometry, material); mesh.position.set(...p); mesh.scale.set(...scale); mesh.rotation.set(...rotation); root.add(mesh); return mesh;
}
const box = (root, size, p, material = m.white) => add(root, new T.BoxGeometry(...size), material, p);
const cyl = (root, radius, height, p, material = m.white, segments = 32, scale = [1, 1, 1]) => add(root, new T.CylinderGeometry(radius, radius, height, segments), material, p, scale);
const ball = (root, radius, p, material = m.green, scale = [1, 1, 1]) => add(root, new T.SphereGeometry(radius, 20, 12), material, p, scale);
const ring = (root, radius, tube, p, material = m.white, rotation = [Math.PI / 2, 0, 0], scale = [1, 1, 1]) => add(root, new T.TorusGeometry(radius, tube, 6, 48), material, p, scale, rotation);
function tube(root, points, radius, material, segments = 32) { return add(root, new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), segments, radius, 5, false), material); }
function heart(root, p, scale = 1, material = m.red) {
  const shape = new T.Shape(); shape.moveTo(0, -1.05); shape.bezierCurveTo(-.3, -.7, -1.4, .05, -1.4, .7); shape.bezierCurveTo(-1.4, 1.65, -.4, 1.9, 0, 1.05); shape.bezierCurveTo(.4, 1.9, 1.4, 1.65, 1.4, .7); shape.bezierCurveTo(1.4, .05, .3, -.7, 0, -1.05);
  add(root, new T.ExtrudeGeometry(shape, { depth: .4, bevelEnabled: true, bevelThickness: .16, bevelSize: .13, bevelSegments: 3, curveSegments: 16, steps: 1 }), material, p, [scale, scale, scale]);
}
function globe(root, p, radius = 1.65) {
  ball(root, radius, p, m.blue);
  for (let i = -2; i <= 2; i++) { const y = radius * i / 3; ring(root, Math.sqrt(radius * radius - y * y) + .02, .027, [p[0], p[1] + y, p[2]], m.frame); }
  for (let i = 0; i < 6; i++) ring(root, radius + .02, .027, p, m.frame, [0, i * Math.PI / 6, 0]);
  // Small raised continental patches, following the globe surface.
  for (let i = 0; i < 14; i++) { const a = i * 2.39996, y = Math.sin(i * 1.13) * .8, r = Math.sqrt(1 - y * y); ball(root, .18 + i % 3 * .04, [p[0] + Math.cos(a) * r * radius, p[1] + y * radius, p[2] + Math.sin(a) * r * radius], m.lime, [1, .5, 1]); }
}
function palm(root, x, z, height = 4) {
  tube(root, [[x, 0, z], [x + .2, height * .5, z], [x + .5, height, z]], .12, m.trunk, 10);
  for (let j = 0; j < 8; j++) {
    const a = j * Math.PI / 4, verts = [], indices = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8, r = t * height * .55, width = Math.sin(t * Math.PI) * .32, y = height + .35 * Math.sin(t * Math.PI) - t * t * .95;
      for (const side of [-1, 1]) verts.push(x + .5 + Math.cos(a) * r - Math.sin(a) * width * side, y, z + Math.sin(a) * r + Math.cos(a) * width * side);
      if (k < 8) { const b = k * 2; indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(verts, 3)); geo.setIndex(indices); geo.computeVertexNormals();
    const leaf = add(root, geo, j % 2 ? m.green : m.lime); leaf.material.side = T.DoubleSide;
  }
}
function garden(root, x, z, width = 2, depth = 1.3) {
  box(root, [width, .3, depth], [x, .2, z], m.white); box(root, [width - .16, .12, depth - .16], [x, .4, z], m.turf);
  for (let i = 0; i < 5; i++) ball(root, .25, [x - width * .35 + i * width * .17, .62, z], i % 3 ? m.green : m.pink, [1, .7, 1]);
}
function fountain(root, x, z, symbol = 'globe') {
  cyl(root, 2.1, .22, [x, .12, z], m.paving); cyl(root, 1.8, .16, [x, .3, z], m.water); ring(root, 1.85, .12, [x, .35, z]);
  cyl(root, .65, .3, [x, .55, z]);
  if (symbol === 'heart') heart(root, [x, .7, z], .55);
  else if (symbol === 'globe') globe(root, [x, 1.35, z], .55);
  else { cyl(root, .1, 1.4, [x, 1, z], m.water); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; tube(root, [[x, 1.5, z], [x + Math.cos(a) * .5, 1.8, z + Math.sin(a) * .5], [x + Math.cos(a), .4, z + Math.sin(a)]], .035, m.water, 10); } }
}
function wing(root, x, z, radius, levels) {
  for (let i = 0; i < levels; i++) {
    const r = radius - i * .35, y = i * 1.55;
    cyl(root, r, .18, [x, y + .15, z], m.white, 40, [1, 1, .78]);
    cyl(root, r - .13, 1.2, [x, y + .83, z], m.glass, 40, [1, 1, .78]);
    cyl(root, r + .1, .22, [x, y + 1.5, z], m.roof, 40, [1, 1, .78]);
    for (let j = 0; j < 18; j++) { const a = j / 18 * Math.PI * 2; box(root, [.035, 1.3, .035], [x + Math.sin(a) * (r - .09), y + .84, z + Math.cos(a) * (r - .09) * .78], m.frame); }
  }
  garden(root, x, z, radius * 1.2, radius * .65);
  for (const dx of [-.8, .8]) { cyl(root, .22, .4, [x + dx, levels * 1.55 + .2, z], m.white, 12); ball(root, .55, [x + dx, levels * 1.55 + .8, z], m.green, [1, 1.25, 1]); }
}
function portal(root, height = 7) {
  box(root, [2.7, height, 1.15], [0, height / 2, -.1]); box(root, [2.25, height - .65, 1.2], [0, height / 2, .0], m.glass);
  box(root, [.35, height, 1.35], [-1.55, height / 2, .05]); box(root, [.35, height, 1.35], [1.55, height / 2, .05]);
  tube(root, [[-1.55, height - .5, .05], [-1.45, height + .5, .05], [0, height + 1, .05], [1.45, height + .5, .05], [1.55, height - .5, .05]], .2, m.white);
  cyl(root, 2, .2, [0, 2.35, 1.5], m.roof, 32, [1, 1, .75]);
  for (const x of [-1.5, 1.5]) cyl(root, .12, 2.2, [x, 1.1, 2], m.white, 12);
  for (const x of [-.6, .6]) box(root, [.65, 1.9, .09], [x, 1.05, 1.48], m.glass);
  box(root, [3.2, .15, 1.4], [0, .12, 2.5], m.paving);
}
function civic(id) {
  const root = new T.Group(); root.name = id;
  cyl(root, 5.8, .15, [0, .08, 0], m.paving, 48, [1, 1, 1.05]);
  const three = ['health', 'english', 'growth'].includes(id);
  wing(root, -3.15, -1.15, 2.65, three ? 3 : 2); wing(root, 3.15, -1.15, 2.65, three ? 3 : 2);
  portal(root, id === 'health' || id === 'english' ? 7.2 : 5.3);
  if (id === 'health') { heart(root, [0, 5.7, 1.1], 1); fountain(root, 0, 4.75, 'heart'); }
  if (id === 'english') { globe(root, [0, 7.4, .6], 1.65); fountain(root, 0, 4.75); }
  if (id === 'growth') { box(root, [2.2, .35, 1.5], [0, 6.5, .4], m.gold); box(root, [2.2, .35, 1.5], [0, 6.95, .4], m.blue); box(root, [2.2, .35, 1.5], [0, 7.4, .4], m.red); fountain(root, 0, 4.75, 'water'); }
  if (id === 'finance') {
    for (let i = 0; i < 8; i++) cyl(root, .17, 4.1, [-2.1 + i * .6, 2.05, 2.3], m.gold, 12);
    add(root, new T.CylinderGeometry(1.18, 1.18, .3, 40), m.gold, [0, 6.7, .65], [1, 1, 1], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) ring(root, .7, .05, [0, 6.7, .83 + i * .02], m.white, [0, 0, 0]);
    fountain(root, 0, 4.75, 'water');
  }
  if (id === 'tasks') { box(root, [2.6, 3.3, .18], [0, 5.7, .8], m.blue); tube(root, [[-.8, 5.5, 1.0], [-.25, 4.9, 1.0], [.9, 6.5, 1.0]], .14, m.frame); fountain(root, 0, 4.75, 'water'); }
  if (id === 'together') { heart(root, [-.7, 5.65, .85], .6, m.gold); heart(root, [.7, 5.65, .85], .6, m.red); fountain(root, 0, 4.75, 'water'); }
  if (id === 'hobby') { for (let i = 0; i < 4; i++) box(root, [.35, 2.2 - i * .25, .2], [-.6 + i * .4, 5.8, .85], [m.red, m.gold, m.blue, m.pink][i]); fountain(root, 0, 4.75, 'water'); }
  for (const x of [-5.1, 5.1]) { palm(root, x, 2.5, 3.5); garden(root, x, 4.6, 1.4, 1.1); }
  return root;
}
function stadium() {
  const root = new T.Group(); root.name = 'sport';
  cyl(root, 5.75, .16, [0, .12, -.4], m.paving, 64, [1.18, 1, .75]);
  cyl(root, 5.3, 2.2, [0, 1.25, -1], m.glass, 64, [1.18, 1, .65]);
  ring(root, 5.3, .22, [0, 2.45, -1], m.white, [Math.PI / 2, 0, 0], [1.18, .65, 1]);
  ring(root, 4.25, .65, [0, 2.45, -1], m.roof, [Math.PI / 2, 0, 0], [1.18, .65, .3]);
  cyl(root, 4.0, .08, [0, 2.5, -1], m.turf, 48, [1.18, 1, .65]);
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; box(root, [.08, 2.1, .08], [Math.sin(a) * 6.15, 1.25, -1 + Math.cos(a) * 3.4], m.frame); }
  ring(root, 4.2, .65, [0, .3, 4.2], m.orange, [Math.PI / 2, 0, 0], [1.4, .52, .08]);
  for (const r of [3.7, 4, 4.3, 4.6]) ring(root, r, .02, [0, .36, 4.2], m.white, [Math.PI / 2, 0, 0], [1.4, .52, 1]);
  box(root, [5.0, .05, 2.7], [0, .35, 4.2], m.turf);
  for (const x of [-2.6, 2.6]) { box(root, [.08, .8, .08], [x, .75, 3.7]); box(root, [.08, .8, .08], [x, .75, 4.7]); box(root, [.08, .08, 1.08], [x, 1.12, 4.2]); }
  box(root, [1.7, .35, .35], [0, 3.5, 2.6], m.gold); for (const x of [-.9, .9]) { cyl(root, .6, .2, [x, 3.5, 2.6], m.gold, 20, [1, 1, 1]).rotation.z = Math.PI / 2; }
  for (const x of [-6, 6]) palm(root, x, 4, 3.8);
  return root;
}
function driving() {
  const root = new T.Group(); root.name = 'driving';
  box(root, [11, .15, 12], [0, .12, 0], m.paving);
  wing(root, -3.5, -2.5, 2.4, 2); wing(root, 3.5, -2.5, 2.4, 2);
  box(root, [4.5, 2.2, 2.3], [0, 1.2, -2.2], m.glass);
  tube(root, [[-2.7, 2.6, -.4], [-1.3, 3.2, -.4], [1.3, 3.2, -.4], [2.7, 2.6, -.4]], .3, m.blue, 20);
  const road = ring(root, 3.3, .65, [0, .28, 3.6], m.road, [Math.PI / 2, 0, 0], [1.35, .67, .07]); road.name = 'training-track';
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const line = box(root, [.5, .025, .045], [Math.sin(a) * 4.45, .34, 3.6 + Math.cos(a) * 2.23], m.gold); line.rotation.y = -a; }
  for (let i = 0; i < 6; i++) { add(root, new T.ConeGeometry(.12, .35, 10), m.orange, [-2.5 + i, .52, 4.1]); }
  garden(root, 0, 3.6, 3.5, 1.7); for (const x of [-5, 5]) palm(root, x, 3.5, 3.4);
  return root;
}
function bridge(root, x, z, rotation = 0) {
  const group = new T.Group(); group.position.set(x, .4, z); group.rotation.y = rotation; root.add(group);
  // Arched deck follows a sampled curve; railings and piers are separate geometry.
  const points = [];
  for (let i = 0; i <= 16; i++) { const a = i / 16; const y = .3 + Math.sin(a * Math.PI) * 1.05; points.push([-5 + a * 10, y, 0]); box(group, [.67, .22, 2.2], [-5 + a * 10, y, 0]);
    for (const dz of [-1.15, 1.15]) box(group, [.12, .8, .12], [-5 + a * 10, y + .5, dz]);
  }
  for (const dz of [-1.15, 1.15]) tube(group, points.map(([x, y]) => [x, y + .9, dz]), .09, m.white);
  for (const dx of [-4.3, 4.3]) box(group, [.6, 2.3, 2.2], [dx, -.55, 0], m.rock);
}
function island() {
  const root = new T.Group(); root.name = 'tropical-island';
  const outline = new T.Shape();
  for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2, r = 1 + .045 * Math.sin(a * 7) + .025 * Math.cos(a * 13); const x = Math.cos(a) * 33 * r, y = Math.sin(a) * 30 * r; if (i === 0) outline.moveTo(x, y); else outline.lineTo(x, y); }
  add(root, new T.ExtrudeGeometry(outline, { depth: 2.7, bevelEnabled: true, bevelSize: .55, bevelThickness: .3, bevelSegments: 2, steps: 1 }), m.rock, [0, -2.5, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  add(root, new T.ShapeGeometry(outline, 48), m.sand, [0, .26, 0], [.98, .98, 1], [-Math.PI / 2, 0, 0]);
  add(root, new T.ShapeGeometry(outline, 48), m.turf, [0, .29, 0], [.92, .91, 1], [-Math.PI / 2, 0, 0]);
  for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2, r = 1 + .03 * Math.sin(a * 7); add(root, new T.IcosahedronGeometry(1, 1), m.rock, [Math.cos(a) * 32 * r, -.3 + Math.sin(i * 2.3) * .35, Math.sin(a) * 29 * r], [1.15 + i % 3 * .3, 1.3 + i % 4 * .2, 1.4], [i * .3, i * .7, i * .2]); }
  // Broad front beach slopes naturally into the water.
  cyl(root, 8, .16, [-7, -.15, 29], m.sand, 48, [1.5, 1, .65]);
  for (const x of [-8, 8]) { box(root, [4, .08, 49], [x, .37, 0], m.paving); box(root, [2.7, .045, 49], [x, .43, 0], m.road); }
  for (const z of [-8, 8]) { box(root, [49, .08, 4], [0, .38, z], m.paving); box(root, [49, .045, 2.7], [0, .45, z], m.road); }
  for (const x of [-25, 25]) { box(root, [3.7, .1, 51], [x, .38, 0], m.paving); box(root, [2.6, .05, 51], [x, .45, 0], m.road); }
  for (const z of [-25, 25]) { box(root, [51, .1, 3.7], [0, .38, z], m.paving); box(root, [51, .05, 2.6], [0, .45, z], m.road); }
  for (let i = -23; i <= 23; i += 2) {
    for (const x of [-25, -8, 8, 25]) if (Math.abs(Math.abs(i) - 8) > 2) box(root, [.045, .02, .8], [x, .49, i], m.white);
    for (const z of [-25, -8, 8, 25]) if (Math.abs(Math.abs(i) - 8) > 2) box(root, [.8, .02, .045], [i, .49, z], m.white);
  }
  for (const x of [-8, 8]) for (const z of [-8, 8]) for (let j = 0; j < 5; j++) box(root, [2.6, .02, .15], [x, .51, z + 2.2 + j * .35], m.white);
  bridge(root, -27, 11, Math.PI / 2); bridge(root, 11, 28, 0);
  // Cliff waterfall: spatial ribbons step down from the rock, not a screen overlay.
  for (let i = 0; i < 5; i++) add(root, new T.IcosahedronGeometry(1, 2), m.rock, [-28 + Math.sin(i * 2) * 1.4, 2.1 + i % 2 * .7, -18 + Math.cos(i * 2)], [2.1, 2.6, 2], [i * .3, i * .5, 0]);
  for (let i = 0; i < 3; i++) box(root, [.65, 4.5 - i * .3, .12], [-29 + i * .75, 1.8, -15.1], m.cyan);
  for (let i = 0; i < 10; i++) ball(root, .45, [-28 + Math.sin(i * 2) * 1.4, -.2, -14.3 + Math.cos(i * 2) * .5], m.water, [1, .1, 1]);
  // Flower beds and sculpted bushes along the roads.
  for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, x = Math.cos(a) * 28, z = Math.sin(a) * 26;
    garden(root, x, z, 1.8, 1.1);
    if (i % 3 === 0) ball(root, .75, [x, 1.2, z], i % 2 ? m.pink : m.lime, [1, 1.5, 1]);
  }
  // Lighthouse and distant bay mountains continue the reference beyond the island.
  cyl(root, .75, 6.5, [28, 3.5, -23], m.white, 24); cyl(root, .95, .3, [28, 6.8, -23], m.gold, 24); cyl(root, .62, .9, [28, 7.35, -23], m.glass, 24);
  add(root, new T.ConeGeometry(1.05, .7, 24), m.roof, [28, 8.15, -23]);
  const hill = new T.PlaneGeometry(140, 26, 64, 12), positions = hill.attributes.position;
  for (let i = 0; i < positions.count; i++) { const x = positions.getX(i), y = positions.getY(i); const height = Math.max(0, 7 + Math.sin(x * .065) * 6 + Math.sin(x * .17) * 2) * Math.sin((y + 13) / 26 * Math.PI); positions.setZ(i, height); }
  hill.computeVertexNormals(); add(root, hill, m.turf, [0, -.2, -77], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  return root;
}
function car() {
  const root = new T.Group(); root.name = 'coastal-car';
  add(root, new T.CapsuleGeometry(.42, 1.0, 4, 10), m.blue, [0, .42, 0], [1, .8, 1], [Math.PI / 2, 0, 0]);
  box(root, [.75, .38, .9], [0, .72, -.15], m.glass);
  for (const x of [-.42, .42]) for (const z of [-.65, .65]) add(root, new T.CylinderGeometry(.23, .23, .16, 14), m.dark, [x, .25, z], [1, 1, 1], [0, 0, Math.PI / 2]);
  for (const x of [-.27, .27]) { box(root, [.2, .12, .06], [x, .45, .86], m.white); box(root, [.2, .12, .06], [x, .45, -.86], m.red); }
  return root;
}
function boat() {
  const root = new T.Group(); root.name = 'sailboat';
  add(root, new T.SphereGeometry(1, 20, 12), m.white, [0, 0, 0], [.5, .35, 1.6]); box(root, [.7, .08, 2.4], [0, .22, 0], m.trunk);
  cyl(root, .045, 4, [0, 2.1, 0], m.white, 8);
  const shape = new T.Shape(); shape.moveTo(0, 0); shape.lineTo(0, 3.6); shape.lineTo(1.7, .3); shape.closePath();
  const sail = add(root, new T.ShapeGeometry(shape), m.white, [.07, .5, 0]); sail.material.side = T.DoubleSide;
  return root;
}
// Bake intricate modelling into a small number of material batches; no primitive meshes at runtime.
function bake(root) {
  root.updateMatrixWorld(true); const batches = new Map();
  root.traverse(node => { if (node.isMesh) { const key = node.material.name; if (!batches.has(key)) batches.set(key, { material: node.material, geometries: [] }); const geometry = node.geometry.clone(); geometry.applyMatrix4(node.matrixWorld); if (!geometry.attributes.uv) geometry.setAttribute('uv', new T.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2)); batches.get(key).geometries.push(geometry.index ? geometry.toNonIndexed() : geometry); } });
  const result = new T.Group(); result.name = root.name;
  for (const [name, batch] of batches) { const geometry = mergeGeometries(batch.geometries, false); const mesh = new T.Mesh(geometry, batch.material); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; result.add(mesh); }
  return result;
}
const models = Object.fromEntries(['health', 'growth', 'english', 'finance', 'together', 'tasks', 'hobby'].map(id => [id, civic(id)]));
models.sport = stadium(); models.driving = driving(); const parked = car(); parked.position.set(0, .3, -.2); models.driving.add(parked); models.island = island(); models.car = car(); models.boat = boat();
const palmRoot = new T.Group(); palmRoot.name = 'palm'; palm(palmRoot, 0, 0, 4.5); models.palm = palmRoot;
const manifest = [];
for (const [id, root] of Object.entries(models)) {
  const baked = bake(root), binary = await new GLTFExporter().parseAsync(baked, { binary: true, onlyVisible: true });
  await writeFile(new URL(`${id}.glb`, out), Buffer.from(binary));
  const triangles = baked.children.reduce((sum, mesh) => sum + mesh.geometry.attributes.position.count / 3, 0);
  manifest.push({ id, file: `${id}.glb`, bytes: binary.byteLength, triangles, drawCalls: baked.children.length, source: 'Авторская геометрия PLAY YOUR LIFE; MIT' });
}
await writeFile(new URL('manifest.json', out), JSON.stringify(manifest, null, 2));
log(`City GLB: ${manifest.length} моделей, ${(manifest.reduce((n, x) => n + x.bytes, 0) / 1024 / 1024).toFixed(2)} MB`);
