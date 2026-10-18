import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const dict = {
  ar: {
    app_name: 'Tracker',
    app_tagline: 'متابعة المشاريع والمهام',
    // التنقل
    nav_dashboard: 'اللوحة الرئيسية', nav_my_tasks: 'مهامي', nav_projects: 'المشاريع', nav_users: 'المستخدمون',
    sign_out: 'تسجيل الخروج', change_password: 'تغيير كلمة المرور', switch_lang: 'English',
    // الدخول
    email: 'البريد الإلكتروني', password: 'كلمة المرور', sign_in: 'دخول', signing_in: 'جارٍ الدخول…',
    forgot_password: 'نسيت كلمة المرور؟', send_reset: 'أرسل رابط الاستعادة', back_to_login: 'العودة للدخول',
    reset_sent: 'إن كان البريد مسجلاً فستصلك رسالة برابط لتعيين كلمة مرور جديدة.',
    bad_login: 'البريد أو كلمة المرور غير صحيحة.', account_disabled: 'هذا الحساب معطّل. تواصل مع مدير النظام.',
    new_password: 'كلمة المرور الجديدة', confirm_password: 'تأكيد كلمة المرور', save_password: 'حفظ كلمة المرور',
    must_change_title: 'عيّن كلمة مرور جديدة', must_change_hint: 'هذه أول مرة تدخل فيها. اختر كلمة مرور خاصة بك (8 أحرف على الأقل).',
    password_short: 'كلمة المرور 8 أحرف على الأقل.', password_mismatch: 'كلمتا المرور غير متطابقتين.', password_saved: 'تم حفظ كلمة المرور.',
    // عام
    save: 'حفظ', saving: 'جارٍ الحفظ…', cancel: 'إلغاء', delete: 'حذف', edit: 'تعديل', close: 'إغلاق', all: 'الكل',
    loading: 'جارٍ التحميل…', search: 'بحث بالعنوان…', none: '—', error_generic: 'حدث خطأ. حاول مرة أخرى.',
    confirm_delete_task: 'حذف هذه المهمة نهائياً؟',
    // الحالات والأولويات
    status_new: 'جديدة', status_in_progress: 'قيد التنفيذ', status_review: 'قيد المراجعة', status_done: 'مكتملة',
    priority_low: 'منخفضة', priority_medium: 'متوسطة', priority_high: 'عالية', priority_urgent: 'عاجلة',
    pstatus_active: 'نشط', pstatus_on_hold: 'متوقف', pstatus_completed: 'مكتمل', pstatus_archived: 'مؤرشف',
    role_admin: 'مدير النظام', role_pm: 'مدير مشروع', role_member: 'عضو فريق',
    // اللوحة
    dash_title: 'اللوحة الرئيسية', dash_open: 'مهام مفتوحة', dash_overdue: 'متأخرة', dash_week: 'مستحقة هذا الأسبوع', dash_done: 'مكتملة',
    dash_overdue_list: 'المهام المتأخرة', dash_week_list: 'المستحقة خلال 7 أيام', dash_projects: 'إنجاز المشاريع',
    dash_workload: 'حمل العمل لكل عضو', dash_no_overdue: 'لا توجد مهام متأخرة. عمل رائع.', dash_no_week: 'لا شيء مستحق هذا الأسبوع.',
    days_late: '{n} يوم تأخير', open_tasks_n: '{n} مفتوحة', overdue_n: '{n} متأخرة',
    // المشاريع
    projects_title: 'المشاريع', new_project: 'مشروع جديد', edit_project: 'تعديل المشروع', no_projects: 'لا توجد مشاريع بعد.',
    project_name: 'اسم المشروع', description: 'الوصف', start_date: 'تاريخ البداية', end_date: 'تاريخ النهاية',
    manager: 'مدير المشروع', members: 'الأعضاء', status: 'الحالة', progress: 'الإنجاز', tasks_n: '{n} مهمة',
    show_archived: 'إظهار المؤرشفة',
    err_name_required: 'اسم المشروع مطلوب.', err_end_required: 'تاريخ النهاية مطلوب.', err_end_before_start: 'تاريخ النهاية يسبق تاريخ البداية.',
    // المهام
    new_task: 'مهمة جديدة', task_title: 'عنوان المهمة', assignees: 'المسؤولون', due_date: 'تاريخ الاستحقاق', priority: 'الأولوية',
    all_members: 'كل أعضاء المشروع', clear: 'مسح', view_board: 'لوحة كانبان', view_list: 'قائمة',
    filter_assignee: 'المسؤول', err_title_required: 'عنوان المهمة مطلوب.', err_assignee_required: 'اختر مسؤولاً واحداً على الأقل.',
    member_self_only: 'بصفتك عضواً، تُسند المهام لنفسك فقط.', group_task: 'مهمة جماعية ({n})',
    status_only_hint: 'يمكنك تغيير الحالة فقط؛ بقية التفاصيل يعدّلها مدير المشروع.',
    comments: 'التعليقات', add_comment: 'اكتب تعليقاً… استخدم @ للإشارة إلى زميل', send: 'إرسال', no_comments: 'لا توجد تعليقات.',
    activity: 'سجل النشاط', drop_here: 'أفلت هنا', no_tasks: 'لا توجد مهام.', project: 'المشروع', created_by: 'أنشأها',
    act_created: 'أنشأ المهمة', act_status: 'غيّر الحالة من {a} إلى {b}', act_priority: 'غيّر الأولوية من {a} إلى {b}',
    act_due_date: 'غيّر الاستحقاق من {a} إلى {b}', act_title: 'غيّر العنوان', act_assigned: 'أسند المهمة إلى {b}', act_unassigned: 'أزال {a} من المهمة',
    // مهامي
    my_title: 'مهامي', my_overdue: 'متأخرة', my_today: 'اليوم وهذا الأسبوع', my_later: 'لاحقاً', my_nodate: 'بلا تاريخ', my_done: 'مكتملة مؤخراً',
    my_empty: 'لا توجد مهام مسندة إليك.',
    // المستخدمون
    users_title: 'المستخدمون', new_user: 'مستخدم جديد', full_name: 'الاسم الكامل', role: 'الدور', active: 'نشط', disabled: 'معطّل',
    temp_password: 'كلمة مرور مؤقتة', generate: 'توليد', last_login: 'آخر دخول', enable: 'تفعيل', disable: 'تعطيل',
    user_created: 'تم إنشاء الحساب. أرسل للمستخدم بريده وكلمة المرور المؤقتة: {p}', copy: 'نسخ',
    // الإشعارات
    notifications: 'الإشعارات', no_notifications: 'لا توجد إشعارات.', mark_all_read: 'تعليم الكل كمقروء',
    n_assigned: '{actor} أسند إليك: {title}', n_status: '{actor} غيّر حالة «{title}» إلى {status}',
    n_comment: '{actor} علّق على: {title}', n_mention: '{actor} أشار إليك في: {title}',
    // الإعداد
    setup_title: 'التطبيق غير مُعدّ بعد', setup_body: 'لم تُضبط بيانات الاتصال بـ Supabase. اتبع خطوات ملف README في المستودع، ثم أعد النشر.',
  },
  en: {
    app_name: 'Tracker',
    app_tagline: 'Projects & tasks',
    nav_dashboard: 'Dashboard', nav_my_tasks: 'My tasks', nav_projects: 'Projects', nav_users: 'Users',
    sign_out: 'Sign out', change_password: 'Change password', switch_lang: 'العربية',
    email: 'Email', password: 'Password', sign_in: 'Sign in', signing_in: 'Signing in…',
    forgot_password: 'Forgot password?', send_reset: 'Send reset link', back_to_login: 'Back to sign in',
    reset_sent: 'If the email is registered, you will receive a link to set a new password.',
    bad_login: 'Incorrect email or password.', account_disabled: 'This account is disabled. Contact your admin.',
    new_password: 'New password', confirm_password: 'Confirm password', save_password: 'Save password',
    must_change_title: 'Set a new password', must_change_hint: 'This is your first sign-in. Choose your own password (at least 8 characters).',
    password_short: 'Password must be at least 8 characters.', password_mismatch: 'Passwords do not match.', password_saved: 'Password saved.',
    save: 'Save', saving: 'Saving…', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', close: 'Close', all: 'All',
    loading: 'Loading…', search: 'Search by title…', none: '—', error_generic: 'Something went wrong. Please try again.',
    confirm_delete_task: 'Delete this task permanently?',
    status_new: 'New', status_in_progress: 'In progress', status_review: 'In review', status_done: 'Done',
    priority_low: 'Low', priority_medium: 'Medium', priority_high: 'High', priority_urgent: 'Urgent',
    pstatus_active: 'Active', pstatus_on_hold: 'On hold', pstatus_completed: 'Completed', pstatus_archived: 'Archived',
    role_admin: 'Admin', role_pm: 'Project manager', role_member: 'Team member',
    dash_title: 'Dashboard', dash_open: 'Open tasks', dash_overdue: 'Overdue', dash_week: 'Due this week', dash_done: 'Done',
    dash_overdue_list: 'Overdue tasks', dash_week_list: 'Due in the next 7 days', dash_projects: 'Project progress',
    dash_workload: 'Workload per member', dash_no_overdue: 'No overdue tasks. Great work.', dash_no_week: 'Nothing due this week.',
    days_late: '{n} days late', open_tasks_n: '{n} open', overdue_n: '{n} overdue',
    projects_title: 'Projects', new_project: 'New project', edit_project: 'Edit project', no_projects: 'No projects yet.',
    project_name: 'Project name', description: 'Description', start_date: 'Start date', end_date: 'End date',
    manager: 'Project manager', members: 'Members', status: 'Status', progress: 'Progress', tasks_n: '{n} tasks',
    show_archived: 'Show archived',
    err_name_required: 'Project name is required.', err_end_required: 'End date is required.', err_end_before_start: 'End date is before start date.',
    new_task: 'New task', task_title: 'Task title', assignees: 'Assignees', due_date: 'Due date', priority: 'Priority',
    all_members: 'All project members', clear: 'Clear', view_board: 'Board', view_list: 'List',
    filter_assignee: 'Assignee', err_title_required: 'Task title is required.', err_assignee_required: 'Choose at least one assignee.',
    member_self_only: 'As a team member, you can only assign tasks to yourself.', group_task: 'Group task ({n})',
    status_only_hint: 'You can change the status only; the project manager edits the other details.',
    comments: 'Comments', add_comment: 'Write a comment… use @ to mention a teammate', send: 'Send', no_comments: 'No comments yet.',
    activity: 'Activity', drop_here: 'Drop here', no_tasks: 'No tasks.', project: 'Project', created_by: 'Created by',
    act_created: 'created the task', act_status: 'changed status from {a} to {b}', act_priority: 'changed priority from {a} to {b}',
    act_due_date: 'changed due date from {a} to {b}', act_title: 'renamed the task', act_assigned: 'assigned {b}', act_unassigned: 'removed {a}',
    my_title: 'My tasks', my_overdue: 'Overdue', my_today: 'Today & this week', my_later: 'Later', my_nodate: 'No date', my_done: 'Recently done',
    my_empty: 'No tasks are assigned to you.',
    users_title: 'Users', new_user: 'New user', full_name: 'Full name', role: 'Role', active: 'Active', disabled: 'Disabled',
    temp_password: 'Temporary password', generate: 'Generate', last_login: 'Last sign-in', enable: 'Enable', disable: 'Disable',
    user_created: 'Account created. Send the user their email and temporary password: {p}', copy: 'Copy',
    notifications: 'Notifications', no_notifications: 'No notifications.', mark_all_read: 'Mark all as read',
    n_assigned: '{actor} assigned you: {title}', n_status: '{actor} moved “{title}” to {status}',
    n_comment: '{actor} commented on: {title}', n_mention: '{actor} mentioned you in: {title}',
    setup_title: 'App not configured yet', setup_body: 'The Supabase connection is not set. Follow the README steps in the repository, then redeploy.',
  },
};

const I18nContext = createContext(null);

function readLang() {
  try { return localStorage.getItem('lang') === 'en' ? 'en' : 'ar'; } catch { return 'ar'; }
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(readLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try { localStorage.setItem('lang', lang); } catch { /* ignore */ }
  }, [lang]);

  const value = useMemo(() => {
    const t = (key, vars) => {
      let s = dict[lang][key] ?? dict.ar[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
      return s;
    };
    const locale = lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
    const fmtDate = (iso) =>
      iso ? new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : t('none');
    const fmtDateTime = (iso) =>
      iso ? new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : t('none');
    return { lang, setLang, t, fmtDate, fmtDateTime };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
