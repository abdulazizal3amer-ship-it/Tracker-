import { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { api } from '../lib/api.js';
import { Avatar } from './ui.jsx';
import Notifications from './Notifications.jsx';

export default function Layout() {
  const { profile, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [menu, setMenu] = useState(false);

  const toggleLang = () => {
    const next = lang === 'ar' ? 'en' : 'ar';
    setLang(next);
    api.updateUser(profile.id, { language: next }).catch(() => {});
  };

  const links = [
    { to: '/', label: t('nav_dashboard'), end: true },
    { to: '/my', label: t('nav_my_tasks') },
    { to: '/projects', label: t('nav_projects') },
    ...(profile.role === 'admin' ? [{ to: '/users', label: t('nav_users') }] : []),
  ];

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="logo" aria-hidden>
            <svg viewBox="0 0 32 32" width="26" height="26"><rect width="32" height="32" rx="8" fill="currentColor" /><path d="M9 16.5l4.5 4.5L23 11" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span>{t('app_name')}</span>
        </Link>
        <nav className="nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="top-actions">
          <Notifications />
          <div className="user-menu">
            <button className="user-btn" onClick={() => setMenu(!menu)} aria-expanded={menu}>
              <Avatar user={profile} size={30} />
              <span className="hide-sm">{profile.full_name}</span>
            </button>
            {menu && (
              <div className="menu" onMouseLeave={() => setMenu(false)}>
                <div className="menu-head">
                  <strong>{profile.full_name}</strong>
                  <small className="muted">{t('role_' + profile.role)}</small>
                </div>
                <button onClick={() => { toggleLang(); setMenu(false); }}>{t('switch_lang')}</button>
                <Link to="/password" onClick={() => setMenu(false)}>{t('change_password')}</Link>
                <button onClick={signOut}>{t('sign_out')}</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
