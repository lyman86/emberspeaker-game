// Converts Poly Haven glTF folders into compact GLBs (WebP textures, simplified meshes) and prints their sizes.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, weld, simplify, getBounds } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
const [, , src, out, maxTex = '512'] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
fs.mkdirSync(out, { recursive: true });
await MeshoptSimplifier.ready;
const sizes = {};
for (const id of fs.readdirSync(src)) {
  const f = path.join(src, id, id + '.gltf');
  if (!fs.existsSync(f)) continue;
  const doc = await io.read(f);
  let tris = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  const steps = [weld(), dedup()];
  if (tris > 6000) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: 6000 / tris, error: 0.004 }));
  await doc.transform(...steps, prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [+maxTex, +maxTex], quality: 80 }));
  const b = getBounds(doc.getRoot().listScenes()[0]);
  sizes[id] = { min: b.min.map((v) => +v.toFixed(2)), max: b.max.map((v) => +v.toFixed(2)), tris: Math.round(tris) };
  await io.write(path.join(out, id + '.glb'), doc);
  console.log(id, (fs.statSync(path.join(out, id + '.glb')).size / 1e6).toFixed(2) + 'MB', JSON.stringify(sizes[id]));
}
fs.writeFileSync(path.join(out, 'sizes.json'), JSON.stringify(sizes, null, 1));
