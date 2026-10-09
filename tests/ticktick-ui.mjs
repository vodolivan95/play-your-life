import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { emptyTickTickSettings } from '../src/ticktickSettings.ts';

// Isolated App harness. No Firebase or TickTick account, password or real task is used.
const dir = 'work/ticktick';
await mkdir(dir, { recursive: true });
const base = '/play-your-life/';
const origin = 'http://127.0.0.1:5178';
const bridge = 'https://ticktick-bridge.example';
const home = origin + base;
await writeFile(`${dir}/harness.html`, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/${dir}/harness.tsx"></script></body></html>`);
await writeFile(`${dir}/harness.tsx`, `
import React, {useState, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import App from '../../src/App';
import {newAccountGame} from '../../src/accountGame';
import '../../src/styles.css'; import '../../src/interface.css'; import '../../src/components/AdaptiveLayout.css';
const uid = new URLSearchParams(location.search).get('uid') || 'guest';
const key = 'ticktick-fixture-game:' + uid;
function Fixture() {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem(key); if(saved) return JSON.parse(saved);
    const s = newAccountGame('Тестовый игрок'); s.profile.onboardingComplete = true;
    s.goals = [{id:'goal-1', name:'Моя цель', sphere:'english', current:0, target:1, created:'2026-10-01', reward:0, rewarded:false, progressMode:'tasks'}];
    s.quests = [{id:'task-' + uid, name:'Учить слова', sphere:'english', xp:20, difficulty:'Medium', done:false, goalId:'goal-1', ownerId:uid}];
    return s;
  });
  useEffect(() => localStorage.setItem(key, JSON.stringify(state)), [state]);
  return <App state={state} onChange={setState} userId={uid === 'guest' ? undefined : uid} tickTickToken={uid === 'guest' ? undefined : async () => 'fixture-login-' + uid} />;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
`);
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5178', '--strictPort'], {
  env: { ...process.env, VITE_BASE_PATH: base, VITE_TICKTICK_BRIDGE_URL: bridge }, stdio: ['ignore','pipe','pipe'],
});
let output = ''; server.stdout.on('data', x => { output += String(x); }); server.stderr.on('data', x => { output += String(x); });
const accounts = new Map();
const account = uid => {
  if (!accounts.has(uid)) accounts.set(uid, { connected: false, settings: emptyTickTickSettings(), tasks: new Map(), creates: 0 });
  return accounts.get(uid);
};
const calls = [];
let browser;
let activePage;
const pageErrors=[];
const harness = uid => `${home}${dir}/harness.html?uid=${uid}`;
async function context(width) {
  const ctx = await browser.newContext({ viewport: { width, height: 950 }, isMobile: width < 600, hasTouch: width < 600 });
  await ctx.route(bridge + '/**', async route => {
    const r = route.request();
    const uid = r.headers().authorization?.replace('Bearer fixture-login-', '');
    const path = new URL(r.url()).pathname;
    const method = r.method();
    if (method === 'OPTIONS') { await route.fulfill({ status:204, headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS'} }); return; }
    assert.ok(uid && uid !== 'guest');
    const a = account(uid); const data = r.postDataJSON();
    if (a.unavailable) { await route.abort('internetdisconnected'); return; }
    calls.push({uid,path,method});
    let status = 200, result;
    if(path === '/status') result = {connected:a.connected};
    else if(path === '/authorize') result = {url:'https://ticktick.com/oauth/authorize?state=' + uid};
    else if(path === '/settings' && method === 'GET') result = a.settings;
    else if(path === '/settings' && method === 'PUT') {
      if(data.revision !== a.settings.revision) { status=409; result={error:'Настройки изменены на другом устройстве. Обнови подключение перед сохранением.'}; }
      else { a.settings={...data,revision:data.revision+1}; result=a.settings; }
    }
    else if(path === '/api/project') result = [{id:'english',name:'Мой английский'},{id:'fitness',name:'Тренировки'},{id:'budget',name:'Личный бюджет'},{id:'notes',name:'Заметки',kind:'NOTE'}];
    else if(path.endsWith('/data')) result = {tasks:[...a.tasks.values()].filter(t=>t.projectId===path.split('/')[3] && t.status!==2).concat([{id:'foreign',projectId:'english',title:'Посторонняя задача',status:0}])};
    else if(path === '/create') {
      const id='remote-'+data.localId;
      if(!a.tasks.has(id)) { a.creates++; a.tasks.set(id,{...data,id,status:0}); }
      result=a.tasks.get(id);
    }
    else if(path === '/disconnect') { a.connected=false; a.settings=emptyTickTickSettings(a.settings.revision+1); result={connected:false}; }
    else if(path.includes('/task/')) {
      const id=path.split('/').at(path.endsWith('/complete')?-2:-1);
      const task=a.tasks.get(id);
      if(!task) { status=404; result={error:'Не найдено'}; }
      else if(path.endsWith('/complete')) {task.status=2; result=null;}
      else if(method==='POST') {result={...task,...data};a.tasks.set(id,result);}
      else result=task;
    } else throw new Error('Unexpected fixture route: '+path);
    await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin},body:JSON.stringify(result)});
  });
  await ctx.route('https://ticktick.com/oauth/authorize**', async route => {
    const uid = new URL(route.request().url()).searchParams.get('state');
    const a=account(uid); a.connected=true; a.settings=emptyTickTickSettings(a.settings.revision+1);
    await route.fulfill({contentType:'text/html',body:`<script>location.replace(${JSON.stringify(harness(uid)+'#ticktick=connected')})</script>`});
  });
  return ctx;
}
const panel = page => page.getByRole('region', {name:'Настройки TickTick'});
const stateOf = (page,uid) => page.evaluate(uid=>JSON.parse(localStorage.getItem('ticktick-fixture-game:'+uid)),uid);
try {
  let ready=false;
  for(let i=0;i<100;i++) {
    try { if((await fetch(home)).ok) {ready=true;break;} } catch { /* Starting. */ }
    await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(ready,output);
  browser=await chromium.launch({executablePath:process.env.LIFEGAME_CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const width of [1440,390]) {
    const uid='user-'+width;
    const ctx=await context(width); const page=await ctx.newPage();
    activePage=page;
    const errors=[]; page.on('pageerror',e=>{errors.push(e.message);pageErrors.push(e.message);});
    await page.clock.install();
    await page.goto(harness(uid)+'#profile');
    await panel(page).getByText('Аккаунт TickTick не подключён', {exact:false}).waitFor();
    assert.equal(await panel(page).locator('.ticktick-badge').innerText(),'Не подключён');
    assert.equal(await page.getByRole('button',{name:'Восстановить из файла'}).isDisabled(),false,'unconfigured TickTick cannot block game restores');
    const idleCalls=calls.filter(c=>c.uid===uid).length;
    await page.clock.runFor(60010);
    assert.equal(calls.filter(c=>c.uid===uid).length,idleCalls,'users without TickTick do not poll the bridge every minute');
    await page.clock.resume();
    await panel(page).getByRole('button',{name:'Подключить TickTick',exact:true}).click();
    await page.waitForURL(harness(uid)+'#profile');
    await panel(page).getByText('Доступ к TickTick подтверждён.',{exact:false}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Восстановить из файла'}).isDisabled(),true,'confirmed connections protect restored plans from automatic export');
    assert.equal(await panel(page).locator('select').count(),9);
    assert.equal(await panel(page).getByLabel('Обновлять автоматически, пока приложение открыто').isChecked(),false);
    assert.equal(await panel(page).getByLabel('Список TickTick: Английский').locator('option').filter({hasText:'Заметки'}).count(),0);
    await panel(page).getByLabel('Список TickTick: Английский').selectOption('english');
    await panel(page).getByLabel('Список TickTick: Спорт').selectOption('fitness');
    assert.equal(await panel(page).getByRole('button',{name:'Синхронизировать сейчас'}).isDisabled(),true);
    assert.equal(account(uid).creates,0);
    await panel(page).getByRole('button',{name:'Сохранить настройки'}).click();
    await panel(page).getByText('Настройки сохранены в вашем аккаунте.',{exact:false}).waitFor();
    assert.equal(account(uid).settings.sphereLists.sport,'fitness');
    await panel(page).getByRole('button',{name:'Синхронизировать сейчас'}).click();
    await panel(page).getByText('Связанные задачи целей синхронизированы.',{exact:true}).waitFor();
    assert.equal(account(uid).creates,1); assert.equal((await stateOf(page,uid)).quests.length,1);
    const nextCtx=await context(width); const nextPage=await nextCtx.newPage();
    await nextPage.goto(harness(uid)+'#profile');
    await panel(nextPage).getByText('Доступ к TickTick подтверждён.',{exact:false}).waitFor();
    assert.equal(await panel(nextPage).getByLabel('Список TickTick: Спорт').inputValue(),'fitness');
    assert.ok(account(uid).settings.links['task-'+uid]);
    // A stale device cannot overwrite settings saved elsewhere.
    await panel(page).getByLabel('Список TickTick: Финансы').selectOption('budget');
    account(uid).settings={...account(uid).settings,revision:account(uid).settings.revision+1};
    await panel(page).getByRole('button',{name:'Сохранить настройки'}).click();
    await panel(page).getByText('Настройки изменены на другом устройстве.',{exact:false}).waitFor();
    assert.equal(account(uid).settings.sphereLists.finance,undefined);
    page.once('dialog',d=>d.accept());
    await panel(page).getByRole('button',{name:'Обновить подключение'}).click();
    await panel(page).getByText('Доступ к TickTick подтверждён.',{exact:false}).waitFor();
    await panel(page).getByLabel('Обновлять автоматически, пока приложение открыто').check();
    await panel(page).getByRole('button',{name:'Сохранить настройки'}).click();
    await panel(page).getByText('Настройки сохранены в вашем аккаунте.',{exact:false}).waitFor();
    await ctx.setOffline(true);
    account(uid).tasks.get('remote-task-'+uid).status=2;
    await panel(page).getByRole('button',{name:'Синхронизировать сейчас'}).click();
    await panel(page).getByText('Нет сети.',{exact:false}).waitFor();
    assert.equal((await stateOf(page,uid)).xp,0);
    await ctx.setOffline(false);
    await page.waitForFunction(uid => JSON.parse(localStorage.getItem('ticktick-fixture-game:'+uid)).xp === 20, uid);
    await panel(page).getByText('Связанные задачи целей синхронизированы.',{exact:true}).waitFor();
    assert.equal((await stateOf(page,uid)).xp,20); assert.equal((await stateOf(page,uid)).quests[0].done,true);
    await page.reload();
    await panel(page).getByText('Доступ к TickTick подтверждён.',{exact:false}).waitFor();
    await panel(page).getByRole('button',{name:'Синхронизировать сейчас'}).click();
    await panel(page).getByText('Связанные задачи целей синхронизированы.',{exact:true}).waitFor();
    assert.equal((await stateOf(page,uid)).xp,20); assert.equal(account(uid).creates,1);
    // The application itself loads from localhost while its integration server is offline.
    account(uid).unavailable=true;
    await page.reload();
    await panel(page).locator('.transfer-message').waitFor();
    assert.equal(await panel(page).locator('.ticktick-badge').innerText(),'Не подключён');
    assert.equal(await page.getByRole('button',{name:'Восстановить из файла'}).isDisabled(),true,'known active connections remain protected while offline');
    account(uid).unavailable=false;
    await page.evaluate(()=>window.dispatchEvent(new Event('online')));
    await panel(page).getByText('Доступ к TickTick подтверждён.',{exact:false}).waitFor();
    assert.equal(await panel(page).getByLabel('Обновлять автоматически, пока приложение открыто').isChecked(),true);
    assert.equal((await stateOf(page,uid)).xp,20);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes('fixture-login-')),false);
    await panel(page).scrollIntoViewIfNeeded(); await page.screenshot({path:`${dir}/profile-${width}.png`,fullPage:true});
    const strangerCtx=await context(width); const stranger=await strangerCtx.newPage();
    await stranger.goto(harness('other-'+width)+'#profile');
    await panel(stranger).getByText('Аккаунт TickTick не подключён',{exact:false}).waitFor();
    assert.equal(await panel(stranger).locator('select').count(),0);
    const before=await stateOf(page,uid); page.once('dialog',d=>d.accept());
    await panel(page).getByRole('button',{name:'Отключить TickTick'}).click();
    await panel(page).getByText('TickTick отключён. Задачи и прогресс',{exact:false}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Восстановить из файла'}).isDisabled(),false);
    assert.deepEqual(await stateOf(page,uid),before); assert.equal(account(uid).tasks.size,1);
    assert.deepEqual(errors,[]);
    await ctx.close(); await nextCtx.close(); await strangerCtx.close();
  }
  const guestCtx=await context(390); const guest=await guestCtx.newPage(); const before=calls.length;
  await guest.goto(harness('guest')+'#profile');
  await panel(guest).getByText('Войдите или зарегистрируйтесь',{exact:false}).waitFor();
  assert.equal(calls.length,before); assert.equal(await panel(guest).locator('select').count(),0); await guestCtx.close();
  const migrationCtx=await context(390); const migrationUid='legacy-account';
  await migrationCtx.addInitScript(({bridge,uid})=>localStorage.setItem('play-your-life-ticktick-v1:'+uid,JSON.stringify({url:bridge,key:'b'.repeat(64),auth:'firebase',projectId:'',revision:2,sphereLists:{english:'english'},auto:true,deleteRemote:false,links:{},dismissed:[]})),{bridge,uid:migrationUid});
  account(migrationUid).unavailable=true;
  const migrated=await migrationCtx.newPage();
  await migrated.goto(harness(migrationUid)+'#profile');
  await panel(migrated).locator('.transfer-message').waitFor();
  assert.equal(await migrated.getByRole('button',{name:'Восстановить из файла'}).isDisabled(),true,'previously configured accounts stay protected even with no linked tasks');
  assert.equal(await migrated.evaluate(uid=>JSON.parse(localStorage.getItem('play-your-life-ticktick-v1:'+uid)).activated,migrationUid),true);
  await migrationCtx.close();
  console.log('TickTick UI passed: profile, OAuth return, nine mappings, account/device isolation, conflicts, offline, reload, one-time XP, disconnect. Mock services only.');
} catch (error) {
  console.error('Fixture requests:', JSON.stringify(calls));
  console.error('Fixture page errors:', JSON.stringify(pageErrors));
  console.error('Fixture server:',output);
  if (activePage) {
    console.error('Fixture UI:', await activePage.locator('body').innerText());
    await activePage.screenshot({path:`${dir}/failure.png`,fullPage:true});
  }
  throw error;
} finally {
  await browser?.close(); server.kill();
  await rm(`${dir}/harness.html`,{force:true}); await rm(`${dir}/harness.tsx`,{force:true});
}
