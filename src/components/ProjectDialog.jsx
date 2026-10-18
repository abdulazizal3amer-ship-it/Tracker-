import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { PROJECT_STATUSES, validateProject } from '../lib/logic.js';
import { ErrorText, Modal, PeoplePicker } from './ui.jsx';

export default function ProjectDialog({ project, onClose, onSaved }) {
  const { t } = useI18n();
  const { profile, activeUsers, userById } = useAuth();
  const isAdmin = profile.role === 'admin';
  const [form, setForm] = useState({
    name: project?.name || '',
    description: project?.description || '',
    start_date: project?.start_date || '',
    end_date: project?.end_date || '',
    status: project?.status || 'active',
    manager_id: project?.manager_id || profile.id,
  });
  const [members, setMembers] = useState(project ? project.project_members.map((m) => m.user_id) : []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const managers = activeUsers.filter((u) => u.role === 'pm' || u.role === 'admin');
  const memberOptions = activeUsers.filter((u) => u.id !== form.manager_id).map((u) => u.id);

  const save = async (e) => {
    e.preventDefault();
    const err = validateProject(form);
    if (err) return setError(t(err));
    setBusy(true); setError('');
    try {
      const saved = await api.saveProject(form, members, project);
      onSaved(saved);
    } catch (ex) {
      setError(ex.message || t('error_generic'));
      setBusy(false);
    }
  };

  return (
    <Modal title={project ? t('edit_project') : t('new_project')} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>{t('project_name')}<input value={form.name} onChange={set('name')} autoFocus maxLength={120} /></label>
        <label>{t('description')}<textarea rows={3} value={form.description} onChange={set('description')} /></label>
        <div className="form-row">
          <label>{t('start_date')}<input type="date" value={form.start_date} onChange={set('start_date')} /></label>
          <label>{t('end_date')}<input type="date" value={form.end_date} onChange={set('end_date')} /></label>
        </div>
        <div className="form-row">
          <label>
            {t('manager')}
            <select value={form.manager_id} onChange={set('manager_id')} disabled={!isAdmin}>
              {managers.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </label>
          {project && (
            <label>
              {t('status')}
              <select value={form.status} onChange={set('status')}>
                {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{t('pstatus_' + s)}</option>)}
              </select>
            </label>
          )}
        </div>
        <fieldset>
          <legend>{t('members')}</legend>
          <PeoplePicker options={memberOptions} value={members} onChange={setMembers} userById={userById} />
        </fieldset>
        <ErrorText>{error}</ErrorText>
        <div className="row end">
          <button type="button" className="btn" onClick={onClose}>{t('cancel')}</button>
          <button className="btn primary" disabled={busy}>{busy ? t('saving') : t('save')}</button>
        </div>
      </form>
    </Modal>
  );
}
