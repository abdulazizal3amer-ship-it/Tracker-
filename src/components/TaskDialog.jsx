import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../lib/i18n.jsx';
import {
  PRIORITIES, STATUSES, assignableIds, assigneeIds, canChangeStatus, canEditTaskDetails,
  managesProject, parseMentions, participantIds, validateTask,
} from '../lib/logic.js';
import { Avatar, ErrorText, Modal, PeoplePicker } from './ui.jsx';

/** إنشاء مهمة أو عرضها وتعديلها، مع التعليقات وسجل النشاط */
export default function TaskDialog({ task, project, onClose, onSaved, defaultStatus }) {
  const { t, fmtDate, fmtDateTime } = useI18n();
  const { profile, userById } = useAuth();
  const isNew = !task;

  const [form, setForm] = useState(() => ({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || defaultStatus || 'new',
    priority: task?.priority || 'medium',
    due_date: task?.due_date || '',
  }));
  const [assignees, setAssignees] = useState(() => (task ? assigneeIds(task) : managesProject(profile, project) ? [] : [profile.id]));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const manages = managesProject(profile, project);
  const canDetails = isNew || canEditTaskDetails(profile, task, project);
  const canStatus = isNew || canChangeStatus(profile, task, project);
  const canAssign = isNew ? true : manages;
  const options = canAssign ? assignableIds(profile, project) : participantIds(project);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    const err = validateTask(form, assignees);
    if (err) return setError(t(err));
    setBusy(true); setError('');
    try {
      await api.saveTask({ ...form, project_id: project.id }, assignees, task);
      onSaved();
    } catch (ex) {
      setError(ex.message || t('error_generic'));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t('confirm_delete_task'))) return;
    setBusy(true);
    try { await api.deleteTask(task.id); onSaved(); } catch (ex) { setError(ex.message); setBusy(false); }
  };

  return (
    <Modal title={isNew ? t('new_task') : form.title || t('new_task')} onClose={onClose} wide={!isNew}>
      <div className={isNew ? '' : 'task-layout'}>
        <form onSubmit={save} className="form">
          <label>
            {t('task_title')}
            <input value={form.title} onChange={set('title')} disabled={!canDetails} autoFocus={isNew} maxLength={200} />
          </label>
          <label>
            {t('description')}
            <textarea rows={4} value={form.description} onChange={set('description')} disabled={!canDetails} />
          </label>
          <div className="form-row">
            <label>
              {t('status')}
              <select value={form.status} onChange={set('status')} disabled={!canStatus}>
                {STATUSES.map((s) => <option key={s} value={s}>{t('status_' + s)}</option>)}
              </select>
            </label>
            <label>
              {t('priority')}
              <select value={form.priority} onChange={set('priority')} disabled={!canDetails}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{t('priority_' + p)}</option>)}
              </select>
            </label>
            <label>
              {t('due_date')}
              <input type="date" value={form.due_date} onChange={set('due_date')} disabled={!canDetails} />
            </label>
          </div>

          <fieldset>
            <legend>
              {t('assignees')}
              {canAssign && manages && (
                <span className="legend-actions">
                  <button type="button" className="link" onClick={() => setAssignees(participantIds(project))}>{t('all_members')}</button>
                  <button type="button" className="link" onClick={() => setAssignees([])}>{t('clear')}</button>
                </span>
              )}
            </legend>
            <PeoplePicker
              options={canAssign ? options : assignees}
              value={assignees}
              onChange={setAssignees}
              userById={userById}
              disabled={!canAssign}
            />
            {isNew && !manages && <small className="muted">{t('member_self_only')}</small>}
          </fieldset>

          {!isNew && !canDetails && canStatus && <p className="hint">{t('status_only_hint')}</p>}
          {!isNew && (
            <p className="muted small">
              {t('created_by')}: {userById[task.created_by]?.full_name || '—'} · {fmtDate(task.created_at)}
            </p>
          )}

          <ErrorText>{error}</ErrorText>
          <div className="row end">
            {!isNew && manages && <button type="button" className="btn danger-ghost" onClick={remove} disabled={busy}>{t('delete')}</button>}
            <span className="grow" />
            <button type="button" className="btn" onClick={onClose}>{t('cancel')}</button>
            {(canDetails || canStatus) && <button className="btn primary" disabled={busy}>{busy ? t('saving') : t('save')}</button>}
          </div>
        </form>

        {!isNew && <TaskSide task={task} project={project} t={t} fmtDateTime={fmtDateTime} />}
      </div>
    </Modal>
  );
}

