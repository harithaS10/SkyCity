import { useState, useEffect, useCallback } from 'react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://www.vivifysoft.in/VivifyReports';
const ACCENT_PALETTE = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ec4899","#ef4444","#06b6d4","#f97316"];

function getHeaders() {
  const token = localStorage.getItem('authToken');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
function formatPrice(price) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(price);
}
function getImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${BASE_URL}/${url.replace(/^\//, '')}`;
}
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return isMobile;
}

// Detect dark mode from the <html> element class
function useIsDark() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; } button { font-family: inherit; }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideInRight { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
  @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
`;

function Spinner({ t }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:48 }}>
      <div style={{ width:32, height:32, border:`3px solid ${t.border}`, borderTop:'3px solid #6366f1', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
    </div>
  );
}
function Empty({ icon, title, subtitle, t }) {
  return (
    <div style={{ textAlign:'center', padding:48, border:`2px dashed ${t.border}`, borderRadius:16, background:t.cardBg }}>
      <span style={{ fontSize:48, display:'block', marginBottom:16 }}>{icon}</span>
      <p style={{ margin:'0 0 8px', fontSize:16, fontWeight:600, color:t.text }}>{title}</p>
      <p style={{ margin:0, fontSize:14, color:t.muted }}>{subtitle}</p>
    </div>
  );
}
function BackButton({ onBack, t }) {
  return (
    <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10, border:`1px solid ${t.border}`, background:t.cardBg, cursor:'pointer', fontSize:13, fontWeight:600, color:t.text }}>
      ← Back
    </button>
  );
}

// Shared cascading state logic — used by both Web and Mobile views
function useCascadingNav() {
  const [view, setView] = useState('categories');
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    fetch(`${BASE_URL}/api/categories`, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => { if (d.success && d.data) setCategories(d.data); })
      .catch(console.error).finally(() => setIsLoading(false));
  }, []);

  const selectCategory = useCallback((cat) => {
    setSelectedCategory(cat); setView('subcategories'); setIsLoading(true);
    fetch(`${BASE_URL}/api/subcategories?categoryId=${cat.id}`, { headers: getHeaders() })
      .then(r => r.json()).then(d => { if (d.success && d.data) setSubCategories(d.data); })
      .catch(console.error).finally(() => setIsLoading(false));
  }, []);

  const selectSubCategory = useCallback((sc) => {
    setSelectedSubCategory(sc); setView('products'); setIsLoading(true);
    fetch(`${BASE_URL}/api/products?subCategoryId=${sc.id}`, { headers: getHeaders() })
      .then(r => r.json()).then(d => { if (d.success && d.data) setProducts(d.data); })
      .catch(console.error).finally(() => setIsLoading(false));
  }, []);

  const selectProduct = (p) => { setSelectedProduct(p); setView('detail'); };

  return { view, setView, categories, subCategories, products, selectedCategory, selectedSubCategory, selectedProduct, isLoading, selectCategory, selectSubCategory, selectProduct };
}

// Breadcrumb — shared
function Breadcrumb({ view, setView, selectedCategory, selectedSubCategory, selectedProduct, t }) {
  if (view === 'categories') return null;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:20, fontSize:12, color:t.muted, flexWrap:'wrap' }}>
      <span style={{ cursor:'pointer', color:'#6366f1', fontWeight:600 }} onClick={() => setView('categories')}>Home</span>
      {selectedCategory && (<><span>›</span><span style={{ cursor: view==='subcategories'?'default':'pointer', color: view==='subcategories'?t.text:'#6366f1', fontWeight:600 }} onClick={() => view!=='subcategories' && setView('subcategories')}>{selectedCategory.categoryName}</span></>)}
      {selectedSubCategory && view!=='subcategories' && (<><span>›</span><span style={{ cursor: view==='products'?'default':'pointer', color: view==='products'?t.text:'#6366f1', fontWeight:600 }} onClick={() => view!=='products' && setView('products')}>{selectedSubCategory.subCategoryName}</span></>)}
      {view==='detail' && selectedProduct && (<><span>›</span><span style={{ color:t.text, fontWeight:600 }}>{selectedProduct.productName}</span></>)}
    </div>
  );
}

// ── WEB VIEW — cascading with grid cards ──────────────────────────────────────
function WebView() {
  const isDark = useIsDark();
  const t = {
    bg:      isDark ? 'linear-gradient(160deg,#0f172a 0%,#1e293b 100%)' : 'linear-gradient(160deg,#f8fafc 0%,#f1f5f9 100%)',
    cardBg:  isDark ? '#1e293b' : '#fff',
    cardBorder: isDark ? '#334155' : '#f1f5f9',
    text:    isDark ? '#f1f5f9' : '#0f172a',
    muted:   isDark ? '#94a3b8' : '#94a3b8',
    border:  isDark ? '#334155' : '#e5e7eb',
    imgBg:   isDark ? '#0f172a' : '#f8fafc',
    badgeBg: isDark ? '#0f172a' : '#f0f9ff',
    badgeBorder: isDark ? '#1e40af' : '#bae6fd',
    badgeText: isDark ? '#93c5fd' : '#0284c7',
    descText: isDark ? '#94a3b8' : '#6b7280',
  };

  const nav = useCascadingNav();
  const { view, setView, categories, subCategories, products, selectedCategory, selectedSubCategory, selectedProduct, isLoading, selectCategory, selectSubCategory, selectProduct } = nav;

  return (
    <div style={{ minHeight:'100vh', background:t.bg, padding:'48px 20px', fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{GLOBAL_STYLE}</style>
      <div style={{ maxWidth:960, margin:'0 auto' }}>
        <Breadcrumb {...nav} t={t} />

        {/* Categories */}
        {view === 'categories' && (
          <div>
            <div style={{ marginBottom:36, animation:'slideUp 0.4s ease' }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:t.badgeBg, border:`1px solid ${t.badgeBorder}`, borderRadius:20, padding:'6px 14px', marginBottom:12 }}>
                <span>🛡️</span><span style={{ fontSize:12, fontWeight:700, color:t.badgeText, letterSpacing:'0.05em' }}>SECURITY INFRASTRUCTURE</span>
              </div>
              <h1 style={{ margin:'0 0 8px', fontSize:32, fontWeight:900, color:t.text, letterSpacing:'-0.04em' }}>Security Systems</h1>
              <p style={{ margin:0, fontSize:14, color:t.muted }}>Select a category to explore sub-categories and products</p>
            </div>
            {isLoading ? <Spinner t={t} /> : !categories.length ? <Empty icon="📂" title="No categories found" subtitle="Add categories from the admin panel" t={t} /> : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16 }}>
                {categories.map((cat, i) => {
                  const accent = ACCENT_PALETTE[i % ACCENT_PALETTE.length];
                  return (
                    <button key={cat.id} onClick={() => selectCategory(cat)}
                      style={{ background:t.cardBg, border:`1.5px solid ${t.cardBorder}`, borderRadius:20, padding:24, cursor:'pointer', textAlign:'left', boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.05)', transition:'all 0.25s', animation:`slideUp 0.4s ease ${i*70}ms both`, position:'relative', overflow:'hidden' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor=accent; e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow=`0 16px 40px ${accent}30`; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor=t.cardBorder; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow= isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.05)'; }}
                    >
                      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:accent, borderRadius:'20px 20px 0 0' }} />
                      <div style={{ width:52, height:52, borderRadius:16, background:`${accent}25`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, marginBottom:16, marginTop:8 }}>📦</div>
                      <p style={{ margin:'0 0 4px', fontSize:17, fontWeight:800, color:t.text }}>{cat.categoryName}</p>
                      <p style={{ margin:'0 0 20px', fontSize:12, color:t.muted }}>Click to view sub-categories</p>
                      <span style={{ fontSize:11, fontWeight:700, color:accent, background:`${accent}20`, padding:'4px 10px', borderRadius:20 }}>Explore →</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SubCategories */}
        {view === 'subcategories' && (
          <div style={{ animation:'slideInRight 0.35s cubic-bezier(0.4,0,0.2,1)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
              <BackButton onBack={() => setView('categories')} t={t} />
              <span style={{ fontSize:20, fontWeight:800, color:t.text }}>{selectedCategory?.categoryName}</span>
            </div>
            {isLoading ? <Spinner t={t} /> : !subCategories.length ? <Empty icon="📁" title="No sub-categories found" subtitle="This category has no sub-categories yet" t={t} /> : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:16 }}>
                {subCategories.map((sc, i) => {
                  const a = ACCENT_PALETTE[(i+2) % ACCENT_PALETTE.length];
                  return (
                    <button key={sc.id} onClick={() => selectSubCategory(sc)}
                      style={{ background:t.cardBg, border:`1.5px solid ${t.cardBorder}`, borderRadius:16, padding:20, cursor:'pointer', textAlign:'left', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)', transition:'all 0.2s', animation:`slideUp 0.4s ease ${i*60}ms both`, position:'relative', overflow:'hidden' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor=a; e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow=`0 12px 32px ${a}30`; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor=t.cardBorder; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow= isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)'; }}
                    >
                      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:a }} />
                      <div style={{ width:44, height:44, borderRadius:12, background:`${a}25`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, marginBottom:12, marginTop:6 }}>🗂️</div>
                      <p style={{ margin:'0 0 4px', fontSize:15, fontWeight:700, color:t.text }}>{sc.subCategoryName}</p>
                      {sc.description && <p style={{ margin:'0 0 12px', fontSize:12, color:t.muted, lineHeight:1.4 }}>{sc.description}</p>}
                      <span style={{ fontSize:11, fontWeight:700, color:a, background:`${a}20`, padding:'3px 8px', borderRadius:20 }}>{sc.productCount ?? 0} products</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Products */}
        {view === 'products' && (
          <div style={{ animation:'slideInRight 0.35s cubic-bezier(0.4,0,0.2,1)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
              <BackButton onBack={() => setView('subcategories')} t={t} />
              <div><span style={{ fontSize:12, color:t.muted }}>{selectedCategory?.categoryName} / </span><span style={{ fontSize:18, fontWeight:800, color:t.text }}>{selectedSubCategory?.subCategoryName}</span></div>
            </div>
            {isLoading ? <Spinner t={t} /> : !products.length ? <Empty icon="📦" title="No products found" subtitle="No products in this sub-category yet" t={t} /> : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:20 }}>
                {products.map((p, i) => (
                  <div key={p.id} style={{ background:t.cardBg, border:`1.5px solid ${t.cardBorder}`, borderRadius:16, overflow:'hidden', boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.05)', transition:'all 0.25s', animation:`slideUp 0.4s ease ${i*50}ms both`, cursor:'pointer' }}
                    onClick={() => selectProduct(p)}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='#6366f1'; e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 16px 40px rgba(99,102,241,0.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor=t.cardBorder; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow= isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.05)'; }}
                  >
                    <div style={{ width:'100%', height:160, background:t.imgBg, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', position:'relative' }}>
                      {p.imageUrl ? <img src={getImageUrl(p.imageUrl)} alt={p.productName} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:40 }}>📦</span>}
                      <div style={{ position:'absolute', top:8, left:8, display:'flex', flexDirection:'column', gap:4 }}>
                        <span style={{ background:'#6366f1', color:'#fff', padding:'3px 8px', borderRadius:6, fontSize:10, fontWeight:700 }}>{p.categoryName}</span>
                        {p.subCategoryName && <span style={{ background:'#8b5cf6', color:'#fff', padding:'3px 8px', borderRadius:6, fontSize:10, fontWeight:700 }}>{p.subCategoryName}</span>}
                      </div>
                    </div>
                    <div style={{ padding:16 }}>
                      <h3 style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:t.text, lineHeight:1.3 }}>{p.productName}</h3>
                      <div style={{ fontSize:18, fontWeight:800, color:'#059669', marginBottom:10 }}>{formatPrice(p.price)}</div>
                      {p.description && <p style={{ margin:'0 0 12px', fontSize:12, color:t.descText, lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.description}</p>}
                      <button onClick={e => { e.stopPropagation(); selectProduct(p); }} style={{ width:'100%', padding:10, borderRadius:10, border:'none', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>View Details →</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Detail */}
        {view === 'detail' && selectedProduct && (
          <div style={{ animation:'slideInRight 0.35s cubic-bezier(0.4,0,0.2,1)', maxWidth:600, margin:'0 auto' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
              <BackButton onBack={() => setView('products')} t={t} />
              <span style={{ fontSize:16, fontWeight:700, color:t.text }}>Product Details</span>
            </div>
            <div style={{ background:t.cardBg, borderRadius:20, overflow:'hidden', boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 24px rgba(0,0,0,0.08)' }}>
              <div style={{ width:'100%', height:280, background:t.imgBg, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                {selectedProduct.imageUrl ? <img src={getImageUrl(selectedProduct.imageUrl)} alt={selectedProduct.productName} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:64 }}>📦</span>}
              </div>
              <div style={{ padding:28 }}>
                <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
                  <span style={{ background:'#6366f120', color:'#6366f1', padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700 }}>{selectedProduct.categoryName}</span>
                  {selectedProduct.subCategoryName && <span style={{ background:'#8b5cf620', color:'#8b5cf6', padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700 }}>{selectedProduct.subCategoryName}</span>}
                </div>
                <h2 style={{ margin:'0 0 8px', fontSize:24, fontWeight:800, color:t.text }}>{selectedProduct.productName}</h2>
                <div style={{ fontSize:28, fontWeight:900, color:'#059669', marginBottom:16 }}>{formatPrice(selectedProduct.price)}</div>
                {selectedProduct.description && <p style={{ margin:0, fontSize:14, color:t.descText, lineHeight:1.6 }}>{selectedProduct.description}</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MOBILE VIEW — cascading with list cards ───────────────────────────────────
function MobileView() {
  const isDark = useIsDark();
  const t = {
    bg:       isDark ? 'linear-gradient(160deg,#0f172a 0%,#1e293b 100%)' : 'linear-gradient(160deg,#f8fafc 0%,#f1f5f9 100%)',
    cardBg:   isDark ? '#1e293b' : '#fff',
    cardBorder: isDark ? '#334155' : '#f1f5f9',
    text:     isDark ? '#f1f5f9' : '#0f172a',
    muted:    isDark ? '#94a3b8' : '#94a3b8',
    border:   isDark ? '#334155' : '#e5e7eb',
    imgBg:    isDark ? '#0f172a' : '#f8fafc',
    badgeBg:  isDark ? '#0f172a' : '#f0f9ff',
    badgeBorder: isDark ? '#1e40af' : '#bae6fd',
    badgeText: isDark ? '#93c5fd' : '#0284c7',
    descText: isDark ? '#94a3b8' : '#6b7280',
  };

  const nav = useCascadingNav();
  const { view, setView, categories, subCategories, products, selectedCategory, selectedSubCategory, selectedProduct, isLoading, selectCategory, selectSubCategory, selectProduct } = nav;

  return (
    <div style={{ minHeight:'100vh', background:t.bg, padding:'20px 16px', fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{GLOBAL_STYLE}</style>

      {view === 'categories' && (
        <div style={{ marginBottom:24, animation:'slideUp 0.4s ease' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:t.badgeBg, border:`1px solid ${t.badgeBorder}`, borderRadius:20, padding:'5px 12px', marginBottom:10 }}>
            <span>🛡️</span><span style={{ fontSize:11, fontWeight:700, color:t.badgeText }}>SECURITY INFRASTRUCTURE</span>
          </div>
          <h1 style={{ margin:'0 0 6px', fontSize:24, fontWeight:900, color:t.text }}>Security Systems</h1>
          <p style={{ margin:0, fontSize:13, color:t.muted }}>Tap a category to explore</p>
        </div>
      )}

      <Breadcrumb {...nav} t={t} />

      {/* Categories */}
      {view === 'categories' && (
        isLoading ? <Spinner t={t} /> : !categories.length ? <Empty icon="📂" title="No categories found" subtitle="Add categories from the admin panel" t={t} /> : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {categories.map((cat, i) => {
              const accent = ACCENT_PALETTE[i % ACCENT_PALETTE.length];
              return (
                <button key={cat.id} onClick={() => selectCategory(cat)}
                  style={{ background:t.cardBg, border:`1.5px solid ${accent}30`, borderRadius:16, padding:'16px 18px', cursor:'pointer', textAlign:'left', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)', transition:'all 0.2s', animation:`slideUp 0.4s ease ${i*60}ms both`, display:'flex', alignItems:'center', gap:14, position:'relative', overflow:'hidden' }}
                >
                  <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, background:accent, borderRadius:'16px 0 0 16px' }} />
                  <div style={{ width:44, height:44, borderRadius:12, background:`${accent}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>📦</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:'0 0 3px', fontSize:15, fontWeight:700, color:t.text }}>{cat.categoryName}</p>
                    <p style={{ margin:0, fontSize:12, color:t.muted }}>Tap to view sub-categories</p>
                  </div>
                  <span style={{ fontSize:18, color:accent, flexShrink:0 }}>›</span>
                </button>
              );
            })}
          </div>
        )
      )}

      {/* SubCategories */}
      {view === 'subcategories' && (
        isLoading ? <Spinner t={t} /> : !subCategories.length ? <Empty icon="📁" title="No sub-categories" subtitle="This category has no sub-categories yet" t={t} /> : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {subCategories.map((sc, i) => {
              const a = ACCENT_PALETTE[(i+2) % ACCENT_PALETTE.length];
              return (
                <button key={sc.id} onClick={() => selectSubCategory(sc)}
                  style={{ background:t.cardBg, border:`1.5px solid ${a}30`, borderRadius:16, padding:'16px 18px', cursor:'pointer', textAlign:'left', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)', transition:'all 0.2s', animation:`slideUp 0.4s ease ${i*60}ms both`, display:'flex', alignItems:'center', gap:14, position:'relative', overflow:'hidden' }}
                >
                  <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, background:a, borderRadius:'16px 0 0 16px' }} />
                  <div style={{ width:44, height:44, borderRadius:12, background:`${a}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>🗂️</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:'0 0 3px', fontSize:15, fontWeight:700, color:t.text }}>{sc.subCategoryName}</p>
                    {sc.description && <p style={{ margin:'0 0 3px', fontSize:12, color:t.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sc.description}</p>}
                    <p style={{ margin:0, fontSize:11, color:a, fontWeight:600 }}>{sc.productCount ?? 0} products</p>
                  </div>
                  <span style={{ fontSize:18, color:a, flexShrink:0 }}>›</span>
                </button>
              );
            })}
          </div>
        )
      )}

      {/* Products */}
      {view === 'products' && (
        isLoading ? <Spinner t={t} /> : !products.length ? <Empty icon="📦" title="No products found" subtitle="No products in this sub-category yet" t={t} /> : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {products.map((p, i) => (
              <div key={p.id} style={{ background:t.cardBg, border:`1.5px solid ${t.cardBorder}`, borderRadius:16, overflow:'hidden', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)', animation:`slideUp 0.4s ease ${i*50}ms both`, cursor:'pointer' }}
                onClick={() => selectProduct(p)}
              >
                <div style={{ display:'flex' }}>
                  <div style={{ width:100, height:100, background:t.imgBg, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
                    {p.imageUrl ? <img src={getImageUrl(p.imageUrl)} alt={p.productName} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:32 }}>📦</span>}
                  </div>
                  <div style={{ padding:'12px 14px', flex:1, minWidth:0 }}>
                    <h3 style={{ margin:'0 0 4px', fontSize:14, fontWeight:700, color:t.text, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.productName}</h3>
                    <div style={{ fontSize:16, fontWeight:800, color:'#059669', marginBottom:6 }}>{formatPrice(p.price)}</div>
                    {p.description && <p style={{ margin:'0 0 8px', fontSize:11, color:t.descText, lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.description}</p>}
                    <span style={{ fontSize:10, fontWeight:700, color:'#8b5cf6', background:'#8b5cf615', padding:'2px 8px', borderRadius:20 }}>{selectedSubCategory?.subCategoryName}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Detail */}
      {view === 'detail' && selectedProduct && (
        <div style={{ animation:'slideInRight 0.35s cubic-bezier(0.4,0,0.2,1)' }}>
          <div style={{ marginBottom:16 }}>
            <BackButton onBack={() => setView('products')} t={t} />
          </div>
          <div style={{ background:t.cardBg, borderRadius:20, overflow:'hidden', boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 24px rgba(0,0,0,0.08)' }}>
            <div style={{ width:'100%', height:220, background:t.imgBg, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
              {selectedProduct.imageUrl ? <img src={getImageUrl(selectedProduct.imageUrl)} alt={selectedProduct.productName} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:56 }}>📦</span>}
            </div>
            <div style={{ padding:20 }}>
              <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
                <span style={{ background:'#6366f115', color:'#6366f1', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{selectedProduct.categoryName}</span>
                {selectedProduct.subCategoryName && <span style={{ background:'#8b5cf615', color:'#8b5cf6', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{selectedProduct.subCategoryName}</span>}
              </div>
              <h2 style={{ margin:'0 0 8px', fontSize:20, fontWeight:800, color:t.text }}>{selectedProduct.productName}</h2>
              <div style={{ fontSize:24, fontWeight:900, color:'#059669', marginBottom:12 }}>{formatPrice(selectedProduct.price)}</div>
              {selectedProduct.description && <p style={{ margin:0, fontSize:13, color:t.descText, lineHeight:1.6 }}>{selectedProduct.description}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function SecurityComponents() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileView /> : <WebView />;
}
