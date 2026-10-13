import type { AccessPoint, Floor, Shelf } from './model';

export default function Map2D({ floor, shelves, points, selected, onShelf }: { floor: Floor; shelves: Shelf[]; points: AccessPoint[]; selected?: string; onShelf: (id: string) => void }) {
  return <svg className="floor-map" viewBox={`-1 -1 ${floor.width + 2} ${floor.depth + 2}`} role="img" aria-label={`${floor.name} 平面图，点击货架查看商品`}>
    <defs><pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 L 0 0 0 1" fill="none" stroke="#dfdfd5" strokeWidth=".018" /></pattern></defs>
    <rect width={floor.width} height={floor.depth} rx=".4" fill="#f5f4ed" stroke="#d4d7cc" strokeWidth=".08" />
    <rect width={floor.width} height={floor.depth} fill="url(#grid)" />
    <rect x="7.5" y={floor.depth - 1.5} width="5" height="1" rx=".15" fill="#e3e4d9" />
    <text x="10" y={floor.depth - .8} textAnchor="middle" className="map-label">{floor.name === '1F' ? '入口 / 收银台' : '收银台'}</text>
    {points.map(p => <g key={p.id} opacity={p.available ? 1 : .45}>
      <rect x={p.x - 1} y={p.z - .65} width="2" height="1.3" rx=".18" fill="#e2e6db" />
      <text x={p.x} y={p.z + .13} textAnchor="middle" className="map-label">{p.label}{!p.available ? ' 停用' : ''}</text>
    </g>)}
    {shelves.map(s => <g key={s.id} transform={`translate(${s.x} ${s.z}) rotate(${s.rotation})`} className={`map-shelf ${selected === s.id ? 'selected' : ''}`} role="button" tabIndex={0} aria-label={`${s.code} ${s.category}货架`} onClick={() => onShelf(s.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onShelf(s.id); } }}>
      <rect x={-s.width / 2 + .12} y={-s.depth / 2 + .18} width={s.width} height={s.depth} rx=".12" fill="#1c332518" />
      <rect x={-s.width / 2} y={-s.depth / 2} width={s.width} height={s.depth} rx=".12" className="shelf-body" />
      <line x1="0" x2="0" y1={-s.depth / 2 + .2} y2={s.depth / 2 - .2} stroke="#ffffff70" strokeWidth=".05" />
      <text x="0" y="-.1" textAnchor="middle" className="map-code">{s.code}</text>
      <text x="0" y=".48" textAnchor="middle" className="map-category">{s.category}</text>
      {selected === s.id && <><text x={-s.width / 2 - .35} y=".15" textAnchor="middle" className="map-label">A</text><text x={s.width / 2 + .35} y=".15" textAnchor="middle" className="map-label">B</text></>}
    </g>)}
  </svg>;
}
