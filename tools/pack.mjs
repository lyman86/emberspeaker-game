// Optimizes converted Mixamo GLBs for the web: drops embedded clips from characters,
// shrinks textures to 1024px WebP, and merges every animation into one library file.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, resample, weld, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const [, , src, out] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
fs.mkdirSync(out, { recursive: true });

for (const f of fs.readdirSync(path.join(src, 'chars')).filter((f) => f.endsWith('.glb'))) {
  const doc = await io.read(path.join(src, 'chars', f));
  for (const a of doc.getRoot().listAnimations()) a.dispose();
  let tris = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  const steps = [weld(), dedup()];
  if (tris > 25000) { await MeshoptSimplifier.ready; steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: 22000 / tris, error: 0.002 })); }
  await doc.transform(...steps, prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }));
  await io.write(path.join(out, f), doc);
  console.log(f, (fs.statSync(path.join(out, f)).size / 1e6).toFixed(2) + 'MB');
}

// animation library: one document, clip name = file name
const lib = await io.read(path.join(src, 'anims', 'idle.glb'));
lib.getRoot().listAnimations().forEach((a) => a.dispose());
const nodesByName = new Map(lib.getRoot().listNodes().map((n) => [n.getName(), n]));
const buf = lib.getRoot().listBuffers()[0];
for (const f of fs.readdirSync(path.join(src, 'anims')).filter((f) => f.endsWith('.glb')).sort()) {
  const d = await io.read(path.join(src, 'anims', f));
  const a = d.getRoot().listAnimations()[0];
  const anim = lib.createAnimation(f.replace('.glb', ''));
  for (const ch of a.listChannels()) {
    const tgt = nodesByName.get(ch.getTargetNode().getName());
    if (!tgt) continue;
    const s = ch.getSampler();
    const input = lib.createAccessor().setArray(s.getInput().getArray().slice()).setType('SCALAR').setBuffer(buf);
    const output = lib.createAccessor().setArray(s.getOutput().getArray().slice()).setType(s.getOutput().getType()).setBuffer(buf);
    const sampler = lib.createAnimationSampler().setInput(input).setOutput(output).setInterpolation(s.getInterpolation());
    anim.addSampler(sampler).addChannel(lib.createAnimationChannel().setTargetNode(tgt).setTargetPath(ch.getTargetPath()).setSampler(sampler));
  }
}
await lib.transform(resample({ tolerance: 1e-4 }), prune({ keepLeaves: true, keepAttributes: true }));
await io.write(path.join(out, 'anims.glb'), lib);
console.log('anims.glb', (fs.statSync(path.join(out, 'anims.glb')).size / 1e6).toFixed(2) + 'MB', lib.getRoot().listAnimations().length, 'clips');
