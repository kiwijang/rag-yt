const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
 const context=await browser.newContext({viewport:{width:1440,height:1200}});
 await context.addInitScript(()=>{localStorage.setItem('ragyt_token','fixture-user');localStorage.setItem('ragyt_user',JSON.stringify({roles:['User']}));});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4200/muscles');
 await page.waitForFunction(()=>{const e=document.querySelector('app-muscle-viewer');return e&&window.ng.getComponent(e).loaded();},{},{timeout:90000});
 const inspect=()=>page.evaluate(()=>{
  const v=window.ng.getComponent(document.querySelector('app-muscle-viewer'));
  return {ids:v.availableIds.size,parts:v.parts.size,amount:v.currentExplosion,offset:Math.max(...[...v.parts].map(([p,s])=>p.position.distanceTo(s.base))),visible:new Set(v.meshes.filter(m=>m.layers.mask===1).map(m=>m.userData.muscleId)).size,bones:v.meshes.filter(m=>m.userData.atlasRole==='bone').map(m=>m.parent.position.toArray())};
 });
 const initial=await inspect();assert.equal(initial.ids,712);assert.equal(initial.parts,466);assert.equal(initial.offset,0);
 assert.ok(await page.getByRole('button',{name:'展開肌肉爆炸圖',exact:true}).isDisabled());
 assert.ok(await page.getByRole('slider',{name:'爆炸圖展開程度',exact:true}).isDisabled());
 await page.evaluate(()=>window.ng.getComponent(document.querySelector('app-muscles-page')).setExplosion(55));
 assert.equal((await inspect()).amount,0);
 const list=page.getByRole('group',{name:'結構清單',exact:true});
 assert.equal(await list.getByRole('button').count(),712);
 await page.getByRole('button',{name:'骨骼系統',exact:true}).click();
 assert.equal(await list.getByRole('button').count(),238);assert.equal((await inspect()).visible,238);
 await page.getByRole('button',{name:'肌筋膜系統',exact:true}).click();
 assert.equal(await list.getByRole('button').count(),474);assert.equal((await inspect()).visible,474);
 await page.getByRole('button',{name:'全部顯示',exact:true}).click();
 assert.equal((await inspect()).visible,712);
 const region=page.getByRole('combobox',{name:'篩選部位',exact:true});
 const galeaSearch=page.getByRole('textbox',{name:'搜尋肌肉或骨骼',exact:true});
 await galeaSearch.fill('帽狀腱膜');assert.equal(await list.getByRole('button').count(),2);
 await list.getByRole('button').first().click();
 await page.getByRole('status',{name:'模型選取名稱',exact:true}).filter({hasText:'帽狀腱膜'}).waitFor();
 const galeaState=await page.locator('app-muscle-viewer').evaluate(e=>{
  const v=window.ng.getComponent(e);return v.meshes.filter(m=>m.userData.muscleId===v.selected()).map(m=>({role:m.userData.atlasRole,visible:m.layers.isEnabled(0),opacity:m.material.opacity}));
 });
 assert.ok(galeaState.length&&galeaState.every(m=>m.role==='support'&&m.visible&&m.opacity===1));
 await page.getByRole('button',{name:'一鍵復原模型',exact:true}).click();
 assert.deepEqual(await region.locator('option').allTextContents(),['全部部位','頭頸','前臂手部','腿腳','上臂肩部','骨盆大腿','脊胸腹']);
 const catalog=require('../../frontend/apps/frontend/src/assets/anatomy/startup-reconciled/catalog.json');
 for(const zone of Object.keys(catalog.zones)){
  await region.selectOption(zone);
  assert.equal(await list.getByRole('button').count(),catalog.items.filter(i=>i.zones.includes(zone)).length);
 }
 await region.selectOption('');
 const addedSearch=page.getByRole('textbox',{name:'搜尋肌肉或骨骼',exact:true});
 await addedSearch.fill('Temporalis');assert.equal(await list.getByRole('button').count(),2);
 await list.getByRole('button').first().click();
 await page.getByText('Z-Anatomy Startup',{exact:true}).waitFor();
 const added=await page.evaluate(()=>window.ng.getComponent(document.querySelector('app-muscles-page')).selected());
 assert.equal(added.source,'Z-Anatomy Startup');assert.match(added.id,/^TP:/);
 await page.getByRole('checkbox',{name:'只顯示已選結構（查看深層肌肉）',exact:true}).check();
 assert.equal((await inspect()).visible,1);
 await page.getByRole('button',{name:'聚焦選取',exact:true}).click();
 const gold=await page.evaluate(()=>{
  const v=window.ng.getComponent(document.querySelector('app-muscle-viewer'));v.render();
  const gl=v.renderer.getContext(),p=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
  gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,p);
  let count=0;for(let i=0;i<p.length;i+=4)if(p[i]>100&&p[i+1]>80&&p[i+2]<130)count++;return count;
 });
 assert.ok(gold>1000,'Added muscle must actually render, not just appear in the list');
 await page.screenshot({path:'C:/Temp/ragyt-combined-added-selected.png'});
 await page.getByRole('button',{name:'一鍵復原模型',exact:true}).click();
 const canvas=await page.locator('canvas').boundingBox();
 await page.mouse.click(canvas.x+canvas.width/2+20,canvas.y+canvas.height*.30);
 await page.waitForFunction(()=>window.ng.getComponent(document.querySelector('app-muscles-page')).selectedId()!==null);
 const clicked=await page.evaluate(()=>window.ng.getComponent(document.querySelector('app-muscles-page')).selected());
 const nameOverlay=page.getByRole('status',{name:'模型選取名稱',exact:true});
 assert.ok((await nameOverlay.textContent()).includes(clicked.name));
 assert.ok((await nameOverlay.textContent()).includes(clicked.english));
 assert.ok((await nameOverlay.textContent()).includes(clicked.id));
 const selectedOpacity=()=>page.locator('app-muscle-viewer').evaluate(e=>{
  const v=window.ng.getComponent(e),alpha=m=>Array.isArray(m.material)?m.material.map(p=>p.opacity):[m.material.opacity];
  return {selected:v.meshes.filter(m=>m.userData.muscleId===v.selected()).flatMap(alpha),others:v.meshes.filter(m=>m.userData.atlasRole==='muscle'&&m.userData.muscleId!==v.selected()).flatMap(alpha)};
 });
 const fromModel=await selectedOpacity();assert.ok(fromModel.selected.every(a=>a===1)&&fromModel.others.every(a=>a===.2));
 const search=page.getByRole('textbox',{name:'搜尋肌肉或骨骼',exact:true});
 await region.selectOption('Zone_Pelvis_Thigh');
 await search.fill('Gluteus medius');assert.equal(await list.getByRole('button').count(),2);
 await list.getByRole('button').first().click();
 const selection=await page.evaluate(()=>window.ng.getComponent(document.querySelector('app-muscles-page')).selected());
 assert.match(selection.name,/臀中肌/);assert.match(selection.id,/^FJ/);
 const fromList=await selectedOpacity();assert.ok(fromList.selected.every(a=>a===1)&&fromList.others.every(a=>a===.2));
 await page.getByRole('button',{name:'清除選擇',exact:true}).click();
 assert.ok((await selectedOpacity()).others.every(a=>a===1));
 await list.getByRole('button').first().click();
 assert.ok((await nameOverlay.textContent()).includes(selection.name));
 assert.ok((await nameOverlay.textContent()).includes(selection.id));
 await page.getByRole('checkbox',{name:'只顯示已選結構（查看深層肌肉）',exact:true}).check();
 assert.equal((await inspect()).visible,1);
 await page.getByRole('button',{name:'聚焦選取',exact:true}).click();
 await page.getByRole('button',{name:'展開肌肉爆炸圖',exact:true}).click();
 await page.waitForFunction(()=>window.ng.getComponent(document.querySelector('app-muscle-viewer')).currentExplosion===55);
 const expanded=await inspect();assert.ok(Math.abs(expanded.offset-.264)<1e-6);assert.deepEqual(expanded.bones,initial.bones);
 const moved=await page.evaluate(()=>{
  const v=window.ng.getComponent(document.querySelector('app-muscle-viewer'));
  return [...v.parts].filter(([p,s])=>p.position.distanceTo(s.base)>1e-9).map(([p])=>p.userData.zones);
 });
 assert.ok(moved.length>0&&moved.length<466);
 assert.ok(moved.every(zones=>zones.includes('Zone_Pelvis_Thigh')),'Only the selected category may move');
 await page.screenshot({path:'C:/Temp/ragyt-upstream-exploded.png'});
 await region.selectOption('Zone_Head_Neck');
 await page.waitForFunction(()=>window.ng.getComponent(document.querySelector('app-muscle-viewer')).currentExplosion===0);
 assert.equal((await inspect()).offset,0);
 await region.selectOption('Zone_Pelvis_Thigh');
 const slider=page.getByRole('slider',{name:'爆炸圖展開程度',exact:true});
 await slider.focus();await slider.press('End');
 await page.waitForFunction(()=>window.ng.getComponent(document.querySelector('app-muscle-viewer')).currentExplosion===100);
 assert.ok(Math.abs((await inspect()).offset-.48)<1e-6);
 await slider.press('Home');
 await page.waitForFunction(()=>window.ng.getComponent(document.querySelector('app-muscle-viewer')).currentExplosion===0);
 assert.equal((await inspect()).offset,0);
 await page.getByRole('slider',{name:'肌肉不透明度',exact:true}).focus();
 await page.getByRole('slider',{name:'肌肉不透明度',exact:true}).press('Home');
 assert.equal((await inspect()).visible,catalog.items.filter(i=>i.type!=='muscle'&&i.zones.includes('Zone_Pelvis_Thigh')).length);
 await page.getByRole('checkbox',{name:'線框模式',exact:true}).check();
 await page.getByRole('button',{name:'一鍵復原模型',exact:true}).click();
 assert.equal((await inspect()).visible,712);assert.equal(await list.getByRole('button').count(),712);
 assert.ok((await nameOverlay.textContent()).includes('點選模型以查看名稱'));
 assert.ok(await slider.isDisabled());
 await page.getByRole('combobox',{name:'篩選部位',exact:true}).selectOption('Zone_Upper_Arm');
 assert.ok(await list.getByRole('button').count()<712);
 await page.getByRole('button',{name:'一鍵復原模型',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'C:/Temp/ragyt-upstream-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: combined GLB loaded, ray selection, 712 IDs, reference type/zone/search filters, isolated muscle, opacity, explosion 0/55/100, fixed bones, exact collapse, reset, mobile layout, no page errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});






