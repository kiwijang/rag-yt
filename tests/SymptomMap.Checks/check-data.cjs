const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),ts=require(path.join(root,'frontend/node_modules/typescript'));
const manifest=require(path.join(root,'frontend/apps/frontend/src/assets/anatomy/startup-reconciled/catalog.json'));
const load=file=>{
 const exports={},code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const requireLocal=id=>id==='../muscles-page/muscle-catalog'?{ANATOMY_ITEMS:manifest.items.map(i=>({...i,region:manifest.zones[i.zone]}))}:load(path.resolve(path.dirname(file),id+'.ts'));
 vm.runInNewContext(code,{exports,require:requireLocal},{filename:file});return exports;
};
const data=load(path.join(root,'frontend/apps/frontend/src/app/pages/symptom-map-page/symptom-map-data.ts'));
assert.equal(data.SYMPTOM_REGIONS.length,7);assert.equal(data.SYMPTOM_LOCATIONS.length,21);
for(const region of data.SYMPTOM_REGIONS)assert.equal(data.SYMPTOM_LOCATIONS.filter(p=>p.region===region.id).length,3);
const known=new Set(data.RELATED_MUSCLES.map(m=>m.id));assert.equal(known.size,data.RELATED_MUSCLES.length);
for(const location of data.SYMPTOM_LOCATIONS){
 assert.ok(data.SYMPTOM_REGIONS.some(r=>r.id===location.region));
 assert.equal(location.sourceUrl,'https://www.triggerpoints.net/symptom/'+location.id);
 const families=[...location.primary,...location.secondary];assert.equal(new Set(families).size,families.length);
 assert.ok(families.length);for(const id of families)assert.ok(known.has(id));
}
for(const muscle of data.RELATED_MUSCLES){
 assert.match(muscle.name,/[\u3400-\u9fff]/);assert.equal(muscle.sourceUrl,'https://www.triggerpoints.net/muscle/'+muscle.id);
 assert.equal(new Set(muscle.models.map(i=>i.id)).size,muscle.models.length);
 for(const item of muscle.models){assert.equal(item.type,'muscle');assert.equal(item.aggregate,false);assert.ok(manifest.items.some(i=>i.id===item.id));}
}
assert.deepEqual(Array.from(data.RELATED_MUSCLES.filter(m=>!m.models.length).map(m=>m.id)).sort(),['pectoralis-minimus','semispinalis-capitis','sternalis']);
console.log(`PASS: 7 regions, 21 cited symptom relationships, ${known.size} bilingual muscle families, model IDs exist, no support/bone/aggregate aliases, exactly 3 explicit unmapped families.`);

