import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { daysBetween, isOverdue, sortByDue, todayISO } from '../lib/logic.js';
import TaskCard from '../components/TaskCard.jsx';
import TaskDialog from '../components/TaskDialog.jsx';

export default function MyTasks() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const [tasks, setTasks] = useState(null);
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    const [ts, ps] = await Promise.all([api.myTasks(profile.id), api.projects()]);
    setTasks(ts); setProjects(ps);
  }, [profile.id]);

  useEffect(() => { load().catch(() => setTasks([])); }, [load]);

  const groups = useMemo(() => {
    if (!tasks) return [];
    const today = todayISO();
    const g = { overdue: [], week: [], later: [], nodate: [], done: [] };
    for (const x of sortByDue(tasks)) {
      if (x.status === 'done') {
        if (x.completed_at && daysBetween(x.completed_at.slice(0, 10), today) <= 7) g.done.push(x);
      } else if (isOverdue(x, today)) g.overdue.push(x);
      else if (!x.due_date) g.nodate.push(x);
      else if (daysBetween(today, x.due_date) <= 7) g.week.push(x);
      else g.later.push(x);
    }
    return [
      ['overdue', t('my_overdue'), g.overdue],
      ['week', t('my_today'), g.week],
      ['later', t('my_later'), g.later],
      ['nodate', t('my_nodate'), g.nodate],
      ['done', t('my_done'), g.done],
    ].filter(([, , list]) => list.length);
  }, [tasks, t]);

  if (!tasks) return <div className="page muted">{t('loading')}</div>;
  const projectById = Object.fromEntries(projects.map((p) => [p.id, p]));

  return (
    <div className="page">
      <h1>{t('my_title')}</h1>
      {groups.length === 0 && <p className="muted card">{t('my_empty')}</p>}
      {groups.map(([key, label, list]) => (
        <section key={key} className="my-group">
          <h2 className={key === 'overdue' ? 'text-danger' : ''}>{label} <span className="count">{list.length}</span></h2>
          <div className="card-grid">
            {list.map((x) => (
              <TaskCard key={x.id} task={x} projectName={projectById[x.project_id]?.name} onOpen={() => setOpen(x)} />
            ))}
          </div>
        </section>
      ))}
      {open && projectById[open.project_id] && (
        <TaskDialog
          task={open}
          project={projectById[open.project_id]}
          onClose={() => setOpen(null)}
          onSaved={() => { setOpen(null); load(); }}
        />
      )}
    </div>
  );
}
