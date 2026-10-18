import { useEffect } from 'react';
import { useI18n } from '../lib/i18n.jsx';
import { isOverdue } from '../lib/logic.js';

export function Avatar({ user, size = 28 }) {
  const name = user?.full_name || '?';
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
  let hue = 0;
  for (const ch of name) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      className="avatar"
      title={name}
      style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${hue} 45% 42%)` }}
    >
      {user?.avatar_url ? <img src={user.avatar_url} alt="" /> : initials}
    </span>
  );
}

export function AvatarStack({ ids, userById, max = 4, size = 24 }) {
  const shown = ids.slice(0, max);
  return (
    <span className="avatar-stack">
      {shown.map((id) => <Avatar key={id} user={userById[id]} size={size} />)}
      {ids.length > max && <span className="avatar more" style={{ width: size, height: size }}>+{ids.length - max}</span>}
    </span>
  );
}

export function StatusBadge({ status }) {
  const { t } = useI18n();
  return <span className={`badge status-${status}`}>{t('status_' + status)}</span>;
}

export function PriorityBadge({ priority }) {
  const { t } = useI18n();
  return <span className={`badge prio-${priority}`}>{t('priority_' + priority)}</span>;
}

export function DueDate({ task }) {
  const { fmtDate } = useI18n();
  if (!task.due_date) return null;
  return <span className={`due ${isOverdue(task) ? 'overdue' : ''}`}>{fmtDate(task.due_date)}</span>;
}

export function ProgressBar({ value }) {
  return (
    <span className="progress" aria-label={`${value}%`}>
      <span className="progress-fill" style={{ width: `${value}%` }} />
    </span>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="close">✕</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function ErrorText({ children }) {
  return children ? <p className="error" role="alert">{children}</p> : null;
}

/** اختيار متعدد للأعضاء على شكل شرائح */
export function PeoplePicker({ options, value, onChange, userById, disabled }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="chips">
      {options.map((id) => (
        <button
          type="button"
          key={id}
          disabled={disabled}
          className={`chip ${value.includes(id) ? 'on' : ''}`}
          onClick={() => toggle(id)}
          aria-pressed={value.includes(id)}
        >
          <Avatar user={userById[id]} size={20} />
          {userById[id]?.full_name || '…'}
        </button>
      ))}
    </div>
  );
}
