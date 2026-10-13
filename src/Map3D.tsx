import { Canvas } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, Html } from '@react-three/drei';
import type { AccessPoint, Floor, Shelf } from './model';
import { useEffect, useRef } from 'react';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';

function Controls({ target }: { target: [number, number, number] }) {
  const ref = useRef<OrbitControlsType>(null);
  useEffect(() => { ref.current?.target.set(...target); ref.current?.update(); }, [target[0], target[1], target[2]]);
  return <OrbitControls ref={ref} makeDefault enableDamping={false} minZoom={12} maxZoom={80} maxPolarAngle={Math.PI / 2.3} />;
}

export default function Map3D({ floor, shelves, points, selected, selectedFace, onShelf, onFailure }: { floor: Floor; shelves: Shelf[]; points: AccessPoint[]; selected?: string; selectedFace?: 'A' | 'B'; onShelf: (id: string) => void; onFailure: () => void }) {
  const target = shelves.find(s => s.id === selected);
  return <Canvas frameloop="demand" dpr={[1, 1.5]} onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); onFailure(); }, { once: true }); }} aria-label={`${floor.name} 3D 地图`}>
    <color attach="background" args={['#f1f2e9']} />
    <OrthographicCamera makeDefault position={[24, 28, 28]} zoom={25} near={.1} far={200} />
    <ambientLight intensity={1.7} /><directionalLight position={[8, 20, 5]} intensity={2.2} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[floor.width / 2, -.05, floor.depth / 2]}><planeGeometry args={[floor.width, floor.depth]} /><meshStandardMaterial color="#e7e7db" /></mesh>
    {shelves.map(s => <group key={s.id} position={[s.x, 0, s.z]} rotation={[0, -s.rotation * Math.PI / 180, 0]}>
      <mesh position={[0, .75, 0]} onClick={e => { e.stopPropagation(); onShelf(s.id); }}><boxGeometry args={[s.width, 1.5, s.depth]} /><meshStandardMaterial color={s.id === selected ? '#326951' : '#bac7b1'} roughness={.8} /></mesh>
      {[.35, .75, 1.15].map(y => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[s.width + .03, .035, s.depth + .03]} /><meshStandardMaterial color={s.id === selected ? '#82ad8c' : '#e5e8db'} /></mesh>)}
      <Html position={[0, 1.7, 0]} center zIndexRange={[10, 0]}><button className={`three-label ${s.id === selected ? 'active' : ''}`} onClick={() => onShelf(s.id)} aria-label={`${s.code} ${s.category}货架`}>{s.code}<small>{s.category}</small></button></Html>
      {s.id === selected && selectedFace && <><mesh position={[selectedFace === 'A' ? -s.width/2-.025 : s.width/2+.025,.8,0]}><boxGeometry args={[.05,1.3,s.depth-.2]} /><meshStandardMaterial color="#e6eddc" /></mesh><Html center position={[selectedFace === 'A' ? -s.width/2-.6 : s.width/2+.6,.1,0]}><span className="three-access">{selectedFace} 面</span></Html></>}
    </group>)}
    {points.map(p => <Html key={p.id} position={[p.x, .1, p.z]} center zIndexRange={[10, 0]}><span className="three-access">{p.label}{p.available ? '' : ' 停用'}</span></Html>)}
    <Html position={[10, .1, floor.depth - 1]} center zIndexRange={[10, 0]}><span className="three-access">{floor.name === '1F' ? '入口 / 收银台' : '收银台'}</span></Html>
    <Controls target={target ? [target.x, 0, target.z] : [floor.width / 2, 0, floor.depth / 2]} />
  </Canvas>;
}
