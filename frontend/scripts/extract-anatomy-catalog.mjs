import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const asset = new URL('../apps/frontend/src/assets/anatomy/Z-Anatomy_Muscles_Interactive_Zones.glb', import.meta.url);
const data = await readFile(asset);
if (data.readUInt32LE(0) !== 0x46546c67 || data.readUInt32LE(4) !== 2 || data.readUInt32LE(16) !== 0x4e4f534a)
  throw new Error('Expected a glTF 2.0 binary with a JSON first chunk.');
const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString('utf8'));
const zones = new Map();
function walk(index, zone = 'Zone_Unassigned') {
  const node = gltf.nodes[index];
  if (node.name?.startsWith('Zone_')) zone = node.name;
  zones.set(index, zone);
  for (const child of node.children ?? []) walk(child, zone);
}
for (const index of gltf.scenes[gltf.scene ?? 0].nodes) walk(index);
const structures = new Map();
let helpers = 0;
gltf.nodes.forEach((node, index) => {
  if (node.mesh === undefined) return;
  if (/\.[gj](?:\.\d+)?$/.test(node.name)) { helpers++; return; }
  const name = node.name.replace(/\.(?:l|r)(?:\.\d+)?$/, '').trim();
  const structure = structures.get(name) ?? { id: name, english: name, nodes: [], zones: [], originalNames: [] };
  structure.nodes.push(index); structure.originalNames.push(node.name);
  if (!structure.zones.includes(zones.get(index))) structure.zones.push(zones.get(index));
  structures.set(name, structure);
});
const catalog = [...structures.values()].sort((a, b) => a.english.localeCompare(b.english, 'en'));
const header = { file: asset.pathname.split('/').at(-1), sha256: createHash('sha256').update(data).digest('hex'), helperNodes: helpers };
const output = new URL('../apps/frontend/src/app/pages/muscles-page/anatomy-catalog.generated.ts', import.meta.url);
await writeFile(output, `// Generated from the supplied GLB by npm run anatomy:catalog. Do not edit.\n// Derived data: Z-Anatomy / BodyParts3D, CC BY-SA 4.0. See assets/anatomy/ATTRIBUTION.md.\nexport const ANATOMY_ASSET = ${JSON.stringify(header)};\nexport const ANATOMY_STRUCTURES = ${JSON.stringify(catalog, null, 2)};\n`, 'utf8');
console.log(`Extracted ${catalog.length} structures / ${catalog.reduce((n, s) => n + s.nodes.length, 0)} anatomical nodes; excluded ${helpers} Blender text-label nodes.`);
