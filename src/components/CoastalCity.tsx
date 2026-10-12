import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { spheres } from '../game';
import type { GameState } from '../game';
import { coastalHitShapes, wideBuildings } from '../coastalCity';
import { buildingState } from '../city';
import wideMapUrl from '../assets/city-wide.webp';
import { validRoutes } from '../cityLive/paths';
import type { CityRoute, Point, RouteKind } from '../cityLive/paths';
import { readRoutes } from '../cityLive/simulation';
import { wideProfile } from '../cityLive/wideMap';
import type { Quality } from '../cityLive/simulation';
import type { CityTime, DebugFlags } from '../cityLive/render';
import LiveCityCanvas from './LiveCityCanvas';
import { sphereCards } from '../sphereDetails';
import './CoastalCity.css';
import { useCityZoom } from '../cityLive/useCityZoom';

const weatherOptions = [
  ['clear','Ясно'],['partlyCloudy','Переменная облачность'],['cloudy','Облачно'],
  ['rain','Дождь'],['thunderstorm','Гроза'],['fog','Туман'],['snow','Снег'],
];
const preferenceKey='play-your-life-live-city-view-v1';
function readPreferences():{time:CityTime;weather:string;quality:Quality} {
  try {
    const value=JSON.parse(localStorage.getItem(preferenceKey)??'{}');
    return {time:['auto','day','sunset','night','sunrise'].includes(value.time)?value.time:'auto',
      weather:weatherOptions.some(([id])=>id===value.weather)?value.weather:'clear',
      quality:['auto','high','medium','low'].includes(value.quality)?value.quality:'auto'};
  } catch {return {time:'auto',weather:'clear',quality:'auto'};}
}
const wideQuery='(min-width: 1000px)';
function useWide() {
  const [wide,setWide]=useState(()=>typeof matchMedia==='function'&&matchMedia(wideQuery).matches);
  useEffect(()=>{
    if(typeof matchMedia!=='function')return;
    const q=matchMedia(wideQuery),on=()=>setWide(q.matches);
    q.addEventListener('change',on);return()=>q.removeEventListener('change',on);
  },[]);
  return wide;
}
const debugDefaults:DebugFlags={road:false,water:false,pedestrian:false,hitboxes:false,spawn:false,intersections:false,fps:false};
const debugLabels:Record<keyof DebugFlags,string>={road:'Дороги',water:'Водные пути',pedestrian:'Пути NPC',hitboxes:'Hitboxes',spawn:'Входы / выходы',intersections:'Перекрёстки',fps:'FPS'};

