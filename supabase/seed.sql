-- =============================================================
-- تفعيل حساب مدير النظام الأول (مرة واحدة فقط)
--
-- 1) أنشئ الحساب من: Supabase > Authentication > Users > Add user > Create new user
--    (ضع بريدك وكلمة مرور، وفعّل "Auto Confirm User")
-- 2) غيّر البريد في السطر التالي إلى بريدك، ثم شغّل هذا الملف في SQL Editor
-- =============================================================

update public.users
set role = 'admin',
    is_active = true,
    must_change_password = false,
    full_name = 'مدير النظام'          -- غيّره إلى اسمك
where email = 'admin@example.com';    -- غيّره إلى بريدك

-- تحقق: يجب أن يظهر صف واحد بدور admin
select full_name, email, role, is_active from public.users where role = 'admin';
