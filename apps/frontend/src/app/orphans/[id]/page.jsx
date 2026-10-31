'use client';

/**
 * /orphans/[id]/page.jsx
 * Orphan detail page — all roles can view, GM sees Transfer button.
 *
 * API:
 *   GET  /api/orphans/:id  → orphan + documents + sponsorship info
 *   POST /api/sponsors/transfer (via TransferSponsorModal)
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Handshake, Search, AlertTriangle, CheckCircle2, Share2 } from 'lucide-react';
import api from '../../../lib/api';
import ProfileDetails from '../../../components/ProfileDetails';
import { openDocument } from '../../../lib/openDocument';
import AppShell from '../../../components/AppShell';
import useAuthStore from '../../../store/useAuthStore';
import TransferSponsorModal from '../../../components/TransferSponsorModal';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import ShareAdModal from '../../../components/ShareAdModal';

// Constants
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  under_review:      { label: 'قيد المراجعة',  textClass: 'text-amber-700', bgClass: 'bg-amber-50', borderClass: 'border-amber-200', dotClass: 'bg-amber-500' },
  under_marketing:   { label: 'تحت التسويق',   textClass: 'text-blue-700', bgClass: 'bg-blue-50', borderClass: 'border-blue-200', dotClass: 'bg-blue-500' },
  under_sponsorship: { label: 'تحت الكفالة',   textClass: 'text-emerald-700', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-200', dotClass: 'bg-emerald-500' },
  rejected:          { label: 'مرفوض',         textClass: 'text-red-700', bgClass: 'bg-red-50', borderClass: 'border-red-200', dotClass: 'bg-red-500' },
  inactive:          { label: 'غير نشط',       textClass: 'text-gray-600', bgClass: 'bg-gray-50', borderClass: 'border-gray-200', dotClass: 'bg-gray-400' },
};

// Derives the two-level registration + placement state from a single status field.
// Level 1: registration (under_review | accepted | rejected)
// Level 2: placement — only present when accepted (under_marketing | under_sponsorship)
function deriveStatusLevels(status) {
  if (status === 'under_review') {
    return {
      registration: { label: 'قيد المراجعة', textClass: 'text-amber-700', bgClass: 'bg-amber-50', borderClass: 'border-amber-200', dotClass: 'bg-amber-500' },
      placement: null,
    };
  }
  if (status === 'rejected') {
    return {
      registration: { label: 'مرفوض', textClass: 'text-red-700', bgClass: 'bg-red-50', borderClass: 'border-red-200', dotClass: 'bg-red-500' },
      placement: null,
    };
  }
  if (status === 'under_marketing') {
    return {
      registration: { label: 'مقبول', textClass: 'text-emerald-700', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-200', dotClass: 'bg-emerald-500' },
      placement: { label: 'تحت التسويق', textClass: 'text-blue-700', bgClass: 'bg-blue-50', borderClass: 'border-blue-200', dotClass: 'bg-blue-500' },
    };
  }
  if (status === 'under_sponsorship') {
    return {
      registration: { label: 'مقبول', textClass: 'text-emerald-700', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-200', dotClass: 'bg-emerald-500' },
      placement: { label: 'مكفول', textClass: 'text-emerald-700', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-200', dotClass: 'bg-emerald-500' },
    };
  }
  return {
    registration: { label: 'غير نشط', textClass: 'text-gray-600', bgClass: 'bg-gray-50', borderClass: 'border-gray-200', dotClass: 'bg-gray-400' },
    placement: null,
  };
}

const GENDER_LABELS = { male: 'ذكر', female: 'أنثى' };
const RELATION_LABELS = {
  uncle: 'عم',
  paternal_uncle: 'عم',
  maternal_uncle: 'خال',
  paternal_aunt: 'عمة',
  maternal_aunt: 'خالة',
  grandfather: 'جد',
  grandmother: 'جدة',
  sibling: 'أخ / أخت',
  brother: 'أخ',
  sister: 'أخت',
  mother: 'أم',
  father: 'أب',
  guardian: 'وصي شرعي',
  legal_guardian: 'وصي شرعي',
  other: 'أخرى',
};

const DOC_TYPE_CONFIG = {
  birth_certificate: { label: 'شهادة الميلاد', textClass: 'text-blue-700', bgClass: 'bg-blue-50' },
  death_certificate: { label: 'شهادة الوفاة',  textClass: 'text-red-700', bgClass: 'bg-red-50' },
  id_card:           { label: 'بطاقة الهوية',   textClass: 'text-purple-700', bgClass: 'bg-purple-50' },
  photo:             { label: 'صورة شخصية',     textClass: 'text-emerald-700', bgClass: 'bg-emerald-50' },
  other:             { label: 'مستند آخر',      textClass: 'text-amber-700', bgClass: 'bg-amber-50' },
};

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconTransfer = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

const IconBack = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const IconDoc = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const IconCake = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/>
    <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/>
    <path d="M2 21h20"/><path d="M7 8v2"/><path d="M12 8v2"/><path d="M17 8v2"/>
    <path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/>
  </svg>
);

const IconMapPin = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const IconUser = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

// ── Info row ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1 bg-slate-50 border border-slate-100 rounded-xl p-2.5 px-3 min-w-0">
      <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider break-all">{label}</span>
      <span className="text-sm text-[#0d3d5c] font-bold overflow-wrap-anywhere break-all min-w-0">{value || '—'}</span>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="bg-white border border-[#e5eaf0] rounded-[1.1rem] p-[1.35rem_1.5rem] shadow-sm">
      <h3 className="text-[13px] font-extrabold text-[#0d3d5c] m-0 mb-[1.1rem] pb-3 border-b-[1.5px] border-[#f0f4f8] border-r-3 border-[#1B5E8C] pr-[0.65rem] tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-gray-200 animate-pulse" style={{ height: i === 1 ? '120px' : '180px' }} />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OrphanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const id = params?.id;

  const [orphan, setOrphan]         = useState(null);
  const [documents, setDocuments]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [transferOpen, setTransfer] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [deleteToast, setDeleteToast] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const isGM = user?.role === 'gm';

  const fetchOrphan = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/orphans/${id}`);
      setOrphan(data.orphan);
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('Error fetching orphan details:', err);
      setError('تعذّر تحميل بيانات اليتيم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchOrphan();
    }
  }, [id]);

  const handleTransferSuccess = () => {
    setSuccessMsg('تم نقل الكفالة بنجاح');
    fetchOrphan();
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/orphans/${id}`);
      setDeleteConfirm(false);
      setDeleteToast(true);
      setTimeout(() => router.push('/orphans'), 2500);
    } catch (err) {
      console.error('Error deleting orphan:', err);
      setError(err.response?.data?.error || 'تعذّر حذف اليتيم');
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const statusInfo   = STATUS_CONFIG[orphan?.status] || STATUS_CONFIG.inactive;
  const statusLevels = orphan ? deriveStatusLevels(orphan.status) : null;

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('ar-YE', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const calcAge = (dob) => {
    if (!dob) return '—';
    const diff = Date.now() - new Date(dob).getTime();
    return `${Math.floor(diff / MS_PER_YEAR)} سنة`;
  };

  return (
    <AppShell>
      <div className="max-w-[1040px] mx-auto pb-12 font-cairo flex flex-col gap-0" dir="rtl">

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-[13px]">
            <button className="flex items-center gap-1 bg-none border-none text-[#1B5E8C] hover:bg-[#f0f7ff] cursor-pointer font-cairo font-semibold p-1 px-2 rounded-md transition-colors duration-150" onClick={() => router.back()}>
              <IconBack /> رجوع
            </button>
            <span className="text-gray-300">/</span>
            <Link href="/orphans" className="text-[#1B5E8C] no-underline font-semibold hover:underline">الأيتام</Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-500">تفاصيل اليتيم</span>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            {/* Transfer button — rightmost (GM only, under sponsorship) */}
            {isGM && orphan?.status === 'under_sponsorship' && (
              <button className="inline-flex items-center gap-2 p-[0.65rem_1.25rem] bg-gradient-to-br from-[#1B5E8C] to-[#134569] text-white border-none rounded-xl font-cairo text-sm font-bold cursor-pointer shadow-md shadow-sky-950/25 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-950/35" onClick={() => setTransfer(true)}>
                <IconTransfer /> نقل الكفالة
              </button>
            )}
            {isGM && orphan?.status === 'under_marketing' && !orphan?.sponsor_name && (
              <button className="inline-flex items-center gap-1.5 p-[0.65rem_1.25rem] bg-[#0f766e] text-white border-none rounded-xl font-cairo text-sm font-extrabold cursor-pointer shadow-md shadow-teal-900/22 transition-all duration-150 hover:not-disabled:-translate-y-0.5 hover:not-disabled:shadow-lg hover:not-disabled:shadow-teal-900/32 disabled:opacity-65 disabled:cursor-not-allowed" onClick={() => setShareOpen(true)}>
                <Share2 size={16} /> مشاركة للكفلاء
              </button>
            )}

            {/* Edit + Delete grouped on the left */}
            <div className="mr-auto flex gap-2">
              {orphan && (isGM || (user?.role === 'agent' && (orphan.status === 'under_review' || orphan.status === 'rejected'))) && (
                <button className="inline-flex items-center gap-1.5 p-2 px-[1.1rem] bg-white text-amber-600 border-[1.5px] border-amber-600 rounded-xl font-cairo text-sm font-bold cursor-pointer transition-all duration-150 hover:bg-amber-50 hover:-translate-y-0.5" onClick={() => router.push(`/orphans/${id}/edit`)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  تعديل
                </button>
              )}

              {isGM && orphan && (
                <Button variant="danger-outline" onClick={() => setDeleteConfirm(true)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                  حذف
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Success banner ──────────────────────────────────────── */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 px-4 rounded-xl text-sm font-semibold mb-4 animate-[slideDown_0.2s_ease]" role="status">
            <CheckCircle2 size={16} className="inline-block ml-1" /> {successMsg}
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 px-4 rounded-xl text-sm mb-4" role="alert">
            <AlertTriangle size={18} className="inline-block ml-1" /> {error}
          </div>
        )}

        {loading ? (
          <PageSkeleton />
        ) : orphan ? (
          <>
            {/* ── Hero banner ─────────────────────────────────────── */}
            <div className="bg-gradient-to-br from-[#0d3d5c] via-[#1B5E8C] to-[#1e6fa3] rounded-[1.25rem] p-7 md:p-8 flex items-center justify-between gap-6 flex-wrap mb-5 shadow-lg shadow-sky-900/30">
              <div className="flex items-center gap-5">
                <div className="relative w-[4.5rem] h-[4.5rem] rounded-full bg-white/20 backdrop-blur-md border-[2.5px] border-white/40 text-white text-[1.6rem] font-extrabold flex items-center justify-center shrink-0">
                  {orphan.full_name?.[0] || '؟'}
                  {orphan.is_gifted && <span className="absolute -bottom-1 -right-1 text-[0.85rem] leading-none">⭐</span>}
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-[1.35rem] font-extrabold text-white m-0 [text-shadow:0_1px_4px_rgba(0,0,0,0.2)]">{orphan.full_name}</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-[4px] border ${statusInfo.bgClass} ${statusInfo.textClass} ${statusInfo.borderClass}`}
                    >
                      <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${statusInfo.dotClass}`} />
                      {statusInfo.label}
                    </span>
                    {orphan.is_gifted && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-200/25 border border-amber-200/50 text-amber-200 text-xs font-bold">⭐ موهوب</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 flex-wrap justify-start md:justify-end">
                {[
                  { icon: <IconCake />,   label: 'العمر',    value: calcAge(orphan.date_of_birth) },
                  { icon: <IconUser />,   label: 'الجنس',    value: GENDER_LABELS[orphan.gender] || '—' },
                  { icon: <IconMapPin />, label: 'المحافظة', value: orphan.governorate_ar || '—' },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2 bg-white/12 border border-white/20 rounded-xl p-2 px-3.5 backdrop-blur-[4px] min-w-[100px] md:min-w-[80px]">
                    <span className="text-white/70 flex shrink-0">{s.icon}</span>
                    <div>
                      <p className="text-[10px] text-white/60 m-0 font-medium">{s.label}</p>
                      <p className="text-[13px] text-white m-0 font-bold">{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-5">

              {/* ── Left column ──────────────────────────────────────── */}
              <div className="flex flex-col gap-5">

                {/* Identity card */}
                <Section title="البيانات الأساسية">
                  <div className="grid grid-cols-2 gap-2.5">
                    <InfoRow label="تاريخ الميلاد" value={formatDate(orphan.date_of_birth)} />
                    <InfoRow label="المندوب" value={orphan.agent_name} />
                    <InfoRow label="تاريخ التسجيل" value={formatDate(orphan.created_at)} />
                    <InfoRow label="اسم الوصي" value={orphan.guardian_name} />
                    <InfoRow label="صلة الوصي" value={RELATION_LABELS[orphan.guardian_relation] || orphan.guardian_relation || '—'} />
                  </div>

                  {orphan.notes && (
                    <div className="mt-4 bg-gray-50 rounded-xl p-3">
                      <span className="text-xs text-gray-400 font-semibold block mb-1">ملاحظات</span>
                      <p className="text-[13px] text-gray-700 m-0 leading-relaxed">{orphan.notes}</p>
                    </div>
                  )}
                </Section>

                {orphan.profile && Object.keys(orphan.profile).length > 0 && (
                  <Section title="بيانات دراسة الحالة">
                    <ProfileDetails profile={orphan.profile} />
                  </Section>
                )}

                {/* Documents */}
                {documents.length > 0 && (
                  <Section title="المستندات المرفقة">
                    <div className="flex flex-col gap-1.5">
                      {documents.map((doc) => (
                        <button
                          type="button"
                          key={doc.id}
                          onClick={() => openDocument(doc)}
                          className="w-full text-start cursor-pointer flex items-center gap-3 p-2.5 px-3.5 border border-gray-200 rounded-xl no-underline transition-all duration-150 bg-[#fafafa] hover:border-[#1B5E8C] hover:bg-[#f0f7ff]"
                        >
                          <span className="text-gray-500 flex shrink-0"><IconDoc /></span>
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <span className="text-[13px] font-semibold text-gray-800 overflow-hidden text-ellipsis whitespace-nowrap">{doc.original_name || doc.doc_type}</span>
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold self-start ${
                                (DOC_TYPE_CONFIG[doc.doc_type] || DOC_TYPE_CONFIG.other).textClass
                              } ${(DOC_TYPE_CONFIG[doc.doc_type] || DOC_TYPE_CONFIG.other).bgClass}`}
                            >
                              {(DOC_TYPE_CONFIG[doc.doc_type] || DOC_TYPE_CONFIG.other).label}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">{formatDate(doc.uploaded_at)}</span>
                        </button>
                      ))}
                    </div>
                  </Section>
                )}
              </div>

              {/* ── Right column ─────────────────────────────────────── */}
              <div className="flex flex-col gap-5">

                {/* Sponsorship + Status card */}
                <Section title="بيانات الكفالة">
                  {/* ── Two-level status flow ── */}
                  <div className="flex flex-col gap-0 mb-3.5">
                    {/* Level 1: registration state */}
                    <div className="flex items-center justify-between gap-3 p-2.5 px-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider whitespace-nowrap">حالة التسجيل</span>
                      <span
                        className={`inline-flex items-center gap-1.5 p-1 px-3.5 rounded-full border text-[13px] font-bold ${statusLevels.registration.bgClass} ${statusLevels.registration.textClass} ${statusLevels.registration.borderClass}`}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${statusLevels.registration.dotClass}`} />
                        {statusLevels.registration.label}
                      </span>
                    </div>

                    {/* Level 2: placement state (only when accepted) */}
                    {statusLevels.placement && (
                      <>
                        <div className="flex justify-end px-5">
                          <div className="w-[2px] h-3.5 bg-slate-200 rounded-[1px]" />
                        </div>
                        <div className="flex items-center justify-between gap-3 p-2.5 px-3 bg-slate-50 border border-slate-100 rounded-xl">
                          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider whitespace-nowrap">حالة الكفالة</span>
                          <span
                            className={`inline-flex items-center gap-1.5 p-1 px-3.5 rounded-full border text-[13px] font-bold ${statusLevels.placement.bgClass} ${statusLevels.placement.textClass} ${statusLevels.placement.borderClass}`}
                          >
                            <span className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${statusLevels.placement.dotClass}`} />
                            {statusLevels.placement.label}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {orphan.sponsor_name ? (
                    <>
                      <div className="flex items-center gap-3.5 bg-gradient-to-br from-[#0d3d5c] to-[#1B5E8C] rounded-xl p-4 px-4.5 mb-4">
                        <div className="w-11 h-11 rounded-full bg-white/20 border-2 border-white/35 text-white text-[1.05rem] font-extrabold flex items-center justify-center shrink-0">
                          {orphan.sponsor_name[0]}
                        </div>
                        <div>
                          <p className="text-[15px] font-extrabold text-white m-0">{orphan.sponsor_name}</p>
                          <p className="text-[11px] text-white/65 m-0 mt-0.5">الكافل الحالي</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2.5">
                        <InfoRow label="تاريخ بداية الكفالة" value={formatDate(orphan.sponsorship_start)} />
                        <InfoRow
                          label="المبلغ الشهري"
                          value={
                            orphan.monthly_amount
                              ? `${parseFloat(orphan.monthly_amount).toLocaleString('ar-YE')} ريال`
                              : '—'
                          }
                        />
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      icon={<Handshake size={40} strokeWidth={1.5} />}
                      description="لا يوجد كافل مُعيَّن بعد"
                      action={orphan.status === 'under_marketing' && isGM && (
                        <Button variant="primary" onClick={() => router.push('/sponsors')}>
                          تعيين كافل
                        </Button>
                      )}
                      className="p-6 gap-2"
                    />
                  )}
                </Section>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            icon={<span><Search size={16} /></span>}
            description="لم يُعثر على اليتيم"
            action={<button onClick={() => router.back()} className="text-[#1B5E8C] bg-transparent border-[1.5px] border-[#1B5E8C] rounded-xl p-2 px-5 font-semibold cursor-pointer text-sm transition-colors duration-125 hover:bg-[#f0f7ff]">رجوع</button>}
            className="p-16 gap-3"
          />
        )}
      </div>

      {/* ── Delete success toast ───────────────────────────────────── */}
      {deleteToast && (
        <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-[1000] p-4 animate-[fadeIn_0.15s_ease]">
          <div className="bg-white rounded-[1.25rem] p-8 max-w-[420px] w-full shadow-2xl animate-[scaleIn_0.15s_ease]" dir="rtl" style={{ textAlign: 'center' }}>
            <div className="flex justify-center mb-3">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h3 className="text-[1.15rem] font-extrabold text-[#0d3d5c] text-center m-0 mb-3">تم الحذف بنجاح</h3>
            <p className="text-sm text-gray-500 text-center leading-relaxed m-0 mb-6">تم حذف بيانات اليتيم. سيتم تحويلك إلى قائمة الأيتام…</p>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ────────────────────────────────────── */}
      <Modal open={deleteConfirm} onClose={() => !deleting && setDeleteConfirm(false)} className="p-8">
        <div className="flex justify-center mb-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </div>
        <h3 className="text-[1.15rem] font-extrabold text-[#0d3d5c] text-center m-0 mb-3">تأكيد الحذف</h3>
        <p className="text-sm text-gray-500 text-center leading-relaxed m-0 mb-6">
          هل أنت متأكد من حذف <strong>{orphan?.full_name}</strong>؟ لا يمكن التراجع عن هذا الإجراء.
        </p>
        <div className="flex gap-3 justify-center">
          <button className="p-2.5 px-6 bg-transparent border-[1.5px] border-gray-300 rounded-xl text-gray-700 font-cairo text-sm font-semibold cursor-pointer transition-all duration-150 hover:border-gray-400 hover:bg-gray-50" onClick={() => setDeleteConfirm(false)} disabled={deleting}>
            إلغاء
          </button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'جارٍ الحذف…' : 'نعم، احذف'}
          </Button>
        </div>
      </Modal>

      {/* ── Transfer Modal ──────────────────────────────────────────── */}
      {orphan && (
        <TransferSponsorModal
          isOpen={transferOpen}
          onClose={() => setTransfer(false)}
          onSuccess={handleTransferSuccess}
          beneficiaryType="orphan"
          beneficiaryId={orphan.id}
          beneficiaryName={orphan.full_name}
          currentSponsor={orphan.sponsor_name}
          agentId={orphan.agent_id}
        />
      )}

      {orphan && (
        <ShareAdModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          onSuccess={() => router.push('/announcements')}
          endpoint={`/orphans/${id}/share`}
          title="مشاركة اليتيم مع الكفلاء"
          subtitle={orphan.full_name}
        />
      )}

      <style jsx global>{`
        @keyframes slideDown { from { opacity:0; transform:translateY(-6px);} to {opacity:1; transform:none;} }
      `}</style>
    </AppShell>
  );
}
