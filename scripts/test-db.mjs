// اختبار قاعدة البيانات وسياسات الصلاحيات على PostgreSQL حقيقي (PGlite) دون أي خادم.
// التشغيل: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const dir = new URL('../supabase/migrations', import.meta.url).pathname;
const db = new PGlite();
const ids = {
  admin: '00000000-0000-0000-0000-00000000000a',
  pm: '00000000-0000-0000-0000-0000000000b1',
  pm2: '00000000-0000-0000-0000-0000000000b2',
  m1: '00000000-0000-0000-0000-0000000000c1',
  m2: '00000000-0000-0000-0000-0000000000c2',
  out: '00000000-0000-0000-0000-0000000000d1',
};

// محاكاة بيئة Supabase
await db.exec(`
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to authenticated;
  grant execute on function auth.uid() to authenticated;
  alter default privileges in schema public grant all on tables to authenticated;
  alter default privileges in schema public grant all on sequences to authenticated;
  create publication supabase_realtime;
`);
for (const f of ['001_tables.sql', '002_functions.sql', '003_rls.sql']) {
  await db.exec(readFileSync(`${dir}/${f}`, 'utf8'));
  console.log('✓ migrated', f);
}

// مستخدمون عبر محفز auth.users
const mk = (k, role, name) => db.query(
  `insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values ($1, $2, $3, $4)`,
  [ids[k], `${k}@x.com`, { full_name: name }, role ? { role, must_change_password: true } : {}]);
await mk('admin', 'admin', 'المدير'); await mk('pm', 'pm', 'سارة'); await mk('pm2', 'pm', 'خالد');
await mk('m1', 'member', 'أحمد'); await mk('m2', 'member', 'نورة'); await mk('out', 'member', 'غريب');
await db.query(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'self@x.com')`);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };
async function as(k, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${k ? ids[k] : ''}', false); ${k ? 'set role authenticated;' : ''}`);
  try { return { rows: (await db.query(sql, params)).rows }; } catch (e) { return { error: e.message }; } finally { await db.exec('reset role'); }
}

console.log('\nالمستخدمون');
let r = await as(null, `select id, role, must_change_password from public.users order by email`);
ok(r.rows.length === 7, 'المحفز أنشأ صفاً في users لكل حساب');
r = await as(null, `select role, is_active from public.users where email = 'self@x.com'`);
ok(r.rows[0].role === 'member' && r.rows[0].is_active === false, 'التسجيل الذاتي (دون المدير) يبدأ معطّلاً بدور member');
r = await as('m1', `update public.users set role = 'admin' where id = $1`, [ids.m1]);
ok(r.error?.includes('not_allowed'), 'العضو لا يرقّي نفسه لمدير');
r = await as('m1', `update public.users set full_name = 'أحمد علي', must_change_password = false where id = $1 returning id`, [ids.m1]);
ok(r.rows?.length === 1, 'العضو يعدّل اسمه ويلغي إجبار تغيير كلمة المرور');
r = await as('m1', `update public.users set full_name = 'x' where id = $1 returning id`, [ids.m2]);
ok(r.rows?.length === 0, 'العضو لا يعدّل حساب غيره');
r = await as('admin', `update public.users set role = 'pm' where id = $1 returning role`, [ids.m2]);
ok(r.rows?.[0]?.role === 'pm', 'المدير يغيّر الأدوار');
await as('admin', `update public.users set role = 'member' where id = $1`, [ids.m2]);

console.log('\nالمشاريع');
r = await as('m1', `insert into public.projects (name, end_date, manager_id) values ('x', '2026-12-31', $1) returning id`, [ids.m1]);
ok(r.error, 'العضو لا ينشئ مشروعاً');
r = await as('pm', `insert into public.projects (name, end_date, manager_id) values ('موقع', '2026-12-31', $1) returning id`, [ids.pm]);
const pid = r.rows?.[0]?.id; ok(pid, 'مدير المشروع ينشئ مشروعاً باسمه');
r = await as('pm', `insert into public.projects (name, start_date, end_date, manager_id) values ('خطأ', '2026-12-31', '2026-01-01', $1)`, [ids.pm]);
ok(r.error, 'تاريخ النهاية لا يسبق البداية');
r = await as('pm', `insert into public.project_members values ($1, $2), ($1, $3)`, [pid, ids.m1, ids.m2]);
ok(!r.error, 'مدير المشروع يضيف الأعضاء');
r = await as('pm2', `insert into public.project_members values ($1, $2)`, [pid, ids.out]);
ok(r.error, 'مدير مشروع آخر لا يضيف أعضاء لمشروع ليس له');
r = await as('out', `select * from public.projects`);
ok(r.rows.length === 0, 'غير العضو لا يرى المشروع');
r = await as('m1', `select * from public.projects`);
ok(r.rows.length === 1, 'العضو يرى مشروعه');
r = await as('admin', `select * from public.projects`);
ok(r.rows.length === 1, 'مدير النظام يرى كل المشاريع');

console.log('\nالمهام والإسناد الجماعي');
r = await as('pm', `insert into public.tasks (project_id, title, due_date) values ($1, 'تصميم الشعار', '2026-10-01') returning id, created_by`, [pid]);
const tid = r.rows?.[0]?.id; ok(tid && r.rows[0].created_by === ids.pm, 'مدير المشروع ينشئ مهمة');
r = await as('pm', `insert into public.task_assignees (task_id, user_id) values ($1, $2), ($1, $3)`, [tid, ids.m1, ids.m2]);
ok(!r.error, 'إسناد المهمة لعضوين معاً');
r = await as('pm', `insert into public.task_assignees (task_id, user_id) values ($1, $2)`, [tid, ids.out]);
ok(r.error, 'لا إسناد لغير أعضاء المشروع');
r = await as('m1', `select type, message from public.notifications`);
ok(r.rows.length === 1 && r.rows[0].type === 'assigned', 'العضو الأول وصله إشعار إسناد');
r = await as('m2', `select type from public.notifications`);
ok(r.rows.length === 1, 'العضو الثاني وصله إشعار إسناد');

