import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../lib/i18n.jsx';
import {
  PRIORITIES, STATUSES, assigneeIds, canChangeStatus, filterTasks, isOverdue,
  managesProject, participantIds, progress, sortByDue,
} from '../lib/logic.js';
import { AvatarStack, DueDate, PriorityBadge, ProgressBar, StatusBadge } from '../components/ui.jsx';
import TaskCard from '../components/TaskCard.jsx';
import TaskDialog from '../components/TaskDialog.jsx';
import ProjectDialog from '../components/ProjectDialog.jsx';

export default function ProjectView() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { t, fmtDate, lang } = useI18n();
  const { profile, userById } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const [view, setView] = useState(() => { try { return localStorage.getItem('view') || 'board'; } catch { return 'board'; } });
  const [filters, setFilters] = useState({ assignee: '', status: '', priority: '', q: '' });
  const [creating, setCreating] = useState(null);
  const [editing, setEditing] = useState(false);
  const [dragOver, setDragOver] = useState(null);

  const load = useCallback(async () => {
    const [p, ts] = await Promise.all([api.project(id), api.tasksOfProject(id)]);
    setProject(p); setTasks(ts);
  }, [id]);
  useEffect(() => { load().catch(() => setError(t('error_generic'))); }, [load, t]);
  useEffect(() => { try { localStorage.setItem('view', view); } catch { /* ignore */ } }, [view]);

  const shown = useMemo(() => filterTasks(tasks, filters), [tasks, filters]);

  if (error) return <div className="page"><p className="error">{error}</p><Link to="/projects">{t('nav_projects')}</Link></div>;
  if (!project) return <div className="page muted">{t('loading')}</div>;

  const manages = managesProject(profile, project);
  const participant = participantIds(project).includes(profile.id) || profile.role === 'admin';
  const openId = params.get('task');
  const openTask = openId ? tasks.find((x) => x.id === openId) : null;
  const openTaskById = (taskId) => setParams(taskId ? { task: taskId } : {});
  const late = tasks.filter((x) => isOverdue(x)).length;
  const pct = progress(tasks);

  // السحب والإفلات لتغيير الحالة
  const onDrop = async (status, e) => {
    e.preventDefault();
    setDragOver(null);
    const taskId = e.dataTransfer.getData('text/plain');
    const task = tasks.find((x) => x.id === taskId);
    if (!task || task.status === status || !canChangeStatus(profile, task, project)) return;
    const before = tasks;
    setTasks(tasks.map((x) => (x.id === taskId ? { ...x, status } : x)));
    try { await api.setStatus(taskId, status); } catch { setTasks(before); setError(t('error_generic')); }
  };

  const setF = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <div className="page">
      <div className="project-head">
        <div>
          <Link to="/projects" className="muted small">{lang === 'ar' ? '→' : '←'} {t('nav_projects')}</Link>
          <h1>{project.name} <span className={`badge pstatus-${project.status}`}>{t('pstatus_' + project.status)}</span></h1>
          {project.description && <p className="muted">{project.description}</p>}
          <p className="muted small">
            {t('manager')}: {userById[project.manager_id]?.full_name} · {fmtDate(project.start_date)} – {fmtDate(project.end_date)}
          </p>
        </div>
        <div className="project-progress">
          <div className="bar-row"><ProgressBar value={pct} /><span className="bar-val">{pct}%</span></div>
          <small className="muted">
            {t('tasks_n', { n: tasks.length })}{late > 0 && <span className="text-danger"> · {t('overdue_n', { n: late })}</span>}
          </small>
          {manages && <button className="btn small" onClick={() => setEditing(true)}>{t('edit_project')}</button>}
        </div>
      </div>

      <div className="toolbar">
        <div className="segmented">
          <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>{t('view_board')}</button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>{t('view_list')}</button>
        </div>
        <input className="search" placeholder={t('search')} value={filters.q} onChange={setF('q')} />
        <select value={filters.assignee} onChange={setF('assignee')} aria-label={t('filter_assignee')}>
          <option value="">{t('filter_assignee')}: {t('all')}</option>
          {participantIds(project).map((uid) => <option key={uid} value={uid}>{userById[uid]?.full_name}</option>)}
        </select>
        {view === 'list' && (
          <select value={filters.status} onChange={setF('status')} aria-label={t('status')}>
            <option value="">{t('status')}: {t('all')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t('status_' + s)}</option>)}
          </select>
        )}
        <select value={filters.priority} onChange={setF('priority')} aria-label={t('priority')}>
          <option value="">{t('priority')}: {t('all')}</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{t('priority_' + p)}</option>)}
        </select>
        <span className="grow" />
        {participant && project.status !== 'archived' && (
          <button className="btn primary" onClick={() => setCreating('new')}>+ {t('new_task')}</button>
        )}
      </div>

      {view === 'board' ? (
        <div className="board">
          {STATUSES.map((s) => {
            const col = sortByDue(shown.filter((x) => x.status === s));
            return (
              <section
                key={s}
                className={`column ${dragOver === s ? 'drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(s); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => onDrop(s, e)}
              >
                <header className="column-head">
                  <StatusBadge status={s} />
                  <span className="count">{col.length}</span>
                </header>
                <div className="column-body">
                  {col.map((x) => (
                    <TaskCard
                      key={x.id}
                      task={x}
                      showStatus={false}
                      onOpen={() => openTaskById(x.id)}
                      draggable={canChangeStatus(profile, x, project)}
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', x.id)}
                    />
                  ))}
                  {col.length === 0 && <p className="muted center small">{t('drop_here')}</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('task_title')}</th><th>{t('assignees')}</th><th>{t('status')}</th>
                <th>{t('priority')}</th><th>{t('due_date')}</th>
              </tr>
            </thead>
            <tbody>
              {sortByDue(shown).map((x) => (
                <tr key={x.id} className={isOverdue(x) ? 'overdue-row' : ''} onClick={() => openTaskById(x.id)}>
                  <td><button className="link strong">{x.title}</button></td>
                  <td><AvatarStack ids={assigneeIds(x)} userById={userById} size={22} /></td>
                  <td><StatusBadge status={x.status} /></td>
                  <td><PriorityBadge priority={x.priority} /></td>
                  <td>{x.due_date ? <DueDate task={x} /> : <span className="muted">—</span>}</td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={5} className="muted center">{t('no_tasks')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {(creating || openTask) && (
        <TaskDialog
          key={openTask?.id || 'new'}
          task={openTask || null}
          project={project}
          onClose={() => { setCreating(null); openTaskById(null); }}
          onSaved={() => { setCreating(null); openTaskById(null); load(); }}
        />
      )}
      {editing && (
        <ProjectDialog project={project} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />
      )}
    </div>
  );
}
