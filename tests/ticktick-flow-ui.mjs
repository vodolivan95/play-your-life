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
const demo = uid === 'demo';
const key = 'ticktick-fixture-game:' + uid;
function Fixture() {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem(key); if(saved) return JSON.parse(saved);
    const s = newAccountGame('Тестовый игрок'); s.profile.onboardingComplete = true; s.profile.mode = demo ? 'demo' : 'personal';
    s.goals = [{id:'goal-1', name:'Вылечить зубы', sphere:'english', current:0, target:100, created:'2026-10-01', reward:0, rewarded:false, progressMode:'tasks',stages:[{id:'stage-1',name:'Первый визит',status:'active',completionMode:'tasks'}]},{id:'goal-2', name:'Бросить курить', sphere:'english', current:0, target:100, created:'2026-10-01', reward:0, rewarded:false, progressMode:'tasks'}];
    s.quests = [];
    return s;
  });
  useEffect(() => localStorage.setItem(key, JSON.stringify(state)), [state]);
  return <App state={state} onChange={setState} userId={uid === 'guest' || demo ? undefined : uid} tickTickToken={uid === 'guest' || demo ? undefined : async () => 'fixture-login-' + uid} />;
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
  await row('Купить билеты').getByRole('button',{name:'Без проекта'}).click();
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
  // 7. Из сферы открывается нативный inbox-dialog поверх той же страницы.
  a.tasks.set('scope-1',{id:'scope-1',projectId:'english',title:'Разобрать из сферы',status:0});
  await page.locator('.sidebar').getByRole('button',{name:/^Сферы жизни/}).click();
  const englishCard = page.locator('.sph-card').filter({hasText:'Английский'}).first();
  await englishCard.locator('.sph-card-photo').click();
  const quick = page.getByRole('dialog',{name:'Сфера Английский',exact:true});
  await quick.getByRole('button',{name:'Открыть район',exact:true}).click();
  const scene = page.locator('.sph-scene');
  await scene.getByRole('heading',{name:'Английский',exact:true}).waitFor();
  const sphereUrl = page.url();
  await scene.getByRole('button',{name:'Разобрать входящие',exact:true}).click();
  const sphereInboxDialog = page.getByRole('dialog',{name:'Разобрать входящие: Английский',exact:true});
  await sphereInboxDialog.waitFor();
  assert.equal(page.url(),sphereUrl,'разбор из сферы не меняет страницу');
  assert.equal(await scene.isVisible(),true,'диалог остаётся поверх открытой сферы');
  const sphereInbox = sphereInboxDialog.getByRole('region',{name:'Входящие из TickTick'});
  const scopeRow = sphereInbox.locator('li',{hasText:'Разобрать из сферы'});
  await scopeRow.waitFor();
  await scopeRow.getByRole('button',{name:'Разобрать',exact:true}).click();
  const sphereChoices = scopeRow.getByRole('group',{name:'Сфера'});
  assert.equal(await sphereChoices.getByRole('button').count(),1,'в scope остаётся ровно одна сфера');
  assert.equal(await sphereChoices.getByRole('button',{name:/Английский/}).getAttribute('aria-pressed'),'true');
  await page.keyboard.press('Escape');
  await sphereInboxDialog.waitFor({state:'detached'});

  // 8. Меню цели предвыбирает цель и этап, но оставляет выбор другой цели,
  // одиночной задачи и создание новых сущностей в той же сфере.
  await page.goto(harness(uid)+'#/goals/goal-1/stages/stage-1');
  const workspace = page.locator('.gw-workspace');
  await workspace.waitFor();
  await workspace.locator('summary[aria-label="Дополнительные действия проекта"]').click();
  await workspace.getByRole('button',{name:'Разобрать входящие',exact:true}).click();
  const goalInboxDialog = page.getByRole('dialog',{name:'Разобрать входящие: Английский',exact:true});
  await goalInboxDialog.waitFor();
  assert.equal(await page.locator('dialog[open]').count(),1,'в меню цели открыт один native dialog');
  const goalInbox = goalInboxDialog.getByRole('region',{name:'Входящие из TickTick'});
  const goalRow = goalInbox.locator('li',{hasText:'Разобрать из сферы'});
  await goalRow.waitFor();
  await goalRow.getByRole('button',{name:'Разобрать',exact:true}).click();
  const goalChoices = goalRow.getByRole('group',{name:'Проект'});
  const stageChoices = goalRow.getByRole('group',{name:'Этап'});
  assert.equal(await goalChoices.getByRole('button',{name:'Вылечить зубы',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await stageChoices.getByRole('button',{name:'Первый визит',exact:true}).getAttribute('aria-pressed'),'true');
  await goalChoices.getByRole('button',{name:'Бросить курить',exact:true}).click();
  assert.equal(await goalChoices.getByRole('button',{name:'Бросить курить',exact:true}).getAttribute('aria-pressed'),'true');
  await goalChoices.getByRole('button',{name:'Без проекта',exact:true}).click();
  assert.equal(await goalChoices.getByRole('button',{name:'Без проекта',exact:true}).getAttribute('aria-pressed'),'true');
  await goalChoices.getByRole('button',{name:'＋ Новый проект',exact:true}).click();
  await goalRow.getByLabel('Название нового проекта').fill('Проект из входящих');
  await goalRow.getByRole('button',{name:'Создать проект',exact:true}).click();
  await goalChoices.getByRole('button',{name:'Проект из входящих',exact:true}).waitFor();
  assert.equal(await goalChoices.getByRole('button',{name:'Проект из входящих',exact:true}).getAttribute('aria-pressed'),'true');
  const newStageChoices = goalRow.getByRole('group',{name:'Этап'});
  await newStageChoices.getByRole('button',{name:'＋ Новый этап',exact:true}).click();
  await goalRow.getByLabel('Название нового этапа').fill('Этап из входящих');
  await goalRow.getByRole('button',{name:'Создать этап',exact:true}).click();
  assert.equal(await newStageChoices.getByRole('button',{name:'Этап из входящих',exact:true}).getAttribute('aria-pressed'),'true');
  await goalRow.getByRole('button',{name:'Принять в игру',exact:true}).click();
  await page.waitForFunction(uid=>{
    const s=JSON.parse(localStorage.getItem('ticktick-fixture-game:'+uid));
    const g=s.goals.find(g=>g.name==='Проект из входящих');
    return Boolean(g?.stages?.some(stage=>stage.name==='Этап из входящих')&&s.quests.some(q=>q.name==='Разобрать из сферы'&&q.goalId===g.id&&q.stageId===g.stages.find(stage=>stage.name==='Этап из входящих').id));
  },uid,{timeout:15000});
  st = await stateOf(page,uid);
  const importedGoal = st.goals.find(g=>g.name==='Проект из входящих');
  const importedTask = st.quests.find(q=>q.name==='Разобрать из сферы');
  assert.equal(importedTask.goalId,importedGoal.id);
  assert.equal(importedTask.stageId,importedGoal.stages.find(s=>s.name==='Этап из входящих').id);
  await goalInboxDialog.getByRole('button',{name:'Закрыть',exact:true}).click();

  // 9. «Задачи в TickTick» переключает тот же native dialog на inbox, не вкладывая диалоги.
  // <details> не размонтируется при смене editor и остаётся раскрытым после шага 8.
  await workspace.getByRole('button',{name:'Задачи в TickTick',exact:true}).click();
  const connectionDialog = page.getByRole('dialog',{name:'Подключение TickTick',exact:true});
  await connectionDialog.waitFor();
  assert.equal(await page.locator('dialog[open]').count(),1);
  await connectionDialog.getByRole('button',{name:'Разобрать входящие',exact:true}).click();
  const switchedInboxDialog = page.getByRole('dialog',{name:'Разобрать входящие: Английский',exact:true});
  await switchedInboxDialog.getByRole('heading',{name:'Разобрать входящие',exact:true}).waitFor();
  assert.equal(await page.locator('dialog[open]').count(),1,'переключение не создаёт вложенный dialog');
  await page.keyboard.press('Escape');
  await switchedInboxDialog.waitFor({state:'hidden'});

  // 10. В demo диалог не пуст: объясняет ограничение и показывает TickTickConnection.
  const demoCtx=await context(1440); const demoPage=await demoCtx.newPage();
  await demoPage.goto(harness('demo'));
  await demoPage.locator('.sidebar').getByRole('button',{name:/^Сферы жизни/}).click();
  const demoCard=demoPage.locator('.sph-card').filter({hasText:'Английский'}).first();
  await demoCard.locator('.sph-card-photo').click();
  const demoQuick=demoPage.getByRole('dialog',{name:'Сфера Английский',exact:true});
  await demoQuick.getByRole('button',{name:'Открыть район',exact:true}).click();
  await demoPage.locator('.sph-scene').getByRole('button',{name:'Разобрать входящие',exact:true}).click();
  const demoInboxDialog=demoPage.getByRole('dialog',{name:'Разобрать входящие: Английский',exact:true});
  await demoInboxDialog.getByText('В демо-игре входящие недоступны. Войди в личный аккаунт и подключи TickTick.',{exact:true}).waitFor();
  await demoInboxDialog.getByRole('region',{name:'Настройки TickTick'}).getByText('Демо и игра на устройстве не передаются в TickTick.',{exact:false}).waitFor();
  await demoInboxDialog.getByRole('button',{name:'Закрыть',exact:true}).click();
  await demoInboxDialog.waitFor({state:'detached'});
  await demoCtx.close();

  // 11. Offline-ветка также обязана объяснять состояние, а не оставлять пустой inbox.
  await page.locator('.sidebar').getByRole('button',{name:/^Сферы жизни/}).click();
  const returnCard=page.locator('.sph-card').filter({hasText:'Английский'}).first();
  await returnCard.locator('.sph-card-photo').click();
  const returnQuick=page.getByRole('dialog',{name:'Сфера Английский',exact:true});
  await returnQuick.getByRole('button',{name:'Открыть район',exact:true}).click();
  await ctx.setOffline(true);
  await page.locator('.sph-scene').getByRole('button',{name:'Разобрать входящие',exact:true}).click();
  const offlineInboxDialog=page.getByRole('dialog',{name:'Разобрать входящие: Английский',exact:true});
  await offlineInboxDialog.getByText(/Изменения задач сохранены в игре/i).waitFor();
  await offlineInboxDialog.getByRole('region',{name:'Настройки TickTick'}).waitFor();
  await ctx.setOffline(false);
  console.log('TickTick flow UI passed: inbox accept, scope from sphere/goal/stage, native dialog switch, demo and offline states. Mock services only.');
} catch (error) {
  console.error('Fixture requests:', JSON.stringify(calls));
  console.error('Fixture page errors:', JSON.stringify(pageErrors));
  if (activePage) { console.error('Fixture UI:', (await activePage.locator('body').innerText()).slice(0,1500)); await activePage.screenshot({path:`${dir}/failure.png`,fullPage:true}); }
  throw error;
} finally {
  await browser?.close(); server.kill();
  await rm(`${dir}/harness.html`,{force:true}); await rm(`${dir}/harness.tsx`,{force:true});
}
