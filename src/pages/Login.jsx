import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { ErrorText } from '../components/ui.jsx';

export default function Login() {
  const { t, lang, setLang } = useI18n();
  const { disabled } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(disabled ? t('account_disabled') : '');
  const [info, setInfo] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setInfo('');
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) setError(t('bad_login'));
      } else {
        await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + window.location.pathname,
        });
        setInfo(t('reset_sent'));
      }
    } catch {
      setError(t('error_generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center-screen login-bg">
      <form className="card narrow login" onSubmit={submit}>
        <div className="login-head">
          <span className="logo big" aria-hidden>
            <svg viewBox="0 0 32 32" width="44" height="44"><rect width="32" height="32" rx="8" fill="currentColor" /><path d="M9 16.5l4.5 4.5L23 11" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <h1>{t('app_name')}</h1>
          <p className="muted">{t('app_tagline')}</p>
        </div>

        <label>
          {t('email')}
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        </label>
        {mode === 'login' && (
          <label>
            {t('password')}
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
          </label>
        )}

        <ErrorText>{error}</ErrorText>
        {info && <p className="info">{info}</p>}

        <button className="btn primary full" disabled={busy}>
          {busy ? t('signing_in') : mode === 'login' ? t('sign_in') : t('send_reset')}
        </button>

        <div className="row between">
          <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'reset' : 'login'); setError(''); setInfo(''); }}>
            {mode === 'login' ? t('forgot_password') : t('back_to_login')}
          </button>
          <button type="button" className="link" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{t('switch_lang')}</button>
        </div>
      </form>
    </div>
  );
}