export default function CoastalCity({ state,onOpen,paused,speed }: {
  state:GameState;onOpen:(id:string)=>void;paused:boolean;speed:number;
}) {
  const {zoom,setZoom,scroll}=useCityZoom();
  const wide=useWide();
  const cards=useMemo(()=>sphereCards(state),[state]);
  const [picked,setPicked]=useState<string|null>(null);
  const current=cards.find(c=>c.id===picked)??null;
  const [preferences,setPreferences]=useState(readPreferences);
  // Одна горизонтальная карта острова для ПК и телефона; на телефоне она шире экрана и листается.
  const profile=wideProfile,buildings=wideBuildings;
  const [routes,setRoutes]=useState<CityRoute[]>(()=>{try{return readRoutes(localStorage,profile);}catch{return profile.routes;}});
  const [debug,setDebug]=useState(debugDefaults);
  const dev=new URLSearchParams(window.location.search).get('city-dev')==='1';
  const [editing,setEditing]=useState(false),[mode,setMode]=useState<RouteKind>('road');
  const [draft,setDraft]=useState<Point[]>([]),[routeId,setRouteId]=useState('custom-road'),[closed,setClosed]=useState(false);
  const [message,setMessage]=useState(''),[selected,setSelected]=useState('');
  useEffect(()=>{try{localStorage.setItem(preferenceKey,JSON.stringify(preferences));}catch{/* Игра не зависит от доступности настройки карты. */}},[preferences]);
  const save=()=>{
    const existing=routes.find(r=>r.id===routeId);
    const route:CityRoute={...existing,id:routeId,kind:mode,points:draft,closed,speed:existing?.speed??(mode==='road'?18:mode==='water'?9:4),capacity:existing?.capacity??(mode==='road'?2:1)};
    const next=[...routes.filter(r=>r.id!==routeId),route];
    if (!validRoutes(next)) {setMessage('Нужны минимум три разные точки и ID из латинских букв, цифр, дефиса.');return;}
    try {localStorage.setItem(profile.storageKey,JSON.stringify(next));setRoutes(next);setDraft([]);setEditing(false);setMessage('Маршрут сохранён на этом устройстве. Экспортируй JSON для переноса в проект.');}
    catch {setMessage('Хранилище недоступно. Экспортируй JSON перед закрытием страницы.');}
  };
  const exportRoutes=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(routes,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='play-your-life-city-routes.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <div className="coastal-city">
    <div className="coastal-controls" aria-label="Вид города">
      <label>Время <select aria-label="Время города" value={preferences.time} onChange={e=>setPreferences({...preferences,time:e.target.value as CityTime})}>
        <option value="auto">Авто · цикл дня</option><option value="day">День</option><option value="sunset">Закат</option><option value="night">Ночь</option><option value="sunrise">Рассвет</option>
      </select></label>
      <label>Погода <select aria-label="Погода города" value={preferences.weather} onChange={e=>setPreferences({...preferences,weather:e.target.value})}>
        {weatherOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Качество <select aria-label="Качество города" value={preferences.quality} onChange={e=>setPreferences({...preferences,quality:e.target.value as Quality})}>
        <option value="auto">AUTO</option><option value="high">HIGH</option><option value="medium">MEDIUM</option><option value="low">LOW</option>
      </select></label>
      <div className="coastal-zoom" aria-label="Масштаб карты">
        <button aria-label="Уменьшить карту" disabled={zoom===1} onClick={()=>setZoom(Math.max(1,zoom-.5))}>−</button>
        <button onClick={()=>setZoom(1)}>Весь остров</button>
        <button aria-label="Увеличить карту" disabled={zoom>=3} onClick={()=>setZoom(Math.min(3,zoom+.5))}>+</button>
      </div>
    </div>
    {dev&&<details className="city-dev-tools">
      <summary>DEV MODE · маршруты и диагностика</summary>
      <div className="city-debug-flags">{(Object.keys(debug) as (keyof DebugFlags)[]).map(key=><label key={key}><input type="checkbox" checked={debug[key]} onChange={e=>setDebug({...debug,[key]:e.target.checked})}/>{debugLabels[key]}</label>)}</div>
      <p>Пути показаны в координатах оригинала. Новые пути проверяй на карте: редактор не распознаёт дороги по фотографии.</p>
      <div className="city-route-editor">
        <label>Маршрут <select aria-label="Выбрать маршрут" value={selected} onChange={e=>{
          setSelected(e.target.value);const r=routes.find(r=>r.id===e.target.value);
          if (r) {setDraft(r.points);setMode(r.kind);setClosed(r.closed);setRouteId(r.id);setEditing(true);}
          else {setDraft([]);setRouteId(`custom-${mode}`);setClosed(false);}
        }}><option value="">Новый маршрут</option>{routes.map(r=><option key={r.id} value={r.id}>{r.id}</option>)}</select></label>
        <label>Тип <select aria-label="Тип маршрута" value={mode} onChange={e=>setMode(e.target.value as RouteKind)}><option value="road">ROAD</option><option value="water">WATER</option><option value="pedestrian">PEDESTRIAN</option></select></label>
        <label>ID <input aria-label="ID маршрута" value={routeId} maxLength={64} onChange={e=>setRouteId(e.target.value)}/></label>
        <label><input type="checkbox" checked={closed} onChange={e=>setClosed(e.target.checked)}/>Замкнутый</label>
        <button aria-pressed={editing} onClick={()=>setEditing(!editing)}>{editing?'Закончить расстановку':'Расставить точки'}</button>
        <button disabled={!draft.length} onClick={()=>setDraft(draft.slice(0,-1))}>Отменить точку</button>
        <button disabled={draft.length<3} onClick={save}>SAVE</button>
        <button onClick={exportRoutes}>Экспорт JSON</button>
        <button onClick={()=>{try{localStorage.removeItem(profile.storageKey);setRoutes(profile.routes);setDraft([]);setEditing(false);setSelected('');setMessage('Исходные маршруты восстановлены.');}catch{setMessage('Не удалось восстановить маршруты.');}}}>Исходные маршруты</button>
        <label>Импорт JSON <input type="file" accept="application/json,.json" aria-label="Импорт маршрутов" onChange={async e=>{
          const file=e.target.files?.[0];if (!file)return;
          try {if(file.size>600000)throw Error();const value=JSON.parse(await file.text());if(!validRoutes(value))throw Error();localStorage.setItem(profile.storageKey,JSON.stringify(value));setRoutes(value);setMessage('Маршруты импортированы.');}
          catch{setMessage('Не удалось импортировать: проверь формат и координаты JSON.');}
        }}/></label>
      </div>
      <p role="status">{message||`${draft.length} точек · SAVE сохраняет только маршруты; прогресс игры не изменяется.`}</p>
    </details>}
    <p className="coastal-hint" id="coastal-hint">{editing?'Нажимай на карту, чтобы добавить точки маршрута.':'Нажми на здание, чтобы войти. Подпись района или список — карточка района. Приближай колёсиком мыши или двойным щелчком к курсору, листай перетаскиванием; на телефоне — двумя пальцами.'}</p>
    <div className="coastal-frame">
    <div ref={scroll} className="coastal-scroll" aria-label="Прибрежная карта" aria-describedby="coastal-hint">
      <div className="coastal-stage" style={wide?{width:`${zoom*100}%`}:undefined}>
      <div className="coastal-map" data-time={preferences.time} data-weather={preferences.weather} data-paused={paused} data-editing={editing}
        style={{...(wide?{}:{width:`${zoom*175}%`}),'--city-rate':speed} as unknown as CSSProperties}>
        <img src={wideMapUrl} width={2400} height={1350} alt="Прибрежный город на островах: девять зданий сфер жизни, мосты, водопады и пляж" draggable={false}/>
        <LiveCityCanvas profile={profile} routes={routes} paused={paused} speed={speed} quality={preferences.quality} time={preferences.time} weather={preferences.weather}
          debug={debug} draft={draft} editing={editing} onPoint={point=>setDraft([...draft,point])}/>
        {buildings.map(building=>{
          const sphere=spheres.find(s=>s.id===building.id)!,tier=buildingState(state,building.id).tier;
          return <button key={building.id} className="coastal-building" data-building={building.id}
            aria-label={`Войти: ${sphere.name}`} onClick={()=>onOpen(building.id)}
            style={{left:`${building.x}%`,top:`${building.y}%`,width:`${building.width}%`,height:`${building.height}%`,clipPath:coastalHitShapes[building.id]}}>
            <span>{sphere.icon} {sphere.name}{tier>1?` · Здание ${tier} ур.`:''}</span>
          </button>;
        })}
        {wide&&buildings.map(building=>{
          const card=cards.find(c=>c.id===building.id);if(!card)return null;
          return <button key={building.id} className="coastal-pin" data-pin={building.id} aria-pressed={picked===building.id}
            aria-label={`Район ${card.name}, уровень ${card.level}`} onClick={()=>setPicked(picked===building.id?null:building.id)}
            style={{left:`${building.x+building.width*.78}%`,top:`${building.y+building.height*.3}%`,'--pin':card.color} as CSSProperties}>
            {card.tasksToday>0&&<i aria-hidden="true">{card.tasksToday}</i>}<small>ур. {card.level}</small>
          </button>;
        })}
      </div>
      </div>
    </div>
    {wide&&<nav className="coastal-districts" aria-label="Районы острова">
      <header><b>Районы</b><small>ур. района</small></header>
      {cards.map(card=><button key={card.id} aria-pressed={picked===card.id} onClick={()=>setPicked(picked===card.id?null:card.id)} style={{'--pin':card.color} as CSSProperties}>
        <span className="dot" aria-hidden="true"/><span className="name">{card.name}<span className="bar"><span style={{width:`${card.progress}%`}}/></span></span><b>{card.level}</b>
      </button>)}
    </nav>}
    {!wide&&<div className="coastal-chips" aria-label="Районы острова">
      {cards.map(card=><button key={card.id} aria-pressed={picked===card.id} onClick={()=>setPicked(picked===card.id?null:card.id)} style={{'--pin':card.color} as CSSProperties}>
        <span className="dot" aria-hidden="true"/>{card.name} · {card.level}
      </button>)}
    </div>}
    {current&&<aside className="coastal-panel" aria-label={`Район ${current.name}`} style={{'--pin':current.color} as CSSProperties}>
      <button className="close" aria-label="Закрыть карточку района" onClick={()=>setPicked(null)}>×</button>
      <span className="tag">{current.rank}</span>
      <h3>{current.name}</h3>
      <p>Уровень района {current.level} · здание {buildingState(state,current.id).tier} ур.</p>
      <div className="stats"><span><small>Задачи сегодня</small><b>{current.tasksToday}</b></span><span><small>XP за неделю</small><b>{current.weekXP}</b></span><span><small>Серия</small><b>{current.streak} дн.</b></span></div>
      <div className="coastal-progress"><span><small>До следующего уровня</small><b>{current.maxed?'максимум':`${current.currentXP} / ${current.requiredXP} XP`}</b></span><i><i style={{width:`${current.progress}%`}}/></i></div>
      <button className="enter" onClick={()=>onOpen(current.id)}>Войти внутрь</button>
    </aside>}
    </div>
  </div>;
}
