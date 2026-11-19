const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const dir = path.join(root, 'frontend/apps/frontend/src/assets/anatomy/muscle-atlas-3d');
const source = process.argv[2] || 'C:/Temp/ragyt-muscle-atlas-upstream';
const catalog = JSON.parse(fs.readFileSync(path.join(dir, 'catalog.json')));
const binary = fs.readFileSync(path.join(dir, 'atlas.glb'));
const jsonLength = binary.readUInt32LE(12);
const gltf = JSON.parse(binary.subarray(20, 20 + jsonLength).toString());
assert.equal(catalog.items.length, 492);
assert.equal(catalog.items.filter(x => x.type === 'muscle').length, 254);
assert.equal(catalog.items.filter(x => x.type === 'bone').length, 238);
const nodes = gltf.nodes.filter(x => x.extras?.anatomyId && x.children);
assert.equal(nodes.length, 492);
assert.equal(new Set(nodes.map(x => x.extras.anatomyId)).size, 492);
for (const item of catalog.items) {
  const input = fs.readFileSync(path.join(source, 'models', item.file));
  assert.equal(crypto.createHash('sha256').update(input).digest('hex'), item.sha256, item.id);
  assert.match(item.name, /[\u3400-\u9fff]/);
  const node = nodes.find(n => n.extras.anatomyId === item.id);
  assert.equal(node.extras.atlasRole, item.type);
  const expected = {min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity]};
  for (const line of input.toString().split(/\r?\n/)) {
    if (!line.startsWith('v ')) continue;
    const [x, y, z] = line.trim().split(/\s+/).slice(1).map(Number);
    [x/1000, z/1000, -y/1000].forEach((v,i) => {
      expected.min[i] = Math.min(expected.min[i],v); expected.max[i] = Math.max(expected.max[i],v);
    });
  }
  const actual = {min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity]};
  const visit = index => {
    const child = gltf.nodes[index];
    if (child.mesh !== undefined) for (const primitive of gltf.meshes[child.mesh].primitives) {
      const accessor = gltf.accessors[primitive.attributes.POSITION];
      for (let i=0;i<3;i++) {
        actual.min[i] = Math.min(actual.min[i], accessor.min[i]);
        actual.max[i] = Math.max(actual.max[i], accessor.max[i]);
      }
    }
    for (const index of child.children || []) visit(index);
  };
  for (const index of node.children) visit(index);
  for (const edge of ['min','max']) for (let i=0;i<3;i++)
    assert.ok(Math.abs(actual[edge][i]-expected[edge][i]) < 0.000002, `${item.id} geometry bounds changed`);
}
for (const [a,b] of catalog.export.adjacency) assert.notEqual(catalog.export.colors[a], catalog.export.colors[b], `${a}/${b}`);
assert.equal(binary.length,catalog.export.bytes);
console.log('PASS: 492 source hashes, Chinese labels, IDs, roles, converted geometry bounds and adjacent family colors.');
