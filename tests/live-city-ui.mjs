import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5175','--strictPort'],{stdio:'ignore'});
for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5175')).ok)break;}catch{/* Vite запускается. */}await new Promise(r=>setTimeout(r,250));}
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('work/live-city',{recursive:true});
let browser;
const results=[];
try {
 browser=await chromium.launch({executablePath:process.env.LIFEGAME_CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const context=await browser.newContext({viewport:{width:1440,height:1100},hasTouch:true});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5175/?room-demo=sport');
 await page.locator('.live-city-canvas[data-ready=true]').waitFor();
 const start=await page.locator('.live-city-canvas').getAttribute('data-stats');
 await page.waitForTimeout(30000);
 const after=JSON.parse(await page.locator('.live-city-canvas').getAttribute('data-stats'));
 const before=JSON.parse(start);
 for(const kind of ['road','water','pedestrian'])assert.ok(after.positions.some(p=>p.kind===kind&&before.positions.some(b=>b.id===p.id&&Math.hypot(b.x-p.x,b.y-p.y)>.002)),kind+' движется');
 console.log("30-second profile",JSON.stringify({elapsed:after.elapsed,fps:after.fps,renderMs:after.renderMs,simulationMs:after.simulationMs,quality:after.quality,counts:after.counts}));
 await page.locator(".coastal-map").screenshot({path:"work/live-city/profile.png"});
 assert.ok(after.elapsed>before.elapsed+15);assert.equal(after.fountains,8);assert.equal(after.waterfalls,8);
 await page.locator('.coastal-map').screenshot({path:'work/live-city/desktop-day.png'});
 results.push({width:1440,stats:after});
 for(const width of [360,390,412,430]) {
  await page.setViewportSize({width,height:900});
  await page.locator('.coastal-map').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1300);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width);
  const bounds=await page.locator('.coastal-building').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {w:b.width,h:b.height};}));
  assert.ok(bounds.every(b=>b.w>=44&&b.h>=44),'touch targets '+width);
  const canvasBounds=await page.locator('.live-city-canvas').boundingBox();const mapBounds=await page.locator('.coastal-map').boundingBox();
  assert.ok(Math.abs(canvasBounds.width-mapBounds.width)<1);assert.ok(Math.abs(canvasBounds.height-mapBounds.height)<1);
  const mobileStats=JSON.parse(await page.locator('.live-city-canvas').getAttribute('data-stats'));
  assert.equal(mobileStats.quality,'medium');
  assert.equal(mobileStats.paused,false);
  const pixelRatio=await page.evaluate(()=>Math.min(2,devicePixelRatio));
  assert.ok(await page.locator('.live-city-canvas').evaluate((node,ratio)=>node.width>=Math.min(1400,node.getBoundingClientRect().width*ratio)-1,pixelRatio),'sharp canvas '+width);
  await page.waitForTimeout(2200);
  const moving=JSON.parse(await page.locator('.live-city-canvas').getAttribute('data-stats'));
  for(const kind of ['road','water','pedestrian'])assert.ok(moving.positions.some(p=>p.kind===kind&&mobileStats.positions.some(b=>b.id===p.id&&Math.hypot(b.x-p.x,b.y-p.y)>.0001)),kind+' mobile movement '+width);
  await page.locator('.coastal-map').screenshot({path:'work/live-city/mobile-'+width+'.png'});
  results.push({width,stats:JSON.parse(await page.locator('.live-city-canvas').getAttribute('data-stats'))});
 }
 await page.getByRole('combobox',{name:'Время города',exact:true}).selectOption('night');
 await page.getByRole('combobox',{name:'Погода города',exact:true}).selectOption('rain');
 await page.waitForTimeout(8000);
 await page.locator('.coastal-map').screenshot({path:'work/live-city/mobile-night-rain.png'});
 await page.getByRole('combobox',{name:'Погода города',exact:true}).selectOption('clear');
 await page.getByRole('combobox',{name:'Время города',exact:true}).selectOption('day');
 await page.getByRole('button',{name:'Увеличить карту',exact:true}).click();
 await page.waitForTimeout(1000);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const canvasBounds=await page.locator('.live-city-canvas').boundingBox(),mapBounds=await page.locator('.coastal-map').boundingBox();assert.ok(Math.abs(canvasBounds.width-mapBounds.width)<1);
 await page.getByRole('button',{name:'Весь остров',exact:true}).click();
 // Actual multi-touch events and wheel zoom scale the common map coordinate system.
 await page.locator('.coastal-scroll').scrollIntoViewIfNeeded();
 const touch=await context.newCDPSession(page),region=await page.locator('.coastal-scroll').boundingBox();
 const cx=region.x+region.width/2,cy=Math.max(50,Math.min(650,region.y+region.height/2));
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-35,y:cy},{x:cx+35,y:cy}]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-65,y:cy},{x:cx+65,y:cy}]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(300);
 assert.ok(await page.locator('.coastal-map').evaluate(node=>parseFloat(node.style.width)>150),'pinch enlarges map');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('button',{name:'Весь остров',exact:true}).click();
 await page.locator('.coastal-scroll').scrollIntoViewIfNeeded();const wheelBounds=await page.locator('.coastal-scroll').boundingBox();
 await page.mouse.move(wheelBounds.x+wheelBounds.width/2,Math.max(50,Math.min(650,wheelBounds.y+wheelBounds.height/2)));await page.mouse.wheel(0,-100);await page.waitForTimeout(300);
 assert.ok(await page.locator('.coastal-map').evaluate(node=>parseFloat(node.style.width)>100),'wheel enlarges map');
 await page.getByRole('button',{name:'Весь остров',exact:true}).click();
 await page.getByRole('button',{name:'⏸ Пауза',exact:true}).click();
 await page.locator('.coastal-map').scrollIntoViewIfNeeded();await page.waitForTimeout(1200);const paused=JSON.parse(await page.locator('.live-city-canvas').getAttribute('data-stats'));
 await page.waitForTimeout(1200);const paused2=JSON.parse(await page.locator('.live-city-canvas').getAttribute('data-stats'));assert.equal(paused.elapsed,paused2.elapsed);
 await page.getByRole('button',{name:'▶ Продолжить',exact:true}).click();
 for(const id of ['health','growth','finance','english','driving','together','tasks','hobby']) {
  const button=page.locator('[data-building="'+id+'"]');await button.scrollIntoViewIfNeeded();await button.click();
  await page.getByText('3D-интерьер этой сферы готовится.',{exact:false}).waitFor();await page.getByRole('button',{name:'← Вернуться в город',exact:true}).click();
 }
 await page.goto('http://127.0.0.1:5175/?room-demo=sport&city-dev=1');
 await page.locator('.city-dev-tools summary').click();await page.getByLabel('Дороги',{exact:true}).check();await page.getByLabel('FPS',{exact:true}).check();
 await page.getByLabel('ID маршрута',{exact:true}).fill('browser-test');await page.getByRole('button',{name:'Расставить точки',exact:true}).click();
 const canvas=page.locator('.live-city-canvas');await canvas.click({position:{x:40,y:100}});await canvas.click({position:{x:80,y:110}});await canvas.click({position:{x:120,y:140}});
 await page.getByRole('button',{name:'SAVE',exact:true}).click();assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('play-your-life-live-city-routes-v1')).some(r=>r.id==='browser-test')));
 await page.reload();await page.locator('.city-dev-tools summary').click();assert.equal(await page.locator('option[value="browser-test"]').count(),1);
 await page.getByRole('button',{name:'Исходные маршруты',exact:true}).click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('play-your-life-live-city-routes-v1')),null);
 assert.deepEqual(errors,[]);await context.close();
 // Reduced motion removes ambient effects and lowers budget, without freezing the transport.
 const reducedContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3,reducedMotion:'reduce'});
 const reducedPage=await reducedContext.newPage();await reducedPage.goto('http://127.0.0.1:5175/?room-demo=sport');
 await reducedPage.locator('.coastal-map').scrollIntoViewIfNeeded();await reducedPage.locator('.live-city-canvas[data-ready=true]').waitFor();
 const stopped=JSON.parse(await reducedPage.locator('.live-city-canvas').getAttribute('data-stats'));assert.equal(stopped.paused,false);assert.equal(stopped.reduced,true);assert.equal(stopped.quality,'low');
 await reducedPage.waitForTimeout(4000);
 const resumed=JSON.parse(await reducedPage.locator('.live-city-canvas').getAttribute('data-stats'));assert.equal(resumed.paused,false);assert.ok(resumed.elapsed>stopped.elapsed+1);
 for(const kind of ['road','water','pedestrian'])assert.ok(resumed.positions.some(p=>p.kind===kind&&stopped.positions.some(b=>b.id===p.id&&Math.hypot(b.x-p.x,b.y-p.y)>.0001)),kind+' resumes under reduced motion');
 assert.ok(await reducedPage.locator('.live-city-canvas').evaluate(node=>node.width>=node.getBoundingClientRect().width*2-1));
 await reducedPage.locator('.coastal-map').screenshot({path:'work/live-city/mobile-resumed.png'});await reducedContext.close();
 // Карточки: новый аккаунт только локальный, тот же путь, что в существующих quests-ui.
 const cardsContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const cards=await cardsContext.newPage();
 await cards.goto('http://127.0.0.1:5175/');
 await cards.evaluate(async()=>{const {newAccountGame}=await import('/src/accountGame.ts');const state=newAccountGame('Тест города');state.profile.onboardingComplete=true;state.coins=237;state.xp=400;localStorage.setItem('play-your-life-v1',JSON.stringify(state));});
 await cards.getByRole('button',{name:'Продолжить игру на этом устройстве'}).click();
 const oldSave=await cards.evaluate(()=>localStorage.getItem('play-your-life-v1'));
 await cards.locator('.home-spheres').scrollIntoViewIfNeeded();await cards.locator('.home-spheres img').first().waitFor();
 assert.equal(await cards.locator('.home-spheres img[data-building-source="master-city"]').count(),9);
 assert.equal(await cards.locator('.home-spheres [data-sphere-icon]').count(),9);
 assert.equal(await cards.locator('.home-spheres canvas').count(),0);
 assert.equal(await cards.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await cards.locator('.home-spheres').screenshot({path:'work/live-city/sphere-cards-mobile.png'});
 for(const width of [360,390,412,430]){await cards.setViewportSize({width,height:844});assert.equal(await cards.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'home overflow '+width);}
 await cards.reload();await cards.getByRole('button',{name:'Продолжить игру на этом устройстве'}).click();assert.equal(await cards.evaluate(()=>localStorage.getItem('play-your-life-v1')),oldSave);
 await cardsContext.close();await writeFile('work/live-city/browser-result.json',JSON.stringify({passed:true,results,errors},null,2));console.log(JSON.stringify({passed:true,viewports:results.map(r=>({width:r.width,fps:r.stats.fps,quality:r.stats.quality,counts:r.stats.counts})),errors},null,2));
} finally {await browser?.close();if(server.exitCode===null&&server.signalCode===null){const stopped=once(server,'exit');server.kill('SIGTERM');await stopped;}}
