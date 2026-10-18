import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { canCreateProject, isOverdue, participantIds, progress } from '../lib/logic.js';
import { Avatar, AvatarStack, ProgressBar } from '../components/ui.jsx';
import ProjectDialog from '../components/ProjectDialog.jsx';

export default function Projects() {
  const { t, fmtDate } = useI18n();
  const { profile, userById } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [ps, ts] = await Promise.all([api.projects(), api.allTasks()]);
    setProjects(ps); setTasks(ts);
  }, []);
  useEffect(() => { load().catch(() => setProjects([])); }, [load]);

  if (!projects) return <div className="page muted">{t('loading')}</div>;
  const shown = projects.filter((p) => archived || p.status !== 'archived');

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t('projects_title')}</h1>
        <label className="check"><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />{t('show_archived')}</label>
        {canCreateProject(profile) && <button className="btn primary" onClick={() => setCreating(true)}>+ {t('new_project')}</button>}
      </div>

      {shown.length === 0 && <p className="muted card">{t('no_projects')}</p>}
      <div className="card-grid projects">
        {shown.map((p) => {
          const pt = tasks.filter((x) => x.project_id === p.id);
          const late = pt.filter((x) => isOverdue(x)).length;
          const pct = progress(pt);
          return (
            <Link key={p.id} to={`/projects/${p.id}`} className="card project-card">
              <div className="row between">
                <strong className="project-name">{p.name}</strong>
                <span className={`badge pstatus-${p.status}`}>{t('pstatus_' + p.status)}</span>
              </div>
              {p.description && <p className="muted clamp">{p.description}</p>}
              <div className="bar-row">
                <ProgressBar value={pct} />
                <span className="bar-val">{pct}%</span>
              </div>
              <div className="row between small">
                <span className="muted">
                  {t('tasks_n', { n: pt.length })}
                  {late > 0 && <span className="text-danger"> · {t('overdue_n', { n: late })}</span>}
                </span>
                <span className="muted">{fmtDate(p.end_date)}</span>
              </div>
              <div className="row between">
                <span className="with-avatar small"><Avatar user={userById[p.manager_id]} size={22} />{userById[p.manager_id]?.full_name}</span>
                <AvatarStack ids={participantIds(p).filter((id) => id !== p.manager_id)} userById={userById} size={22} />
              </div>
            </Link>
          );
        })}
      </div>

      {creating && (
        <ProjectDialog onClose={() => setCreating(false)} onSaved={(saved) => { setCreating(false); navigate(`/projects/${saved.id}`); }} />
      )}
    </div>
  );
}
