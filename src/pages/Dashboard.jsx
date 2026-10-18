import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../lib/i18n.jsx';
import {
  assigneeIds, countByStatus, daysOverdue, isDueThisWeek, isOverdue, progress, sortByDue, todayISO, workload,
} from '../lib/logic.js';
import { AvatarStack, Avatar, ProgressBar, PriorityBadge, DueDate } from '../components/ui.jsx';

export default function Dashboard() {
  const { t } = useI18n();
  const { userById, activeUsers } = useAuth();
  const [tasks, setTasks] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.allTasks(), api.projects()])
      .then(([ts, ps]) => { setTasks(ts); setProjects(ps); })
      .catch(() => setError(t('error_generic')));
  }, [t]);

  const data = useMemo(() => {
    if (!tasks) return null;
    const today = todayISO();
    const live = new Set(projects.filter((p) => p.status !== 'archived').map((p) => p.id));
    const ts = tasks.filter((x) => live.has(x.project_id));
    const counts = countByStatus(ts);
    const overdue = ts.filter((x) => isOverdue(x, today)).sort((a, b) => daysOverdue(b, today) - daysOverdue(a, today));
    const week = sortByDue(ts.filter((x) => isDueThisWeek(x, today)));
    const byProject = projects
      .filter((p) => p.status === 'active')
      .map((p) => {
        const pt = ts.filter((x) => x.project_id === p.id);
        return { p, total: pt.length, pct: progress(pt), late: pt.filter((x) => isOverdue(x, today)).length };
      });
    return {
      counts, overdue, week, byProject, today,
      open: ts.length - counts.done,
      load: workload(ts, activeUsers, today),
    };
  }, [tasks, projects, activeUsers]);

  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (!data) return <div className="page muted">{t('loading')}</div>;

  const projectName = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const maxLoad = Math.max(1, ...data.load.map((r) => r.open));

  const TaskRow = ({ task, late }) => (
    <li>
      <Link className="task-row" to={`/projects/${task.project_id}?task=${task.id}`}>
        <span className="task-row-main">
          <strong>{task.title}</strong>
          <small className="muted">{projectName[task.project_id]}</small>
        </span>
        <span className="task-row-meta">
          {late ? <span className="badge late">{t('days_late', { n: daysOverdue(task, data.today) })}</span> : <DueDate task={task} />}
          <PriorityBadge priority={task.priority} />
          <AvatarStack ids={assigneeIds(task)} userById={userById} max={3} size={22} />
        </span>
      </Link>
    </li>
  );

  return (
    <div className="page">
      <h1>{t('dash_title')}</h1>

      <section className="stats">
        <div className="stat"><span className="stat-n">{data.open}</span><span>{t('dash_open')}</span></div>
        <div className={`stat ${data.overdue.length ? 'danger' : ''}`}><span className="stat-n">{data.overdue.length}</span><span>{t('dash_overdue')}</span></div>
        <div className="stat"><span className="stat-n">{data.week.length}</span><span>{t('dash_week')}</span></div>
        <div className="stat good"><span className="stat-n">{data.counts.done}</span><span>{t('dash_done')}</span></div>
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>{t('dash_overdue_list')}</h2>
          {data.overdue.length === 0 ? <p className="muted">{t('dash_no_overdue')}</p> : (
            <ul className="task-list">{data.overdue.slice(0, 15).map((x) => <TaskRow key={x.id} task={x} late />)}</ul>
          )}
        </section>
        <section className="card">
          <h2>{t('dash_week_list')}</h2>
          {data.week.length === 0 ? <p className="muted">{t('dash_no_week')}</p> : (
            <ul className="task-list">{data.week.slice(0, 15).map((x) => <TaskRow key={x.id} task={x} />)}</ul>
          )}
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>{t('dash_projects')}</h2>
          {data.byProject.length === 0 ? <p className="muted">{t('no_projects')}</p> : (
            <ul className="bars">
              {data.byProject.map(({ p, total, pct, late }) => (
                <li key={p.id}>
                  <Link to={`/projects/${p.id}`} className="bar-row">
                    <span className="bar-label">{p.name}</span>
                    <ProgressBar value={pct} />
                    <span className="bar-val">{pct}%</span>
                  </Link>
                  <small className="muted">
                    {t('tasks_n', { n: total })}{late ? ' · ' : ''}
                    {late ? <span className="text-danger">{t('overdue_n', { n: late })}</span> : null}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h2>{t('dash_workload')}</h2>
          {data.load.length === 0 ? <p className="muted">{t('no_tasks')}</p> : (
            <ul className="bars">
              {data.load.map(({ user, open, overdue }) => (
                <li key={user.id} className="bar-row">
                  <span className="bar-label with-avatar"><Avatar user={user} size={22} />{user.full_name}</span>
                  <span className="progress"><span className="progress-fill" style={{ width: `${(open / maxLoad) * 100}%` }} /></span>
                  <span className="bar-val" title={overdue ? t('overdue_n', { n: overdue }) : undefined}>
                    {open}{overdue ? <small className="text-danger"> · {t('overdue_n', { n: overdue })}</small> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
