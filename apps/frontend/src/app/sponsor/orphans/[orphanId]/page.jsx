'use client';

/**
 * Route: /sponsor/orphans/[orphanId]
 * API:   GET /api/sponsor/reports/:orphanId
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck, ArrowLeft, Heart, HandHeart, CheckCircle2, XCircle, LayoutDashboard } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import sponsorApi from '@/lib/sponsorApi';
import useSponsorStore from '@/store/useSponsorStore';

const API_REPORTS = (id) => `/sponsor/reports/${id}`;

const ARABIC_MONTHS = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const REPORT_STATUS = {
  pending:  { label: 'قيد المراجعة', color: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-200', Icon: null },
  approved: { label: 'مقبول',        color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200', Icon: CheckCircle2 },
  rejected: { label: 'مرفوض',        color: 'text-rose-700',    bg: 'bg-rose-100',    border: 'border-rose-200', Icon: XCircle },
};

const DISB_STATUS = {
  draft:               { label: 'مسودة',        color: 'text-slate-500' },
  supervisor_approved: { label: 'مراجعة',       color: 'text-blue-600' },
  finance_approved:    { label: 'جاهز للصرف',   color: 'text-indigo-600' },
  released:            { label: 'مُصدَر',        color: 'text-emerald-600' },
  rejected:            { label: 'مرفوض',        color: 'text-rose-600' },
};

export default function SponsorOrphanDetail() {
  const { orphanId } = useParams();
  const router = useRouter();
  const { isAuthenticated, sponsor } = useSponsorStore();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('quran'); // 'quran' | 'disbursements'

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/sponsor/login'); return; }
    sponsorApi.get(API_REPORTS(orphanId))
      .then(({ data: res }) => setData(res))
      .catch(() => setError('تعذّر تحميل البيانات. يرجى المحاولة لاحقاً.'))
      .finally(() => setLoading(false));
  }, [orphanId]);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans" dir="rtl">
      
      {/* ── Premium Header ── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/sponsor/dashboard" className="group flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-emerald-600 transition-colors bg-slate-100 hover:bg-emerald-50 px-3 py-2 rounded-xl">
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
            <span>العودة للوحة القيادة</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-500">حساب الكافل</span>
              <span className="text-sm font-bold text-slate-800">{sponsor?.name || ''}</span>
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-xl flex items-center justify-center shadow-md">
              <ShieldCheck className="text-white" size={22} strokeWidth={2} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 md:py-12 px-6 flex flex-col gap-8">
        
        {error && (
          <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 text-rose-700 p-4 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2">
            <AlertTriangle size={20} /> <span className="font-semibold text-sm">{error}</span>
          </div>
        )}

        {loading ? (
          <PremiumLoadingSkeleton />
        ) : !data ? null : (
          <>
            {/* ── Beautiful Context Banner ── */}
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-900 via-[#0B2F44] to-[#0A4A3E] shadow-xl p-8 md:p-10 text-white flex flex-col md:flex-row items-center gap-6 justify-between">
               <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/20 blur-[60px] rounded-full mix-blend-overlay -translate-y-1/2 -translate-x-1/2" />
               <div className="relative z-10 flex items-center gap-5">
                 <div className="w-16 h-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center shrink-0">
                   <LayoutDashboard size={28} className="text-emerald-300" />
                 </div>
                 <div>
                   <h1 className="text-2xl md:text-3xl font-black mb-1">السجل الشامل لليتيم</h1>
                   <p className="text-slate-300 text-sm font-medium">التقارير وسجل الدفعات متوفرة بشفافية تامة لضمان الأثر.</p>
                 </div>
               </div>
               <div className="relative z-10 flex gap-4 shrink-0 bg-white/5 backdrop-blur-md p-2 rounded-2xl border border-white/10">
                 <div className="flex flex-col items-center px-4 py-2">
                   <span className="text-2xl font-black text-white">{data.quran_reports?.length || 0}</span>
                   <span className="text-[0.65rem] font-bold text-emerald-300 uppercase tracking-wider mt-1">تقارير حفظ</span>
                 </div>
                 <div className="w-px bg-white/20 my-2" />
                 <div className="flex flex-col items-center px-4 py-2">
                   <span className="text-2xl font-black text-white">{data.disbursements?.length || 0}</span>
                   <span className="text-[0.65rem] font-bold text-blue-300 uppercase tracking-wider mt-1">دورة صرف</span>
                 </div>
               </div>
            </div>

            {/* ── Premium Modern Tabs ── */}
            <div className="flex p-1.5 bg-white border border-slate-200/60 rounded-2xl shadow-sm max-w-fit self-center">
              {[
                { key: 'quran', label: 'تقارير القرآن', icon: Heart, count: data.quran_reports?.length || 0 },
                { key: 'disbursements', label: 'سجل الصرف', icon: HandHeart, count: data.disbursements?.length || 0 },
              ].map(({ key, label, icon: Icon, count }) => {
                const isActive = tab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`relative flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 outline-none ${isActive ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                  >
                    {isActive && <div className="absolute inset-0 bg-emerald-50 rounded-xl -z-10 animate-in fade-in zoom-in-95 duration-200" />}
                    <Icon size={16} className={isActive ? 'text-emerald-500' : 'text-slate-400'} />
                    {label}
                    <span className={`text-[0.65rem] font-black px-2 py-0.5 rounded-full ml-1 ${isActive ? 'bg-emerald-200/50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ── Content Area ── */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {tab === 'quran'         && <QuranReportsTab reports={data.quran_reports || []} />}
              {tab === 'disbursements' && <DisbursementsTab disbursements={data.disbursements || []} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ── Quran Tab ──
function QuranReportsTab({ reports }) {
  if (!reports.length) {
    return (
      <div className="bg-white border border-slate-200/60 rounded-[2rem] p-16 text-center shadow-sm">
        <span className="text-5xl opacity-30 mb-4 block">📖</span>
        <h4 className="text-lg font-black text-slate-800 mb-2">لا توجد تقارير حفظ</h4>
        <p className="text-sm font-medium text-slate-500">لم يتم اعتماد أي تقارير شهرية لهذا اليتيم بعد.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
      {reports.map((r) => {
        const cfg = REPORT_STATUS[r.status] || REPORT_STATUS.pending;
        const Icon = cfg.Icon;
        return (
          <div key={r.id} className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 left-0 h-1 bg-emerald-100 group-hover:bg-emerald-400 transition-colors" />
            
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
                  <span className="text-[0.65rem] font-bold text-slate-400 leading-none">{r.year}</span>
                  <span className="text-sm font-black text-slate-700 leading-none mt-1">{ARABIC_MONTHS[r.month]}</span>
                </div>
              </div>
              <span className={`flex items-center gap-1 text-[0.65rem] font-bold px-2.5 py-1 rounded-lg border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                {Icon && <Icon size={12} />} {cfg.label}
              </span>
            </div>

            <div className="mb-4">
              {r.memorized_text ? (
                <span className="block text-base font-bold text-slate-800 mb-1 leading-relaxed whitespace-pre-wrap break-words">{r.memorized_text}</span>
              ) : (
                <span className="block text-3xl font-black text-slate-800 mb-1">{r.juz_memorized} <span className="text-sm text-slate-400 font-bold">أجزاء</span></span>
              )}
              <span className="text-xs font-semibold text-slate-500">ما تم حفظه — بعد مراجعة المشرف</span>
            </div>

            {r.supervisor_notes && r.status === 'rejected' && (
              <div className="mt-4 p-3 bg-rose-50 rounded-xl border border-rose-100 text-[0.75rem] font-semibold text-rose-700 leading-relaxed">
                {r.supervisor_notes}
              </div>
            )}
            
            <div className="mt-6 pt-4 border-t border-slate-100 text-[0.65rem] font-bold text-slate-400 flex justify-between">
              <span>تاريخ التقديم</span>
              <span>{new Date(r.submitted_at).toLocaleDateString('ar-YE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Disbursements Tab ──
function DisbursementsTab({ disbursements }) {
  if (!disbursements.length) {
    return (
      <div className="bg-white border border-slate-200/60 rounded-[2rem] p-16 text-center shadow-sm">
        <span className="text-5xl opacity-30 mb-4 block">💳</span>
        <h4 className="text-lg font-black text-slate-800 mb-2">سجل الدفعات فارغ</h4>
        <p className="text-sm font-medium text-slate-500">لم تصدر أي مدفوعات مالية خاصة بهذا اليتيم حتى الآن.</p>
      </div>
    );
  }

  const totalReleased = disbursements
    .filter((d) => d.list_status === 'released' && d.included)
    .reduce((s, d) => s + parseFloat(d.amount), 0);

  return (
    <div className="flex flex-col gap-6">
      
      {/* Summary Card */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-emerald-800 mb-1">الخلاصة المالية</h4>
          <p className="text-xs font-medium text-emerald-600">إجمالي المبالغ المُصدَرة والمسلّمة فعلياً لليتيم</p>
        </div>
        <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-emerald-50">
          <span className="text-2xl font-black text-emerald-700">{totalReleased.toLocaleString('ar-YE')} <span className="text-sm">ر.ي</span></span>
        </div>
      </div>

      {/* Modern List */}
      <div className="bg-white border border-slate-200/60 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="flex flex-col divide-y divide-slate-100">
          {disbursements.map((d, i) => {
            const cfg = DISB_STATUS[d.list_status] || DISB_STATUS.draft;
            return (
              <div key={i} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                
                <div className="flex items-center gap-4 min-w-[200px]">
                  <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center shrink-0">
                    <span className="text-[0.65rem] font-bold text-slate-400 leading-none">{d.year}</span>
                    <span className="text-sm font-black text-slate-700 leading-none mt-1">{ARABIC_MONTHS[d.month]}</span>
                  </div>
                  <div>
                    <span className="block text-sm font-black text-slate-800 mb-0.5">{parseFloat(d.amount).toLocaleString('ar-YE')} ر.ي</span>
                    <span className={`text-[0.7rem] font-bold ${cfg.color}`}>مرحلة: {cfg.label}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-auto ml-16 sm:ml-0">
                  {d.included ? (
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="flex items-center gap-1 text-[0.65rem] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 size={12} /> كفالة مدرجة
                      </span>
                      {d.receipt_confirmed_at ? (
                        <span className="text-[0.65rem] font-bold text-slate-500">
                          مُستلَم يوم {new Date(d.receipt_confirmed_at).toLocaleDateString('ar-YE', { day: 'numeric', month: 'short' })}
                        </span>
                      ) : (
                        <span className="text-[0.65rem] font-bold text-amber-500">🕐 قيد التسليم للصراف</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-1.5" title={d.exclusion_reason}>
                      <span className="flex items-center gap-1 text-[0.65rem] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg">
                        <XCircle size={12} /> مستبعد
                      </span>
                      <span className="text-[0.65rem] font-bold text-slate-400">راجع الإدارة للتفاصيل</span>
                    </div>
                  )}
                </div>
                
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Premium Skeleton ──
function PremiumLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-32 bg-slate-200 rounded-[2rem] animate-pulse" />
      <div className="h-14 w-64 bg-slate-200 rounded-2xl self-center animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-slate-200 rounded-3xl animate-pulse" />)}
      </div>
    </div>
  );
}
