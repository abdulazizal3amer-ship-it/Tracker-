import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../lib/i18n.jsx';

export default function Notifications() {
  const { profile, userById } = useAuth();
  const { t, fmtDateTime } = useI18n();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    api.notifications().then(setItems).catch(() => {});
    // إشعارات فورية عبر Supabase Realtime
    const channel = supabase
      .channel('notifications-' + profile.id)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => setItems((prev) => [payload.new, ...prev].slice(0, 30))
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile.id]);

  useEffect(() => {
    const onClick = (e) => open && box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const unread = items.filter((n) => !n.is_read);

  const markAll = async () => {
    if (!unread.length) return;
    await api.markRead(unread.map((n) => n.id));
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const openItem = async (n) => {
    if (!n.is_read) {
      await api.markRead([n.id]).catch(() => {});
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    setOpen(false);
    if (n.project_id) navigate(`/projects/${n.project_id}?task=${n.task_id}`);
  };

  const text = (n) => {
    const actor = userById[n.actor_id]?.full_name || '—';
    return t('n_' + n.type, {
      actor,
      title: n.message || '',
      status: n.new_status ? t('status_' + n.new_status) : '',
    });
  };

  return (
    <div className="notif" ref={box}>
      <button className="icon-btn bell" onClick={() => setOpen(!open)} aria-label={t('notifications')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        {unread.length > 0 && <span className="dot">{unread.length > 9 ? '9+' : unread.length}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <header>
            <strong>{t('notifications')}</strong>
            {unread.length > 0 && <button className="link" onClick={markAll}>{t('mark_all_read')}</button>}
          </header>
          {items.length === 0 && <p className="muted pad">{t('no_notifications')}</p>}
          <ul>
            {items.map((n) => (
              <li key={n.id}>
                <button className={`notif-item ${n.is_read ? '' : 'unread'}`} onClick={() => openItem(n)}>
                  <span>{text(n)}</span>
                  <small className="muted">{fmtDateTime(n.created_at)}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
