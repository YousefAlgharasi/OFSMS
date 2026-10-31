'use client';

/**
 * /families/[id]/page.jsx
 * Family detail page — all roles can view, GM sees Transfer button.
 *
 * API:
 *   GET  /api/families/:id  → family + documents + sponsorship info
 *   POST /api/sponsors/transfer (via TransferSponsorModal)
 */

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Handshake, Search, AlertTriangle, CheckCircle2, Check, X, Plus, Share2 } from 'lucide-react';
import api from '../../../lib/api';
import { openDocument } from '../../../lib/openDocument';
import AppShell from '../../../components/AppShell';
import EmptyState from '@/components/ui/EmptyState';
import useAuthStore from '../../../store/useAuthStore';
import TransferSponsorModal from '../../../components/TransferSponsorModal';
import ShareAdModal from '../../../components/ShareAdModal';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  under_review: { label: 'قيد المراجعة', color: '#F59E0B', bg: '#FEF3C7' },
  under_marketing: { label: 'تحت التسويق', color: '#3B82F6', bg: '#EFF6FF' },
  under_sponsorship: { label: 'تحت الكفالة', color: '#10B981', bg: '#ECFDF5' },
  rejected: { label: 'مرفوض', color: '#EF4444', bg: '#FEF2F2' },
  inactive: { label: 'غير نشط', color: '#6B7280', bg: '#F3F4F6' },
};

const DOC_TYPE_CONFIG = {
  guardian_id: { label: 'بطاقة المعيل', color: '#7c3aed', bg: '#f5f3ff' },
  other: { label: 'مستند آخر', color: '#d97706', bg: '#fffbeb' },
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

const IconUsers = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const IconMapPin = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconUser = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// ── Info row ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1 bg-slate-50 border border-slate-100 rounded-[0.625rem] py-2.5 px-3 min-w-0">
      <span className="text-[0.68rem] text-slate-400 font-semibold uppercase tracking-wider break-words">{label}</span>
      <span className="text-[0.875rem] text-[#0d3d5c] font-bold break-words min-w-0">{value || '—'}</span>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="bg-white border border-[#e5eaf0] rounded-[1.1rem] py-5 px-6 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
      <h3 className="text-[0.82rem] font-extrabold text-[#0d3d5c] m-0 mb-4 pb-3 border-b-[1.5px] border-[#f0f4f8] border-r-[3px] border-r-[#1B5E8C] pr-2.5 tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-[shimmer_1.4s_infinite]" style={{ height: i === 1 ? '120px' : '180px' }} />
      ))}
    </div>
  );
}

