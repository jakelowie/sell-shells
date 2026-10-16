import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CircleAlert, LoaderCircle, ShieldCheck, UserRoundCog } from 'lucide-react';
import { mutate, request } from '../../shared/api/client';
import { useAuth, type AppRole } from './AuthProvider';

type UserRole = { user_id: string; email: string | null; role: AppRole; created_at: string; updated_at: string };
const roles: AppRole[] = ['user', 'admin', 'superadmin'];

export default function AdminUsersPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRole[]>([]);
  const [drafts, setDrafts] = useState<Record<string, AppRole>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await request<{ data: UserRole[] }>('/api/auth/users');
      setUsers(result.data);
      setDrafts(Object.fromEntries(result.data.map(record => [record.user_id, record.role])));
    } catch (loadError) { setError((loadError as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async (record: UserRole) => {
    const nextRole = drafts[record.user_id] ?? record.role;
    if (nextRole === record.role) return;
    setSaving(record.user_id); setError(''); setNotice('');
    try {
      const response = await mutate<UserRole>(`/api/auth/users/${encodeURIComponent(record.user_id)}/role`, 'PATCH', { role: nextRole });
      setUsers(current => current.map(item => item.user_id === record.user_id ? response.data : item));
      setNotice(`Role updated for ${record.email || record.user_id}.`);
    } catch (saveError) { setError((saveError as Error).message); }
    finally { setSaving(null); }
  };

  return <div className="app-shell auth-admin-shell"><main className="main auth-admin-main"><header className="topbar"><button className="auth-back-link" onClick={() => onNavigate('/admin')}><ArrowLeft size={15} /> Inventory</button><div className="top-actions"><span className="role-badge superadmin"><ShieldCheck size={13} /> SUPERADMIN</span><span className="auth-current-email">{user?.email}</span></div></header><div className="content"><div className="page-heading"><div><div className="eyebrow">SECURITY / ACCESS</div><h1>Role management</h1><p>Grant application access to registered accounts.</p></div><div className="role-management-icon"><UserRoundCog size={21} /></div></div>
    <div className="role-policy-note"><ShieldCheck size={16} /><span><b>Role boundaries apply in the API and database.</b> Admins can manage inventory. Only a superadmin can assign roles, and accounts cannot change their own role.</span></div>
    {error && <div className="error-banner"><CircleAlert size={17} /><span>{error}</span><button onClick={() => void load()}>Retry</button></div>}
    {notice && <div className="auth-message auth-success">{notice}</div>}
    <section className="role-list-panel"><div className="role-list-heading"><div><strong>Registered accounts</strong><span>{users.length} accounts</span></div><button className="filter-btn" onClick={() => void load()} disabled={loading}>Refresh</button></div>
      {loading ? <div className="loading"><LoaderCircle className="spin" size={22} /> Loading accounts…</div> : users.length === 0 ? <div className="empty"><strong>No accounts found</strong><span>Accounts appear here after they sign up.</span></div> : <div className="table-wrap"><table className="role-table"><thead><tr><th>ACCOUNT</th><th>USER ID</th><th>ROLE</th><th>ACTION</th></tr></thead><tbody>{users.map(record => {const own = record.user_id === user?.id;const draft = drafts[record.user_id] ?? record.role;return <tr key={record.user_id}><td><span className="role-account-email">{record.email || 'Email unavailable'}</span>{own && <span className="role-you">YOU</span>}</td><td><code>{record.user_id}</code></td><td><select aria-label={`Role for ${record.email || record.user_id}`} value={draft} disabled={own || saving === record.user_id} onChange={event => setDrafts(current => ({ ...current, [record.user_id]: event.target.value as AppRole }))}>{roles.map(role => <option value={role} key={role}>{role}</option>)}</select></td><td><button className="role-save" disabled={own || draft === record.role || saving === record.user_id} onClick={() => void save(record)}>{saving === record.user_id ? 'Saving…' : 'Save role'}</button></td></tr>;})}</tbody></table></div>}
    </section><div className="role-warning">Use superadmin access sparingly. Role updates take effect on the next API request.</div></div></main></div>;
}
