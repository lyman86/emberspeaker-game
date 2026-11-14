import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const dir=mkdtempSync(join(tmpdir(),'emberspeaker-test-'));
try {
  const file=join(dir,'test.mjs');
  await build({entryPoints:['tests/progression.mjs'],bundle:true,platform:'node',format:'esm',outfile:file,define:{'import.meta.env.BASE_URL':JSON.stringify('./')}});
  const result=spawnSync(process.execPath,[file],{stdio:'inherit'});
  process.exitCode=result.status??1;
} finally {rmSync(dir,{recursive:true,force:true});}
