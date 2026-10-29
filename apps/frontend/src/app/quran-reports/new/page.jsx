'use client';

/**
 * page.jsx
 * Route:  /quran-reports/new  (Agent only)
 * Task:   feature/ui-quran-report-submission
 *
 * Agent selects an orphan from the list, which opens a pop-up modal
 * to submit the monthly Quran memorization report.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  ClipboardList,
  Send,
  Search,
  X,
  BookOpen,
  ArrowRight,
  Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';

// ── Constants ──────────────────────────────────────────────────────────────────

const API = {
  ORPHANS: '/orphans?status=under_sponsorship',
  QURAN_REPORTS: '/quran-reports',
};

const MONTHS_AR = [
  '', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const calcAge = (dob) => {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
};

// ── Main page ──────────────────────────────────────────────────────────────────

export default function QuranReportSubmissionPage() {
  const router = useRouter();

  const [orphans, setOrphans] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [selectedOrphan, setSelectedOrphan] = useState(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState(null);

  // Form Fields inside modal
  const now = new Date();
  const defaultMonth = now.getMonth() + 1;
  const defaultYear = now.getFullYear();

  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [memorizedText, setMemorizedText] = useState('');
  const [agentNotes, setAgentNotes] = useState('');

  const yearOptions = [defaultYear - 1, defaultYear, defaultYear + 1];

  const orphanAge = selectedOrphan ? calcAge(selectedOrphan.date_of_birth) : null;

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setDataLoading(true);
      const orphanRes = await api.get(API.ORPHANS);
      setOrphans(orphanRes.data.orphans || []);
    } catch (err) {
      console.error('Failed to load orphans:', err);
      setOrphans([]);
    } finally {
      setDataLoading(false);
    }
  };

  // Filter orphans by search query
  const filteredOrphans = useMemo(() => {
    if (!searchQuery.trim()) return orphans;
    const q = searchQuery.toLowerCase().trim();
    return orphans.filter(
      (o) =>
        o.full_name?.toLowerCase().includes(q) ||
        o.orphan_code?.toLowerCase().includes(q) ||
        o.governorate_ar?.toLowerCase().includes(q)
    );
  }, [orphans, searchQuery]);

  // Open modal when orphan is clicked
  const handleSelectOrphan = (orphan) => {
    setSelectedOrphan(orphan);
    setMonth(defaultMonth);
    setYear(defaultYear);
    setMemorizedText('');
    setAgentNotes('');
    setApiError('');
    setReportModalOpen(true);
  };

  // Close report modal
  const handleCloseReportModal = () => {
    if (submitting) return;
    setReportModalOpen(false);
    setSelectedOrphan(null);
    setApiError('');
  };

  // Submit report via API
  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!selectedOrphan) return;

    if (!memorizedText.trim()) {
      setApiError('يرجى كتابة ما حفظه اليتيم هذا الشهر');
      return;
    }

    setSubmitting(true);
    setApiError('');

    try {
      await api.post(API.QURAN_REPORTS, {
        orphanId: selectedOrphan.id,
        month: parseInt(month, 10),
        year: parseInt(year, 10),
        memorizedText: memorizedText.trim(),
        agentNotes: agentNotes.trim(),
      });

      setSubmittedSuccess({
        orphanName: selectedOrphan.full_name,
        month: parseInt(month, 10),
        year: parseInt(year, 10),
        memorizedText: memorizedText.trim(),
      });

      setReportModalOpen(false);
    } catch (err) {
      setApiError(
        err.response?.data?.errors?.[0]?.msg ||
        err.response?.data?.error ||
        'حدث خطأ أثناء رفع التقرير. يرجى المحاولة مجدداً'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      {/* ── Pop-up Success Confirmation Modal ────────────────────────────── */}
      {submittedSuccess && (
        <div
          className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          dir="rtl"
        >
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-slate-100 flex flex-col items-center gap-4 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#1B5E8C] flex items-center justify-center">
              <ClipboardList size={40} className="text-[#1B5E8C]" />
            </div>

            <h2 className="text-xl font-black text-slate-900 m-0">تم رفع التقرير بنجاح</h2>

            <p className="text-sm text-slate-600 leading-relaxed m-0">
              تم رفع تقرير حفظ القرآن لـ <strong className="text-slate-900">{submittedSuccess.orphanName}</strong>
              {' '}عن شهر{' '}
              <strong className="text-[#1B5E8C]">{MONTHS_AR[submittedSuccess.month]} {submittedSuccess.year}</strong>
              .
            </p>

            <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 w-full text-right whitespace-pre-wrap break-words m-0">
              {submittedSuccess.memorizedText}
            </p>

            <p className="text-xs text-slate-500 m-0 flex items-center justify-center gap-1.5">
              <Send size={14} className="text-[#1B5E8C]" />
              <span>التقرير الآن في قائمة انتظار المشرف للمراجعة والاعتماد.</span>
            </p>

            <div className="flex gap-3 justify-center flex-wrap mt-2 w-full">
              <Button
                variant="primary"
                onClick={() => {
                  setSubmittedSuccess(null);
                  setSelectedOrphan(null);
                }}
                className="flex-1 !py-2.5 !rounded-xl !bg-gradient-to-br from-[#1B5E8C] to-[#134569] hover:from-[#2E7EB8] hover:to-[#1B5E8C] text-white shadow-[0_2px_8px_rgba(27,94,140,0.25)] font-bold text-xs"
              >
                رفع تقرير ليتيم آخر
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/quran-reports')}
                className="flex-1 !py-2.5 !rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                قائمة التقارير
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── The Report Submission Pop-up Modal (The thing in Picture 2) ── */}
      {reportModalOpen && selectedOrphan && (
        <div
          className="fixed inset-0 z-[900] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"
          dir="rtl"
        >
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden my-6 relative animate-in zoom-in-95 duration-150">

            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-gray-100 bg-white">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1B5E8C] flex items-center justify-center font-bold">
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">رفع تقرير حفظ القرآن</h2>
                    <p className="text-xs text-slate-500">أدخل مقدار الحفظ وسيقوم المشرف باعتماده</p>
                  </div>
                </div>

                <button
                  onClick={handleCloseReportModal}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                  title="إغلاق"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Selected Orphan Highlight Card */}
              <div className="flex items-center gap-3.5 p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1B5E8C] to-[#134569] text-white flex items-center justify-center text-lg font-black shrink-0 shadow-md shadow-[#1B5E8C]/20">
                  {selectedOrphan.full_name?.charAt(0) || '؟'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                      {selectedOrphan.full_name}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1B5E8C]/10 text-[#1B5E8C]">
                      يتيم مكفول
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    {orphanAge != null && <span>{orphanAge} سنة</span>}
                    {selectedOrphan.governorate_ar && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>{selectedOrphan.governorate_ar}</span>
                      </>
                    )}
                    {selectedOrphan.orphan_code && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="font-mono text-slate-600 font-bold">{selectedOrphan.orphan_code}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitReport} className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">

              {/* ── Section 2: الفترة الزمنية ── */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-3 pb-2 border-b border-slate-200/60">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1B5E8C] to-[#134569] text-white flex items-center justify-center text-sm font-bold shrink-0">
                    ٢
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">الفترة الزمنية</h4>
                    <p className="text-[11px] text-slate-500">الشهر والسنة الذي يغطيهما التقرير</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      الشهر <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={month}
                      onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#1B5E8C] focus:ring-2 focus:ring-[#1B5E8C]/20 transition cursor-pointer"
                    >
                      {MONTHS_AR.slice(1).map((name, i) => (
                        <option key={i + 1} value={i + 1}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      السنة <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={year}
                      onChange={(e) => setYear(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#1B5E8C] focus:ring-2 focus:ring-[#1B5E8C]/20 transition cursor-pointer"
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-center">
                    <span className="text-[10px] font-bold text-slate-400 block">الفترة المعتمدة</span>
                    <span className="text-xs font-black text-[#1B5E8C]">
                      {MONTHS_AR[month]} {year}
                    </span>
                  </div>
                </div>
              </div>

                            {/* ── Section 3: ما تم حفظه ── */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-slate-200/60">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1B5E8C] to-[#134569] text-white flex items-center justify-center text-sm font-bold shrink-0">
                    ٣
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">ما حفظه اليتيم</h4>
                    <p className="text-[11px] text-slate-500">اكتب ما حفظه اليتيم هذا الشهر — سيقرأ المشرف التقرير ويقرر اعتماده</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="modalMemorizedText">
                    ما تم حفظه هذا الشهر <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="modalMemorizedText"
                    name="memorizedText"
                    rows={4}
                    maxLength={2000}
                    value={memorizedText}
                    onChange={(e) => {
                      setMemorizedText(e.target.value);
                      setApiError('');
                    }}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 font-sans focus:outline-none focus:border-[#1B5E8C] focus:ring-2 focus:ring-[#1B5E8C]/20 transition resize-y"
                    placeholder="مثال: سورة النبأ كاملة، وجزء عمّ من سورة النازعات إلى سورة الانفطار"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="modalAgentNotes">
                    ملاحظات المندوب <span className="text-slate-400 font-medium">(اختياري)</span>
                  </label>
                  <textarea
                    id="modalAgentNotes"
                    name="agentNotes"
                    rows={2}
                    maxLength={1000}
                    value={agentNotes}
                    onChange={(e) => setAgentNotes(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 font-sans focus:outline-none focus:border-[#1B5E8C] focus:ring-2 focus:ring-[#1B5E8C]/20 transition resize-y"
                    placeholder="أي ملاحظة تساعد المشرف على المراجعة"
                  />
                </div>
              </div>

              {/* Error feedback */}
              {apiError && (
                <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 animate-in fade-in">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                  <span>{apiError}</span>
                </div>
              )}

              {/* Footer Buttons inside modal */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseReportModal}
                  disabled={submitting}
                  className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 py-2.5 px-6 rounded-xl bg-gradient-to-br from-[#1B5E8C] to-[#134569] hover:from-[#2E7EB8] hover:to-[#1B5E8C] text-white text-xs font-bold shadow-[0_2px_8px_rgba(27,94,140,0.25)] transition disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0" />
                      <span>جارٍ الإرسال…</span>
                    </>
                  ) : (
                    <>
                      <span>إرسال التقرير</span>
                      <ArrowRight size={14} className="rotate-180" />
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── Main Page Layout ────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto pb-16 font-sans space-y-6" dir="rtl">

        {/* Page Header */}
        <PageHeader
          title="رفع تقرير حفظ القرآن"
          subtitle="أدخل مقدار ما حفظه اليتيم هذا الشهر. سيراجع المشرف التقرير ويقرر الاستحقاق المالي."
          className="flex-col sm:flex-row sm:items-start"
          action={
            <Button variant="outline" type="button" onClick={() => router.back()}>
              ← رجوع
            </Button>
          }
        />

        {/* Info Banner */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-[#1B5E8C] leading-relaxed shadow-xs">
          <span className="shrink-0 text-[#1B5E8C] font-bold text-sm">ℹ</span>
          <p className="m-0 font-medium">
            التقرير يُرفع مرة واحدة لكل يتيم كل شهر. انقر على أي يتيم من القائمة أدناه لفتح نافذة إدخال وتوثيق الحفظ مباشرة.
          </p>
        </div>

        {/* Loading state */}
        {dataLoading ? (
          <div className="flex flex-col items-center gap-4 bg-white border border-slate-200 rounded-3xl p-16 text-center text-sm text-slate-500 shadow-xs">
            <div className="w-9 h-9 border-4 border-slate-200 border-t-[#1B5E8C] rounded-full animate-spin" />
            <p className="m-0 font-medium">جارٍ تحميل قائمة الأيتام المكفولين…</p>
          </div>
        ) : orphans.length === 0 ? (
          <div className="flex flex-col items-center gap-3 bg-white border border-slate-200 rounded-3xl p-14 text-center shadow-xs">
            <ClipboardList size={48} className="text-[#1B5E8C]" />
            <h3 className="text-base font-bold text-slate-800 m-0">لا يوجد أيتام مكفولون حالياً</h3>
            <p className="text-xs text-slate-400 m-0">
              لا توجد لديك حالات أيتام تحت الكفالة النشطة في الوقت الراهن لرفع تقارير حفظ القرآن لها.
            </p>
            <Button variant="outline" className="mt-2" onClick={() => router.push('/my-orphans')}>
              عرض قائمة أيتامي
            </Button>
          </div>
        ) : (
          /* Step 1: اختيار اليتيم */
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">

            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1B5E8C] to-[#134569] text-white flex items-center justify-center text-lg font-bold shrink-0 shadow-md shadow-[#1B5E8C]/20">
                  ١
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 m-0">اختيار اليتيم</h2>
                  <p className="text-xs text-slate-500 m-0">اختر اليتيم من القائمة لفتح نافذة رفع التقرير</p>
                </div>
              </div>

              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-center">
                إجمالي الأيتام: {orphans.length}
              </span>
            </div>

            {/* Search filter input */}
            <div className="relative">
              <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم اليتيم، الكود، أو المحافظة..."
                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#1B5E8C] focus:bg-white focus:ring-2 focus:ring-[#1B5E8C]/20 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  مسح
                </button>
              )}
            </div>

            {/* Orphans List / Interactive Cards */}
            <div className="space-y-2.5">
              {filteredOrphans.length === 0 ? (
                <div className="py-10 text-center text-slate-400 space-y-1">
                  <Users size={28} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold">لا يوجد أيتام يطابقون نتائج البحث</p>
                </div>
              ) : (
                filteredOrphans.map((o) => {
                  const age = calcAge(o.date_of_birth);
                  const isSelected = selectedOrphan?.id === o.id;

                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => handleSelectOrphan(o)}
                      className={`w-full flex items-center justify-between gap-3.5 py-3.5 px-4 rounded-2xl border-[1.5px] text-right cursor-pointer transition-all duration-150 group ${
                        isSelected
                          ? 'border-[#1B5E8C] bg-blue-50/80 shadow-[0_2px_8px_rgba(27,94,140,0.15)] ring-1 ring-[#1B5E8C]'
                          : 'border-slate-200 bg-slate-50/60 hover:border-[#1B5E8C] hover:bg-blue-50/40 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Circular Avatar with Initial Letter */}
                        <div className="w-10 h-10 rounded-full shrink-0 bg-gradient-to-br from-[#1B5E8C] to-[#134569] text-white flex items-center justify-center text-base font-bold shadow-sm group-hover:scale-105 transition-transform">
                          {o.full_name?.charAt(0) || '؟'}
                        </div>

                        {/* Name and Info */}
                        <div className="min-w-0">
                          <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-[#1B5E8C] transition-colors truncate">
                            {o.full_name}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                            {age != null && <span>{age} سنة</span>}
                            {o.governorate_ar && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                <span>{o.governorate_ar}</span>
                              </>
                            )}
                            {o.orphan_code && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                <span className="font-mono text-slate-400">{o.orphan_code}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Action Prompt on Card */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 group-hover:border-[#1B5E8C] group-hover:bg-[#1B5E8C] group-hover:text-white text-slate-700 text-xs font-bold transition-all shadow-xs">
                          <span>رفع التقرير</span>
                          <ArrowRight size={13} className="rotate-180" />
                        </span>
                        <div className="sm:hidden w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-[#1B5E8C]">
                          <ArrowRight size={14} className="rotate-180" />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

          </div>
        )}

      </div>
    </AppShell>
  );
}
