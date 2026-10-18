// دالة إنشاء الحسابات — تعمل على Supabase Edge Functions (لا خادم تديره الجهة)
// مفتاح الخدمة (service_role) يبقى هنا فقط ولا يصل إلى المتصفح أبداً.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1) التحقق من أن المستدعي مدير نظام نشط
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);

    const { data: me } = await caller
      .from('users').select('role, is_active').eq('id', user.id).single();
    if (!me || me.role !== 'admin' || !me.is_active) return json({ error: 'forbidden' }, 403);

    // 2) التحقق من المدخلات
    const { full_name, email, role, password } = await req.json();
    if (!full_name?.trim() || !email?.includes('@')) return json({ error: 'invalid_input' }, 400);
    if (!['admin', 'pm', 'member'].includes(role)) return json({ error: 'invalid_role' }, 400);
    if (typeof password !== 'string' || password.length < 8) return json({ error: 'weak_password' }, 400);

    // 3) إنشاء الحساب؛ محفز قاعدة البيانات ينشئ صفه في جدول users
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() },
      app_metadata: { role, must_change_password: true },
    });
    if (error) return json({ error: error.message }, 400);

    return json({ id: data.user.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