function TaskSide({ task, project, t, fmtDateTime }) {
  const { userById } = useAuth();
  const [tab, setTab] = useState('comments');
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggest, setSuggest] = useState(null);
  const box = useRef(null);
  const people = participantIds(project).map((id) => userById[id]).filter(Boolean);

  const load = () => {
    api.comments(task.id).then(setComments).catch(() => {});
    api.activity(task.id).then(setActivity).catch(() => {});
  };
  useEffect(load, [task.id]);

  // اقتراح الأسماء عند كتابة @
  const onType = (e) => {
    const v = e.target.value;
    setBody(v);
    const upto = v.slice(0, e.target.selectionStart);
    const m = upto.match(/@([^\s@]*)$/);
    setSuggest(m ? m[1] : null);
  };
  const pick = (u) => {
    const el = box.current;
    const pos = el.selectionStart;
    const before = body.slice(0, pos).replace(/@([^\s@]*)$/, '@' + u.full_name + ' ');
    setBody(before + body.slice(pos));
    setSuggest(null);
    el.focus();
  };

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await api.addComment(task.id, body.trim(), parseMentions(body, people));
      setBody('');
      load();
    } finally { setBusy(false); }
  };

  const label = (s) => (s && t('status_' + s) !== 'status_' + s ? t('status_' + s) : s);
  const describe = (a) => {
    const name = (id) => userById[id]?.full_name || '—';
    switch (a.action) {
      case 'status': return t('act_status', { a: label(a.old_value), b: label(a.new_value) });
      case 'priority': return t('act_priority', { a: t('priority_' + a.old_value), b: t('priority_' + a.new_value) });
      case 'due_date': return t('act_due_date', { a: a.old_value || '—', b: a.new_value || '—' });
      case 'assigned': return t('act_assigned', { b: name(a.new_value) });
      case 'unassigned': return t('act_unassigned', { a: name(a.old_value) });
      default: return t('act_' + a.action);
    }
  };

  const matches = suggest === null ? [] : people.filter((u) => u.full_name.toLowerCase().includes(suggest.toLowerCase())).slice(0, 6);

  return (
    <aside className="task-side">
      <div className="tabs">
        <button className={tab === 'comments' ? 'on' : ''} onClick={() => setTab('comments')}>{t('comments')} ({comments.length})</button>
        <button className={tab === 'activity' ? 'on' : ''} onClick={() => setTab('activity')}>{t('activity')}</button>
      </div>
      {tab === 'comments' ? (
        <>
          <ul className="comments">
            {comments.length === 0 && <li className="muted">{t('no_comments')}</li>}
            {comments.map((c) => (
              <li key={c.id}>
                <Avatar user={userById[c.user_id]} size={26} />
                <div>
                  <div className="comment-head"><strong>{userById[c.user_id]?.full_name}</strong><small className="muted">{fmtDateTime(c.created_at)}</small></div>
                  <p className="comment-body">{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <form className="comment-form" onSubmit={send}>
            <div className="mention-wrap">
              <textarea ref={box} rows={3} value={body} onChange={onType} placeholder={t('add_comment')} />
              {matches.length > 0 && (
                <ul className="mention-list">
                  {matches.map((u) => (
                    <li key={u.id}><button type="button" onMouseDown={(e) => { e.preventDefault(); pick(u); }}><Avatar user={u} size={20} />{u.full_name}</button></li>
                  ))}
                </ul>
              )}
            </div>
            <button className="btn primary" disabled={busy || !body.trim()}>{t('send')}</button>
          </form>
        </>
      ) : (
        <ul className="activity">
          {activity.map((a) => (
            <li key={a.id}>
              <strong>{userById[a.user_id]?.full_name || '—'}</strong> {describe(a)}
              <small className="muted"> · {fmtDateTime(a.created_at)}</small>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
