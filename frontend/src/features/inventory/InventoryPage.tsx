import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Boxes, ChevronLeft, ChevronRight, CircleAlert, Image as ImageIcon, Layers3, LoaderCircle, Menu, Plus, Search, Shell as ShellIcon, Tags, UsersRound, X } from 'lucide-react';
import InventoryTable from './components/InventoryTable';
import RecordModal from './components/RecordModal';
import type { Shell, ShellType, StockType } from '../../shared/api';
import { deleteInventoryRecord, getInventoryRecord, inventoryRecordId, inventoryRecordLabel, listInventory, listInventoryLookups, saveInventoryRecord } from './api/inventoryApi';

import type { InventorySection } from './types';
type Section = InventorySection;
const PAGE_SIZE = 12;
const nav: { id: Section | 'customers'; label: string; icon: typeof ShellIcon; group: string }[] = [
  { id: 'shells', label: 'Shell collection', icon: ShellIcon, group: 'COLLECTION' },
  { id: 'stock-info', label: 'Stock information', icon: Boxes, group: 'COLLECTION' },
  { id: 'images', label: 'Image library', icon: ImageIcon, group: 'COLLECTION' },
  { id: 'customers', label: 'Customers', icon: UsersRound, group: 'COLLECTION' },
  { id: 'stock-types', label: 'Stock types', icon: Tags, group: 'CATALOGS' },
  { id: 'shell-types', label: 'Shell types', icon: Layers3, group: 'CATALOGS' },
];
const titles: Record<Section, { title: string; sub: string }> = {
  shells: { title: 'Shell collection', sub: 'A field guide to every shell in your collection.' },
  'stock-types': { title: 'Stock types', sub: 'Manage the ways your shells are stored.' },
  'shell-types': { title: 'Shell types', sub: 'Organize your collection by shell type.' },
  'stock-info': { title: 'Stock information', sub: 'Keep tabs on quantities and availability.' },
  images: { title: 'Image library', sub: 'Photographs and reference images for your shells.' },
};

