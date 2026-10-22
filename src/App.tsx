import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Box, Check, ChevronRight, Compass, Layers, MapPin, RotateCcw, Search, Share2, ShoppingBag, X } from 'lucide-react';
import { loadCatalog, type LoadedCatalog } from './data';
import { accessDescription, isStale, parseLink, productLocations, searchProducts } from './model';
import Map2D from './Map2D';
import ProductArt from './ProductArt';
import PullProduct from './PullProduct';
const Map3D = lazy(() => import('./Map3D'));

class MapBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function App() {
  const [loaded, setLoaded] = useState<LoadedCatalog>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [storeId, setStoreId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [productId, setProductId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [shelfId, setShelfId] = useState('');
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [reset, setReset] = useState(0);
  const [notice, setNotice] = useState('');
  const [shareState, setShareState] = useState('');
  const mapToolbar = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { setLoaded(await loadCatalog()); } catch (e) { setError(e instanceof Error ? e.message : '读取失败'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const catalog = loaded?.catalog;
  const stores = catalog?.stores.filter(s => s.published) || [];
  const store = stores.find(s => s.id === storeId) || stores[0];
  const isDemo = loaded?.mode === 'demo' || Boolean(store?.is_demo);
  const floors = catalog?.floors.filter(f => f.store_id === store?.id && f.published).sort((a, b) => a.sort_order - b.sort_order) || [];
  const floor = floors.find(f => f.id === floorId) || floors.find(f => f.name === '1F') || floors[0];
  const products = useMemo(() => catalog && store ? searchProducts(catalog, store.id, query, category) : [], [catalog, store?.id, query, category]);
  const product = catalog?.products.find(p => p.id === productId);
  const positions = catalog && product && store ? productLocations(catalog, product.id, store.id) : [];
  const position = positions.find(p => p.location.id === locationId) || positions[0];
  const shelves = catalog?.shelves.filter(s => s.floor_id === floor?.id) || [];
  const selectedShelf = shelves.find(s => s.id === shelfId);
  const points = catalog?.access_points.filter(p => p.floor_id === floor?.id) || [];
  const categories = [...new Set(catalog && store ? searchProducts(catalog, store.id, '', '').map(p => p.category) : [])];

  useEffect(() => {
    if (!catalog) return;
    const read = () => {
      const link = parseLink(window.location.hash);
      const st = catalog.stores.find(s => s.id === link.store && s.published) || catalog.stores.find(s => s.published);
      const fl = catalog.floors.find(f => f.id === link.floor && f.store_id === st?.id && f.published);
      setStoreId(st?.id || ''); setFloorId(fl?.id || '');
      const locations = st && link.product ? productLocations(catalog, link.product, st.id) : [];
      const loc = locations.find(p => p.location.id === link.location) || locations.find(p => p.floor.id === fl?.id) || locations[0];
      setProductId(loc ? link.product! : ''); setLocationId(loc?.location.id || '');
      setShelfId(loc?.floor.id === fl?.id || !fl ? loc?.shelf.id || '' : '');
      if (!fl && loc) setFloorId(loc.floor.id);
      if (link.product && !loc) setNotice('分享的位置已下线或不可用，请重新搜索。');
      if (loc && window.matchMedia('(max-width:760px)').matches) requestAnimationFrame(()=>mapToolbar.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth',block:'start'}));
    };
    read(); window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [catalog]);

  function navigate(next: { store?: string; floor?: string; product?: string; location?: string }) {
    const params = new URLSearchParams({ store: next.store || store!.id, floor: next.floor || floor!.id });
    if (next.product) params.set('product', next.product);
    if (next.location) params.set('location', next.location);
    const hash = `#${params.toString()}`;
    if (window.location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
    else window.location.hash = params.toString();
  }
  function chooseProduct(id: string) {
    if (!catalog || !store) return;
    const locations = productLocations(catalog, id, store.id);
    const p = locations.find(p => p.floor.id === floor?.id) || locations[0];
    if (p) navigate({ floor: p.floor.id, product: id, location: p.location.id });
  }
  function chooseShelf(id: string) {
    setShelfId(id);
    const l = catalog?.locations.find(l => l.active && l.shelf_id === id);
    if (l) navigate({ product: l.product_id, location: l.id });
    else { navigate({}); setProductId(''); setLocationId(''); setNotice('这个货架还没有已发布的商品位置。'); }
  }
  function fail3D() { setView('2d'); setNotice('此设备的 3D 地图不可用，已切换为平面图。'); }
  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); setShareState('已复制'); }
    catch { setShareState('请复制浏览器地址分享'); }
    setTimeout(() => setShareState(''), 2500);
  }

  if (loading && !catalog) return <div className="startup"><span className="wordmark">棚<span>tana</span></span><p>正在展开店铺地图…</p></div>;
  if (!catalog || !store || !floor) return <div className="startup"><span className="wordmark">棚<span>tana</span></span><h1>{error ? '暂时无法读取门店' : '还没有已发布的门店'}</h1><p>{error || '请先在 Supabase 发布门店与楼层。'}</p><button className="primary-button" onClick={() => void refresh()}>重新加载</button></div>;

  return <div className="app-shell">
    <header className="app-header"><a href={import.meta.env.BASE_URL} className="wordmark" aria-label="tana 首页">棚<span>tana</span></a><span className="header-divider" /><span className="header-caption">店内找货，心里有数。</span><div className="header-right"><span className="demo-badge">{loaded.mode === 'cached' ? '历史数据' : isDemo ? '演示门店' : '门店地图'}</span><span className="header-location"><MapPin size={14} /> 日本 · 店内地图</span></div></header>
    <div className={`data-banner ${loaded.mode === 'cached' ? 'warning' : ''}`}>{loaded.mode === 'cached' ? `连接失败，正在显示 ${new Date(loaded.cachedAt!).toLocaleString('zh-CN', { timeZone: 'Asia/Tokyo' })} 保存的历史数据。${isDemo ? '此数据为虚构门店演示。' : ''}` : isDemo ? '这是虚构门店与包装示意，用于体验找货流程，请勿据此前往实际货架。' : '商品位置不代表实时库存，请以店内陈列为准。'}{loaded.mode === 'cached' && <button onClick={() => void refresh()} disabled={loading}>重试连接</button>}</div>
    {error && <div className="notice" role="alert">{error}</div>}
    {notice && <div className="notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice('')}><X size={16} /></button></div>}
    <main className="workspace">
      <aside className="catalog-panel">
        <div className="store-heading"><span className="eyebrow">YOUR STORE / 当前门店</span>{stores.length > 1 ? <select aria-label="选择门店" value={store.id} onChange={e => { setQuery(''); setCategory(''); navigate({ store: e.target.value, floor: catalog.floors.find(f => f.store_id === e.target.value && f.published)?.id }); }} >{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select> : <h1>{store.name.replace(' · 演示店', '')}<ArrowUpRight size={20} /></h1>}<p>{store.address}</p></div>
        <label className="search-box"><Search size={19} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="找商品、品牌或 JAN 条码" aria-label="搜索商品" />{query && <button onClick={() => setQuery('')} aria-label="清空搜索"><X size={16} /></button>}</label>
        <div className="category-tabs" aria-label="商品分类">{['', ...categories].map(c => <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>{c || '全部'}</button>)}</div>
        <div className="list-heading"><span>{query ? '搜索结果' : '店内商品'}</span><span>{products.length} 件</span></div>
        <div className="product-list">{products.map(p => { const pos = productLocations(catalog, p.id, store.id)[0]; return <button className={`product-row ${p.id === productId ? 'active' : ''}`} key={p.id} onClick={() => chooseProduct(p.id)}><div className="product-thumb"><ProductArt product={p} /></div><div className="product-row-copy"><span className="product-brand">{p.brand}</span><strong>{p.name_zh}</strong><small>{p.spec}</small><span className="product-position">{pos.floor.name}<span>·</span>{pos.shelf.code} 货架{productLocations(catalog, p.id, store.id).length > 1 ? ' · 多处陈列' : ''}</span></div><ChevronRight size={17} /></button>; })}{products.length === 0 && <div className="empty"><Search size={25} /><h3>暂时没有找到</h3><p>试试日文名称、品牌或其他关键词。</p><button onClick={() => { setQuery(''); setCategory(''); }}>查看全部商品</button></div>}</div>
        <div className="panel-foot"><ShoppingBag size={15} /><span>先找位置，再轻松逛店。</span></div>
      </aside>

      <section className="map-workspace" aria-label="门店地图">
        <div className="map-heading"><div><span className="eyebrow">STORE EXPLORER / 店铺导览</span><h2>你的下一站，在哪一架？</h2></div><div className="view-toggle"><button aria-pressed={view === '2d'} className={view === '2d' ? 'active' : ''} onClick={() => setView('2d')}><Layers size={15} />平面</button><button aria-pressed={view === '3d'} className={view === '3d' ? 'active' : ''} onClick={() => setView('3d')}><Box size={15} />3D</button></div></div>
        <div className="map-toolbar" ref={mapToolbar}><div className="floor-tabs" aria-label="选择楼层">{floors.map(f => <button key={f.id} className={f.id === floor.id ? 'active' : ''} aria-pressed={f.id === floor.id} onClick={() => { setShelfId(''); navigate({ floor: f.id, product: productId, location: locationId }); }}>{f.name}</button>)}</div><span className="floor-category">{floor.category}</span><button className="reset-map" aria-label="恢复全层视图" onClick={() => { setShelfId(''); setReset(v => v + 1); }}><RotateCcw size={16} /></button></div>
        <div className="map-canvas"><div className="floor-watermark" aria-hidden="true">{floor.name}</div><div className="map-stage" key={`${floor.id}-${reset}`}>{view === '2d' ? <Map2D floor={floor} floors={floors} shelves={shelves} points={points} selected={selectedShelf?.id} selectedFace={selectedShelf && position && selectedShelf.id === position.shelf.id ? position.location.face : undefined} onShelf={chooseShelf} /> : <MapBoundary onFailure={fail3D}><Suspense fallback={<div className="map-loading">正在展开 3D 地图…</div>}><Map3D floor={floor} floors={floors} shelves={shelves} points={points} selected={selectedShelf?.id} selectedFace={selectedShelf && position && selectedShelf.id === position.shelf.id ? position.location.face : undefined} onShelf={chooseShelf} onFailure={fail3D} /></Suspense></MapBoundary>}</div><div className="map-compass"><Compass size={21} /><span>以店内地标辨认方向</span></div><span className="map-hint">{view === '3d' ? '拖动旋转 · 双指缩放' : '点击货架，查看商品'}</span></div>
        <div className="map-legend"><span><i className="legend-shelf" />商品货架</span><span><i className="legend-target" />选中货架</span><span className="legend-note">当前查看 {floor.name} · 不含实时定位</span></div>

        {product && position ? <section className="location-detail" aria-label="选中商品位置"><div className="detail-product"><PullProduct key={product.id} product={product} /><div><span className="eyebrow">找到它 / PRODUCT LOCATION</span><h3>{product.name_zh}</h3><p>{product.name_ja} · {product.spec}</p><div className="location-options">{positions.map(p => <button key={p.location.id} className={p.location.id === position.location.id ? 'active' : ''} onClick={() => navigate({ floor: p.floor.id, product: product.id, location: p.location.id })}>{p.floor.name} · {p.shelf.code}{p.location.id === position.location.id && <Check size={12} />}</button>)}</div></div></div><div className="position-directions"><div className="position-primary"><span>{position.floor.name}</span><ArrowUpRight size={21} /><strong>{position.shelf.code}</strong><small>货架</small></div><p>面向 <b>{position.location.face} 面</b> · 从下往上 <b>第 {position.location.level} 层</b> · {position.location.section}</p><div className="shelf-levels" aria-label={`从下往上第 ${position.location.level} 层`}>{Array.from({ length: position.shelf.levels }, (_, i) => position.shelf.levels - i).map(n => <span key={n} className={n === position.location.level ? 'active' : ''}><i /><small>{n}</small></span>)}</div><small className={isStale(position.location.last_verified_at) ? 'stale' : 'verified'}>{isDemo ? '演示位置 · 未经实店核实' : `${isStale(position.location.last_verified_at) ? '位置待复核' : '位置已核实'} · ${new Date(position.location.last_verified_at).toLocaleDateString('zh-CN', { timeZone: 'Asia/Tokyo' })}`}</small>{!isDemo && isStale(position.location.last_verified_at) && <p role="status">此位置超过 7 天未核实或核实时间无效，陈列可能已调整，请以现场为准。</p>}<button className="share-button" onClick={() => void share()}><Share2 size={14} />{shareState || '分享位置'}</button></div></section> : <section className="choose-prompt"><MapPin size={24} /><div><h3>选一件商品，找到它的位置</h3><p>搜索商品或点击地图上的货架。</p></div></section>}
        <div className="access-strip"><span className="eyebrow">楼层连接</span>{points.map(p => <div className="access-item" key={p.id}><span>{p.label}</span><small>{accessDescription(p, floors)}</small></div>)}</div>
      </section>
    </main>
    <footer className="app-footer"><span>棚 tana · 把时间留给想逛的东西</span><span>{isDemo ? 'DEMO / 虚构门店' : '商品位置以现场为准'}</span></footer>
  </div>;
}




