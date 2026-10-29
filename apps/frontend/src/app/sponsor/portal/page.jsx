'use client';

/**
 * Route: /sponsor/portal?token=<portal_token>   (PUBLIC — no staff auth needed)
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, X, ShieldCheck, ArrowLeft, Users, Bell, LogOut, KeyRound, Heart, HandHeart } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import Spinner from '@/components/ui/Spinner';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

const API_ENDPOINTS = {
  LOGIN:   `${BASE_URL}/sponsor/login`,
  ORPHANS: '/sponsor/orphans',
  FEED:    '/ads/sponsor/feed',
  REPORTS: (id) => `/sponsor/reports/${id}`,
};

const QURAN_STATUS = {
  approved: { label: 'معتمد',        color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200' },
  rejected: { label: 'مرفوض',        color: 'text-rose-700',    bg: 'bg-rose-100',    border: 'border-rose-200' },
  pending:  { label: 'قيد المراجعة', color: 'text-amber-700',   bg: 'bg-amber-100',   border: 'border-amber-200' },
};

const fmt = (iso) => iso ? new Date(iso).toLocaleDateString('ar-YE', { dateStyle: 'medium' }) : '—';

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

const portalApi = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

const mapAdToAnnouncement = (ad) => ({
  id: ad.id,
  title: ad.beneficiary_type === 'family' ? `طلب كفالة أسرة: ${ad.beneficiary_name}` : `طلب كفالة: ${ad.beneficiary_name}`,
  body: ad.beneficiary_type === 'family' ? `من سيكفل هذه الأسرة؟ المحافظة: ${ad.governorate_ar || '—'}` : `من سيكفل هذا الطفل؟ المحافظة: ${ad.governorate_ar || '—'}`,
  published_at: ad.published_at,
});

// ── 1. Premium Login View ────────────────────────────────────────────────────────
function LoginView({ token, onLogin }) {
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) { setError('يرجى إدخال كلمة المرور'); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(API_ENDPOINTS.LOGIN, { portalToken: token, password });
      onLogin(data.accessToken, data.sponsor);
    } catch (err) {
      setError(err.response?.data?.error || 'كلمة المرور غير صحيحة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row-reverse min-h-screen font-sans bg-slate-50" dir="rtl">
      {/* Brand Panel */}
      <aside className="relative md:w-[45%] lg:w-[50%] bg-gradient-to-br from-[#0B2F44] via-[#124b6e] to-[#0A4A3E] flex items-center justify-center overflow-hidden shrink-0 min-h-[300px] md:min-h-screen">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-[10%] -right-[10%] w-[500px] h-[500px] rounded-full bg-[#1da07f] blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-[10%] -left-[10%] w-[400px] h-[400px] rounded-full bg-[#3b82f6] blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }} />
        </div>
        <div className="relative z-10 w-[80%] max-w-[400px] flex flex-col items-center justify-center">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[2rem] shadow-2xl flex flex-col items-center w-full transform transition-transform duration-700 hover:scale-105">
            <div className="w-20 h-20 bg-gradient-to-br from-[#1cd29c] to-[#0d7d59] rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(28,210,156,0.3)] mb-6">
              <ShieldCheck size={40} className="text-white" strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl font-extrabold text-white mb-3 tracking-tight text-center">بوابة الكفلاء</h1>
            <p className="text-sm font-medium text-blue-100/80 text-center leading-relaxed">
              نافذتك المباشرة لمتابعة أيتامك، والاطلاع على تقاريرهم من أي مكان.
            </p>
            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent my-6" />
            <span className="text-white/90 text-xs font-semibold tracking-wider">مؤسسة نماء التنموية الخيرية</span>
          </div>
        </div>
      </aside>

      {/* Form Panel */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-12 relative z-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 text-center">
            <h2 className="text-[2rem] font-black text-slate-800 mb-2 tracking-tight">مرحباً بك مجدداً</h2>
            <p className="text-slate-500 font-medium">الرجاء إدخال كلمة المرور للوصول إلى محفظتك</p>
          </div>

          {!token ? (
            <div className="bg-rose-50/80 backdrop-blur-sm border border-rose-100 text-rose-700 p-5 rounded-2xl flex items-start gap-3 shadow-sm">
              <AlertTriangle size={22} className="shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm mb-1">رابط غير صالح</h4>
                <p className="text-xs font-medium opacity-90">يبدو أن رابط البوابة غير صحيح أو منتهي الصلاحية. يرجى استخدام الرابط المرسل إليك حصرياً.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {error && (
                <div className="flex items-center gap-3 bg-red-50/80 backdrop-blur-sm border border-red-100 text-red-600 rounded-2xl p-4 animate-in slide-in-from-top-2 fade-in">
                  <AlertTriangle size={18} className="shrink-0" />
                  <span className="text-sm font-semibold">{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700 ml-1">كلمة المرور</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                    <KeyRound size={20} strokeWidth={2} />
                  </div>
                  <input
                    type="password"
                    className="w-full bg-white border-2 border-slate-200 rounded-2xl py-3.5 pr-12 pl-4 text-slate-800 font-medium placeholder:text-slate-400 transition-all outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60 tracking-widest text-left"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    disabled={loading}
                    autoFocus
                    dir="ltr"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="group relative w-full flex items-center justify-center gap-2 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-base transition-all duration-200 overflow-hidden shadow-[0_8px_20px_rgba(15,23,42,0.15)] hover:shadow-[0_8px_25px_rgba(15,23,42,0.25)] hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                disabled={loading}
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                {loading ? (
                  <><Spinner size="md" />جاري التحقق...</>
                ) : (
                  <><span>دخول آمن</span> <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" /></>
                )}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

// ── 2. Premium Modal ──────────────────────────────────────────────────────────
function OrphanDetailModal({ orphanId, orphanName, token, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalApi.get(API_ENDPOINTS.REPORTS(orphanId), { headers: authHeader(token) })
      .then(({ data: d }) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [orphanId, token]);

  const quranReports  = data?.quran_reports  || [];
  const disbursements = data?.disbursements  || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" dir="rtl">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      {/* Modal Content */}
      <div className="relative bg-white rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-lg font-black text-slate-800 leading-none mb-1">سجل التقارير</h3>
            <p className="text-xs font-bold text-slate-500">اليتيم: {orphanName}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 sm:p-6 flex-1 space-y-8 bg-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
              <Spinner size="lg" variant="emerald" />
              <span className="text-sm font-bold">جاري إحضار السجلات...</span>
            </div>
          ) : !data ? (
            <div className="text-center py-12 text-slate-500 font-semibold bg-slate-50 rounded-2xl">تعذّر تحميل البيانات. يرجى المحاولة لاحقاً.</div>
          ) : (
            <>
              {/* Quran Reports */}
              <section>
                <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><Heart size={16} /></span>
                  تقارير حفظ القرآن
                </h4>
                {quranReports.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">لا توجد تقارير حالياً</p>
                ) : (
                  <div className="space-y-3">
                    {quranReports.map((r) => {
                      const cfg = QURAN_STATUS[r.status] || QURAN_STATUS.pending;
                      return (
                        <div key={r.id} className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-emerald-200 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-xs font-bold text-slate-400">{r.year}</span>
                              <span className="text-sm font-black text-slate-700 leading-none">{r.month}</span>
                            </div>
                            <div>
                              <span className="block text-sm font-bold text-slate-800 whitespace-pre-wrap break-words">{r.memorized_text ? `حفظ: ${r.memorized_text}` : `حفظ ${r.juz_memorized} أجزاء`}</span>
                              <span className="block text-xs font-semibold text-slate-400 mt-0.5">تقرير الحفظ الشهري</span>
                            </div>
                          </div>
                          <span className={`text-[0.65rem] font-bold px-2.5 py-1 rounded-lg border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                            {cfg.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Disbursements */}
              <section>
                <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                  <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><HandHeart size={16} /></span>
                  سجل الدفعات المالية
                </h4>
                {disbursements.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">لا يوجد سجل مدفوعات حالياً</p>
                ) : (
                  <div className="space-y-3">
                    {disbursements.map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-blue-200 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-xs font-bold text-slate-400">{d.year}</span>
                              <span className="text-sm font-black text-slate-700 leading-none">{d.month}</span>
                            </div>
                            <div>
                              <span className="block text-sm font-black text-slate-800">{parseFloat(d.amount).toLocaleString('ar-YE')} ر.ي</span>
                              <span className="block text-[0.65rem] font-bold text-slate-400 mt-1">دفعة شهرية</span>
                            </div>
                        </div>
                        <span className={`text-[0.65rem] font-bold px-2.5 py-1 rounded-lg border ${d.included ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                          {d.included ? (d.receipt_confirmed_at ? 'تم الاستلام' : 'قيد التوزيع') : 'مستبعد'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 3. Premium Dashboard View ─────────────────────────────────────────────────
function DashboardView({ token, sponsor, onLogout }) {
  const [orphans,       setOrphans]       = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [detailOrphan,  setDetailOrphan]  = useState(null);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    Promise.all([
      portalApi.get(API_ENDPOINTS.ORPHANS, authHeaders),
      portalApi.get(API_ENDPOINTS.FEED, authHeaders).catch(() => ({ data: { ads: [] } })),
    ])
      .then(([orphanRes, annRes]) => {
        setOrphans(orphanRes.data.orphans || []);
        setAnnouncements((annRes.data.ads || []).map(mapAdToAnnouncement));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalMonthly = orphans.reduce((s, o) => s + Number(o.monthly_amount || 0), 0);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans" dir="rtl">
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="text-white" size={22} strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-800 leading-none tracking-tight">بوابة الكفلاء</h1>
              <span className="text-[0.65rem] font-bold text-slate-400">نظام الإدارة الآمن</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-slate-700 hidden sm:block">{sponsor.name}</span>
            <button onClick={onLogout} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 md:py-12 flex flex-col gap-10">
        
        {/* Welcome & Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-900 via-[#0B2F44] to-[#0A4A3E] shadow-xl p-8 md:p-10 flex flex-col justify-center">
             <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/20 blur-[80px] rounded-full mix-blend-overlay -translate-y-1/2 translate-x-1/3" />
             <div className="relative z-10">
               <h2 className="text-2xl md:text-3xl font-black text-white mb-3">أهلاً بك في حسابك الموحد</h2>
               <p className="text-slate-300 text-sm font-medium leading-relaxed max-w-md">مساحتك الخاصة لمتابعة التقارير الشهرية وتفاصيل الكفالات لأيتامك في مكان واحد، بكل شفافية ووضوح.</p>
             </div>
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm flex items-center gap-4 hover:border-emerald-200 transition-colors">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                <Users size={24} />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-800">{orphans.length}</div>
                <div className="text-xs font-bold text-slate-500">يتيم مكفول</div>
              </div>
            </div>
            
            <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm flex items-center gap-4 hover:border-blue-200 transition-colors">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                <span className="text-xl font-black">ر.ي</span>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-800">{totalMonthly.toLocaleString('ar-YE')}</div>
                <div className="text-xs font-bold text-slate-500">إجمالي شهري</div>
              </div>
            </div>
          </div>
        </div>

        {/* Orphans Grid */}
        <section>
          <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
            <Users className="text-emerald-600" size={22} /> محفظة الأيتام
          </h3>
          
          {loading ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
               {[1,2,3].map(i => <div key={i} className="h-48 bg-slate-200 animate-pulse rounded-3xl" />)}
             </div>
          ) : orphans.length === 0 ? (
             <div className="bg-white rounded-[2rem] p-12 text-center border border-slate-200/60 shadow-sm">
               <span className="text-5xl opacity-30 mb-4 block">👨‍👩‍👧‍👦</span>
               <p className="font-bold text-slate-500">لا يوجد أيتام مكفولون في هذه المحفظة</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {orphans.map((o) => (
                <div key={o.id} className="group bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm hover:shadow-[0_15px_30px_-10px_rgba(0,0,0,0.05)] hover:border-emerald-200 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-12 h-12 bg-slate-100 border-2 border-white rounded-full shadow-sm flex items-center justify-center text-lg font-black text-slate-600 shrink-0">
                      {o.full_name?.charAt(0) || '؟'}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800 mb-0.5 line-clamp-1">{o.full_name}</h4>
                      <p className="text-xs font-semibold text-slate-400">{o.gender === 'female' ? 'أنثى' : 'ذكر'} • {o.governorate_ar}</p>
                    </div>
                    {o.is_gifted && <span className="mr-auto text-amber-500"><Heart size={16} fill="currentColor" /></span>}
                  </div>
                  
                  <div className="bg-slate-50 rounded-2xl p-4 mb-5 text-center border border-slate-100">
                    <span className="block text-xl font-black text-emerald-700">{Number(o.monthly_amount || 0).toLocaleString('ar-YE')}</span>
                    <span className="text-[0.65rem] font-bold text-slate-500">ريال يمني / شهرياً</span>
                  </div>

                  <button
                    onClick={() => setDetailOrphan({ id: o.id, name: o.full_name })}
                    className="mt-auto w-full py-3 bg-white border-2 border-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2 group/btn"
                  >
                    السجلات والتقارير <ArrowLeft size={14} className="group-hover/btn:-translate-x-1 transition-transform" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Announcements */}
        {announcements.length > 0 && (
          <section>
            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
              <Bell className="text-amber-500" size={22} fill="currentColor" fillOpacity={0.2} /> تعميمات هامة
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {announcements.map((a) => (
                <div key={a.id} className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-1.5 h-full bg-amber-400" />
                  <div className="pr-4">
                    <span className="text-[0.65rem] font-bold text-slate-400 block mb-1">{fmt(a.published_at)}</span>
                    <h4 className="text-sm font-black text-slate-800 mb-2">{a.title}</h4>
                    <p className="text-xs font-semibold text-slate-500 leading-relaxed">{a.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Modal */}
      {detailOrphan && (
        <OrphanDetailModal
          orphanId={detailOrphan.id}
          orphanName={detailOrphan.name}
          token={token}
          onClose={() => setDetailOrphan(null)}
        />
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function SponsorPortalPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [accessToken, setAccessToken] = useState('');
  const [sponsor,     setSponsor]     = useState(null);

  const handleLogin = (jwt, sponsorData) => {
    setAccessToken(jwt);
    setSponsor(sponsorData);
  };

  const handleLogout = () => {
    setAccessToken('');
    setSponsor(null);
  };

  if (!accessToken || !sponsor) {
    return <LoginView token={token} onLogin={handleLogin} />;
  }

  return <DashboardView token={accessToken} sponsor={sponsor} onLogout={handleLogout} />;
}
