import { supabase, q, fetchAll } from './supabase.js';
import { diffAssignees } from './logic.js';

const TASK_COLUMNS = '*, task_assignees(user_id)';
const PROJECT_COLUMNS = '*, project_members(user_id)';

export const api = {
  // ---------- المستخدمون ----------
  users: () => q(supabase.from('users').select('*').order('full_name')),
  profile: (id) => q(supabase.from('users').select('*').eq('id', id).single()),
  updateUser: (id, patch) => q(supabase.from('users').update(patch).eq('id', id)),
  createUser: async (body) => {
    const { data, error } = await supabase.functions.invoke('create-user', { body });
    if (error) {
      let msg = error.message;
      try { msg = (await error.context.json()).error || msg; } catch { /* ignore */ }
      throw new Error(msg);
    }
    return data;
  },

  // ---------- المشاريع ----------
  projects: () =>
    q(supabase.from('projects').select(PROJECT_COLUMNS).order('created_at', { ascending: false })),
  project: (id) => q(supabase.from('projects').select(PROJECT_COLUMNS).eq('id', id).single()),

  async saveProject(project, memberIds, existing) {
    const row = {
      name: project.name.trim(),
      description: project.description || null,
      start_date: project.start_date || null,
      end_date: project.end_date,
      status: project.status || 'active',
      manager_id: project.manager_id,
    };
    let saved;
    if (existing) {
      saved = await q(supabase.from('projects').update(row).eq('id', existing.id).select().single());
    } else {
      saved = await q(supabase.from('projects').insert(row).select().single());
    }
    const before = existing ? existing.project_members.map((m) => m.user_id) : [];
    const after = memberIds.filter((id) => id !== row.manager_id);
    const { add, remove } = diffAssignees(before, after);
    if (remove.length) {
      await q(supabase.from('project_members').delete().eq('project_id', saved.id).in('user_id', remove));
    }
    if (add.length) {
      await q(supabase.from('project_members').insert(add.map((user_id) => ({ project_id: saved.id, user_id }))));
    }
    return saved;
  },

  // ---------- المهام ----------
  tasksOfProject: (projectId) =>
    fetchAll(() => supabase.from('tasks').select(TASK_COLUMNS).eq('project_id', projectId).order('created_at')),
  allTasks: () => fetchAll(() => supabase.from('tasks').select(TASK_COLUMNS).order('created_at')),

  async myTasks(userId) {
    const links = await fetchAll(() => supabase.from('task_assignees').select('task_id').eq('user_id', userId));
    const ids = links.map((l) => l.task_id);
    const out = [];
    for (let i = 0; i < ids.length; i += 200) {
      out.push(...(await q(supabase.from('tasks').select(TASK_COLUMNS).in('id', ids.slice(i, i + 200)))));
    }
    return out;
  },

  async saveTask(task, assigneeIdsNow, existing) {
    const row = {
      project_id: task.project_id,
      title: task.title.trim(),
      description: task.description || null,
      status: task.status || 'new',
      priority: task.priority || 'medium',
      due_date: task.due_date || null,
    };
    let saved;
    if (existing) {
      const patch = {};
      for (const k of Object.keys(row)) if (row[k] !== existing[k]) patch[k] = row[k];
      saved = Object.keys(patch).length
        ? await q(supabase.from('tasks').update(patch).eq('id', existing.id).select().single())
        : existing;
    } else {
      saved = await q(supabase.from('tasks').insert(row).select().single());
    }
    const before = existing ? (existing.task_assignees || []).map((a) => a.user_id) : [];
    const { add, remove } = diffAssignees(before, assigneeIdsNow);
    if (remove.length) {
      await q(supabase.from('task_assignees').delete().eq('task_id', saved.id).in('user_id', remove));
    }
    if (add.length) {
      await q(supabase.from('task_assignees').insert(add.map((user_id) => ({ task_id: saved.id, user_id }))));
    }
    return saved;
  },

  setStatus: (taskId, status) => q(supabase.from('tasks').update({ status }).eq('id', taskId)),
  deleteTask: (taskId) => q(supabase.from('tasks').delete().eq('id', taskId)),

  // ---------- التعليقات والسجل ----------
  comments: (taskId) =>
    q(supabase.from('comments').select('*').eq('task_id', taskId).order('created_at')),
  addComment: (task_id, body, mentions) =>
    q(supabase.from('comments').insert({ task_id, body, mentions })),
  activity: (taskId) =>
    q(supabase.from('activity_log').select('*').eq('task_id', taskId).order('created_at', { ascending: false }).limit(50)),

  // ---------- الإشعارات ----------
  notifications: () =>
    q(supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30)),
  markRead: (ids) => q(supabase.from('notifications').update({ is_read: true }).in('id', ids)),
};
