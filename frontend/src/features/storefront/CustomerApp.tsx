import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, CircleAlert, Image as ImageIcon, LoaderCircle, MapPin, Shell, Sparkles } from 'lucide-react';
import { getAllImagesForShell, getShellById, getShellsForType, getShellTypes, type Shell as ShellRecord, type ShellImage, type ShellType } from '../../shared/api';
import { useAuth } from '../auth/AuthProvider';

const PAGE_SIZE = 12;
const title = (shell: ShellRecord) => shell.shell_name || 'Untitled shell';

export default function CustomerApp({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  const detailMatch = path.match(/^\/customers\/shell\/([^/]+)\/?$/);
  useEffect(() => { document.title = detailMatch ? 'Shell details — Shellhouse' : 'Shellhouse — The Shell Collection'; }, [detailMatch, path]);
  if (detailMatch) return <ShellDetails shellId={decodeURIComponent(detailMatch[1])} onNavigate={onNavigate} />;
  const typeFromPath = path.match(/^\/customers\/([^/]+)\/?$/);
  return <Storefront selectedTypeId={typeFromPath ? decodeURIComponent(typeFromPath[1]) : ''} onSelectType={id => onNavigate(id ? `/customers/${encodeURIComponent(id)}` : '/customers')} onNavigate={onNavigate} />;
}

function Storefront({ selectedTypeId, onSelectType, onNavigate }: { selectedTypeId: string; onSelectType: (id: string) => void; onNavigate: (path: string) => void }) {
  const [types, setTypes] = useState<ShellType[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [typesError, setTypesError] = useState('');
  const [initialTypeId, setInitialTypeId] = useState('');
  const [shells, setShells] = useState<ShellRecord[]>([]);
  const [images, setImages] = useState<Record<string, ShellImage | undefined>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [shellError, setShellError] = useState('');
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const activeTypeId = selectedTypeId || initialTypeId;
  const selectedType = types.find(type => type.type_id === activeTypeId);

  const loadTypes = useCallback(() => {
    let active = true;
    setTypesLoading(true); setTypesError('');
    getShellTypes().then(result => {
      if (!active) return;
      setTypes(result.data);
      if (result.data.length && !result.data.some(type => type.type_id === selectedTypeId)) {
        if (selectedTypeId) onSelectType(result.data[0].type_id);
        else setInitialTypeId(result.data[0].type_id);
      }
    }).catch(error => { if (active) setTypesError((error as Error).message); })
      .finally(() => { if (active) setTypesLoading(false); });
    return () => { active = false; };
  }, [onSelectType, selectedTypeId]);

  useEffect(() => loadTypes(), [loadTypes]);

  useEffect(() => {
    if (!activeTypeId || !selectedType) { setShells([]); setImages({}); setTotal(0); return; }
    let active = true;
    setLoading(true); setShellError(''); setFailed([]);
    getShellsForType(activeTypeId, page * PAGE_SIZE, PAGE_SIZE).then(async result => {
      if (!active) return;
      setShells(result.data); setTotal(result.pagination.total);
      const pairs = await Promise.all(result.data.map(async shell => {
        try {
          const response = await getAllImagesForShell(shell.shell_id);
          const bestImage = response.find(image => image.is_main_image && image.image_url) ?? response.find(image => image.image_url);
          return [shell.shell_id, bestImage] as const;
        } catch { return [shell.shell_id, undefined] as const; }
      }));
      if (active) setImages(Object.fromEntries(pairs));
    }).catch(error => { if (active) { setShells([]); setImages({}); setTotal(0); setShellError((error as Error).message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [activeTypeId, page, retry, selectedType]);

  const selectType = (id: string) => { if (id === activeTypeId) return; setPage(0); setInitialTypeId(id); onSelectType(id); };

  return <div className="storefront">
    <StoreHeader onNavigate={onNavigate} />
    <main>
      <section className="store-hero"><div className="store-hero-copy"><span className="store-kicker"><Sparkles size={14} /> A SHELL COLLECTOR’S EDIT</span><h1>Find a little<br /><em>wonder.</em></h1><p>Explore a considered collection of natural shells, each with its own story and place of origin.</p><a className="hero-link" href="#collection">Explore the collection <ArrowDown size={15} /></a></div><div className="hero-art" aria-hidden="true"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-shell">{images[shells[0]?.shell_id]?.image_url ? <img className="hero-photo" src={images[shells[0].shell_id]?.image_url ?? undefined} alt="" /> : <Shell size={104} strokeWidth={0.8} />}</div><span className="hero-caption">THE QUIET BEAUTY OF THE SHORE</span><span className="hero-index">01 — 04</span></div><div className="hero-footnote"><span>Curated natural specimens</span><span>Collected with care&nbsp; · &nbsp;Shared with wonder</span></div></section>
      <section id="collection" className="collection-section"><div className="collection-intro"><div><span className="store-kicker">THE COLLECTION</span><h2>Browse by shell type</h2><p>Choose a category to discover the shells within.</p></div><span className="collection-note">A living catalog of coastal forms</span></div>
        {typesLoading ? <div className="store-state"><LoaderCircle className="spin" size={22} /> Loading shell types…</div> : typesError ? <div className="store-error"><CircleAlert size={17} /><span>{typesError}</span><button onClick={() => { void loadTypes(); }}>Try again</button></div> : types.length === 0 ? <div className="store-empty"><div className="store-empty-icon"><Shell size={22} /></div><h3>The collection is taking shape</h3><p>Shell categories will appear here as they are added.</p></div> : <>
          <nav className="category-tabs" aria-label="Shell types">{types.map((type, index) => <button key={type.type_id} className={activeTypeId === type.type_id ? 'active' : ''} aria-pressed={activeTypeId === type.type_id} onClick={() => selectType(type.type_id)}><span className="category-number">{String(index + 1).padStart(2, '0')}</span>{type.shell_type_name || 'Unnamed type'}<span className="category-arrow"><ArrowRight size={14} /></span></button>)}</nav>
          <div className="products-heading"><div><span className="store-kicker">{selectedType?.shell_type_name || 'SELECTED CATEGORY'}</span><h2>{selectedType?.shell_type_name || 'Shells'}</h2></div><span>{total} {total === 1 ? 'specimen' : 'specimens'}</span></div>
          {shellError && <div className="store-error"><CircleAlert size={17} /><span>{shellError}</span><button onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
          {loading ? <div className="store-state"><LoaderCircle className="spin" size={22} /> Gathering the collection…</div> : shellError ? null : shells.length === 0 ? <div className="store-empty"><div className="store-empty-icon"><Shell size={22} /></div><h3>No specimens in this category yet</h3><p>Check back as the collection grows.</p></div> : <div className="product-grid">{shells.map((shell, index) => {
            const image = images[shell.shell_id]; const imageFailed = failed.includes(shell.shell_id);
            return <a className="product-card" href={`/customers/shell/${encodeURIComponent(shell.shell_id)}`} target="_blank" rel="noopener noreferrer" key={shell.shell_id} aria-label={`View details for ${title(shell)}`} style={{ animationDelay: `${Math.min(index * 35, 210)}ms` }}>
              <div className="product-image">{image?.image_url && !imageFailed ? <img src={image.image_url} alt={title(shell)} loading="lazy" onError={() => setFailed(current => current.includes(shell.shell_id) ? current : [...current, shell.shell_id])} /> : <div className="product-placeholder"><Shell size={34} strokeWidth={1} /><span>Image unavailable</span></div>}<span className="view-product">View specimen <ArrowRight size={14} /></span></div>
              <div className="product-info"><div><h3>{title(shell)}</h3><p>{shell.author || 'Author not recorded'}</p></div><span className="product-number">{String(page * PAGE_SIZE + index + 1).padStart(2, '0')}</span></div>
              {shell.locality && <div className="product-origin"><MapPin size={13} />{shell.locality}</div>}
            </a>;
          })}</div>}
          {!loading && !shellError && total > PAGE_SIZE && <div className="store-pagination"><span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span><div><button aria-label="Previous page" disabled={page === 0} onClick={() => setPage(value => value - 1)}><ChevronLeft size={17} /></button><span>{page + 1} <i>/</i> {Math.ceil(total / PAGE_SIZE)}</span><button aria-label="Next page" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(value => value + 1)}><ChevronRight size={17} /></button></div></div>}
        </>}
      </section>
    </main>
    <StoreFooter onNavigate={onNavigate} />
  </div>;
}

function ShellDetails({ shellId, onNavigate }: { shellId: string; onNavigate: (path: string) => void }) {
  const [shell, setShell] = useState<ShellRecord | null>(null);
  const [types, setTypes] = useState<ShellType[]>([]);
  const [images, setImages] = useState<ShellImage[]>([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [retry, setRetry] = useState(0);
  const [broken, setBroken] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState(false);
  const [freshening, setFreshening] = useState(false);
  const [urlRetries, setUrlRetries] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setImageError(''); setNotFound(false); setImages([]); setShell(null); setSelectedImage(0); setBroken([]); setUrlRetries([]);
    Promise.all([getShellById(shellId), getShellTypes().catch(() => ({ data: [] as ShellType[] }))]).then(async ([shellResult, typeResult]) => {
      if (!active) return;
      if (shellResult.data.shell_id !== shellId) { setNotFound(true); return; }
      setShell(shellResult.data); setTypes(typeResult.data);
      try { const imageRecords = await getAllImagesForShell(shellId); if (active) setImages(imageRecords.filter(image => image.shell_id === shellId)); }
      catch (imageLoadError) { if (active) setImageError((imageLoadError as Error).message); }
    }).catch(error => {
      if (!active) return;
      const message = (error as Error).message;
      if (message.includes('(404)') || message.toLowerCase().includes('not found')) setNotFound(true);
      else setError(message);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry, shellId]);

  useEffect(() => { if (!lightbox) return; const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') setLightbox(false); }; window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown); }, [lightbox]);

  const refreshImages = async () => {
    setFreshening(true);
    setImageError('');
    try { const records = await getAllImagesForShell(shellId); setImages(records.filter(image => image.shell_id === shellId)); setSelectedImage(0); setBroken([]); }
    catch (error) { setImageError((error as Error).message); }
    finally { setFreshening(false); }
  };

  const currentImage = images[selectedImage];
  const currentImageFailed = currentImage ? broken.includes(currentImage.image_id) : false;
  const handleImageFailure = (image: ShellImage) => {
    setBroken(current => current.includes(image.image_id) ? current : [...current, image.image_id]);
    if (!urlRetries.includes(image.image_id)) {
      setUrlRetries(current => [...current, image.image_id]);
      void refreshImages();
    }
  };
  const shellTypeName = types.find(type => type.type_id === shell?.shell_type_id)?.shell_type_name;
  useEffect(() => { document.title = shell ? `${title(shell)} — Shellhouse` : 'Shell details — Shellhouse'; }, [shell]);
  const infoRows = shell ? [
    ['Scientific author', shell.author], ['Locality', shell.locality], ['Depth', shell.deepness], ['Source', shell.from]
  ].filter((row): row is [string, string] => Boolean(row[1])) : [];

  return <div className="storefront details-storefront">
    <StoreHeader onNavigate={onNavigate} />
    <main className="detail-main"><a className="back-to-store" href="/customers" onClick={event => { event.preventDefault(); onNavigate('/customers'); }}><ArrowLeft size={15} /> Back to collection</a>
      {loading ? <div className="detail-state"><LoaderCircle className="spin" size={24} /> Opening specimen…</div> : notFound ? <div className="detail-state detail-empty"><div className="store-empty-icon"><Shell size={24} /></div><h1>Specimen not found</h1><p>This shell may have been removed or is no longer available.</p><a className="detail-back-button" href="/customers" onClick={event => { event.preventDefault(); onNavigate('/customers'); }}>Browse the collection</a></div> : error && !shell ? <div className="store-error"><CircleAlert size={18} /><span>{error}</span><button onClick={() => setRetry(value => value + 1)}>Try again</button></div> : shell && <div className="detail-layout">
        <section className="detail-gallery"><div className="detail-main-image" onClick={() => currentImage?.image_url && !currentImageFailed && setLightbox(true)}>{currentImage?.image_url && !currentImageFailed ? <img src={currentImage.image_url} alt={title(shell)} onError={() => handleImageFailure(currentImage)} /> : <div className="detail-placeholder"><Shell size={56} strokeWidth={.8} /><span>{images.length ? 'This image could not be loaded' : 'No images for this specimen yet'}</span></div>}{currentImage?.image_url && !currentImageFailed && <span className="enlarge-image">Click to enlarge</span>}</div>
          {images.length > 0 && <div className="thumbnail-row" aria-label="Shell images">{images.map((image, index) => <button key={image.image_id} className={`image-thumbnail ${selectedImage === index ? 'active' : ''}`} aria-label={`Show image ${index + 1}`} aria-pressed={selectedImage === index} onClick={() => setSelectedImage(index)}>{image.image_url && !broken.includes(image.image_id) ? <img src={image.image_url} alt={`${title(shell)} view ${index + 1}`} onError={() => handleImageFailure(image)} /> : <span><ImageIcon size={17} /></span>}</button>)}</div>}
          {imageError && <div className="image-load-error"><span>Images couldn’t be loaded.</span><button onClick={() => void refreshImages()} disabled={freshening}>{freshening && <LoaderCircle className="spin" size={13} />} Try again</button></div>}{currentImageFailed && !imageError && <button className="refresh-images" onClick={() => void refreshImages()} disabled={freshening}>{freshening && <LoaderCircle className="spin" size={14} />} Refresh image links</button>}</section>
        <section className="detail-copy"><div className="store-kicker">{shellTypeName || 'SHELL SPECIMEN'}</div><h1>{title(shell)}</h1><p className="detail-author">{shell.author || 'Author not recorded'}</p><div className="detail-rule" /><div className="detail-description">{shell.note ? <p>{shell.note}</p> : <p>No additional description is available.</p>}</div>
          {infoRows.length > 0 && <dl className="detail-facts">{infoRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
          {shell.is_deleted && <div className="unavailable-note">This specimen is currently unavailable.</div>}
          <a className="detail-collection-link" href="/customers" onClick={event => { event.preventDefault(); onNavigate('/customers'); }}>Discover more shells <ArrowRight size={15} /></a>
        </section>
      </div>}
    </main><StoreFooter onNavigate={onNavigate} />
    {lightbox && currentImage?.image_url && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Expanded shell photograph" onClick={() => setLightbox(false)}><button aria-label="Close image" onClick={() => setLightbox(false)}>×</button><img src={currentImage.image_url} alt={title(shell!)} /></div>}
  </div>;
}

function StoreHeader({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user, role, signOut } = useAuth();
  const isStaff = role === 'admin' || role === 'superadmin';
  return <header className="store-header"><a href="/customers" className="store-brand" onClick={event => { event.preventDefault(); onNavigate('/customers'); }}><span className="store-brand-mark"><Shell size={21} /></span><span>shellhouse<small>THE SHELL COLLECTION</small></span></a><nav className="store-header-nav"><a href="/customers#collection" onClick={event => { if (window.location.pathname !== '/customers') { event.preventDefault(); onNavigate('/customers'); } }}>The collection</a><a href="/customers#about">Our approach</a></nav><div className="store-header-actions"><a className="header-collection-link" href="/customers#collection" onClick={event => { if (window.location.pathname !== '/customers') { event.preventDefault(); onNavigate('/customers'); } }}>Explore <ArrowRight size={14} /></a>{isStaff ? <><a className="store-signout" href="/admin" onClick={event => { event.preventDefault(); onNavigate('/admin'); }}>Admin</a><button className="store-signout" title={user?.email || 'Sign out'} onClick={() => void signOut().catch(signOutError => window.alert((signOutError as Error).message))}>Sign out</button></> : <a className="store-signout" href="/sign-in" onClick={event => { event.preventDefault(); onNavigate('/sign-in'); }}>Staff sign in</a>}</div></header>;
}

function StoreFooter({ onNavigate }: { onNavigate: (path: string) => void }) {
  return <footer id="about" className="store-footer"><a href="/customers" className="footer-brand" onClick={event => { event.preventDefault(); onNavigate('/customers'); }}><Shell size={17} /> shellhouse</a><span>Natural forms, thoughtfully collected.</span><span>© Shellhouse Collection</span></footer>;
}
