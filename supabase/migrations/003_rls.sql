-- =============================================================
-- سياسات الأمان على مستوى الصفوف (Row Level Security)
-- الحماية الحقيقية هنا: حتى لو عُدّل كود الواجهة لا يرى أحد إلا ما يحق له.
-- =============================================================

alter table public.users            enable row level security;
alter table public.groups           enable row level security;
alter table public.group_members    enable row level security;
alter table public.projects         enable row level security;
alter table public.project_members  enable row level security;
alter table public.tasks            enable row level security;
alter table public.task_assignees   enable row level security;
alter table public.subtasks         enable row level security;
alter table public.comments         enable row level security;
alter table public.attachments      enable row level security;
alter table public.activity_log     enable row level security;
alter table public.notifications    enable row level security;

-- ---------- users ----------
-- فريق صغير: كل مستخدم نشط يرى أسماء زملائه (للإسناد والإشارة)
create policy users_select on public.users for select to authenticated
  using (public.is_active_user() or id = auth.uid());
create policy users_update on public.users for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
-- الإنشاء يتم عبر محفز auth.users فقط، والحذف ممنوع (تعطيل بدلاً منه)

-- ---------- groups ----------
create policy groups_select on public.groups for select to authenticated
  using (public.is_active_user());
create policy groups_write on public.groups for all to authenticated
  using (public.my_role() in ('admin', 'pm'))
  with check (public.my_role() in ('admin', 'pm'));

create policy group_members_select on public.group_members for select to authenticated
  using (public.is_active_user());
create policy group_members_write on public.group_members for all to authenticated
  using (public.my_role() in ('admin', 'pm'))
  with check (public.my_role() in ('admin', 'pm'));

-- ---------- projects ----------
-- manager_id يُقرأ من الصف نفسه لكي يرى المدير مشروعه فور إنشائه (insert ... returning)
create policy projects_select on public.projects for select to authenticated
  using (
    public.is_active_user()
    and (public.is_admin() or manager_id = auth.uid() or public.is_project_participant(id, auth.uid()))
  );
create policy projects_insert on public.projects for insert to authenticated
  with check (
    public.is_admin()
    or (public.my_role() = 'pm' and manager_id = auth.uid())
  );
create policy projects_update on public.projects for update to authenticated
  using (public.manages_project(id))
  with check (public.is_admin() or (public.my_role() = 'pm' and manager_id = auth.uid()));
create policy projects_delete on public.projects for delete to authenticated
  using (public.is_admin());

-- ---------- project_members ----------
create policy members_select on public.project_members for select to authenticated
  using (public.can_see_project(project_id));
create policy members_insert on public.project_members for insert to authenticated
  with check (public.manages_project(project_id));
create policy members_delete on public.project_members for delete to authenticated
  using (public.manages_project(project_id));

-- ---------- tasks ----------
create policy tasks_select on public.tasks for select to authenticated
  using (public.can_see_project(project_id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.can_see_project(project_id) and created_by = auth.uid());
create policy tasks_update on public.tasks for update to authenticated
  using (
    public.manages_project(project_id)
    or public.is_task_assignee(id)
    or created_by = auth.uid()
  )
  with check (public.can_see_project(project_id));
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.manages_project(project_id));

-- ---------- task_assignees ----------
-- مدير المشروع يُسند لأي مشارك؛ العضو يُسند نفسه فقط
create policy assignees_select on public.task_assignees for select to authenticated
  using (public.can_see_project(public.task_project(task_id)));
create policy assignees_insert on public.task_assignees for insert to authenticated
  with check (
    public.is_project_participant(public.task_project(task_id), user_id)
    and (
      public.manages_project(public.task_project(task_id))
      or (user_id = auth.uid() and public.can_see_project(public.task_project(task_id)))
    )
  );
create policy assignees_delete on public.task_assignees for delete to authenticated
  using (public.manages_project(public.task_project(task_id)));

-- ---------- subtasks ----------
create policy subtasks_select on public.subtasks for select to authenticated
  using (public.can_see_project(public.task_project(task_id)));
create policy subtasks_write on public.subtasks for all to authenticated
  using (public.manages_project(public.task_project(task_id)) or public.is_task_assignee(task_id))
  with check (public.manages_project(public.task_project(task_id)) or public.is_task_assignee(task_id));

-- ---------- comments ----------
create policy comments_select on public.comments for select to authenticated
  using (public.can_see_project(public.task_project(task_id)));
create policy comments_insert on public.comments for insert to authenticated
  with check (user_id = auth.uid() and public.can_see_project(public.task_project(task_id)));
create policy comments_delete on public.comments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------- attachments ----------
create policy attachments_select on public.attachments for select to authenticated
  using (public.can_see_project(public.task_project(task_id)));
create policy attachments_insert on public.attachments for insert to authenticated
  with check (uploaded_by = auth.uid() and public.can_see_project(public.task_project(task_id)));
create policy attachments_delete on public.attachments for delete to authenticated
  using (uploaded_by = auth.uid() or public.manages_project(public.task_project(task_id)));

-- ---------- activity_log (قراءة فقط؛ الكتابة عبر المحفزات) ----------
create policy activity_select on public.activity_log for select to authenticated
  using (public.can_see_project(public.task_project(task_id)));

-- ---------- notifications ----------
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- ---------- الإشعارات الفورية ----------
alter publication supabase_realtime add table public.notifications;
