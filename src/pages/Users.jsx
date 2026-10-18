import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { ROLES, generatePassword, validatePassword } from '../lib/logic.js';
import { Avatar, ErrorText, Modal } from '../components/ui.jsx';

export default function Users() {
  const { t, fmtDateTime } = useI18n();
  const { users, profile, reload } = useAuth();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState('');
  const [error, setError] = useState('');

  const update = async (u, patch) => {
    setError('');
    try { await api.updateUser(u.id, patch); await reload(); } catch (e) { setError(e.message); }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t('users_title')}</h1>
        <span className="grow" />
        <button className="btn primary" onClick={() => setCreating(true)}>+ {t('new_user')}</button>
      </div>
      {created && (
        <div className="card info-card">
          <p>{t('user_created', { p: '' })}<code dir="ltr">{created}</code></p>
          <button className="btn small" onClick={() => navigator.clipboard?.writeText(created)}>{t('copy')}</button>
        </div>
      )}
      <ErrorText>{error}</ErrorText>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr><th>{t('full_name')}</th><th>{t('email')}</th><th>{t('role')}</th><th>{t('status')}</th><th>{t('last_login')}</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.is_active ? '' : 'disabled-row'}>
                <td><span className="with-avatar"><Avatar user={u} size={26} />{u.full_name}</span></td>
                <td dir="ltr" className="start">{u.email}</td>
                <td>
                  <select value={u.role} disabled={u.id === profile.id} onChange={(e) => update(u, { role: e.target.value })}>
                    {ROLES.map((r) => <option key={r} value={r}>{t('role_' + r)}</option>)}
                  </select>
                </td>
                <td>
                  <span className={`badge ${u.is_active ? 'status-done' : 'late'}`}>{u.is_active ? t('active') : t('disabled')}</span>{' '}
                  {u.id !== profile.id && (
                    <button className="link small" onClick={() => update(u, { is_active: !u.is_active })}>
                      {u.is_active ? t('disable') : t('enable')}
                    </button>
                  )}
                </td>
                <td className="muted small">{fmtDateTime(u.last_login_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {creating && (
        <NewUser
          onClose={() => setCreating(false)}
          onCreated={async (email, pw) => { setCreating(false); setCreated(`${email} / ${pw}`); await reload(); }}
        />
      )}
    </div>
  );
}

function NewUser({ onClose, onCreated }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ full_name: '', email: '', role: 'member', password: generatePassword() });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    if (!validatePassword(form.password)) return setError(t('password_short'));
    setBusy(true); setError('');
    try {
      await api.createUser(form);
      onCreated(form.email.trim().toLowerCase(), form.password);
    } catch (ex) {
      setError(ex.message || t('error_generic'));
      setBusy(false);
    }
  };

  return (
    <Modal title={t('new_user')} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>{t('full_name')}<input required value={form.full_name} onChange={set('full_name')} autoFocus /></label>
        <label>{t('email')}<input required type="email" dir="ltr" value={form.email} onChange={set('email')} /></label>
        <label>
          {t('role')}
          <select value={form.role} onChange={set('role')}>
            {ROLES.map((r) => <option key={r} value={r}>{t('role_' + r)}</option>)}
          </select>
        </label>
        <label>
          {t('temp_password')}
          <span className="input-group">
            <input required dir="ltr" value={form.password} onChange={set('password')} />
            <button type="button" className="btn" onClick={() => setForm({ ...form, password: generatePassword() })}>{t('generate')}</button>
          </span>
        </label>
        <ErrorText>{error}</ErrorText>
        <div className="row end">
          <button type="button" className="btn" onClick={onClose}>{t('cancel')}</button>
          <button className="btn primary" disabled={busy}>{busy ? t('saving') : t('save')}</button>
        </div>
      </form>
    </Modal>
  );
}
