import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { validatePassword } from '../lib/logic.js';
import { ErrorText } from '../components/ui.jsx';

/** تُستخدم لثلاث حالات: أول دخول (إجباري)، رابط الاستعادة، والتغيير الاختياري من القائمة */
export default function SetPassword({ forced }) {
  const { t } = useI18n();
  const { profile, reload, clearRecovery, signOut } = useAuth();
  const navigate = useNavigate();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validatePassword(p1)) return setError(t('password_short'));
    if (p1 !== p2) return setError(t('password_mismatch'));
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: p1 });
      if (err) throw err;
      if (profile.must_change_password) await api.updateUser(profile.id, { must_change_password: false });
      clearRecovery();
      await reload();
      setDone(true);
      if (!forced) setTimeout(() => navigate('/'), 900);
    } catch (err) {
      setError(err.message || t('error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const form = (
    <form className="card narrow" onSubmit={submit}>
      <h1>{forced ? t('must_change_title') : t('change_password')}</h1>
      {forced && profile.must_change_password && <p className="muted">{t('must_change_hint')}</p>}
      <label>
        {t('new_password')}
        <input type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} dir="ltr" required />
      </label>
      <label>
        {t('confirm_password')}
        <input type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} dir="ltr" required />
      </label>
      <ErrorText>{error}</ErrorText>
      {done && <p className="info">{t('password_saved')}</p>}
      <button className="btn primary full" disabled={busy}>{busy ? t('saving') : t('save_password')}</button>
      {forced && <button type="button" className="link" onClick={signOut}>{t('sign_out')}</button>}
    </form>
  );

  return forced ? <div className="center-screen">{form}</div> : <div className="page narrow-page">{form}</div>;
}
