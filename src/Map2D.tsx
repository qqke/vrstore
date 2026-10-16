import type { AccessPoint, Floor, Shelf } from './model';
import { accessDescription } from './model';
import { useEffect, useRef, useState } from 'react';
import './map-controls.css';

export default function Map2D({ floor, floors, shelves, points, selected, selectedFace, onShelf }: { floor: Floor; floors: Floor[]; shelves: Shelf[]; points: AccessPoint[]; selected?: string; selectedFace?: 'A' | 'B'; onShelf: (id: string) => void }) {
  const [zoom,setZoom]=useState(1);
  const [touchDrag,setTouchDrag]=useState(false);
  const [center,setCenter]=useState({x:floor.width/2,z:floor.depth/2});
  const drag=useRef<{x:number;y:number;center:{x:number;z:number}} | null>(null);
  useEffect(()=>{
    const target=shelves.find(s=>s.id===selected);
    setZoom(target ? 1.45 : 1); setCenter(target ? {x:target.x,z:target.z} : {x:floor.width/2,z:floor.depth/2});
  },[selected,floor.id]);
  const width=(floor.width+2)/zoom, depth=(floor.depth+2)/zoom;
  const x=Math.max(-1,Math.min(floor.width+1-width,center.x-width/2));
  const z=Math.max(-1,Math.min(floor.depth+1-depth,center.z-depth/2));
  return <div className="map2d-container"><div className="map-zoom"><button aria-label="放大地图" disabled={zoom>=3} onClick={()=>setZoom(v=>Math.min(3,v+.4))}>+</button><button aria-label="缩小地图" disabled={zoom<=1} onClick={()=>setZoom(v=>Math.max(1,v-.4))}>−</button><button className="touch-map-toggle" aria-pressed={touchDrag} disabled={zoom<=1} onClick={()=>setTouchDrag(v=>!v)}>{touchDrag ? '允许页面滚动' : '拖动地图'}</button></div><svg className="floor-map" viewBox={`${x} ${z} ${width} ${depth}`} style={{touchAction:touchDrag && zoom>1 ? 'none' : 'pan-y'}} role="group" aria-label={`${floor.name} 平面图，点击货架查看商品`}
    onPointerDown={e=>{if(zoom<=1 || (e.pointerType==='touch' && !touchDrag) || (e.target as Element).closest('.map-shelf'))return; drag.current={x:e.clientX,y:e.clientY,center};e.currentTarget.setPointerCapture(e.pointerId);}}
    onPointerMove={e=>{if(!drag.current)return;const rect=e.currentTarget.getBoundingClientRect();const scale=Math.min(rect.width/width,rect.height/depth);setCenter({x:Math.max(0,Math.min(floor.width,drag.current.center.x-(e.clientX-drag.current.x)/scale)),z:Math.max(0,Math.min(floor.depth,drag.current.center.z-(e.clientY-drag.current.y)/scale))});}}
    onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
    <defs><pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 L 0 0 0 1" fill="none" stroke="#dfdfd5" strokeWidth=".018" /></pattern></defs>
    <rect width={floor.width} height={floor.depth} rx=".4" fill="#f5f4ed" stroke="#d4d7cc" strokeWidth=".08" />
    <rect width={floor.width} height={floor.depth} fill="url(#grid)" />
    <rect x="7.5" y={floor.depth - 1.5} width="5" height="1" rx=".15" fill="#e3e4d9" />
    <text x="10" y={floor.depth - .8} textAnchor="middle" className="map-label">{floor.name === '1F' ? '入口 / 收银台' : '收银台'}</text>
    {points.map(p => <g key={p.id} opacity={p.available ? 1 : .45}>
      <title>{p.label} · {accessDescription(p, floors)}</title>
      <rect x={p.x - 1} y={p.z - .65} width="2" height="1.3" rx=".18" fill="#e2e6db" />
      <text x={p.x} y={p.z + .13} textAnchor="middle" className="map-label">{p.label}{!p.available ? ' 停用' : ''}</text>
      <text x={p.x} y={p.z + .5} textAnchor="middle" className="map-label">{accessDescription(p, floors)}</text>
    </g>)}
    {shelves.map(s => <g key={s.id} transform={`translate(${s.x} ${s.z}) rotate(${s.rotation})`} className={`map-shelf ${selected === s.id ? 'selected' : ''}`} role="button" tabIndex={0} aria-label={`${s.code} ${s.category}货架`} onClick={() => onShelf(s.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onShelf(s.id); } }}>
      <rect x={-s.width / 2 + .12} y={-s.depth / 2 + .18} width={s.width} height={s.depth} rx=".12" fill="#1c332518" />
      <rect x={-s.width / 2} y={-s.depth / 2} width={s.width} height={s.depth} rx=".12" className="shelf-body" />
      <line x1="0" x2="0" y1={-s.depth / 2 + .2} y2={s.depth / 2 - .2} stroke="#ffffff70" strokeWidth=".05" />
      <text x="0" y="-.1" textAnchor="middle" className="map-code">{s.code}</text>
      <text x="0" y=".48" textAnchor="middle" className="map-category">{s.category}</text>
      {selected === s.id && <><text x={-s.width / 2 - .35} y=".15" textAnchor="middle" className="map-label">A</text><text x={s.width / 2 + .35} y=".15" textAnchor="middle" className="map-label">B</text></>}
      {selected === s.id && selectedFace && <line x1={selectedFace === 'A' ? -s.width / 2 + .12 : s.width / 2 - .12} x2={selectedFace === 'A' ? -s.width / 2 + .12 : s.width / 2 - .12} y1={-s.depth / 2 + .15} y2={s.depth / 2 - .15} stroke="white" strokeWidth=".13" aria-label={`目标 ${selectedFace} 面`} />}
    </g>)}
  </svg></div>;
}
