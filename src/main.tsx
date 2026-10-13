import React, { lazy, Suspense, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

const Admin = import.meta.env.DEV ? lazy(() => import('./Admin')) : null;
function Root() {
  const [admin, setAdmin] = useState(window.location.hash === '#admin');
  useEffect(() => { const read=()=>setAdmin(window.location.hash==='#admin'); window.addEventListener('hashchange',read); return ()=>window.removeEventListener('hashchange',read); },[]);
  return admin && Admin ? <Suspense fallback={<div className="startup">正在加载管理页面…</div>}><Admin /></Suspense> : <App />;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Root /></React.StrictMode>);