export default function InventoryPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [section, setSection] = useState<Section>('shells'), [page, setPage] = useState(0), [search, setSearch] = useState(''), [includeDeleted, setIncludeDeleted] = useState(false), [data, setData] = useState<unknown[]>([]), [total, setTotal] = useState(0), [shells, setShells] = useState<Shell[]>([]), [stocks, setStocks] = useState<StockType[]>([]), [types, setTypes] = useState<ShellType[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [dialog, setDialog] = useState<unknown | null>(null), [saving, setSaving] = useState(false), [toast, setToast] = useState(''), [mobileNav, setMobileNav] = useState(false);
  const openSection = useCallback((target: Section) => { onNavigate('/admin'); setSection(target); setPage(0); setSearch(''); setError(''); setMobileNav(false); }, [onNavigate]);
  const meta = titles[section];
  const load = useCallback(async () => { setLoading(true); setError(''); try { const result = await listInventory(section, page, PAGE_SIZE, search, includeDeleted); setData(result.data); setTotal(result.pagination.total); } catch (e) { setError((e as Error).message); setData([]); setTotal(0); } finally { setLoading(false); } }, [section, page, search, includeDeleted]);
  const loadLookups = useCallback(async () => { try { const lookups = await listInventoryLookups(); setShells(lookups.shells); setStocks(lookups.stocks); setTypes(lookups.types); } catch { /* Lookup errors are reported by the active list request. */ } }, []);
  useEffect(() => { void load(); }, [load]); useEffect(() => { void loadLookups(); }, [loadLookups]);
  const notify = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(''), 2600) };
  const beginEdit = async (item: unknown) => { if (section === 'images') { setDialog({ mode: 'edit', item }); return; } try { const result = await getInventoryRecord(section, inventoryRecordId(section, item)); setDialog({ mode: 'edit', item: result.data }); } catch (e) { setError((e as Error).message); } };
  const save = async (form: HTMLFormElement) => {
    setSaving(true);
    try {
      const state = dialog as { mode: 'create' | 'edit'; item?: Record<string, unknown> };
      await saveInventoryRecord(section, form, state);
      setDialog(null);
      notify(state.mode === 'edit' ? 'Changes saved' : 'Record created');
      void load();
      void loadLookups();
    } finally {
      setSaving(false);
    }
  };
  const remove = async (item: unknown) => {
    const id = inventoryRecordId(section, item);
    if (!window.confirm(`Delete ${inventoryRecordLabel(section, item)}?`)) return;
    try {
      await deleteInventoryRecord(section, id);
      notify(section === 'shells' ? 'Shell moved to deleted' : 'Record deleted');
      void load();
      void loadLookups();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const groups = useMemo(() => Array.from(new Set(nav.map(x => x.group))), []);
  return <div className="app-shell"><aside className={`sidebar ${mobileNav ? 'open' : ''}`}><div className="brand"><div className="brand-mark"><ShellIcon size={21} /></div><span>shellhouse</span><button className="mobile-close" onClick={() => setMobileNav(false)}><X size={18} /></button></div><div className="workspace"><div className="workspace-icon">C</div><div><strong>Coastal collection</strong><small>PERSONAL ARCHIVE</small></div><ChevronRight size={15} /></div><div className="nav-list">{groups.map(group => <div className="nav-group" key={group}><div className="nav-heading">{group}</div>{nav.filter(n => n.group === group && n.id !== 'customers').map(item => <button className={`nav-item ${section === item.id ? 'active' : ''}`} key={item.id} onClick={() => openSection(item.id as Section)}><item.icon size={17} /><span>{item.label}</span>{item.id === 'shells' && <span className="nav-count">{shells.length}</span>}</button>)}{group === 'COLLECTION' && <button className="nav-item" onClick={() => { onNavigate('/customers'); setMobileNav(false); }}><UsersRound size={17}/><span>Customers</span></button>}</div>)}</div><div className="sidebar-bottom"><div className="api-status"><span className="status-dot" /><span>API connection</span><b>LOCAL</b></div><div className="profile"><div className="avatar">S</div><div><strong>Shell curator</strong><small>Collection manager</small></div><span className="more">···</span></div></div></aside>{mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} />}
    <main className="main"><header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(true)}><Menu size={20} /></button><div className="crumb">Workspace <ChevronRight size={13} /> <span>{meta.title}</span></div><div className="top-actions"><span className="today">Your collection, thoughtfully kept</span><div className="top-avatar">S</div></div></header><div className="content"><div className="page-heading"><div><div className="eyebrow">COLLECTION / {section.replace('-', ' ').toUpperCase()}</div><h1>{meta.title}</h1><p>{meta.sub}</p></div><button className="primary" onClick={() => setDialog({ mode: 'create' })}><Plus size={17} /> {section === 'images' ? 'Upload image' : section === 'shells' ? 'Add a shell' : 'Add record'}</button></div>
      <div className="summary-row"><div className="summary-card"><div className="summary-icon lavender"><ShellIcon size={18} /></div><div><small>IN THIS VIEW</small><strong>{total.toLocaleString()} <span>records</span></strong></div></div><div className="summary-note"><span className="note-star">✳</span><span>“The sea, once it casts its spell, holds one in its net of wonder forever.”</span><i>— Jacques Cousteau</i></div></div>
      <section className="table-panel"><div className="toolbar"><div className="searchbox"><Search size={16} /><input placeholder={section === 'shells' ? 'Search by shell name...' : section === 'images' ? 'Search image file name...' : 'Search records...'} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /><kbd>⌘ K</kbd></div>{section === 'shells' && <label className="deleted-toggle"><input type="checkbox" checked={includeDeleted} onChange={e => { setIncludeDeleted(e.target.checked); setPage(0); }} /><span>Include deleted</span></label>}<button className="filter-btn" onClick={() => { setSearch(''); setPage(0); }}><Archive size={15} /> Reset</button></div>
        {error && <div className="error-banner"><CircleAlert size={17} /><span>{error}</span><button onClick={() => void load()}>Retry</button></div>}
        {loading ? <div className="loading"><LoaderCircle className="spin" size={23} /> Loading collection…</div> : data.length === 0 ? <div className="empty"><div className="empty-icon"><ShellIcon size={24} /></div><strong>{search ? 'No matching records' : 'Nothing here yet'}</strong><span>{search ? 'Try another search or clear the filter.' : 'Add your first record to start building this collection.'}</span>{!search && <button className="text-action" onClick={() => setDialog({ mode: 'create' })}>Create a record <ChevronRight size={15} /></button>}</div> : <InventoryTable section={section} data={data} shells={shells} stocks={stocks} types={types} onEdit={beginEdit} onDelete={remove} />}
        <div className="pagination"><span>Showing <b>{total === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)}</b> of <b>{total}</b> records</span><div><button aria-label="Previous page" disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}><ChevronLeft size={17} /></button><span className="page-index">{page + 1} <i>/</i> {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span><button aria-label="Next page" disabled={(page + 1) * PAGE_SIZE >= total || loading} onClick={() => setPage(p => p + 1)}><ChevronRight size={17} /></button></div></div></section><footer><span>Made for the love of little things.</span><span>Shellhouse <i>·</i> Inventory Studio</span></footer></div></main>
    {dialog !== null && <RecordModal key={`${section}-${(dialog as {mode?:string;item?:Record<string,unknown>}).mode}-${(dialog as {item?:Record<string,unknown>}).item?.stock_info_id ?? 'new'}`} section={section} dialog={dialog as { mode: 'create' | 'edit'; item?: Record<string, unknown> }} shells={shells} stocks={stocks} types={types} saving={saving} error={error} onClose={() => setDialog(null)} onSubmit={async e => { e.preventDefault(); setError(''); try { await save(e.currentTarget); } catch (err) { setError((err as Error).message); setSaving(false); } }} />}{toast && <div className="toast">✓ &nbsp;{toast}</div>}</div>
}
