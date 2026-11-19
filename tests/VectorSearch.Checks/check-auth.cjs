const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(test,timeout=6000){const end=Date.now()+timeout;while(!test()){if(Date.now()>end)throw Error('Timed out waiting for authentication/poll event');await wait(25);}}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage();const errors=[],writes=[];
 let statusCalls=0,aborts=0,holdNext=false,held=false,statusCode=200,lastStatusCode=0,sourceCalls=0,logins=0;
 page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>{if(new URL(r.url()).pathname.endsWith('/Rag/index/status'))aborts++;});
 await page.route('**/api/**',async route=>{
  const req=route.request(),u=new URL(req.url());let data=[],code=200;
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'}});
  if(req.method()!=='GET')writes.push(u.pathname);
  if(u.pathname.endsWith('/Auth/login')){
   const email=req.postDataJSON().email,admin=email.startsWith('admin');logins++;
   data={email,roles:[admin?'Admin':'User'],accessToken:'fixture-'+(admin?'admin':'user')+'-'+logins};
  }
  else if(u.pathname.endsWith('/Auth/admin-dashboard')){code=(req.headers().authorization??'').includes('fixture-admin')?200:403;data={message:code===200?'ok':'Forbidden'};}
  else if(u.pathname.endsWith('/Rag/index/status')){
   statusCalls++;code=statusCode;lastStatusCode=code;
   if(holdNext){holdNext=false;held=true;await wait(4000);}
   data=code===200?{state:'idle',processed:0,total:0,updated:0,supportsScopedEmbedding:true,supportsAtomicChunkEmbedding:true,supportsOriginalTextEmbedding:true}:{message:'Denied'};
  }
  else if(u.pathname.endsWith('/SourceManagement/pdf')){sourceCalls++;data=[7,8,9].map(id=>({id,name:'PDF '+id,url:'/fixture.pdf'}));}
  else if(u.pathname.endsWith('/SourceManagement/youtube')){sourceCalls++;data=[];}
  else if(req.method()!=='GET')throw Error('Unexpected backend mutation: '+u.pathname);
  try {await route.fulfill({status:code,json:data,headers:{'Access-Control-Allow-Origin':'*'}});}catch(error){if(!held)throw error;}
 });
 const login=async email=>{
  await page.locator('#login-email').fill(email);await page.locator('#login-password').fill('Fixture123!');
  await page.getByRole('button',{name:'登入',exact:true}).click();
  await page.waitForURL(email.startsWith('admin')?'**/admin-dashboard':'**/user-rag');
 };
 await page.goto('http://127.0.0.1:4200/login');await wait(2700);
 if(statusCalls)throw Error('Logged-out page polled index status');
 await login('admin@fixture.local');await page.getByRole('heading',{name:'RAG Source Console',exact:true}).waitFor();await until(()=>statusCalls>0);
 if(await page.locator('app-source-embedding-button').count()!==3)throw Error('Expected multiple source polling subscribers');
 await page.getByRole('button',{name:'RAG Query',exact:true}).click();await page.waitForURL('**/user-rag');
 await page.locator('app-vector-index-panel').waitFor();await wait(100);
 const sharedBefore=statusCalls;await wait(2700);
 if(statusCalls-sharedBefore!==1)throw Error('Cached sources and RAG Query must share one periodic status request');
 holdNext=true;await until(()=>held);
 await page.getByRole('button',{name:'Logout',exact:true}).click();await page.waitForURL('**/login');await until(()=>aborts>0);
 const signedOut=statusCalls;await wait(5500);
 if(statusCalls!==signedOut)throw Error('Polling continued after logout');
 if(await page.evaluate(()=>localStorage.getItem('ragyt_token')!==null||localStorage.getItem('ragyt_user')!==null))throw Error('Logout did not clear credentials');
 if(writes.some(p=>p.includes('/cancel')))throw Error('Logout must not cancel backend jobs');
 await login('user@fixture.local');
 if(await page.locator('app-vector-index-panel').count())throw Error('User sees admin index controls');
 if(await page.getByRole('button',{name:'Back',exact:true}).count())throw Error('User has a console navigation control');
 for(const path of ['/dashboard','/admin-dashboard']){
  const before=sourceCalls;await page.goto('http://127.0.0.1:4200'+path);await page.waitForURL('**/user-rag');
  if(sourceCalls!==before||await page.getByRole('heading',{name:'RAG Source Console',exact:true}).count())throw Error('User entered console via '+path);
  if(!await page.evaluate(()=>localStorage.getItem('ragyt_token')?.startsWith('fixture-user')))throw Error('Role denial should preserve valid User login');
 }
 // A forged local role must still fail the authoritative server Admin check.
 await page.evaluate(()=>localStorage.setItem('ragyt_user',JSON.stringify({roles:['Admin']})));
 await page.goto('http://127.0.0.1:4200/dashboard');await page.waitForURL('**/user-rag');
 if(await page.getByRole('heading',{name:'RAG Source Console',exact:true}).count())throw Error('Forged local Admin role bypassed server role check');
 if(statusCalls!==signedOut)throw Error('User account polled admin index status');
 await page.getByRole('button',{name:'Logout',exact:true}).click();await page.waitForURL('**/login');
 await page.goto('http://127.0.0.1:4200/user-rag');await page.waitForURL('**/login');
 await login('admin@fixture.local');await until(()=>statusCalls>signedOut);
 statusCode=403;await until(()=>lastStatusCode===403);const denied=statusCalls;await wait(5500);
 if(statusCalls!==denied)throw Error('403 caused an endless poll loop');
 statusCode=401;await page.getByRole('button',{name:'RAG Query',exact:true}).click();await page.waitForURL('**/login');
 const expired=statusCalls;await wait(5500);if(statusCalls!==expired)throw Error('401 caused an endless poll loop');
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS Admin-only console routes/server check, User redirects without logout, one shared poll, logout aborts in-flight request, cached pages stop polling, relogin resumes, 401/403 stop retries; all APIs mocked');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
