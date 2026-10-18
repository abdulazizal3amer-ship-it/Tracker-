import { describe, expect, it } from 'vitest';
import {
  assignableIds, canChangeStatus, canCreateProject, canEditTaskDetails, countByStatus, daysOverdue,
  diffAssignees, filterTasks, generatePassword, isDueThisWeek, isOverdue, managesProject, parseMentions,
  participantIds, progress, sortByDue, todayISO, validatePassword, validateProject, validateTask, workload,
} from '../src/lib/logic.js';

const TODAY = '2026-10-14';
const admin = { id: 'a', role: 'admin', full_name: 'مدير النظام' };
const pm = { id: 'p', role: 'pm', full_name: 'سارة' };
const pm2 = { id: 'p2', role: 'pm', full_name: 'خالد' };
const m1 = { id: 'm1', role: 'member', full_name: 'أحمد علي' };
const m2 = { id: 'm2', role: 'member', full_name: 'نورة' };
const project = { id: 'pr', manager_id: 'p', project_members: [{ user_id: 'm1' }, { user_id: 'm2' }] };
const task = (o = {}) => ({ id: 't', title: 'مهمة', status: 'new', priority: 'medium', due_date: null, created_by: 'p', task_assignees: [], ...o });

describe('التأخر والاستحقاق', () => {
  it('المهمة المتأخرة: تاريخها مضى وليست مكتملة', () => {
    expect(isOverdue(task({ due_date: '2026-10-13' }), TODAY)).toBe(true);
    expect(isOverdue(task({ due_date: '2026-10-14' }), TODAY)).toBe(false);
    expect(isOverdue(task({ due_date: '2026-10-01', status: 'done' }), TODAY)).toBe(false);
    expect(isOverdue(task(), TODAY)).toBe(false);
  });
  it('عدد أيام التأخير', () => {
    expect(daysOverdue(task({ due_date: '2026-10-04' }), TODAY)).toBe(10);
    expect(daysOverdue(task({ due_date: '2026-10-20' }), TODAY)).toBe(0);
  });
  it('المستحقة هذا الأسبوع تشمل اليوم و7 أيام', () => {
    expect(isDueThisWeek(task({ due_date: TODAY }), TODAY)).toBe(true);
    expect(isDueThisWeek(task({ due_date: '2026-10-21' }), TODAY)).toBe(true);
    expect(isDueThisWeek(task({ due_date: '2026-10-22' }), TODAY)).toBe(false);
    expect(isDueThisWeek(task({ due_date: '2026-10-13' }), TODAY)).toBe(false);
  });
  it('todayISO بصيغة YYYY-MM-DD', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('الإنجاز والإحصاءات', () => {
  it('نسبة الإنجاز = المكتملة ÷ الإجمالي', () => {
    expect(progress([])).toBe(0);
    expect(progress([task({ status: 'done' }), task(), task(), task()])).toBe(25);
  });
  it('المهمة الجماعية تُحتسب مرة واحدة في الإنجاز', () => {
    const group = task({ status: 'done', task_assignees: [{ user_id: 'm1' }, { user_id: 'm2' }] });
    expect(progress([group, task()])).toBe(50);
  });
  it('العدّ حسب الحالة', () => {
    expect(countByStatus([task(), task({ status: 'done' }), task({ status: 'review' })]))
      .toEqual({ new: 1, in_progress: 0, review: 1, done: 1 });
  });
  it('حمل العمل: المهمة الجماعية تُحتسب لكل عضو', () => {
    const ts = [
      task({ id: '1', task_assignees: [{ user_id: 'm1' }, { user_id: 'm2' }], due_date: '2026-10-01' }),
      task({ id: '2', task_assignees: [{ user_id: 'm1' }] }),
      task({ id: '3', status: 'done', task_assignees: [{ user_id: 'm2' }] }),
    ];
    const w = workload(ts, [m1, m2, pm], TODAY);
    expect(w.map((r) => [r.user.id, r.open, r.overdue])).toEqual([['m1', 2, 1], ['m2', 1, 1]]);
  });
});

describe('الصلاحيات', () => {
  it('إنشاء المشاريع للمدير ومدير المشروع فقط', () => {
    expect(canCreateProject(admin)).toBe(true);
    expect(canCreateProject(pm)).toBe(true);
    expect(canCreateProject(m1)).toBe(false);
  });
  it('إدارة المشروع: المدير العام أو مديره', () => {
    expect(managesProject(admin, project)).toBe(true);
    expect(managesProject(pm, project)).toBe(true);
    expect(managesProject(pm2, project)).toBe(false);
    expect(managesProject(m1, project)).toBe(false);
  });
  it('تغيير الحالة: أي عضو من المسندين في المهمة الجماعية', () => {
    const group = task({ task_assignees: [{ user_id: 'm1' }, { user_id: 'm2' }] });
    expect(canChangeStatus(m1, group, project)).toBe(true);
    expect(canChangeStatus(m2, group, project)).toBe(true);
    expect(canChangeStatus(m1, task(), project)).toBe(false);
    expect(canChangeStatus(pm, task(), project)).toBe(true);
  });
  it('تعديل التفاصيل: مدير المشروع أو منشئ المهمة', () => {
    expect(canEditTaskDetails(m1, task({ task_assignees: [{ user_id: 'm1' }] }), project)).toBe(false);
    expect(canEditTaskDetails(m1, task({ created_by: 'm1' }), project)).toBe(true);
    expect(canEditTaskDetails(pm, task(), project)).toBe(true);
  });
  it('الإسناد: المدير لأي مشارك، والعضو لنفسه فقط', () => {
    expect(assignableIds(pm, project).sort()).toEqual(['m1', 'm2', 'p']);
    expect(assignableIds(m1, project)).toEqual(['m1']);
  });
  it('المشاركون بلا تكرار', () => {
    expect(participantIds({ manager_id: 'p', project_members: [{ user_id: 'p' }, { user_id: 'm1' }] })).toEqual(['p', 'm1']);
  });
});

describe('الإسناد المتعدد والإشارات', () => {
  it('فرق المسندين: من يُضاف ومن يُزال', () => {
    expect(diffAssignees(['m1', 'm2'], ['m2', 'p'])).toEqual({ add: ['p'], remove: ['m1'] });
    expect(diffAssignees([], ['m1'])).toEqual({ add: ['m1'], remove: [] });
  });
  it('استخراج الإشارات بالاسم الكامل', () => {
    expect(parseMentions('@أحمد علي راجع هذا مع @نورة', [m1, m2, pm])).toEqual(['m1', 'm2']);
    expect(parseMentions('بلا إشارات', [m1])).toEqual([]);
  });
});

describe('الترتيب والتصفية', () => {
  it('الترتيب بالاستحقاق والمهام بلا تاريخ في الآخر', () => {
    const ts = [task({ id: 'x' }), task({ id: 'b', due_date: '2026-11-01' }), task({ id: 'a', due_date: '2026-10-01' })];
    expect(sortByDue(ts).map((x) => x.id)).toEqual(['a', 'b', 'x']);
  });
  it('التصفية بالمسؤول والأولوية والبحث', () => {
    const ts = [
      task({ id: '1', title: 'تصميم الشعار', priority: 'high', task_assignees: [{ user_id: 'm1' }] }),
      task({ id: '2', title: 'كتابة المحتوى', task_assignees: [{ user_id: 'm1' }, { user_id: 'm2' }] }),
    ];
    expect(filterTasks(ts, { assignee: 'm2' }).map((x) => x.id)).toEqual(['2']);
    expect(filterTasks(ts, { priority: 'high' }).map((x) => x.id)).toEqual(['1']);
    expect(filterTasks(ts, { q: 'الشعار' }).map((x) => x.id)).toEqual(['1']);
  });
});

describe('التحقق من المدخلات', () => {
  it('كلمة المرور 8 أحرف على الأقل', () => {
    expect(validatePassword('1234567')).toBe(false);
    expect(validatePassword('12345678')).toBe(true);
  });
  it('المشروع: الاسم وتاريخ النهاية، والنهاية لا تسبق البداية', () => {
    expect(validateProject({ name: '', end_date: '2026-12-01' })).toBe('err_name_required');
    expect(validateProject({ name: 'س', end_date: '' })).toBe('err_end_required');
    expect(validateProject({ name: 'س', start_date: '2026-12-02', end_date: '2026-12-01' })).toBe('err_end_before_start');
    expect(validateProject({ name: 'س', start_date: '2026-12-01', end_date: '2026-12-01' })).toBe(null);
  });
  it('المهمة: عنوان ومسؤول واحد على الأقل', () => {
    expect(validateTask({ title: ' ' }, ['m1'])).toBe('err_title_required');
    expect(validateTask({ title: 'س' }, [])).toBe('err_assignee_required');
    expect(validateTask({ title: 'س' }, ['m1', 'm2'])).toBe(null);
  });
  it('توليد كلمة مرور مؤقتة', () => {
    const p = generatePassword();
    expect(p).toHaveLength(12);
    expect(validatePassword(p)).toBe(true);
  });
});
