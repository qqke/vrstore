import type { Catalog, Product } from './model';

const items = [
  ['肌研', '极润保湿化妆水', '極潤ヒアルロン液', '170ml', '护肤', '#d7e2df', '化妆水 保湿'],
  ['资生堂', '安热沙防晒乳', 'アネッサ UVミルク', '60ml', '护肤', '#d8bc71', '防晒 安耐晒'],
  ['Curel', '珂润保湿面霜', '潤浸保湿フェイスクリーム', '40g', '护肤', '#dce8ed', '敏感肌 面霜'],
  ['SENKA', '洗颜专科洁面乳', 'パーフェクトホイップ', '120g', '护肤', '#9ebfcf', '洗面奶 洁面'],
  ['曼丹', '眼唇卸妆液', 'アイメイクアップリムーバー', '145ml', '护肤', '#dcc6d9', '卸妆'],
  ['MINON', '氨基酸保湿面膜', 'アミノモイスト マスク', '4片', '护肤', '#e8d5d5', '蜜浓 面膜'],
  ['乐敦', '清凉眼药水', 'ロート クール40α', '12ml', '医药', '#b4cbd5', '眼药水 眼睛'],
  ['狮王', '祛痘膏', 'ペアアクネクリームW', '24g', '医药', '#dce0d1', '痘痘 pair'],
  ['小林制药', '液体创可贴', '液体ばんそうこう', '10g', '医药', '#d4c1b7', '伤口 创可贴'],
  ['久光', '撒隆巴斯贴', 'サロンパス', '80片', '医药', '#adc7b3', '膏药 肩颈'],
  ['大正制药', '口腔溃疡贴', '口内炎パッチ', '10片', '医药', '#d3c6b3', '口腔'],
  ['小林制药', '退热贴', '熱さまシート', '16片', '医药', '#afccda', '退烧'],
  ['KATE', '三色眉粉', 'デザイニングアイブロウ', 'EX-5', '彩妆', '#c7b3a2', '眉毛'],
  ['CANMAKE', '棉花糖蜜粉', 'マシュマロフィニッシュパウダー', 'MO', '彩妆', '#dac5b1', '散粉 定妆'],
  ['CEZANNE', '自然腮红', 'ナチュラルチーク', '01', '彩妆', '#d8b3ac', '腮红'],
  ['D-UP', '纤长睫毛膏', 'パーフェクトエクステンション', '黑色', '彩妆', '#b4b2ae', '睫毛膏'],
  ['OPERA', '润泽唇膏', 'リップティント', '05', '彩妆', '#d4a8a1', '口红'],
  ['资生堂', '睫毛夹', 'アイラッシュカーラー', '213', '彩妆', '#c8cccb', '工具'],
  ['BOTANIST', '植物洗发水', 'ボタニカルシャンプー', '460ml', '日用', '#c4cfb7', '洗发 护发'],
  ['花王', '蒸汽眼罩', 'めぐりズム', '12片', '日用', '#d5c4d5', '眼罩'],
  ['狮王', '酵素牙膏', 'クリニカ アドバンテージ', '130g', '日用', '#b8ced5', '牙膏'],
  ['花王', '碧柔沐浴露', 'ビオレu ボディウォッシュ', '480ml', '日用', '#d6dcd2', '沐浴'],
  ['尤妮佳', '超立体口罩', '超立体マスク', '30枚', '日用', '#cbd5df', '口罩'],
  ['花王', '衣物洗涤剂', 'アタック ZERO', '580g', '日用', '#d2dccb', '洗衣液'],
  ['DHC', '维生素 C', 'ビタミンC', '60日份', '健康', '#d7c483', '维生素'],
  ['FANCL', '综合维生素', 'マルチビタミン', '30日份', '健康', '#c6ccad', '营养'],
  ['明治', '胶原蛋白粉', 'アミノコラーゲン', '196g', '健康', '#d8c5d3', '胶原蛋白'],
  ['森永', '蛋白质饮料', 'inプロテイン', '240ml', '健康', '#bbc6ca', '蛋白质'],
  ['龙角散', '润喉糖', 'のどすっきり飴', '88g', '健康', '#b6ccd1', '喉糖'],
  ['大塚', '宝矿力饮料', 'ポカリスエット', '500ml', '健康', '#a9c4d7', '饮料']
];

const products: Product[] = items.map((p, i) => ({ id: `p${i + 1}`, brand: p[0], name_zh: p[1], name_ja: p[2], spec: p[3], category: p[4], color: p[5], aliases: p[6].split(' '), jan: `04900000${String(i + 1).padStart(5, '0')}`, image_url: null, active: true }));
const floors = [
  { id: 'b1', name: 'B1', category: '日用 · 健康', sort_order: -1 },
  { id: '1f', name: '1F', category: '护肤 · 医药', sort_order: 0 },
  { id: '2f', name: '2F', category: '彩妆 · 护肤', sort_order: 1 },
].map(f => ({ ...f, store_id: 'demo', width: 20, depth: 16, published: true }));
const shelves = floors.flatMap(f => Array.from({ length: 8 }, (_, i) => ({ id: `${f.id}-s${i + 1}`, floor_id: f.id, code: `${i < 4 ? 'A' : 'B'}${String(i % 4 + 1).padStart(2, '0')}`, category: f.id === '1f' ? i < 4 ? '护肤' : '医药' : f.id === '2f' ? i < 4 ? '彩妆' : '护肤' : i < 4 ? '日用' : '健康', x: 3 + (i % 4) * 4.2, z: i < 4 ? 5 : 10, width: 2.1, depth: 3.0, rotation: 0, levels: 5, version: 1 })));
const shelfFor = (i: number) => {
  const cat = products[i].category;
  const floor = cat === '彩妆' ? '2f' : cat === '日用' || cat === '健康' ? 'b1' : '1f';
  return `${floor}-s${(cat === '医药' || cat === '健康' ? 5 : 1) + i % 4}`;
};
export const demoCatalog: Catalog = {
  stores: [{ id: 'demo', name: '青山药妆 · 演示店', address: '虚构门店 · 非真实位置', published: true, is_demo: true }], floors, shelves, products,
  locations: [...products.map((p, i) => ({ id: `l${i + 1}`, product_id: p.id, shelf_id: shelfFor(i), face: i % 2 ? 'B' as const : 'A' as const, level: 1 + i % 4, section: ['左侧', '中间', '右侧'][i % 3], active: true, last_verified_at: '2026-10-13T00:00:00Z', version: 1 })), { id: 'l31', product_id: 'p1', shelf_id: '2f-s5', face: 'A', level: 2, section: '中间', active: true, last_verified_at: '2026-10-13T00:00:00Z', version: 1 }],
  access_points: floors.flatMap(f => [{ id: `${f.id}-elevator`, floor_id: f.id, group_code: 'E1', kind: 'elevator' as const, label: '电梯', x: 18, z: 2, connects_to: floors.filter(other => other.id !== f.id).map(other => other.id), direction: 'both' as const, available: true, accessible: true }, { id: `${f.id}-stairs`, floor_id: f.id, group_code: 'S1', kind: 'stairs' as const, label: '楼梯', x: 2, z: 2, connects_to: floors.filter(other => Math.abs(other.sort_order - f.sort_order) === 1).map(other => other.id), direction: 'both' as const, available: true, accessible: false }]),
};