// ── Assign Sponsor Modal ──────────────────────────────────────────────────────
function AssignSponsorModal({ isOpen, onClose, onSuccess, familyName, familyId, agentId }) {
  const [tab, setTab] = useState('existing');
  const [sponsors, setSponsors] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [sponsorId, setSponsorId] = useState('');
  const [sponsorSearch, setSponsorSearch] = useState('');
  const [newSponsor, setNewSponsor] = useState({ fullName: '', phone: '', email: '', portalPassword: '' });
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [intermediary, setIntermediary] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setSponsorId(''); setSponsorSearch(''); setError('');
    setNewSponsor({ fullName: '', phone: '', email: '', portalPassword: '' });
    setStartDate(new Date().toISOString().split('T')[0]);
    setMonthlyAmount(''); setIntermediary(''); setTab('existing');
    setFetching(true);
    api.get('/sponsors')
      .then(({ data }) => { setSponsors(data.sponsors || []); setFiltered(data.sponsors || []); })
      .catch(() => setError('تعذّر تحميل قائمة الكفلاء'))
      .finally(() => setFetching(false));
  }, [isOpen]);

  useEffect(() => {
    if (!sponsorSearch.trim()) { setFiltered(sponsors); return; }
    const q = sponsorSearch.toLowerCase();
    setFiltered(sponsors.filter(s =>
      s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.phone?.includes(q)
    ));
  }, [sponsorSearch, sponsors]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  const handleSubmit = async () => {
    setError('');
    if (tab === 'existing' && !sponsorId) { setError('يرجى اختيار كافل'); return; }
    if (tab === 'new') {
      if (!newSponsor.fullName.trim()) { setError('اسم الكافل مطلوب'); return; }
      if (!newSponsor.portalPassword || newSponsor.portalPassword.length < 8) {
        setError('كلمة مرور البوابة يجب أن تكون 8 أحرف على الأقل'); return;
      }
    }
    if (!startDate) { setError('تاريخ البداية مطلوب'); return; }
    if (!monthlyAmount || parseFloat(monthlyAmount) <= 0) { setError('المبلغ الشهري مطلوب'); return; }

    setLoading(true);
    try {
      let finalSponsorId = sponsorId;
      if (tab === 'new') {
        const { data } = await api.post('/sponsors', {
          fullName: newSponsor.fullName.trim(),
          phone: newSponsor.phone.trim() || undefined,
          email: newSponsor.email.trim() || undefined,
          portalPassword: newSponsor.portalPassword,
        });
        finalSponsorId = data.sponsor.id;
      }
      await api.post(`/sponsors/${finalSponsorId}/sponsorships`, {
        beneficiaryType: 'family',
        beneficiaryId: familyId,
        agentId,
        intermediary: intermediary.trim() || undefined,
        startDate,
        monthlyAmount: parseFloat(monthlyAmount),
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.msg || err.response?.data?.error || 'حدث خطأ أثناء التعيين');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#0d3d5c]/55 backdrop-blur-[4px] z-[50] flex items-center justify-center p-4 animate-[fadeIn_.18s_ease]" ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose(); }} role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl w-full max-w-[540px] max-h-[90vh] flex flex-col shadow-[0_20px_60px_rgba(13,61,92,.25)] overflow-hidden animate-[slideUp_.22s_cubic-bezier(0.34,1.56,0.64,1)] font-sans" dir="rtl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3.5 py-5 px-6 border-b-[1.5px] border-[#f0f4f8] shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white flex items-center justify-center shrink-0"><Handshake size={20} /></div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[1rem] font-bold text-[#0d3d5c] m-0">تعيين كافل</h2>
            <p className="text-[0.78rem] text-gray-500 m-0 mt-0.5">الأسرة: <strong className="text-emerald-600">{familyName}</strong></p>
          </div>
          <button className="flex items-center justify-center w-8 h-8 rounded-lg border-none bg-transparent text-gray-400 cursor-pointer shrink-0 transition-colors hover:bg-gray-100" onClick={onClose} disabled={loading}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 pt-3.5 px-6">
          <button className={`flex-1 py-2 px-4 border-[1.5px] rounded-xl font-sans text-[0.83rem] font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${tab === 'existing' ? 'border-emerald-600 text-white bg-emerald-600' : 'border-[#e5eaf0] text-gray-500 bg-gray-50 hover:bg-gray-100'}`} onClick={() => setTab('existing')}><Handshake size={16} /> كافل موجود</button>
          <button className={`flex-1 py-2 px-4 border-[1.5px] rounded-xl font-sans text-[0.83rem] font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${tab === 'new' ? 'border-emerald-600 text-white bg-emerald-600' : 'border-[#e5eaf0] text-gray-500 bg-gray-50 hover:bg-gray-100'}`} onClick={() => setTab('new')}><Plus size={16} /> كافل جديد</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-4 px-6 flex flex-col gap-3.5">
          {tab === 'existing' && (
            <div>
              <label className="block text-[0.8rem] font-semibold text-gray-700 mb-1">اختر الكافل <span className="text-red-600">*</span></label>
              <Input className="focus:border-emerald-600 focus:ring-emerald-600/10" placeholder="ابحث بالاسم أو البريد أو الهاتف…" value={sponsorSearch} onChange={e => setSponsorSearch(e.target.value)} />
              <div className="border-[1.5px] border-[#e5eaf0] rounded-[0.625rem] max-h-[170px] overflow-y-auto bg-gray-50 mt-1.5">
                {fetching ? (
                  [1,2,3].map(i => <div key={i} className="h-[52px] m-1.5 rounded-lg bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-[shimmer_1.4s_infinite]" />)
                ) : filtered.length === 0 ? (
                  <p className="text-center text-gray-400 text-[0.82rem] p-4 m-0">لا يوجد كفلاء مطابقون</p>
                ) : filtered.map(sp => (
                  <button key={sp.id} className={`flex items-center gap-2.5 py-2.5 px-3.5 cursor-pointer border-none border-b border-b-[#f0f4f8] w-full font-sans text-right transition-colors ${sponsorId === sp.id ? 'bg-emerald-50' : 'bg-transparent hover:bg-gray-100'}`} onClick={() => setSponsorId(sp.id)}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-700 text-white flex items-center justify-center text-[0.85rem] font-bold shrink-0">{sp.full_name?.charAt(0) || '؟'}</div>
                    <div className="flex-1">
                      <div className="text-[0.85rem] font-semibold text-gray-800">{sp.full_name}</div>
                      {sp.email && <div className="text-[0.72rem] text-gray-400 direction-ltr text-left">{sp.email}</div>}
                    </div>
                    {sponsorId === sp.id && <span className="text-emerald-600 font-extrabold"><Check size={16} /></span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'new' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-[0.8rem] font-semibold text-gray-700 mb-1">اسم الكافل <span className="text-red-600">*</span></label>
                <Input className="focus:border-emerald-600 focus:ring-emerald-600/10" placeholder="الاسم الكامل" value={newSponsor.fullName} onChange={e => setNewSponsor(p => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[0.8rem] font-semibold text-gray-700 mb-1">رقم الهاتف</label>
                <Input className="direction-ltr text-left focus:border-emerald-600 focus:ring-emerald-600/10" placeholder="+967700000000" value={newSponsor.phone} onChange={e => setNewSponsor(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[0.8rem] font-semibold text-gray-700 mb-1">البريد الإلكتروني</label>
                <Input className="direction-ltr text-left focus:border-emerald-600 focus:ring-emerald-600/10" placeholder="email@example.com" value={newSponsor.email} onChange={e => setNewSponsor(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-[0.8rem] font-semibold text-gray-700 mb-1">كلمة مرور البوابة <span className="text-red-600">*</span></label>
                <Input type="password" className="direction-ltr text-left focus:border-emerald-600 focus:ring-emerald-600/10" placeholder="8 أحرف على الأقل" value={newSponsor.portalPassword} onChange={e => setNewSponsor(p => ({ ...p, portalPassword: e.target.value }))} />
                <p className="text-[0.72rem] text-gray-400 m-0 mt-1">ستُرسَل للكافل للدخول عبر البوابة</p>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="text-[0.72rem] font-bold text-gray-400 text-center py-1 border-y border-y-[#f0f4f8]">تفاصيل الكفالة</div>

          {/* Shared fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[0.8rem] font-semibold text-gray-700 mb-1">تاريخ البداية <span className="text-red-600">*</span></label>
              <Input type="date" className="direction-ltr text-left focus:border-emerald-600 focus:ring-emerald-600/10" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-[0.8rem] font-semibold text-gray-700 mb-1">المبلغ الشهري (ر.ي) <span className="text-red-600">*</span></label>
              <Input type="number" min="1" className="direction-ltr text-left focus:border-emerald-600 focus:ring-emerald-600/10" placeholder="30000" value={monthlyAmount} onChange={e => setMonthlyAmount(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-[0.8rem] font-semibold text-gray-700 mb-1">الوسيط <span className="text-[0.72rem] text-gray-400 font-normal">(اختياري)</span></label>
              <Input className="focus:border-emerald-600 focus:ring-emerald-600/10" placeholder="اسم الوسيط أو الجهة المسهِّلة" value={intermediary} onChange={e => setIntermediary(e.target.value)} />
            </div>
          </div>

          {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg py-2.5 px-3.5 text-[0.82rem] color-red-700 font-medium"><AlertTriangle size={18} /> {error}</div>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 py-4 px-6 border-t border-t-[#f0f4f8]">
          <Button variant="secondary" onClick={onClose} disabled={loading}>إلغاء</Button>
          <button className={`inline-flex items-center gap-1.5 py-2.5 px-6 font-sans text-[0.9rem] font-bold border-none rounded-xl transition-all ${loading ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white cursor-pointer shadow-[0_2px_8px_rgba(5,150,105,0.3)] hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(5,150,105,0.4)]'}`} onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <><Spinner size="sm" />جارٍ التعيين…</>
            ) : (
              <>تعيين الكافل <Check size={16} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FamilyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const id = params?.id;

  const [family, setFamily] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transferOpen, setTransfer] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const isGM = user?.role === 'gm';

  const fetchFamily = () => {
    setLoading(true);
    api.get(`/families/${id}`)
      .then(({ data }) => {
        setFamily(data.family);
        setDocuments(data.documents || []);
      })
      .catch(() => setError('تعذّر تحميل بيانات الأسرة'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (id) fetchFamily();
  }, [id]);

  const handleTransferSuccess = () => {
    setSuccessMsg('تم نقل الكفالة بنجاح');
    fetchFamily();
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleAssignSuccess = () => {
    setSuccessMsg('تم تعيين الكافل بنجاح ✓');
    fetchFamily();
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleDelete = async () => {
    if (!isGM) return; // Client-side security check
    setDeleting(true);
    try {
      await api.delete(`/families/${id}`);
      router.push('/families');
    } catch (err) {
      setError(err.response?.data?.error || 'تعذّر حذف الأسرة');
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const statusInfo = STATUS_CONFIG[family?.status] || STATUS_CONFIG.inactive;

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('ar-YE', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  return (
    <AppShell>
      <div className="max-w-[1040px] mx-auto pb-12 font-sans flex flex-col" dir="rtl">

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 text-[0.82rem]">
            <button className="flex items-center gap-1 bg-transparent border-none text-[#1B5E8C] font-sans text-[0.82rem] font-semibold py-1 px-2 rounded-md cursor-pointer transition-colors hover:bg-blue-50" onClick={() => router.back()}>
              <IconBack /> رجوع
            </button>
            <span className="text-gray-300">/</span>
            <Link href="/families" className="text-[#1B5E8C] no-underline font-semibold hover:underline">الأسر</Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-500">تفاصيل الأسرة</span>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            {/* Transfer button — rightmost (GM only, under sponsorship) */}
            {isGM && family?.status === 'under_sponsorship' && (
              <button className="inline-flex items-center gap-2 py-2.5 px-5 bg-gradient-to-br from-[#1B5E8C] to-[#134569] text-white border-none rounded-xl font-sans text-[0.875rem] font-bold cursor-pointer shadow-[0_2px_8px_rgba(27,94,140,0.25)] transition-all hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(27,94,140,0.35)]" onClick={() => setTransfer(true)}>
                <IconTransfer /> نقل الكفالة
              </button>
            )}
            {isGM && family?.status === 'under_marketing' && !family?.sponsor_name && (
              <button className="inline-flex items-center gap-[0.45rem] py-2.5 px-5 bg-teal-700 text-white border-none rounded-xl font-sans text-[0.875rem] font-extrabold cursor-pointer shadow-[0_2px_8px_rgba(15,118,110,0.22)] transition-all hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(15,118,110,0.32)] disabled:opacity-65 disabled:cursor-not-allowed" onClick={() => setShareOpen(true)}>
                <Share2 size={16} /> مشاركة
              </button>
            )}

            {/* Edit + Delete grouped on the left */}
            <div className="mr-auto flex gap-2">
              {family && (isGM || (user?.role === 'agent' && (family.status === 'under_review' || family.status === 'rejected'))) && (
                <button className="inline-flex items-center gap-1.5 py-2.5 px-4 bg-white text-amber-600 border-[1.5px] border-amber-600 rounded-xl font-sans text-[0.875rem] font-bold cursor-pointer transition-all hover:bg-amber-50 hover:-translate-y-[1px]" onClick={() => router.push(`/families/${id}/edit`)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  تعديل
                </button>
              )}

              {isGM && family && (
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
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 py-3 px-4 rounded-xl text-[0.875rem] font-semibold mb-4 flex items-center gap-2 animate-[slideDown_0.2s_ease]" role="status">
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 py-3 px-4 rounded-xl text-[0.875rem] mb-4 flex items-center gap-2" role="alert"><AlertTriangle size={18} /> {error}</div>
        )}

        {loading ? (
          <PageSkeleton />
        ) : family ? (
          <>
            {/* ── Hero banner ─────────────────────────────────────── */}
            <div className="bg-gradient-to-br from-[#0d3d5c] via-[#1B5E8C] to-[#1e6fa3] rounded-2xl py-7 px-8 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-5 shadow-[0_4px_20px_rgba(13,61,92,0.3)]">
              <div className="flex items-center gap-5">
                <div className="relative w-[4.5rem] h-[4.5rem] rounded-full bg-white/20 backdrop-blur-md border-[2.5px] border-white/35 text-white text-[1.6rem] font-extrabold flex items-center justify-center shrink-0">
                  {family.family_name?.[0] || '؟'}
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-[1.35rem] font-extrabold text-white m-0 drop-shadow-sm">{family.family_name}</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-bold backdrop-blur-sm"
                      style={{ color: statusInfo.color, background: statusInfo.bg, border: `1px solid ${statusInfo.color}30` }}
                    >
                      <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: statusInfo.color }} />
                      {statusInfo.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 flex-wrap justify-start md:justify-end">
                {[
                  { icon: <IconUsers />, label: 'عدد الأفراد', value: family.member_count ? `${family.member_count} أفراد` : '—' },
                  { icon: <IconUser />, label: 'المعيل', value: family.head_of_family || '—' },
                  { icon: <IconMapPin />, label: 'المحافظة', value: family.governorate_ar || '—' },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl py-2 px-3.5 backdrop-blur-sm min-w-[80px] md:min-w-[100px]">
                    <span className="text-white/70 flex shrink-0">{s.icon}</span>
                    <div>
                      <p className="text-[0.62rem] text-white/60 m-0 font-medium">{s.label}</p>
                      <p className="text-[0.82rem] text-white m-0 font-bold">{s.value}</p>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <InfoRow label="رب الأسرة / المعيل" value={family.head_of_family} />
                    <InfoRow label="المندوب" value={family.agent_name} />
                    <InfoRow label="عدد الأفراد" value={family.member_count ? `${family.member_count} أفراد` : '—'} />
                    <InfoRow label="تاريخ التسجيل" value={formatDate(family.created_at)} />
                    <InfoRow label="المحافظة" value={family.governorate_ar} />
                  </div>

                  {family.notes && (
                    <div className="mt-4 bg-gray-50 rounded-[0.625rem] p-3">
                      <span className="text-[0.72rem] text-gray-400 font-semibold block mb-1">ملاحظات</span>
                      <p className="text-[0.85rem] text-gray-700 m-0 leading-relaxed">{family.notes}</p>
                    </div>
                  )}
                </Section>

                {/* Documents */}
                {documents.length > 0 && (
                  <Section title="المستندات المرفقة">
                    <div className="flex flex-col gap-1.5">
                      {documents.map((doc) => (
                        <button
                          type="button"
                          key={doc.id}
                          onClick={() => openDocument(doc)}
                          className="w-full text-start cursor-pointer flex items-center gap-3 py-2.5 px-3.5 border border-gray-200 rounded-[0.625rem] no-underline transition-all bg-gray-50 hover:border-[#1B5E8C] hover:bg-blue-50"
                        >
                          <span className="text-gray-500 flex shrink-0"><IconDoc /></span>
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <span className="text-[0.82rem] font-semibold text-gray-800 overflow-hidden text-ellipsis whitespace-nowrap">{doc.original_name || doc.doc_type}</span>
                            <span
                              className="inline-block py-[0.15rem] px-2 rounded-full text-[0.68rem] font-bold w-fit"
                              style={{
                                color: (DOC_TYPE_CONFIG[doc.doc_type] || DOC_TYPE_CONFIG.other).color,
                                background: (DOC_TYPE_CONFIG[doc.doc_type] || DOC_TYPE_CONFIG.other).bg,
                              }}
                            >
                              {(DOC_TYPE_CONFIG[doc.doc_type] || DOC_TYPE_CONFIG.other).label}
                            </span>
                          </div>
                          <span className="text-[0.72rem] text-gray-400 shrink-0">{formatDate(doc.uploaded_at)}</span>
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
                  <div
                    className="flex items-center justify-center gap-2.5 p-4 rounded-xl border-2 text-[0.95rem] font-extrabold mb-3.5 tracking-wide"
                    style={{ borderColor: statusInfo.color, background: statusInfo.bg }}
                  >
                    <span className="w-[10px] h-[10px] rounded-full shrink-0 animate-[pulse_2s_infinite]" style={{ background: statusInfo.color }} />
                    <span style={{ color: statusInfo.color, fontWeight: 700 }}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {family.sponsor_name ? (
                    <>
                      <div className="flex items-center gap-3.5 bg-gradient-to-br from-[#0d3d5c] to-[#1B5E8C] rounded-[0.875rem] py-4 px-4 mb-4">
                        <div className="w-11 h-11 rounded-full bg-white/20 border-2 border-white/35 text-white text-[1.05rem] font-extrabold flex items-center justify-center shrink-0">
                          {family.sponsor_name[0]}
                        </div>
                        <div>
                          <p className="text-[0.95rem] font-extrabold text-white m-0">{family.sponsor_name}</p>
                          <p className="text-[0.7rem] text-white/65 m-0 mt-0.5">الكافل الحالي</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2.5">
                        <InfoRow label="تاريخ بداية الكفالة" value={formatDate(family.sponsorship_start)} />
                        <InfoRow
                          label="المبلغ الشهري"
                          value={
                            family.monthly_amount
                              ? `${parseFloat(family.monthly_amount).toLocaleString('ar-YE')} ريال`
                              : '—'
                          }
                        />
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      icon={<Handshake size={40} strokeWidth={1.5} />}
                      description="لا يوجد كافل مُعيَّن بعد"
                      action={family.status === 'under_marketing' && isGM && (
                        <Button variant="primary" onClick={() => setAssignOpen(true)}>
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
            icon={<span className="text-[2.5rem]"><Search size={16} /></span>}
            description="لم يُعثر على الأسرة"
            action={<button onClick={() => router.back()} className="text-[#1B5E8C] bg-transparent border-[1.5px] border-[#1B5E8C] rounded-[0.625rem] py-2 px-5 font-sans font-semibold cursor-pointer text-[0.875rem] transition-colors hover:bg-blue-50">رجوع</button>}
            className="py-16 gap-3"
          />
        )}
      </div>

      {/* ── Delete Confirm Modal ────────────────────────────────────── */}
      <Modal open={deleteConfirm} onClose={() => !deleting && setDeleteConfirm(false)} className="py-8 px-7 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
        <div className="flex justify-center mb-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </div>
        <h3 className="text-[1.15rem] font-extrabold text-[#0d3d5c] text-center m-0 mb-3">تأكيد الحذف</h3>
        <p className="text-[0.875rem] text-gray-500 text-center leading-relaxed m-0 mb-6">
          هل أنت متأكد من حذف أسرة <strong>{family?.family_name}</strong>؟ لا يمكن التراجع عن هذا الإجراء.
        </p>
        <div className="flex gap-3 justify-center">
          <button className="py-2.5 px-6 bg-transparent border-[1.5px] border-gray-300 rounded-xl text-gray-700 font-sans text-[0.875rem] font-semibold cursor-pointer transition-all hover:border-gray-400 hover:bg-gray-50" onClick={() => setDeleteConfirm(false)} disabled={deleting}>
            إلغاء
          </button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'جارٍ الحذف…' : 'نعم، احذف'}
          </Button>
        </div>
      </Modal>

      {/* ── Transfer Modal ──────────────────────────────────────────── */}
      {family && (
        <TransferSponsorModal
          isOpen={transferOpen}
          onClose={() => setTransfer(false)}
          onSuccess={handleTransferSuccess}
          beneficiaryType="family"
          beneficiaryId={family.id}
          beneficiaryName={family.family_name}
          currentSponsor={family.sponsor_name}
          agentId={family.agent_id}
        />
      )}

      {/* ── Assign Sponsor Modal ─────────────────────────────────────── */}
      {family && (
        <AssignSponsorModal
          isOpen={assignOpen}
          onClose={() => setAssignOpen(false)}
          onSuccess={handleAssignSuccess}
          familyName={family.family_name}
          familyId={family.id}
          agentId={family.agent_id}
        />
      )}

      {family && (
        <ShareAdModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          onSuccess={() => router.push('/announcements')}
          endpoint={`/families/${id}/share`}
          title="مشاركة الأسرة مع الكفلاء"
          subtitle={family.family_name}
        />
      )}
    </AppShell>
  );
}
