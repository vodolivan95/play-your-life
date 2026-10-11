import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Zoom shares the same map container with canvas and hit zones; native single-finger pan stays available. */
export function useCityZoom() {
  const [zoom,setZoom]=useState(1),scroll=useRef<HTMLDivElement>(null),current=useRef(1);
  const anchor=useRef<{x:number;y:number;mapX:number;mapY:number}|null>(null);
  useLayoutEffect(()=>{
    current.current=zoom;
    const node=scroll.current,p=anchor.current;
    if(node&&p){node.scrollLeft=p.mapX*zoom-p.x;node.scrollTop=p.mapY*zoom-p.y;anchor.current=null;}
  },[zoom]);
  useEffect(()=>{
    const node=scroll.current;if(!node)return;
    let gesture:{distance:number;zoom:number}|null=null;
    const distance=(t:TouchList)=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
    const apply=(value:number,x:number,y:number)=>{
      const bounds=node.getBoundingClientRect(),px=x-bounds.left,py=y-bounds.top;
      anchor.current={x:px,y:py,mapX:(node.scrollLeft+px)/current.current,mapY:(node.scrollTop+py)/current.current};
      setZoom(Math.max(1,Math.min(3,value)));
    };
    const start=(e:TouchEvent)=>{if(e.touches.length===2){gesture={distance:distance(e.touches),zoom:current.current};e.preventDefault();}};
    const move=(e:TouchEvent)=>{
      if(!gesture||e.touches.length!==2)return;
      e.preventDefault();apply(gesture.zoom*distance(e.touches)/Math.max(1,gesture.distance),(e.touches[0].clientX+e.touches[1].clientX)/2,(e.touches[0].clientY+e.touches[1].clientY)/2);
    };
    const end=()=>{gesture=null;};
    const wheel=(e:WheelEvent)=>{e.preventDefault();apply(current.current*Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.003),e.clientX,e.clientY);};
    // Мышь: перетаскивание листает увеличенную карту, двойной щелчок приближает к курсору.
    let drag:{x:number;y:number;left:number;top:number;moved:boolean}|null=null;
    const down=(e:PointerEvent)=>{if(e.pointerType!=='mouse'||e.button!==0)return;drag={x:e.clientX,y:e.clientY,left:node.scrollLeft,top:node.scrollTop,moved:false};};
    const over=(e:PointerEvent)=>{
      if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(!drag.moved&&Math.hypot(dx,dy)<6)return;
      drag.moved=true;node.dataset.dragging='true';node.scrollLeft=drag.left-dx;node.scrollTop=drag.top-dy;
    };
    const up=()=>{if(drag?.moved)setTimeout(()=>{delete node.dataset.dragging;},0);drag=null;};
    const click=(e:MouseEvent)=>{if(node.dataset.dragging){e.stopPropagation();e.preventDefault();delete node.dataset.dragging;}};
    const dbl=(e:MouseEvent)=>{if((e.target as HTMLElement).closest('button'))return;e.preventDefault();apply(current.current<2.9?current.current+1:1,e.clientX,e.clientY);};
    node.addEventListener('pointerdown',down);window.addEventListener('pointermove',over);window.addEventListener('pointerup',up);
    node.addEventListener('click',click,true);node.addEventListener('dblclick',dbl);
    node.addEventListener('touchstart',start,{passive:false});node.addEventListener('touchmove',move,{passive:false});
    node.addEventListener('touchend',end);node.addEventListener('touchcancel',end);node.addEventListener('wheel',wheel,{passive:false});
    return()=>{node.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',over);window.removeEventListener('pointerup',up);node.removeEventListener('click',click,true);node.removeEventListener('dblclick',dbl);node.removeEventListener('touchstart',start);node.removeEventListener('touchmove',move);node.removeEventListener('touchend',end);node.removeEventListener('touchcancel',end);node.removeEventListener('wheel',wheel);};
  },[]);
  return {zoom,setZoom,scroll};
}
