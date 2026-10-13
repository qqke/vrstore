import type { Product } from './model';
import { useState } from 'react';

export default function ProductArt({ product, large = false }: { product: Product; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (product.image_url && !failed) return <img className="product-photo" src={product.image_url} alt={`${product.brand} ${product.name_zh} ${product.spec}`} loading="lazy" onError={() => setFailed(true)} />;
  const box = product.category === '健康' || product.category === '医药' || product.category === '彩妆';
  return <svg viewBox="0 0 100 120" className={large ? 'product-art large' : 'product-art'} role="img" aria-label={`${product.name_zh}，包装示意，非商品实拍`}>
    <ellipse cx="50" cy="108" rx="27" ry="4" fill="#293e3010" />
    {!box && <rect x="36" y="9" width="28" height="16" rx="3" fill="#48594f" />}
    <rect x={box ? 23 : 28} y={box ? 17 : 23} width={box ? 54 : 44} height={box ? 88 : 80} rx={box ? 3 : 9} fill={product.color || '#d7e2df'} />
    <rect x={box ? 27 : 32} y="41" width={box ? 46 : 36} height="43" rx="2" fill="#fffffff0" />
    <text x="50" y="54" textAnchor="middle" fontSize="7" fill="#344d3d" fontWeight="700">{product.brand.slice(0, 8)}</text>
    <line x1="37" x2="63" y1="62" y2="62" stroke="#b6c4ba" />
    <text x="50" y="73" textAnchor="middle" fontSize="5.5" fill="#67776b">{product.spec}</text>
  </svg>;
}
