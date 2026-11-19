// PLAYWRIGHT_MODULE may point to a separately installed Playwright package.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
 page.on('requestfailed',req=>console.error('Request failed:',req.url(),req.failure()));
 await page.addInitScript(()=>{localStorage.setItem('ragyt_token','fixture-only');localStorage.setItem('ragyt_user',JSON.stringify({roles:['Admin']}));});
 let searchUrl,stopped=false;
 const image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOt0AAAAASUVORK5CYII=';
 await page.route('**/api/**',async route=>{
  const req=route.request(),u=new URL(req.url());let data=[];
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'}});
  if(u.pathname.endsWith('/index/status'))data={state:stopped?'cancelled':'running',processed:8,total:100,updated:8};
  else if(u.pathname.endsWith('/index/cancel')&&req.method()==='POST'){stopped=true;data={state:'stopping',processed:8,total:100,updated:8};}
  else if(u.pathname.endsWith('/search')){searchUrl=u;data={searchMode:'hybrid',items:[{id:1,sourceType:2,sourceId:3,sourceName:'PDF fixture',snippet:'中文段落',score:0.016,matchType:'text',model:'BGE-M3'},{id:1,sourceType:2,sourceId:3,sourceName:'PDF fixture',snippet:'PDF 頁面',score:0.016,matchType:'image',model:'Jina CLIP v2',page:1}]};}
  else if(u.pathname.endsWith('/image'))data={imageBase64:image};
  else if(req.method()!=='GET')throw Error('Unexpected mutation blocked: '+u.pathname);
  return route.fulfill({json:data,headers:{'Access-Control-Allow-Origin':'*'}});
 });
 await page.goto(process.env.FRONTEND_URL||'http://127.0.0.1:4200/dashboard');
 await page.getByRole('heading',{name:'RAG Source Console',exact:true}).waitFor();
 if(await page.getByRole('tab').count()!==2)throw Error('Sources console must only have YouTube/PDF tabs');
 await page.getByRole('button',{name:'RAG Query',exact:true}).click();
 await page.waitForURL('**/user-rag');
 const panel=page.locator('app-vector-index-panel');await panel.getByText('建立索引中',{exact:false}).waitFor();
 if(!await panel.getByRole('button',{name:'建立／更新索引'}).isDisabled())throw Error('Index start must be disabled while running');
 await panel.getByRole('button',{name:'停止索引'}).click();await panel.getByText('停止中',{exact:false}).first().waitFor();
 const section=page.locator('app-user-rag-page main');
 await section.getByLabel('Enter your question or keyword',{exact:true}).fill('骨盤');
 const responsePromise=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/search'));
 await section.getByRole('button',{name:'Search RAG',exact:true}).click();
 await responsePromise;
 try { await section.getByText('Jina CLIP v2 · 圖像命中',{exact:true}).waitFor(); }
 catch(error) { console.error('Search URL:',searchUrl?.toString(),'Visible page:',await page.locator('body').innerText());throw error; }
 if(searchUrl.searchParams.get('IncludeImages')!=='true'||searchUrl.searchParams.get('Mode')!=='hybrid')throw Error('Missing model search controls');
 if(await section.locator('article').count()!==2)throw Error('Text/image IDs must coexist');
 await section.getByRole('button',{name:'查看 PDF 第 1 頁'}).click();await section.locator('img').waitFor();
 if(!await section.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0))throw Error('Image did not render');
 await page.screenshot({path:path.join(process.env.TEMP||'/tmp','ragyt-vector-ui-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await section.scrollIntoViewIfNeeded();
 await section.screenshot({path:path.join(process.env.TEMP||'/tmp','ragyt-vector-ui-mobile.png')});
 await page.getByLabel('搜尋方式',{exact:true}).selectOption('vector');
 await page.getByLabel('Search source type',{exact:true}).selectOption('2');
 await page.getByLabel('Source ID (optional)',{exact:true}).fill('3');
 await page.getByLabel('包含 Jina CLIP v2 圖像搜尋',{exact:true}).uncheck();
 const filtered=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/search'));
 await page.getByRole('button',{name:'Search RAG',exact:true}).click();await filtered;
 if(searchUrl.searchParams.get('Mode')!=='vector'||searchUrl.searchParams.get('SourceType')!=='2'||searchUrl.searchParams.get('SourceId')!=='3'||searchUrl.searchParams.get('IncludeImages')!=='false')throw Error('Moved search filters were not preserved');
 await page.evaluate(()=>{localStorage.setItem('ragyt_user',JSON.stringify({roles:['User']}));window.dispatchEvent(new StorageEvent('storage',{key:'ragyt_user'}));});
 await page.locator('app-vector-index-panel').waitFor({state:'detached'});
 if(await page.locator('app-vector-index-panel').count())throw Error('Ordinary users must not see admin index controls');
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS RAG Query navigation, moved filters/index controls, user/admin separation, hybrid/vector/image search, PDF preview, desktop/mobile; all APIs mocked');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
