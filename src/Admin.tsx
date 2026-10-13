import { useEffect, useState, type FormEvent } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import { supabase as publicClient, configurationError } from './data';
import { entities, importCSV, parseField } from './admin-fields';
import './admin.css';

const supabase = publicClient ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, storageKey: 'tana-admin-session', detectSessionInUrl: false } }) : null;

type Row = Record<string, unknown> & { id: string; version: number };
const show = (v: unknown) => v === null || v === undefined ? '' : Array.isArray(v) ? v.join('|') : String(v);

async function authorizedRows(table: string, storeIds: string[]): Promise<Row[]> {
  if (!storeIds.length) return [];
  let request = supabase!.from(table).select('*');
  if (table === 'stores') request = request.in('id', storeIds);
  else if (['floors','products'].includes(table)) request = request.in('store_id', storeIds);
  else {
    const floors = await supabase!.from('floors').select('id').in('store_id', storeIds);
    if (floors.error) throw floors.error;
    const floorIds = floors.data.map(f => f.id);
    if (!floorIds.length) return [];
    if (table === 'product_locations') {
      const shelves = await supabase!.from('shelves').select('id').in('floor_id', floorIds);
      if (shelves.error) throw shelves.error;
      if (!shelves.data.length) return [];
      request = request.in('shelf_id', shelves.data.map(s => s.id));
    } else request = request.in('floor_id', floorIds);
  }
  const result = await request.limit(5000);
  if (result.error) throw result.error;
  if (result.data.length === 5000) throw new Error('记录达到首版上限，请分页后维护。');
  return result.data as Row[];
}

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [table, setTable] = useState('product_locations'); const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row>(); const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [csv, setCsv] = useState(''); const [preview, setPreview] = useState<Record<string, unknown>[]>([]);
  const [filter, setFilter] = useState(''); const [grants, setGrants] = useState<string[]>([]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, current) => { setSession(current); if (!current) { setRows([]); setSelected(undefined); setGrants([]); } });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session || !supabase) return;
    let cancelled = false;
    setSelected(undefined); setPreview([]); setCsv(''); setFilter('');
    void (async () => {
      setBusy(true);
      try {
        const auth = await supabase!.from('store_admins').select('store_id').eq('user_id', session.user.id);
        if (auth.error) throw auth.error;
        const authorized = new Set((auth.data || []).map(r => r.store_id as string));
        const data = await authorizedRows(table,[...authorized]);
        if (!cancelled) { setGrants([...authorized]); setRows(data); if (!authorized.size) setMessage('此账号没有门店管理权限，请通过 Dashboard 授权。'); }
      } catch (e) { if (!cancelled) setMessage(e instanceof Error ? e.message : '加载失败'); }
      finally { if (!cancelled) setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [table, session?.user.id]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await action(); } catch (e) { setMessage(e instanceof Error ? e.message : '操作失败，请检查权限和数据。'); }
    finally { setBusy(false); }
  }
  async function refreshRows() {
    setRows(await authorizedRows(table,grants));
  }
  function edit(row?: Row) {
    setSelected(row); setMessage('');
    setValues(Object.fromEntries(entities[table].fields.map(f => [f.key, show(row?.[f.key] ?? (f.type === 'boolean' ? false : f.key === 'store_id' ? grants[0] || '' : ''))])));
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      const data = Object.fromEntries(entities[table].fields.map(f => [f.key, parseField(f, values[f.key] || '')]));
      if (selected) {
        const result = await supabase!.from(table).update(data).eq('id', selected.id).eq('version', selected.version).select('id');
        if (result.error) throw result.error;
        if (result.data.length !== 1) throw new Error('记录已被他人修改或权限已撤销。输入已保留，请重新载入后核对。');
      } else {
        if (table === 'stores') throw new Error('新门店通过 Dashboard 创建并分配权限。');
        const result = await supabase!.from(table).insert({ id: crypto.randomUUID(), ...data }).select('id');
        if (result.error) throw result.error;
        if (!result.data?.length) throw new Error('保存未确认，请重试。');
      }
      await refreshRows(); setSelected(undefined); setValues({}); setMessage('已保存。位置核实时间请仅在现场确认后更新。');
    });
  }
  async function upload(file?: File) {
    if (!file || !selected || table !== 'products') return;
    await run(async () => {
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) throw new Error('请选择不超过 12MB 的 JPG / PNG / WebP 图片。');
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('图片压缩不可用'); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', .85));
      if (!blob || blob.size > 2 * 1024 * 1024) throw new Error('压缩后仍超过 2MB，请缩小图片。');
      const path = `${selected.store_id}/${crypto.randomUUID()}.webp`;
      const result = await supabase!.storage.from('product-images').upload(path, blob, { contentType: 'image/webp', upsert: false });
      if (result.error) throw result.error;
      setValues(v => ({ ...v, image_url: supabase!.storage.from('product-images').getPublicUrl(path).data.publicUrl }));
      setMessage('图片已上传，请保存商品以更新图片引用。只上传获准公开的素材。');
    });
  }
  function exportRows() {
    const file = new Blob([JSON.stringify(rows, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(file); const link = document.createElement('a'); link.href = url; link.download = `${table}-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url);
    setMessage('已导出当前可读取数据。此文件不包含 Storage 图片，不替代完整备份。');
  }

  if (!supabase) return <div className="startup"><h1>本地管理</h1><p>{configurationError || '请先在 .env.local 配置专用 Supabase 项目。'}</p><a href="#">返回找货页面</a></div>;
  if (!session) return <div className="startup"><span className="wordmark">棚<span>tana</span></span><h1>本地门店管理</h1><p>使用已授权的 Supabase 管理账号。顾客无需登录。</p><form className="admin-login" onSubmit={e => { e.preventDefault(); void run(async () => { const result=await supabase.auth.signInWithPassword({email,password}); if(result.error) throw result.error; setPassword(''); }); }}><label>邮箱<input type="email" required value={email} autoComplete="username" onChange={e => setEmail(e.target.value)} /></label><label>密码<input type="password" required value={password} autoComplete="current-password" onChange={e => setPassword(e.target.value)} /></label><button className="primary-button" disabled={busy}>登录</button></form><p role="status">{message}</p><a href="#">返回找货页面</a></div>;

  return <div className="admin-shell"><header className="admin-heading"><div><span className="wordmark">棚<span>tana</span></span><h1>本地门店管理</h1><p>{session.user.email} · 授权门店：{grants.join(', ') || '无'}</p></div><div><a href="#">查看门店</a><button onClick={() => void run(async () => { const r=await supabase.auth.signOut(); if(r.error) throw r.error; })}>退出</button></div></header>
    <div className="data-banner">大范围调整前先导出和备份，再下线门店；核实完成后发布。位置不等于库存。</div>
    <nav className="admin-tabs">{Object.entries(entities).map(([key, value]) => <button key={key} className={table === key ? 'active' : ''} onClick={() => { setTable(key); setValues({}); }} disabled={busy}>{value.label}</button>)}</nav>
    {message && <p role="status" className="admin-message">{message}</p>}
    <div className="admin-grid"><section><div className="admin-tools"><input aria-label="筛选记录" placeholder="筛选 ID / 名称 / 编号" value={filter} onChange={e => setFilter(e.target.value)} /><button disabled={busy || !grants.length || table === 'stores'} onClick={() => edit()}>新增</button><button disabled={busy} onClick={exportRows}>导出 JSON</button><button disabled={busy} onClick={() => void run(refreshRows)}>刷新</button></div><div className="admin-records">{rows.filter(row => JSON.stringify(row).toLowerCase().includes(filter.toLowerCase())).map(row => <button key={row.id} className={selected?.id === row.id ? 'active' : ''} onClick={() => edit(row)} disabled={busy}><strong>{show(row.name_zh || row.name || row.code || row.product_id || row.label || row.id)}</strong><small>{row.id}</small><span>{row.published === false || row.active === false || row.available === false ? '未公开 / 已停用' : ''}</span></button>)}{!rows.length && <p>暂无可维护记录。</p>}</div></section>
    <section className="admin-editor">{Object.keys(values).length ? <form onSubmit={e => void save(e)}><h2>{selected ? '编辑' : '新增'}{entities[table].label}</h2>{selected && <p className="admin-id">{selected.id} · 版本 {selected.version}</p>}{entities[table].fields.map(f => <label key={f.key}>{f.label}<small>{f.key}</small>{f.type === 'boolean' ? <select value={values[f.key] || 'false'} onChange={e => setValues(v => ({...v,[f.key]:e.target.value}))}><option value="true">是</option><option value="false">否</option></select> : <input type={f.type === 'number' ? 'number' : 'text'} step="any" value={values[f.key] || ''} onChange={e => setValues(v => ({...v,[f.key]:e.target.value}))} />}</label>)}{table === 'products' && selected && <label>上传商品图片<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => void upload(e.target.files?.[0])} /></label>}<button className="primary-button" disabled={busy || !grants.length}>{busy ? '处理中…' : '保存'}</button></form> : <div className="empty"><h3>选择记录开始维护</h3><p>新增门店和管理员授权通过 Supabase Dashboard 完成。</p></div>}</section></div>
    {table !== 'stores' && <section className="admin-import"><h2>CSV 批量新增</h2><p>第一行使用字段名称，必须有 id。最多 200 行，只新增；重复 ID 整批拒绝。列表字段用 | 分隔。</p><textarea aria-label="CSV 导入内容" value={csv} onChange={e => { setCsv(e.target.value); setPreview([]); }} placeholder={`id,${entities[table].fields.map(f => f.key).join(',')}`} /><button disabled={busy || !grants.length} onClick={() => { try { setPreview(importCSV(table,csv)); setMessage('预览已生成，请核对所有记录后导入。'); } catch(e) { setMessage(e instanceof Error ? e.message : '解析失败'); } }}>检查并预览</button>{preview.length > 0 && <><pre>{JSON.stringify(preview,null,2)}</pre><button className="primary-button" disabled={busy} onClick={() => void run(async () => { const r=await supabase.rpc('import_records',{target_table:table,rows:preview}); if(r.error) throw r.error; setPreview([]); setCsv(''); await refreshRows(); setMessage(`已原子导入 ${r.data} 行。`); })}>导入 {preview.length} 行</button></>}</section>}
  </div>;
}
