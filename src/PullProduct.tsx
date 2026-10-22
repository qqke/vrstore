import { useRef, useState, type CSSProperties } from 'react';
import type { Product } from './model';
import ProductArt from './ProductArt';

export default function PullProduct({ product }: { product: Product }) {
  const drag = useRef<{ id: number; y: number } | null>(null);
  const [distance, setDistance] = useState(0);
  const [pulling, setPulling] = useState(false);
  function release() {
    drag.current = null;
    setPulling(false);
    setDistance(0);
  }
  return <div className="pull-product">
    <button className={`detail-art pull-product-handle ${pulling ? 'pulling' : ''}`}
      aria-label={`向下拉出${product.name_zh}，松手回弹；键盘按住空格或回车体验`}
      style={{ '--pull': distance } as CSSProperties}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, y: event.clientY };
        setPulling(true);
      }}
      onPointerMove={event => {
        if (drag.current?.id !== event.pointerId) return;
        setDistance(Math.min(1, Math.max(0, (event.clientY - drag.current.y) / 120)));
      }}
      onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
      onKeyDown={event => {
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        setPulling(true);
        setDistance(1);
      }}
      onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') release(); }}
      onBlur={release} onDragStart={event => event.preventDefault()}>
      <span className="pull-product-object"><ProductArt product={product} large /></span>
    </button>
    <small>↓ 下拉商品 · 松手回弹</small>
  </div>;
}
