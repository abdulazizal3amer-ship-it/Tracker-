import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { assigneeIds, isOverdue } from '../lib/logic.js';
import { AvatarStack, DueDate, PriorityBadge, StatusBadge } from './ui.jsx';

export default function TaskCard({ task, projectName, onOpen, draggable, onDragStart, showStatus = true }) {
  const { userById } = useAuth();
  const { t } = useI18n();
  const ids = assigneeIds(task);
  return (
    <button
      type="button"
      className={`task-card ${isOverdue(task) ? 'is-overdue' : ''} ${task.status === 'done' ? 'is-done' : ''}`}
      onClick={onOpen}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      {projectName && <small className="muted">{projectName}</small>}
      <strong className="task-card-title">{task.title}</strong>
      <span className="task-card-meta">
        {showStatus && <StatusBadge status={task.status} />}
        <PriorityBadge priority={task.priority} />
        {ids.length > 1 && <span className="badge group">{t('group_task', { n: ids.length })}</span>}
      </span>
      <span className="task-card-foot">
        <DueDate task={task} />
        <AvatarStack ids={ids} userById={userById} />
      </span>
    </button>
  );
}
