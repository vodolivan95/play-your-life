// Временный: снимки вкладки «Город» для проверки в облаке. Удаляется перед слиянием.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5176','--strictPort'],{stdio:'ignore'});
for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5176')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
await mkdir('work/city',{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 for(const [w,h,name] of [[1440,1000,'desktop'],[1920,1080,'desktop-wide'],[390,844,'mobile']]){
  const page=await browser.newPage({viewport:{width:w,height:h}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5176/?room-demo=sport');
  await page.locator('.live-city-canvas[data-ready=true]').waitFor();await page.waitForTimeout(2500);
  await page.locator('.coastal-city').scrollIntoViewIfNeeded();
  await page.locator('.coastal-city').screenshot({path:`work/city/${name}.png`});
  const pin=page.locator('[data-pin="health"]');
  if(await pin.count()){await pin.click();await page.waitForTimeout(400);await page.locator('.coastal-city').screenshot({path:`work/city/${name}-panel.png`});}
  else {await page.locator('.coastal-chips button').first().click();await page.waitForTimeout(300);await page.locator('.coastal-city').screenshot({path:`work/city/${name}-panel.png`});}
  console.log(name,'errors',JSON.stringify(errors));
 }
}finally{await browser.close();server.kill();}