r = await as('m2', `update public.tasks set status = 'in_progress' where id = $1 returning status`, [tid]);
ok(r.rows?.[0]?.status === 'in_progress', 'أي عضو في المهمة الجماعية يغيّر الحالة');
r = await as('m1', `select type, new_status, message from public.notifications where type = 'status'`);
ok(r.rows.length === 1 && r.rows[0].new_status === 'in_progress' && r.rows[0].message === 'تصميم الشعار', 'العضو الآخر أُشعر بتغيير الحالة');
r = await as('m2', `select * from public.notifications where type = 'status'`);
ok(r.rows.length === 0, 'من غيّر الحالة لا يُشعَر نفسه');
r = await as('m1', `update public.tasks set title = 'عنوان آخر' where id = $1`, [tid]);
ok(r.error?.includes('not_allowed'), 'المسند إليه لا يعدّل العنوان');
r = await as('m1', `update public.tasks set status = 'done' where id = $1 returning completed_at, completed_by`, [tid]);
ok(r.rows?.[0]?.completed_at && r.rows[0].completed_by === ids.m1, 'الإكمال يسجّل completed_at و completed_by');
r = await as('m1', `update public.tasks set status = 'review' where id = $1 returning completed_at`, [tid]);
ok(r.rows?.[0]?.completed_at === null, 'إعادة فتح المهمة تمسح completed_at');

r = await as('m1', `insert into public.tasks (project_id, title) values ($1, 'مهمتي') returning id`, [pid]);
const own = r.rows?.[0]?.id; ok(own, 'العضو ينشئ مهمة في مشروعه');
r = await as('m1', `insert into public.task_assignees (task_id, user_id) values ($1, $2)`, [own, ids.m2]);
ok(r.error, 'العضو لا يُسند لغيره');
r = await as('m1', `insert into public.task_assignees (task_id, user_id) values ($1, $2)`, [own, ids.m1]);
ok(!r.error, 'العضو يُسند لنفسه');
r = await as('m1', `update public.tasks set title = 'مهمتي المعدلة' where id = $1 returning title`, [own]);
ok(r.rows?.[0]?.title === 'مهمتي المعدلة', 'منشئ المهمة يعدّل تفاصيلها');
r = await as('m1', `delete from public.tasks where id = $1 returning id`, [own]);
ok(r.rows?.length === 0, 'العضو لا يحذف المهام');
r = await as('out', `insert into public.tasks (project_id, title) values ($1, 'x')`, [pid]);
ok(r.error, 'غير العضو لا ينشئ مهمة في المشروع');
r = await as('out', `select * from public.tasks`);
ok(r.rows.length === 0, 'غير العضو لا يرى المهام');

console.log('\nالتعليقات والإشارات والسجل');
r = await as('m1', `insert into public.comments (task_id, body, mentions) values ($1, 'راجعي هذا @نورة', $2)`, [tid, [ids.m2, ids.out]]);
ok(!r.error, 'إضافة تعليق مع إشارة');
r = await as('m2', `select type from public.notifications where type in ('mention','comment')`);
ok(r.rows.length === 1 && r.rows[0].type === 'mention', 'المُشار إليه وصله إشعار إشارة (لا تكرار كتعليق)');
r = await as('out', `select * from public.notifications`);
ok(r.rows.length === 0, 'لا إشعار لمن ليس في المشروع حتى لو أُشير إليه');
r = await as('m2', `insert into public.comments (task_id, user_id, body) values ($1, $2, 'انتحال')`, [tid, ids.m1]);
ok(r.error, 'لا يمكن التعليق باسم شخص آخر');
r = await as('m1', `select action from public.activity_log where task_id = $1 order by id`, [tid]);
ok(['created', 'assigned', 'status'].every((a) => r.rows.some((x) => x.action === a)), 'سجل النشاط يحوي الإنشاء والإسناد وتغيير الحالة');
r = await as('m1', `insert into public.activity_log (task_id, action) values ($1, 'fake')`, [tid]);
ok(r.error, 'لا كتابة مباشرة في سجل النشاط');
r = await as('m1', `select * from public.notifications where user_id <> $1`, [ids.m1]);
ok(r.rows.length === 0, 'كل مستخدم يرى إشعاراته فقط');

console.log('\nإزالة عضو وتعطيل حساب');
await as('pm', `update public.tasks set status = 'new' where id = $1`, [tid]);
r = await as('pm', `delete from public.project_members where project_id = $1 and user_id = $2`, [pid, ids.m2]);
r = await as('pm', `select user_id from public.task_assignees where task_id = $1`, [tid]);
ok(r.rows.length === 1 && r.rows[0].user_id === ids.m1, 'إزالة العضو من المشروع تزيله من مهامه المفتوحة');
await as('admin', `update public.users set is_active = false where id = $1`, [ids.m1]);
r = await as('m1', `select * from public.tasks`);
ok(r.rows.length === 0, 'الحساب المعطّل لا يرى شيئاً');

console.log(`\n${pass} نجح، ${fail} فشل`);
process.exit(fail ? 1 : 0);
