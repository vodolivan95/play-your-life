import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { emptyTickTickSettings } from '../src/ticktickSettings.ts';

// Isolated App harness. No Firebase or TickTick account, password or real task is used.
const dir = 'work/ticktick-flow';
await mkdir(dir, { recursive: true });
const base = '/play-your-life/';
const origin = 'http://127.0.0.1:5179';
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
    s.goals = [{id:'goal-1', name:'Вылечить зубы', sphere:'english', current:0, target:100, created:'2026-10-01', reward:0, rewarded:false, progressMode:'tasks'},{id:'goal-2', name:'Бросить курить', sphere:'english', current:0, target:100, created:'2026-10-01', reward:0, rewarded:false, progressMode:'tasks'}];
    s.quests = [];
    return s;
  });
  useEffect(() => localStorage.setItem(key, JSON.stringify(state)), [state]);
  return <App state={state} onChange={setState} userId={uid === 'guest' ? undefined : uid} tickTickToken={uid === 'guest' ? undefined : async () => 'fixture-login-' + uid} />;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
`);
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5179', '--strictPort'], {
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
    else if(path === '/habits') result = {items:[],sections:[]};
    else if(path === '/habits/links') result = {revision:0,links:{},sectionMap:{},lookbackDays:90,imported:[]};
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
      if(!a.tasks.has(id)) { a.creates++; a.tasks.set(id,{...data,id,status:0,title:data.title}); }
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

const names = g => g.map(x=>x.name).sort();
try {
  let ready=false;
  for(let i=0;i<100;i++) { try { if((await fetch(home)).ok) {ready=true;break;} } catch { /* Starting. */ } await new Promise(r=>setTimeout(r,100)); }
  assert.ok(ready,output);
  browser=await chromium.launch({executablePath:process.env.LIFEGAME_CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
  const uid='flow-user'; const ctx=await context(1440); const page=await ctx.newPage(); activePage=page;
  page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto(harness(uid)+'#profile');
  await panel(page).getByRole('button',{name:'Подключить TickTick',exact:true}).click();
  await page.waitForURL(harness(uid)+'#profile');
  await panel(page).getByText('Доступ к TickTick подтверждён.',{exact:false}).waitFor();
  await panel(page).getByLabel('Список TickTick: Английский').selectOption('english');
  await panel(page).getByRole('button',{name:'Сохранить настройки'}).click();
  await panel(page).getByText('Настройки сохранены в вашем аккаунте.',{exact:false}).waitFor();
  const a = account(uid);
  const today = new Date().toISOString().slice(0,10);
  a.tasks.set('r1',{id:'r1',projectId:'english',title:'Купить билеты',status:0,dueDate:today+'T09:00:00+0000'});
  a.tasks.set('r2',{id:'r2',projectId:'english',title:'Записаться к врачу',status:0});
  await page.goto(harness(uid));
  await page.locator('.sidebar').getByRole('button',{name:/^Мои задачи/}).click();
  await page.getByRole('button',{name:/^Входящие/}).first().click();
  const inbox = page.getByRole('region',{name:'Входящие из TickTick'});
  await inbox.getByText('Купить билеты').waitFor();
  if (process.env.SHOT) {
    for (const theme of ['dark','light']) {
      await page.evaluate(t=>{document.documentElement.dataset.theme=t;document.body.style.background=t==='dark'?'#0a0f20':'#eef3fb';document.querySelectorAll('.ticktick-inbox').forEach(e=>{e.parentElement.style.background='transparent'});},theme);
      await page.waitForTimeout(300);
      await inbox.screenshot({path:`/tmp/inbox-${theme}.png`});
    }
    await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});
    await inbox.locator('li',{hasText:'Купить билеты'}).getByRole('button',{name:'Разобрать'}).click();
    await page.waitForTimeout(300);
    await inbox.screenshot({path:'/tmp/inbox-open.png'});
    await inbox.locator('li',{hasText:'Купить билеты'}).getByRole('button',{name:'Свернуть'}).click();
  }
  // 1. Одиночная задача без цели.
  const row = t => inbox.locator('li',{hasText:t});
  await row('Купить билеты').getByRole('button',{name:'Разобрать'}).click();
  await row('Купить билеты').getByRole('button',{name:'Без цели'}).click();
  await row('Купить билеты').getByRole('button',{name:'Принять в игру'}).click();
  // 2. Задача в новую цель и новый этап.
  await row('Записаться к врачу').getByRole('button',{name:'Разобрать'}).click();
  await row('Записаться к врачу').getByRole('button',{name:'Вылечить зубы'}).click();
  await row('Записаться к врачу').getByRole('button',{name:'Принять в игру'}).click();
  await page.waitForFunction(uid=>JSON.parse(localStorage.getItem('ticktick-fixture-game:'+uid)).quests.length===2,uid);
  let st = await stateOf(page,uid);
  assert.deepEqual(names(st.goals),['Бросить курить','Вылечить зубы'],'цели на месте после приёма');
  // 3. Перезагрузка: всё сохранилось и состояние валидно для загрузки приложением.
  await page.goto(harness(uid));
  await page.locator('.sidebar').getByRole('button',{name:/^Мои задачи/}).click();
  await page.getByRole('button',{name:/^Входящие/}).first().click();
  st = await stateOf(page,uid);
  assert.deepEqual(names(st.goals),['Бросить курить','Вылечить зубы'],'цели на месте после перезагрузки');
  assert.equal(st.quests.length,2);
  const valid = await page.evaluate(async uid=>{ const m = await import('/play-your-life/src/stateValidation.ts'); try { m.validateState(JSON.parse(localStorage.getItem('ticktick-fixture-game:'+uid))); return true; } catch { return false; } },uid);
  assert.equal(valid,true,'сохранение проходит validateState');
  // 4. Перенос срока в TickTick отражается в игре.
  a.tasks.get('r1').dueDate = '2026-11-20T09:00:00+0000';
  await page.getByRole('button',{name:'Обновить',exact:true}).first().click();
  await page.waitForFunction(uid=>JSON.parse(localStorage.getItem('ticktick-fixture-game:'+uid)).quests.some(q=>q.name==='Купить билеты'&&String(q.dueAt).startsWith('2026-11-20')),uid,{timeout:15000});
  // 5. Удаление в TickTick убирает задачу в игре, цели остаются.
  a.tasks.delete('r2');
  const remoteDeleted = [...a.tasks.keys()];
  await page.getByRole('button',{name:'Обновить',exact:true}).first().click();
  await page.waitForFunction(uid=>JSON.parse(localStorage.getItem('ticktick-fixture-game:'+uid)).quests.length===1,uid,{timeout:15000});
  st = await stateOf(page,uid);
  assert.deepEqual(names(st.goals),['Бросить курить','Вылечить зубы'],'удаление в TickTick не удаляет цели');
  assert.ok(remoteDeleted.includes('r1'));
  // 6. Выполнение в TickTick отмечает задачу в игре.
  a.tasks.get('r1').status = 2;
  await page.getByRole('button',{name:'Обновить',exact:true}).first().click();
  await page.waitForFunction(uid=>JSON.parse(localStorage.getItem('ticktick-fixture-game:'+uid)).quests.some(q=>q.name==='Купить билеты'&&q.done),uid,{timeout:15000});
  st = await stateOf(page,uid);
  assert.equal(names(st.goals).length,2);
  console.log('TickTick flow UI passed: inbox accept (single + goal), reload keeps goals, due date move, remote delete, remote complete. Mock services only.');
} catch (error) {
  console.error('Fixture requests:', JSON.stringify(calls));
  console.error('Fixture page errors:', JSON.stringify(pageErrors));
  if (activePage) { console.error('Fixture UI:', (await activePage.locator('body').innerText()).slice(0,1500)); await activePage.screenshot({path:`${dir}/failure.png`,fullPage:true}); }
  throw error;
} finally {
  await browser?.close(); server.kill();
  await rm(`${dir}/harness.html`,{force:true}); await rm(`${dir}/harness.tsx`,{force:true});
}
