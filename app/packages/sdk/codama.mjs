import { rootNodeFromAnchor } from '@codama/nodes-from-anchor';
import { createFromRoot } from 'codama';
import { renderVisitor } from '@codama/renderers-js';
import { readFileSync, existsSync, cpSync, rmSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const idlDir = path.resolve(here, '../../../target/idl');
const outDir = path.resolve(here, 'src/generated');

for (const program of ['laplace', 'hashlock', 'validity']) {
  const progDir = path.join(outDir, program);
  rmSync(progDir, { recursive: true, force: true });

  // Render into a throwaway temp dir. @codama/renderers-js v2 writes the client into
  // <tmp>/src/generated/* (plus a spurious package.json at <tmp>); we copy only the
  // generated client up to <progDir> so consumers import from `./generated/<program>/index.js`.
  const tmp = mkdtempSync(path.join(tmpdir(), `codama-${program}-`));
  const idl = JSON.parse(readFileSync(path.join(idlDir, `${program}.json`), 'utf-8'));
  // renderVisitor writes asynchronously — accept() returns a Promise; must await before copying.
  await createFromRoot(rootNodeFromAnchor(idl)).accept(renderVisitor(tmp));

  const inner = existsSync(path.join(tmp, 'src', 'generated')) ? path.join(tmp, 'src', 'generated') : tmp;
  cpSync(inner, progDir, { recursive: true });
  rmSync(tmp, { recursive: true, force: true });
  console.log(`generated ${program} → src/generated/${program}`);
}
