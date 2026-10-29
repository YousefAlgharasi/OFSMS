'use client';

/**
 * page.jsx
 * Route:  /registrations  (Supervisor + GM)
 * API:    GET  /api/supervisor/queue          → merged pending orphans + families
 *         PATCH /api/orphans/:id/status       → approve / reject orphan
 *         PATCH /api/families/:id/status      → approve / reject family
 *
 * Layout:
 *   Queue list with filter tabs
 *   Slide-in detail panel (opens on row click)
 *   with Approve / Reject (+ notes modal) actions
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, X, User, Users, Check, RefreshCw,
  MapPin, CalendarDays, UserCircle, Users2, CheckCircle2,
} from 'lucide-react';

import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import Textarea from '@/components/ui/Textarea';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';

// ── Constants ─────────────────────────────────────────────────────────────────

const API_ENDPOINTS = {
  QUEUE:          '/supervisor/queue',
  ORPHAN_STATUS:  (id) => `/orphans/${id}/status`,
  FAMILY_STATUS:  (id) => `/families/${id}/status`,
};

const APPROVE_STATUS  = 'under_marketing';
const TOAST_DURATION  = 3000; // ms

const GUARDIAN_LABELS = {
  uncle:         'عم',
  maternal_uncle: 'خال',
  grandfather:   'جد',
  sibling:       'أخ / أخت',
  other:         'أخرى',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const calcAge = (dob) => {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('ar-YE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const fmtDateRelative = (d) => {
  if (!d) return '—';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'اليوم';
  if (diff === 1) return 'أمس';
  if (diff < 7)  return `منذ ${diff} أيام`;
  return fmtDate(d);
};

const statusEndpoint = (record) =>
  record.record_type === 'orphan'
    ? API_ENDPOINTS.ORPHAN_STATUS(record.id)
    : API_ENDPOINTS.FAMILY_STATUS(record.id);

// ── SkeletonRow ───────────────────────────────────────────────────────────────

function SkeletonRow() {
  const shimmer = 'bg-gradient-to-r from-gray-100 to-gray-200 animate-[shimmer_1.4s_infinite] bg-[length:200%_100%]';
  return (
    <div className="flex items-center gap-3.5 py-3.5 px-5 border-b border-gray-50 pointer-events-none">
      <div className={`w-[38px] h-[38px] rounded-xl shrink-0 ${shimmer}`} />
      <div className="flex-1 flex flex-col gap-1.5">
        <div className={`h-3 rounded-full ${shimmer}`} style={{ width: 160 }} />
        <div className={`h-2.5 rounded-full ${shimmer}`} style={{ width: 100 }} />
      </div>
      <div className={`h-2.5 rounded-full ${shimmer}`} style={{ width: 70 }} />
    </div>
  );
}

// ── RejectModal ───────────────────────────────────────────────────────────────

function RejectModal({ record, onConfirm, onCancel, loading }) {
  const [notes, setNotes] = useState('');

  return (
    <div
      className="fixed inset-0 bg-black/45 backdrop-blur-[3px] z-[500] flex items-center justify-content-center sm:items-center items-end p-4 sm:p-4 p-0 font-sans animate-[fadeIn_0.15s_ease]"
      style={{ direction: 'rtl' }}
      onClick={onCancel}
    >
      <div
        className="bg-white border border-gray-200 rounded-2xl w-full max-w-[440px] shadow-[0_20px_60px_rgba(0,0,0,0.18)] overflow-hidden animate-[slideUp_0.2s_ease] mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3.5 py-5 px-6 bg-red-50 border-b border-red-200">
          <span className="text-red-600 shrink-0 mt-0.5"><AlertTriangle size={18} /></span>
          <div>
            <h3 className="text-[1rem] font-extrabold text-red-700 m-0 mb-0.5">رفض التسجيل</h3>
            <p className="text-[0.8rem] text-gray-500 m-0">{record.name}</p>
          </div>
        </div>

        {/* Body */}
        <div className="py-5 px-6">
          <label className="block text-[0.8rem] font-bold text-gray-700 mb-2">
            سبب الرفض <span className="text-red-600">*</span>
          </label>
          <Textarea
            className="rounded-xl border-gray-200 focus:border-red-500 focus:ring-red-500/8"
            rows={4}
            placeholder="اكتب سبب الرفض ليُرسَل للمندوب عبر الإشعارات…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            autoFocus
          />
          <p className="text-[0.75rem] text-gray-400 mt-2 mb-0">
            سيتلقى المندوب إشعاراً فورياً يتضمن هذا السبب.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 py-4 px-6 border-t border-gray-100">
          <button
            className="flex-1 py-2.5 bg-transparent border-[1.5px] border-gray-200 rounded-xl font-sans text-[0.85rem] font-semibold text-gray-500 cursor-pointer transition-colors hover:not(:disabled):border-gray-400 hover:not(:disabled):text-gray-700 disabled:opacity-50"
            onClick={onCancel}
            disabled={loading}
          >
            إلغاء
          </button>
          <button
            className={`flex-[2] py-2.5 bg-gradient-to-br from-red-600 to-red-700 text-white font-sans text-[0.88rem] font-bold border-none rounded-xl cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_2px_8px_rgba(220,38,38,0.25)] transition-all ${!notes.trim() || loading ? 'opacity-40 cursor-not-allowed' : 'hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(220,38,38,0.35)]'}`}
            onClick={() => notes.trim() && onConfirm(notes.trim())}
            disabled={!notes.trim() || loading}
          >
            {loading
              ? <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-[spin_0.6s_linear_infinite] shrink-0" />
              : <><X size={16} /> تأكيد الرفض</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DetailPanel ───────────────────────────────────────────────────────────────

function DetailPanel({ record, onApprove, onReject, actionLoading, onClose }) {
  const isOrphan = record.record_type === 'orphan';

  const headerClass = isOrphan
    ? 'bg-gradient-to-br from-[#0d3d5c] to-[#1B5E8C]'
    : 'bg-gradient-to-br from-[#065f46] to-[#059669]';

  return (
    <div
      className="fixed inset-0 bg-[rgba(13,61,92,0.45)] backdrop-blur-[4px] z-[400] flex items-center justify-center p-4 animate-[fadeIn_0.18s_ease] font-sans"
      style={{ direction: 'rtl' }}
      onClick={onClose}
    >
      <div
        className="bg-white border border-gray-200 rounded-2xl w-full max-w-[500px] max-h-[88vh] flex flex-col shadow-[0_32px_80px_rgba(13,61,92,0.22)] overflow-hidden animate-[slideUp_0.22s_cubic-bezier(0.22,1,0.36,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient header */}
        <div className={`flex items-center gap-3.5 py-5 px-6 text-white shrink-0 ${headerClass}`}>
          <div className="w-[46px] h-[46px] rounded-xl bg-white/18 flex items-center justify-center shrink-0">
            {isOrphan ? <User size={22} /> : <Users size={22} />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[1.1rem] font-extrabold text-white m-0 mb-0.5 truncate">{record.name}</h2>
            <span className={`inline-block text-[0.68rem] font-bold py-0.5 px-2 rounded-full bg-white/20 ${isOrphan ? 'text-blue-200' : 'text-emerald-200'}`}>
              {isOrphan ? 'يتيم' : 'أسرة'}
            </span>
          </div>
          <button
            className="w-[30px] h-[30px] bg-white/15 border-none rounded-lg text-white cursor-pointer flex items-center justify-center shrink-0 transition-colors hover:bg-white/28"
            onClick={onClose}
            aria-label="إغلاق"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0 py-5 px-6 flex flex-col gap-4">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3">
              <MapPin size={14} className="text-[#1B5E8C] mt-0.5 shrink-0" />
              <div>
                <span className="block text-[0.68rem] font-bold text-gray-400 mb-0.5">المحافظة</span>
                <span className="block text-[0.83rem] font-semibold text-gray-800">{record.governorate_ar || '—'}</span>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3">
              <UserCircle size={14} className="text-[#1B5E8C] mt-0.5 shrink-0" />
              <div>
                <span className="block text-[0.68rem] font-bold text-gray-400 mb-0.5">المندوب</span>
                <span className="block text-[0.83rem] font-semibold text-gray-800">{record.agent_name || '—'}</span>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3">
              <CalendarDays size={14} className="text-[#1B5E8C] mt-0.5 shrink-0" />
              <div>
                <span className="block text-[0.68rem] font-bold text-gray-400 mb-0.5">تاريخ التسجيل</span>
                <span className="block text-[0.83rem] font-semibold text-gray-800">{fmtDate(record.created_at)}</span>
              </div>
            </div>
            {isOrphan && record.date_of_birth && (
              <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3">
                <CalendarDays size={14} className="text-[#1B5E8C] mt-0.5 shrink-0" />
                <div>
                  <span className="block text-[0.68rem] font-bold text-gray-400 mb-0.5">العمر</span>
                  <span className="block text-[0.83rem] font-semibold text-gray-800">{calcAge(record.date_of_birth)} سنة</span>
                </div>
              </div>
            )}
            {isOrphan && record.gender && (
              <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3">
                <User size={14} className="text-[#1B5E8C] mt-0.5 shrink-0" />
                <div>
                  <span className="block text-[0.68rem] font-bold text-gray-400 mb-0.5">الجنس</span>
                  <span className="block text-[0.83rem] font-semibold text-gray-800">{record.gender === 'female' ? 'أنثى' : 'ذكر'}</span>
                </div>
              </div>
            )}
            {record.guardian_name && (
              <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3">
                <UserCircle size={14} className="text-[#1B5E8C] mt-0.5 shrink-0" />
                <div>
                  <span className="block text-[0.68rem] font-bold text-gray-400 mb-0.5">{isOrphan ? 'الوصي' : 'رب الأسرة'}</span>
                  <span className="block text-[0.83rem] font-semibold text-gray-800">{record.guardian_name}</span>
                </div>
              </div>
            )}
            {isOrphan && record.guardian_relation && (
              <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3">
                <Users2 size={14} className="text-[#1B5E8C] mt-0.5 shrink-0" />
                <div>
                  <span className="block text-[0.68rem] font-bold text-gray-400 mb-0.5">صلة الوصي</span>
                  <span className="block text-[0.83rem] font-semibold text-gray-800">
                    {GUARDIAN_LABELS[record.guardian_relation] || record.guardian_relation}
                  </span>
                </div>
              </div>
            )}
            {!isOrphan && record.member_count && (
              <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3">
                <Users size={14} className="text-[#1B5E8C] mt-0.5 shrink-0" />
                <div>
                  <span className="block text-[0.68rem] font-bold text-gray-400 mb-0.5">عدد الأفراد</span>
                  <span className="block text-[0.83rem] font-semibold text-gray-800">{record.member_count}</span>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {record.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl py-3 px-4">
              <p className="text-[0.7rem] font-extrabold text-amber-800 tracking-wider mb-1.5 m-0">ملاحظات المندوب</p>
              <p className="text-[0.85rem] text-gray-700 leading-relaxed m-0">{record.notes}</p>
            </div>
          )}

          {/* Full file link */}
          <a
            href={`/${isOrphan ? 'orphans' : 'families'}/${record.id}`}
            className="inline-flex items-center self-start text-[0.8rem] font-bold text-[#1B5E8C] no-underline py-2 px-3 border-[1.5px] border-blue-200 rounded-xl bg-blue-50 transition-colors hover:bg-blue-100 hover:border-blue-300"
            target="_blank"
            rel="noreferrer"
          >
            عرض الملف الكامل والمستندات ←
          </a>
        </div>

        {/* Actions */}
        <div className="flex gap-3 py-4 px-6 border-t-[1.5px] border-gray-100 bg-white shrink-0">
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white font-sans text-[0.9rem] font-bold border-none rounded-xl cursor-pointer shadow-[0_2px_8px_rgba(5,150,105,0.25)] transition-all disabled:opacity-55 disabled:cursor-not-allowed hover:not(:disabled):-translate-y-px hover:not(:disabled):shadow-[0_4px_16px_rgba(5,150,105,0.35)]"
            onClick={onApprove}
            disabled={!!actionLoading}
          >
            {actionLoading === 'approve'
              ? <><span className="inline-block w-3.5 h-3.5 border-2 border-white/35 border-t-white rounded-full animate-[spin_0.6s_linear_infinite]" /> جارٍ الاعتماد…</>
              : <><Check size={16} /> اعتماد التسجيل</>}
          </button>
          <button
            className="flex items-center justify-center gap-1.5 py-3 px-5 bg-white border-[1.5px] border-red-300 text-red-600 font-sans text-[0.88rem] font-bold rounded-xl cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:not(:disabled):bg-red-50 hover:not(:disabled):border-red-400"
            onClick={onReject}
            disabled={!!actionLoading}
          >
            <X size={15} /> رفض
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RegistrationsPage() {
  const [queue,         setQueue]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [filter,        setFilter]        = useState('all');   // all | orphan | family
  const [selected,      setSelected]      = useState(null);    // record in detail panel
  const [rejectTarget,  setRejectTarget]  = useState(null);    // record for reject modal
  const [actionLoading, setActionLoading] = useState(null);    // 'approve' | 'reject' | null
  const [toast,         setToast]         = useState(null);    // { msg, type }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const fetchQueue = useCallback(() => {
    setLoading(true);
    api.get(API_ENDPOINTS.QUEUE)
      .then((res) => setQueue(res.data.queue || []))
      .catch(() => setError('تعذّر تحميل قائمة الانتظار.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const displayed = filter === 'all'
    ? queue
    : queue.filter((r) => r.record_type === filter);

  // ── Approve ──
  const handleApprove = async (record) => {
    setActionLoading('approve');
    try {
      await api.patch(statusEndpoint(record), { status: APPROVE_STATUS });
      setQueue((prev) => prev.filter((r) => r.id !== record.id));
      setSelected(null);
      showToast(`تمت الموافقة على ${record.name} وانتقل إلى التسويق`);
    } catch {
      showToast('فشل الاعتماد. يرجى المحاولة مجدداً.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Reject ──
  const handleRejectConfirm = async (notes) => {
    if (!rejectTarget) return;
    setActionLoading('reject');
    try {
      await api.patch(statusEndpoint(rejectTarget), { status: 'rejected', notes });
      setQueue((prev) => prev.filter((r) => r.id !== rejectTarget.id));
      if (selected?.id === rejectTarget.id) setSelected(null);
      setRejectTarget(null);
      showToast(`تم رفض تسجيل ${rejectTarget.name} وإشعار المندوب`);
    } catch {
      showToast('فشل الرفض. يرجى المحاولة مجدداً.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const orphanCount = queue.filter((r) => r.record_type === 'orphan').length;
  const familyCount = queue.filter((r) => r.record_type === 'family').length;

  const FILTER_TABS = [
    { value: 'all',    label: 'الكل',  count: queue.length },
    { value: 'orphan', label: 'أيتام', count: orphanCount },
    { value: 'family', label: 'أسر',   count: familyCount },
  ];

  return (
    <AppShell>
      <div className="max-w-[900px] mx-auto flex flex-col gap-4 font-sans pb-12 relative" dir="rtl">

        {/* ── Toast ── */}
        {toast && (
          <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 py-3 px-6 rounded-full text-[0.85rem] font-semibold z-[100] whitespace-nowrap shadow-[0_4px_20px_rgba(0,0,0,0.15)] animate-[toastIn_0.25s_ease] ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-[#0d3d5c] text-white'}`}>
            {toast.msg}
          </div>
        )}

        {/* ── Reject modal ── */}
        {rejectTarget && (
          <RejectModal
            record={rejectTarget}
            onConfirm={handleRejectConfirm}
            onCancel={() => setRejectTarget(null)}
            loading={actionLoading === 'reject'}
          />
        )}

        {/* ── Page header ── */}
        <PageHeader
          title="طلبات التسجيل"
          subtitle={loading ? '…' : `${queue.length} طلب بانتظار المراجعة`}
          subtitleClassName="text-[0.82rem] text-gray-400"
          action={
            <button
              className="flex items-center justify-center w-9 h-9 border-[1.5px] border-gray-200 rounded-xl bg-white text-gray-500 cursor-pointer shrink-0 transition-colors hover:border-[#1B5E8C] hover:text-[#1B5E8C] hover:bg-blue-50"
              onClick={fetchQueue}
              title="تحديث"
            >
              <RefreshCw size={14} />
            </button>
          }
        />

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 py-3 px-4 rounded-xl text-[0.85rem]">
            <AlertTriangle size={18} /> {error}
          </div>
        )}

        {/* ── Queue card ── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">

          {/* Filter tabs */}
          <div className="flex border-b-[1.5px] border-gray-200 px-4 pt-2 gap-1 bg-gray-50 overflow-x-auto scrollbar-none">
            {FILTER_TABS.map(({ value, label, count }) => {
              const isActive = filter === value;
              return (
                <button
                  key={value}
                  className={`inline-flex items-center gap-1.5 py-2.5 px-4 border-none bg-transparent font-sans text-[0.83rem] font-semibold cursor-pointer whitespace-nowrap shrink-0 border-b-[2.5px] -mb-[1.5px] transition-colors ${isActive ? 'text-[#1B5E8C] border-b-[#1B5E8C]' : 'text-gray-500 border-b-transparent hover:text-[#1B5E8C]'}`}
                  onClick={() => setFilter(value)}
                >
                  {label}
                  {!loading && (
                    <span className={`text-[0.7rem] font-bold py-0 px-1.5 rounded-full min-w-[1.2rem] text-center ${isActive ? 'bg-blue-50 text-[#1B5E8C]' : 'bg-gray-100 text-gray-500'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Queue rows */}
          <div className="max-h-[calc(100vh-240px)] overflow-y-auto">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              : displayed.length === 0
                ? (
                  <EmptyState
                    icon={<span className="text-emerald-500 flex"><CheckCircle2 size={40} strokeWidth={1.5} /></span>}
                    heading="لا توجد طلبات معلّقة"
                    description="كل الطلبات تمت مراجعتها"
                    className="py-16 px-4 gap-1.5"
                  />
                )
                : displayed.map((record) => {
                  const isOrphan = record.record_type === 'orphan';
                  return (
                    <div
                      key={record.id}
                      className="flex items-center gap-3.5 py-3.5 px-5 border-b border-gray-50 cursor-pointer transition-colors last:border-b-0 hover:bg-blue-50/40 group"
                      onClick={() => setSelected(record)}
                    >
                      {/* Type badge */}
                      <div className={`w-[38px] h-[38px] rounded-xl flex items-center justify-center shrink-0 ${isOrphan ? 'bg-blue-50 text-[#1B5E8C]' : 'bg-emerald-50 text-emerald-600'}`}>
                        {isOrphan ? <User size={18} /> : <Users size={18} />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                        <span className="text-[0.88rem] font-bold text-gray-800 truncate">{record.name}</span>
                        <span className="text-[0.75rem] text-gray-400 truncate">
                          {record.governorate_ar}
                          {record.agent_name && ` · ${record.agent_name}`}
                        </span>
                      </div>

                      {/* Date + arrow */}
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className="text-[0.72rem] text-gray-400 whitespace-nowrap hidden sm:block">{fmtDateRelative(record.created_at)}</span>
                        <span className="text-[0.75rem] text-gray-300 transition-all group-hover:text-[#1B5E8C] group-hover:-translate-x-1">←</span>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </div>

        {/* ── Detail modal ── */}
        {selected && (
          <DetailPanel
            record={selected}
            onApprove={() => handleApprove(selected)}
            onReject={() => setRejectTarget(selected)}
            actionLoading={actionLoading}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
