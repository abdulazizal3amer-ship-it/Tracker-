-- =============================================================
-- نظام إدارة المشاريع والمهام — الجداول
-- يُشغَّل مرة واحدة من: Supabase Dashboard > SQL Editor
-- =============================================================

-- ---------- المستخدمون ----------
-- كلمات المرور لا تُخزَّن هنا؛ تتولاها Supabase Auth (auth.users) مشفرة.
create table public.users (
  id                    uuid primary key references auth.users(id) on delete cascade,
  full_name             text not null check (length(trim(full_name)) > 0),
  email                 text not null unique,
  role                  text not null default 'member' check (role in ('admin', 'pm', 'member')),
  language              text not null default 'ar' check (language in ('ar', 'en')),
  avatar_url            text,
  is_active             boolean not null default true,
  must_change_password  boolean not null default false,
  last_login_at         timestamptz,
  created_at            timestamptz not null default now()
);

-- ---------- المجموعات المحفوظة (للإصدار 1.1) ----------
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid references public.users(id) default auth.uid(),
  created_at  timestamptz not null default now()
);

create table public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.users(id) on delete cascade,
  primary key (group_id, user_id)
);

-- ---------- المشاريع ----------
create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) > 0),
  description  text,
  start_date   date,
  end_date     date not null,
  status       text not null default 'active'
               check (status in ('active', 'on_hold', 'completed', 'archived')),
  manager_id   uuid not null references public.users(id),
  created_at   timestamptz not null default now(),
  check (start_date is null or end_date >= start_date)
);

create table public.project_members (
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  primary key (project_id, user_id)
);

-- ---------- المهام ----------
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  title         text not null check (length(trim(title)) > 0),
  description   text,
  status        text not null default 'new'
                check (status in ('new', 'in_progress', 'review', 'done')),
  priority      text not null default 'medium'
                check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date      date,
  created_by    uuid references public.users(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz,
  completed_by  uuid references public.users(id)
);

-- الإسناد لعضو أو أكثر
create table public.task_assignees (
  task_id      uuid not null references public.tasks(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  assigned_by  uuid references public.users(id) default auth.uid(),
  assigned_at  timestamptz not null default now(),
  primary key (task_id, user_id)
);

create table public.subtasks (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  title        text not null,
  assignee_id  uuid references public.users(id),
  is_done      boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  user_id     uuid not null references public.users(id) default auth.uid(),
  body        text not null check (length(trim(body)) > 0),
  mentions    uuid[] not null default '{}',
  created_at  timestamptz not null default now()
);

create table public.attachments (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks(id) on delete cascade,
  file_name     text not null,
  storage_path  text not null,
  size          bigint not null check (size <= 5 * 1024 * 1024),
  uploaded_by   uuid references public.users(id) default auth.uid(),
  created_at    timestamptz not null default now()
);

create table public.activity_log (
  id          bigint generated always as identity primary key,
  task_id     uuid not null references public.tasks(id) on delete cascade,
  user_id     uuid references public.users(id),
  action      text not null,
  old_value   text,
  new_value   text,
  created_at  timestamptz not null default now()
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  type        text not null check (type in ('assigned', 'status', 'comment', 'mention')),
  task_id     uuid references public.tasks(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete cascade,
  actor_id    uuid references public.users(id),
  message     text,                 -- عنوان المهمة وقت الإشعار
  new_status  text,                 -- للحالة الجديدة في إشعارات تغيير الحالة
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------- الفهارس ----------
create index on public.tasks (project_id);
create index on public.tasks (due_date) where status <> 'done';
create index on public.task_assignees (user_id);
create index on public.project_members (user_id);
create index on public.comments (task_id, created_at);
create index on public.activity_log (task_id, created_at);
create index on public.notifications (user_id, created_at desc);
