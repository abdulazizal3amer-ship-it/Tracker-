import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);

// PKCE يجعل روابط استعادة كلمة المرور تعود بـ ?code= فلا تتعارض مع توجيه الصفحات (#/)
export const supabase = isConfigured
  ? createClient(url, anonKey, { auth: { flowType: 'pkce', persistSession: true } })
  : null;

/** يعيد البيانات أو يرمي الخطأ */
export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

/** يجلب كل الصفوف على دفعات (حد Supabase الافتراضي 1000 صف للطلب) */
export async function fetchAll(build, pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const page = await q(build().range(from, from + pageSize - 1));
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
