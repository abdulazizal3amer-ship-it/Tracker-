-- =============================================================
-- الدوال المساعدة والمحفزات (Triggers)
-- =============================================================

-- ---------- دوال الصلاحيات (security definer لتجنب التكرار في RLS) ----------

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid() and is_active
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and is_active)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

-- هل المستخدم uid مشارك في المشروع (مديره أو عضو فيه)؟
create or replace function public.is_project_participant(pid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects where id = pid and manager_id = uid)
      or exists (select 1 from public.project_members where project_id = pid and user_id = uid)
$$;

create or replace function public.can_see_project(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active_user()
     and (public.is_admin() or public.is_project_participant(pid, auth.uid()))
$$;

-- إدارة المشروع: مدير النظام، أو مدير المشروع إن كان دوره pm
create or replace function public.manages_project(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or (public.my_role() = 'pm'
          and exists (select 1 from public.projects where id = pid and manager_id = auth.uid()))
$$;

create or replace function public.task_project(tid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select project_id from public.tasks where id = tid
$$;

create or replace function public.is_task_assignee(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.task_assignees where task_id = tid and user_id = auth.uid())
$$;

-- ---------- إنشاء صف المستخدم تلقائياً عند إنشاء حساب ----------
-- الدور يُقرأ من app_metadata (لا يستطيع المستخدم تعديله بنفسه).
-- الحساب الذي لم يُنشئه المدير (بلا دور في app_metadata) يبدأ معطّلاً، كطبقة حماية
-- إضافية حتى لو نُسي إيقاف التسجيل العام في إعدادات Supabase.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r text := coalesce(new.raw_app_meta_data ->> 'role', 'member');
begin
  if r not in ('admin', 'pm', 'member') then r := 'member'; end if;
  insert into public.users (id, full_name, email, role, is_active, must_change_password)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    r,
    (new.raw_app_meta_data ? 'role'),
    coalesce((new.raw_app_meta_data ->> 'must_change_password')::boolean, false)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- حماية حقول المستخدم الحساسة ----------
-- غير المدير لا يغيّر الدور أو التفعيل أو البريد. (auth.uid() فارغ = SQL Editor أو مفتاح الخدمة)
create or replace function public.protect_user_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.email is distinct from old.email
       or (new.must_change_password and not old.must_change_password) then
      raise exception 'not_allowed: only an admin can change role, status or email';
    end if;
  end if;
  return new;
end $$;

create trigger users_protect before update on public.users
  for each row execute function public.protect_user_fields();

-- ---------- المهام: الإكمال، الصلاحيات، السجل، الإشعارات ----------

create or replace function public.tasks_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();

  if tg_op = 'UPDATE' and auth.uid() is not null
     and not public.manages_project(old.project_id)
     and old.created_by is distinct from auth.uid() then
    -- المسند إليه (وليس مدير المشروع أو منشئ المهمة) يغيّر الحالة فقط
    if new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.priority is distinct from old.priority
       or new.due_date is distinct from old.due_date
       or new.project_id is distinct from old.project_id then
      raise exception 'not_allowed: assignees can only change the status';
    end if;
  end if;

  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := now();
    new.completed_by := auth.uid();
  elsif new.status <> 'done' then
    new.completed_at := null;
    new.completed_by := null;
  end if;
  return new;
end $$;

create trigger tasks_before_write before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

create or replace function public.tasks_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (task_id, user_id, action, new_value)
    values (new.id, auth.uid(), 'created', new.title);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.activity_log (task_id, user_id, action, old_value, new_value)
    values (new.id, auth.uid(), 'status', old.status, new.status);

    insert into public.notifications (user_id, type, task_id, project_id, actor_id, message, new_status)
    select a.user_id, 'status', new.id, new.project_id, auth.uid(), new.title, new.status
    from public.task_assignees a
    where a.task_id = new.id and a.user_id is distinct from auth.uid();
  end if;
  if new.priority is distinct from old.priority then
    insert into public.activity_log (task_id, user_id, action, old_value, new_value)
    values (new.id, auth.uid(), 'priority', old.priority, new.priority);
  end if;
  if new.due_date is distinct from old.due_date then
    insert into public.activity_log (task_id, user_id, action, old_value, new_value)
    values (new.id, auth.uid(), 'due_date', old.due_date::text, new.due_date::text);
  end if;
  if new.title is distinct from old.title then
    insert into public.activity_log (task_id, user_id, action, old_value, new_value)
    values (new.id, auth.uid(), 'title', old.title, new.title);
  end if;
  return new;
end $$;

create trigger tasks_after_write after insert or update on public.tasks
  for each row execute function public.tasks_after_write();

-- ---------- الإسناد: السجل والإشعار ----------
create or replace function public.assignees_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
begin
  if tg_op = 'INSERT' then
    select * into t from public.tasks where id = new.task_id;
    insert into public.activity_log (task_id, user_id, action, new_value)
    values (new.task_id, auth.uid(), 'assigned', new.user_id::text);
    if new.user_id is distinct from auth.uid() then
      insert into public.notifications (user_id, type, task_id, project_id, actor_id, message)
      values (new.user_id, 'assigned', t.id, t.project_id, auth.uid(), t.title);
    end if;
    return new;
  else
    -- عند حذف المهمة كاملة لا داعي للتسجيل
    if exists (select 1 from public.tasks where id = old.task_id) then
      insert into public.activity_log (task_id, user_id, action, old_value)
      values (old.task_id, auth.uid(), 'unassigned', old.user_id::text);
    end if;
    return old;
  end if;
end $$;

create trigger assignees_after_write after insert or delete on public.task_assignees
  for each row execute function public.assignees_after_write();

-- ---------- التعليقات: إشعار المسندين والمُشار إليهم ----------
create or replace function public.comments_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
begin
  select * into t from public.tasks where id = new.task_id;

  -- المُشار إليهم (بشرط أن يكونوا مشاركين في المشروع)
  insert into public.notifications (user_id, type, task_id, project_id, actor_id, message)
  select distinct m, 'mention', t.id, t.project_id, new.user_id, t.title
  from unnest(new.mentions) as m
  where m <> new.user_id and public.is_project_participant(t.project_id, m);

  -- بقية المسندين
  insert into public.notifications (user_id, type, task_id, project_id, actor_id, message)
  select a.user_id, 'comment', t.id, t.project_id, new.user_id, t.title
  from public.task_assignees a
  where a.task_id = t.id and a.user_id <> new.user_id and not (a.user_id = any (new.mentions));

  return new;
end $$;

create trigger comments_after_insert after insert on public.comments
  for each row execute function public.comments_after_insert();

-- ---------- إزالة عضو من المشروع تزيله من مهامه المفتوحة ----------
create or replace function public.members_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.task_assignees a
  using public.tasks t
  where a.task_id = t.id and t.project_id = old.project_id
    and a.user_id = old.user_id and t.status <> 'done'
    and not exists (select 1 from public.projects p where p.id = old.project_id and p.manager_id = old.user_id);
  return old;
end $$;

create trigger members_after_delete after delete on public.project_members
  for each row execute function public.members_after_delete();

-- ---------- تسجيل آخر دخول ----------
create or replace function public.touch_last_login()
returns void language sql security definer set search_path = public as $$
  update public.users set last_login_at = now() where id = auth.uid()
$$;
