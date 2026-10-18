import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { api } from './api.js';
import { useI18n } from './i18n.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { setLang } = useI18n();
  const [session, setSession] = useState(undefined); // undefined = لم يُحمَّل بعد
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [recovery, setRecovery] = useState(false);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // تنظيف ?code= من العنوان بعد رجوع رابط الاستعادة
  useEffect(() => {
    if (session && window.location.search.includes('code=')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    }
  }, [session]);

  const loadProfile = useCallback(async () => {
    if (!session) { setProfile(null); setUsers([]); return; }
    const me = await api.profile(session.user.id);
    if (!me.is_active) {
      setDisabled(true);
      await supabase.auth.signOut();
      return;
    }
    setDisabled(false);
    setProfile(me);
    setLang(me.language);
    setUsers(await api.users());
  }, [session, setLang]);

  useEffect(() => {
    // إن تعذّر تحميل الملف الشخصي (حساب محذوف مثلاً) نخرج بدل الانتظار للأبد
    loadProfile().catch(() => supabase.auth.signOut());
  }, [loadProfile]);

  useEffect(() => {
    if (session?.user?.id) supabase.rpc('touch_last_login').then(() => {});
  }, [session?.user?.id]);

  const value = useMemo(() => {
    const userById = Object.fromEntries(users.map((u) => [u.id, u]));
    return {
      session,
      profile,
      users,
      activeUsers: users.filter((u) => u.is_active),
      userById,
      recovery,
      disabled,
      clearRecovery: () => setRecovery(false),
      reload: loadProfile,
      signOut: () => supabase.auth.signOut(),
    };
  }, [session, profile, users, recovery, disabled, loadProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
