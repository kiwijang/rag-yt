const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto('http://127.0.0.1:4200/symptom-map');await page.waitForURL('**/login');
 await page.evaluate(()=>{localStorage.setItem('ragyt_token','fixture-user');localStorage.setItem('ragyt_user',JSON.stringify({roles:['User']}));});
 await page.goto('http://127.0.0.1:4200/symptom-map');
 const host=page.locator('app-symptom-map-page'),map=host.locator('app-flat-body-map');
 const data=()=>host.evaluate(e=>{const c=window.ng.getComponent(e);return {region:c.regionId(),symptom:c.symptomId(),muscle:c.muscleId(),model:c.modelId(),step:c.currentStep(),view:c.view(),groups:c.candidateGroups().map(g=>({label:g.label,items:g.items.map(m=>({id:m.id,name:m.name,models:m.models.map(p=>p.id)}))}))};});
 await host.getByRole('heading',{name:'先選擇症狀大區',exact:true}).waitFor();
 assert.equal(await host.getByRole('group',{name:'症狀大區清單',exact:true}).getByRole('button').count(),7);
 assert.equal(await host.getByRole('group',{name:'細部疼痛位置',exact:true}).count(),0);
 assert.equal(await host.getByRole('group',{name:'主要關聯',exact:true}).count(),0);
 await page.screenshot({path:'C:/Temp/ragyt-symptom-map-start.png',fullPage:true});
 const head=map.getByRole('button',{name:'選擇區域：頭頸',exact:true});await head.focus();await head.press('Enter');
 assert.equal((await data()).step,2);
 assert.equal(await host.getByRole('group',{name:'細部疼痛位置',exact:true}).getByRole('button').count(),3);
 await map.getByRole('button',{name:'背面',exact:true}).click();
 const neck=map.getByRole('button',{name:'選擇位置：頸後疼痛',exact:true});await neck.focus();await neck.press('Space');
 assert.equal((await data()).step,3);
 const primary=host.getByRole('group',{name:'主要關聯',exact:true});
 assert.deepEqual((await data()).groups[0].items.map(i=>i.id),['trapezius','multifidi']);
 await primary.getByRole('button').filter({hasText:'斜方肌'}).click();
 assert.ok(await host.getByRole('button',{name:'在 3D 中定位',exact:true}).isDisabled());
 const select=host.getByRole('combobox',{name:'選擇肌肉模型部件',exact:true});
 assert.equal(await select.locator('option').count(),7);
 const chosen=await select.locator('option').nth(1).getAttribute('value');await select.selectOption(chosen);
 assert.ok((await host.getByRole('link',{name:'在 3D 中定位',exact:true}).getAttribute('href')).includes(encodeURIComponent(chosen)));
 await page.screenshot({path:'C:/Temp/ragyt-symptom-map-selected.png',fullPage:true});
 assert.equal(requests.filter(u=>u.endsWith('.glb')).length,0,'Flat map must not load the 54 MB model');
 assert.equal(requests.filter(u=>/\/api\//.test(u)).length,0,'Flat map must not trigger source/LLM/RAG jobs');
 await host.getByRole('button',{name:'← 更換疼痛位置',exact:true}).click();
 const cleared=await data();assert.equal(cleared.muscle,null);assert.equal(cleared.model,'');
 await host.getByRole('button',{name:'重新選擇',exact:true}).click();
 assert.equal((await data()).step,1);
 const areas=await host.getByRole('group',{name:'症狀大區清單',exact:true}).getByRole('button').allTextContents();
 let checked=0;
 for(let area=0;area<7;area++){
  await host.getByRole('group',{name:'症狀大區清單',exact:true}).getByRole('button').nth(area).click();
  for(let location=0;location<3;location++){
   await host.getByRole('group',{name:'細部疼痛位置',exact:true}).getByRole('button').nth(location).click();
   const s=await data(),all=s.groups.flatMap(g=>g.items);
   assert.ok(all.length>0);assert.equal(new Set(all.map(m=>m.id)).size,all.length);
   assert.ok(all.some(m=>m.models.length));assert.ok(all.every(m=>/[\u3400-\u9fff]/.test(m.name)));
   await host.getByRole('button',{name:'← 更換疼痛位置',exact:true}).click();checked++;
  }
  await host.getByRole('button',{name:'重新選擇',exact:true}).click();
 }
 assert.equal(checked,21);
 await host.getByRole('group',{name:'症狀大區清單',exact:true}).getByRole('button').filter({hasText:'上背、肩與上臂'}).click();
 await host.getByRole('group',{name:'細部疼痛位置',exact:true}).getByRole('button').filter({hasText:'肩前側疼痛'}).click();
 await host.getByRole('group',{name:'主要關聯',exact:true}).getByRole('button').filter({hasText:'Pectoralis Minimus'}).click();
 assert.equal(await select.count(),0);assert.ok(await host.getByRole('button',{name:'在 3D 中定位',exact:true}).isDisabled());
 await host.getByRole('status').filter({hasText:'目前模型沒有精確對應'}).waitFor();
 await host.getByRole('group',{name:'主要關聯',exact:true}).getByRole('button').filter({hasText:'棘下肌'}).click();
 assert.equal((await data()).model,'');
 const part=await select.locator('option').nth(1).getAttribute('value');await select.selectOption(part);
 const chatHref=await host.getByRole('link',{name:'帶入 LLM 對話',exact:true}).getAttribute('href');
 const ragHref=await host.getByRole('link',{name:'帶入 RAG 檢索',exact:true}).getAttribute('href');
 assert.ok(new URL(chatHref,'http://localhost').searchParams.get('muscle').includes('棘下肌'));
 assert.ok(new URL(ragHref,'http://localhost').searchParams.get('q').includes('棘下肌'));
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'C:/Temp/ragyt-symptom-map-mobile.png',fullPage:true});
 await page.locator('html').evaluate(e=>e.classList.add('dark'));
 await page.screenshot({path:'C:/Temp/ragyt-symptom-map-dark.png',fullPage:true});
 await host.getByRole('link',{name:'在 3D 中定位',exact:true}).click();await page.waitForURL('**/muscles?id=*');
 await page.waitForFunction(id=>window.ng.getComponent(document.querySelector('app-muscles-page')).selectedId()===id,part);
 await page.locator('app-muscle-viewer span[role="status"]').waitFor({timeout:90000});
 assert.equal(await page.locator('app-muscles-page').evaluate(e=>window.ng.getComponent(e).view()),'front');
 const opacity=await page.locator('app-muscle-viewer').evaluate(e=>{
  const v=window.ng.getComponent(e),id=v.selected();
  const alpha=m=>Array.isArray(m.material)?m.material.map(x=>x.opacity):[m.material.opacity];
  return {selected:v.meshes.filter(m=>m.userData.muscleId===id).flatMap(alpha),others:v.meshes.filter(m=>m.userData.atlasRole==='muscle'&&m.userData.muscleId!==id).flatMap(alpha)};
 });
 assert.ok(opacity.selected.length&&opacity.selected.every(a=>a===1));
 assert.ok(opacity.others.length&&opacity.others.every(a=>a===.2));
 const getCentering=()=>page.locator('app-muscle-viewer').evaluate(e=>{
  const v=window.ng.getComponent(e),box=new v.bodyBox.constructor();
  for(const mesh of v.meshes)if(mesh.userData.muscleId===v.selected())box.expandByObject(mesh);
  const center=box.getCenter(v.controls.target.clone()),screen=center.clone().project(v.camera);
  return {distance:v.controls.target.distanceTo(center),screenX:screen.x,screenY:screen.y};
 });
 const centering=await getCentering();
 assert.ok(centering.distance<1e-6&&Math.abs(centering.screenX)<1e-6&&Math.abs(centering.screenY)<1e-6,'Located muscle must be at the camera target and screen center');
 for(const destination of [{id:'FJ1464',view:'front'},{id:'FJ1520',view:'back'},{id:'FJ1441',requestedId:'FJ1443',view:'front'},{id:'TP:57',view:'back'},{id:'TP:58',view:'back'}]){
  await page.locator('app-muscles-page').evaluate((e,d)=>window.ng.getComponent(e).router.navigateByUrl('/muscles?id='+(d.requestedId??d.id)+'&view='+d.view),destination);
  await page.waitForFunction(d=>{
   const v=window.ng.getComponent(document.querySelector('app-muscle-viewer')),box=new v.bodyBox.constructor();
   if(v.selected()!==d.id||v.view()!==d.view)return false;
   for(const mesh of v.meshes)if(mesh.userData.muscleId===d.id)box.expandByObject(mesh);
   return v.controls.target.distanceTo(box.getCenter(v.controls.target.clone()))<1e-6;
  },destination);
  const centered=await getCentering();assert.ok(Math.abs(centered.screenX)<1e-6&&Math.abs(centered.screenY)<1e-6,'Cached route/view changes must keep the located muscle centered');
  if(destination.id==='TP:57'||destination.id==='TP:58'){
   const visible=await page.locator('app-muscle-viewer').evaluate(e=>{
    const v=window.ng.getComponent(e);v.render();const gl=v.renderer.getContext(),p=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
    gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,p);
    let gold=0;for(let i=0;i<p.length;i+=4)if(p[i]>170&&p[i+1]>100&&p[i+2]<100)gold++;
    return {gold,boneOpacity:v.boneOpacity()};
   });
   assert.equal(visible.boneOpacity,100);assert.ok(visible.gold>5000,'Occipitalis must be visibly rendered with fully opaque bones');
  }
 }
 assert.deepEqual(errors,[]);
 await page.getByRole('button',{name:'登出',exact:true}).click();await page.waitForURL('**/login');
 await page.goto('http://127.0.0.1:4200/symptom-map');await page.waitForURL('**/login');
 console.log(`PASS: ${areas.length} areas / ${checked} symptom flows, SVG keyboard controls, progressive disclosure, source relations, detailed model selection, missing models, downstream resets, no model/API requests before 3D navigation, real 3D ID selection, chat/RAG links, mobile/dark, login guard.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
