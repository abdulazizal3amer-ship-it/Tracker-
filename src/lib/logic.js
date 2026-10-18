// منطق الأعمال — دوال نقية بلا اتصال بقاعدة البيانات، ومغطاة بالاختبارات.
// ملاحظة: هذه الفحوص لتحسين تجربة الاستخدام فقط؛ الحماية الفعلية في سياسات RLS.

export const STATUSES = ['new', 'in_progress', 'review', 'done'];
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
export const PROJECT_STATUSES = ['active', 'on_hold', 'completed', 'archived'];
export const ROLES = ['admin', 'pm', 'member'];

/** تاريخ اليوم بصيغة YYYY-MM-DD بالتوقيت المحلي */
export function todayISO(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function daysBetween(fromISO, toISO) {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 864e5);
}

/** المهمة المتأخرة = تاريخ استحقاقها مضى وحالتها ليست "مكتملة" */
export function isOverdue(task, today = todayISO()) {
  return Boolean(task.due_date) && task.status !== 'done' && task.due_date < today;
}

export function daysOverdue(task, today = todayISO()) {
  return isOverdue(task, today) ? daysBetween(task.due_date, today) : 0;
}

/** مستحقة خلال 7 أيام قادمة (تشمل اليوم) وغير مكتملة */
export function isDueThisWeek(task, today = todayISO()) {
  if (!task.due_date || task.status === 'done') return false;
  const d = daysBetween(today, task.due_date);
  return d >= 0 && d <= 7;
}

/** نسبة الإنجاز = المكتملة ÷ الإجمالي (المهمة الجماعية تُحتسب مرة واحدة) */
export function progress(tasks) {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100);
}

export function countByStatus(tasks) {
  const out = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const t of tasks) out[t.status] = (out[t.status] || 0) + 1;
  return out;
}

export function assigneeIds(task) {
  return (task.task_assignees || []).map((a) => a.user_id);
}

/** المشاركون في المشروع: المدير + الأعضاء، دون تكرار */
export function participantIds(project) {
  if (!project) return [];
  const ids = [project.manager_id, ...(project.project_members || []).map((m) => m.user_id)];
  return [...new Set(ids.filter(Boolean))];
}

export function canCreateProject(user) {
  return Boolean(user) && (user.role === 'admin' || user.role === 'pm');
}

export function managesProject(user, project) {
  if (!user || !project) return false;
  return user.role === 'admin' || (user.role === 'pm' && project.manager_id === user.id);
}

export function canEditTaskDetails(user, task, project) {
  return managesProject(user, project) || (Boolean(user) && task.created_by === user.id);
}

/** تغيير الحالة: مدير المشروع، أو أحد المسندين، أو منشئ المهمة */
export function canChangeStatus(user, task, project) {
  if (!user) return false;
  return (
    managesProject(user, project) ||
    assigneeIds(task).includes(user.id) ||
    task.created_by === user.id
  );
}

/** من يمكن إسناد المهمة إليهم: المدير يُسند لأي مشارك، والعضو لنفسه فقط */
export function assignableIds(user, project) {
  if (!user || !project) return [];
  return managesProject(user, project) ? participantIds(project) : [user.id];
}

export function diffAssignees(before, after) {
  const b = new Set(before);
  const a = new Set(after);
  return {
    add: [...a].filter((id) => !b.has(id)),
    remove: [...b].filter((id) => !a.has(id)),
  };
}

/** يستخرج المُشار إليهم بصيغة @الاسم الكامل من نص التعليق */
export function parseMentions(body, users) {
  return users
    .filter((u) => u.full_name && body.includes('@' + u.full_name))
    .map((u) => u.id);
}

/** ترتيب حسب الاستحقاق، والمهام بلا تاريخ في الآخر */
export function sortByDue(tasks) {
  return [...tasks].sort((x, y) => {
    if (!x.due_date && !y.due_date) return 0;
    if (!x.due_date) return 1;
    if (!y.due_date) return -1;
    return x.due_date < y.due_date ? -1 : x.due_date > y.due_date ? 1 : 0;
  });
}

/** حمل العمل: المهمة الجماعية تُحتسب لكل عضو من أعضائها */
export function workload(tasks, users, today = todayISO()) {
  return users
    .map((u) => {
      const mine = tasks.filter((t) => t.status !== 'done' && assigneeIds(t).includes(u.id));
      return { user: u, open: mine.length, overdue: mine.filter((t) => isOverdue(t, today)).length };
    })
    .filter((r) => r.open > 0)
    .sort((a, b) => b.open - a.open);
}

export function filterTasks(tasks, { assignee, status, priority, q } = {}) {
  const needle = (q || '').trim().toLowerCase();
  return tasks.filter(
    (t) =>
      (!assignee || assigneeIds(t).includes(assignee)) &&
      (!status || t.status === status) &&
      (!priority || t.priority === priority) &&
      (!needle || t.title.toLowerCase().includes(needle))
  );
}

export function validatePassword(p) {
  return typeof p === 'string' && p.length >= 8;
}

/** يعيد مفتاح رسالة الخطأ أو null */
export function validateProject({ name, start_date, end_date }) {
  if (!name || !name.trim()) return 'err_name_required';
  if (!end_date) return 'err_end_required';
  if (start_date && end_date < start_date) return 'err_end_before_start';
  return null;
}

export function validateTask({ title }, assignees) {
  if (!title || !title.trim()) return 'err_title_required';
  if (!assignees.length) return 'err_assignee_required';
  return null;
}

export function generatePassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
