'use client';

/**
 * page.jsx
 * Route:  /my-orphans  (Agent only)
 * Task:   feature/ui-agent-my-orphans
 *
 * Shows the agent's registered orphans and families (two tabs) in a
 * searchable, filterable table. Clicking a row opens a slide-in detail drawer.
 * Links to /orphans/new and /families/new for registration.
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, X, User, CheckCircle2, FileText } from 'lucide-react';
import SearchField from '@/components/ui/SearchField';
import EmptyState from '@/components/ui/EmptyState';
import DetailDrawer from '@/components/ui/DetailDrawer';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/ui/PageHeader';

import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import Button from '@/components/ui/Button';
import StatusBadge, { STATUS_MAP } from '@/components/ui/StatusBadge';

const GENDER_MAP = { male: 'ذكر', female: 'أنثى' };

const RELATION_MAP = {
  uncle:          'عم',
  maternal_uncle: 'خال',
  grandfather:    'جد',
  sibling:        'أخ / أخت',
  other:          'أخرى',
};

const ALL_STATUSES = Object.keys(STATUS_MAP);

// ── Helpers ────────────────────────────────────────────────────────────────────

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

const calcAge = (dob) => {
  if (!dob) return '—';
  const diff = Date.now() - new Date(dob).getTime();
  return `${Math.floor(diff / MS_PER_YEAR)} سنة`;
};

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ar-YE', { dateStyle: 'medium' });
};


function InfoRow({ label, value, highlight }) {
  return (
    <div className="flex justify-between items-start gap-3 py-1.5 border-b border-slate-50 min-w-0">
      <span className="text-[0.8rem] text-slate-500 font-medium min-w-0">{label}</span>
      <span className={`text-[0.83rem] min-w-0 overflow-wrap-anywhere break-all text-left ${highlight ? 'text-emerald-500 font-bold' : 'text-gray-800 font-semibold'}`}>{value}</span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MyOrphansPage() {
  const router = useRouter();

  const [tab,       setTab]       = useState('orphans'); // 'orphans' | 'families'
  const [families,  setFamilies]  = useState([]);
  const [famLoading, setFamLoading] = useState(true);
  const [famError,  setFamError]  = useState('');
  const [selectedFam, setSelectedFam] = useState(null);
  const [famDetail, setFamDetail] = useState(null);
  const [orphans,   setOrphans]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [selected,  setSelected]  = useState(null); // orphan for drawer
  const [search,    setSearch]    = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [docs,      setDocs]      = useState([]);
  const [docsLoading, setDL]      = useState(true);

  // Fetch orphan documents when selection changes
  useEffect(() => {
    if (!selected) return;
    setDL(true);
    api.get(`/orphans/${selected.id}`)
      .then(({ data }) => setDocs(data.documents || []))
      .catch(() => setDocs([]))
      .finally(() => setDL(false));
  }, [selected?.id]);

  // Fetch families registered by this agent
  useEffect(() => {
    api.get('/families')
      .then(({ data }) => setFamilies(data.families || []))
      .catch((err) => {
        console.error('Failed to fetch assigned families:', err);
        setFamError('تعذّر تحميل الأسر. يرجى تحديث الصفحة.');
      })
      .finally(() => setFamLoading(false));
  }, []);

  // Fetch the selected family's full record (sponsor info)
  useEffect(() => {
    if (!selectedFam) { setFamDetail(null); return; }
    api.get(`/families/${selectedFam.id}`)
      .then(({ data }) => setFamDetail(data.family || data))
      .catch(() => setFamDetail(null));
  }, [selectedFam?.id]);

  // Fetch orphans
  useEffect(() => {
    async function fetchOrphans() {
      setLoading(true);
      try {
        const { data } = await api.get('/orphans');
        setOrphans(data.orphans || []);
      } catch (err) {
        console.error('Failed to fetch assigned orphans:', err);
        setError('تعذّر تحميل البيانات. يرجى تحديث الصفحة.');
      } finally {
        setLoading(false);
      }
    }
    fetchOrphans();
  }, []);

  // Filter + search
  const filtered = orphans.filter((o) => {
    const matchSearch = !search ||
      o.full_name?.includes(search) ||
      o.governorate_ar?.includes(search) ||
      o.guardian_name?.includes(search);
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const filteredFamilies = families.filter((f) => {
    const matchSearch = !search ||
      f.family_name?.includes(search) ||
      f.head_of_family?.includes(search) ||
      f.governorate_ar?.includes(search);
    const matchStatus = filterStatus === 'all' || f.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const isOrphans = tab === 'orphans';
  const activeList     = isOrphans ? orphans : families;
  const activeFiltered = isOrphans ? filtered : filteredFamilies;
  const activeLoading  = isOrphans ? loading : famLoading;
  const activeError    = isOrphans ? error : famError;

  // Status counts for filter tabs (of the active tab)
  const counts = activeList.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const switchTab = (t) => {
    setTab(t);
    setFilterStatus('all');
    setSearch('');
  };

  return (
    <AppShell>
      <div className="max-w-[1100px] mx-auto pb-16 font-sans px-4 md:px-0" dir="rtl">

        {/* Page header */}
        <PageHeader
          title="أيتامي وأسري"
          subtitle={(loading || famLoading) ? 'جارٍ التحميل…' : `${orphans.length} يتيم · ${families.length} أسرة`}
          className="flex-col md:flex-row mb-6"
          action={
            isOrphans ? (
              <Button variant="primary" onClick={() => router.push('/orphans/new')}>
                + تسجيل يتيم جديد
              </Button>
            ) : (
              <Button variant="primary" onClick={() => router.push('/families/new')}>
                + تسجيل أسرة جديدة
              </Button>
            )
          }
        />

        {/* Orphans / Families tabs */}
        <div className="flex gap-2 mb-5 border-b border-[#e5eaf0]" role="tablist">
          {[
            { key: 'orphans',  label: 'الأيتام', count: orphans.length },
            { key: 'families', label: 'الأسر',   count: families.length },
          ].map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => switchTab(t.key)}
              className={`px-5 py-2.5 text-[0.9rem] font-bold border-b-[3px] -mb-px bg-transparent cursor-pointer transition-colors duration-150 ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-primary'}`}
            >
              {t.label}
              <span className="mr-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[0.72rem] font-bold bg-gray-100 text-gray-500">{t.count}</span>
            </button>
          ))}
        </div>

        {/* Search + filter bar */}
        <div className="flex flex-col gap-3 mb-5">
          <SearchField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder={isOrphans ? 'ابحث بالاسم أو المحافظة أو الوصي…' : 'ابحث باسم الأسرة أو المعيل أو المحافظة…'}
            inputClassName="rounded-[0.75rem] border-gray-300 pl-10 pr-9.5 text-[0.88rem] focus:ring-4 focus:ring-primary/10"
          />

          {/* Status filter tabs */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 border-[1.5px] rounded-full text-[0.78rem] font-semibold cursor-pointer transition-all duration-150 hover:border-primary hover:text-primary ${filterStatus === 'all' ? 'border-primary bg-primary text-white' : 'border-[#e5eaf0] text-gray-500 bg-white'}`}
              onClick={() => setFilterStatus('all')}
            >
              الكل <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[0.7rem] font-bold ${filterStatus === 'all' ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'}`}>{activeList.length}</span>
            </button>
            {ALL_STATUSES.map((s) => counts[s] ? (
              <button
                key={s}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 border-[1.5px] rounded-full text-[0.78rem] font-semibold cursor-pointer transition-all duration-150 hover:border-primary hover:text-primary ${filterStatus === s ? 'border-primary bg-primary text-white' : 'border-[#e5eaf0] text-gray-500 bg-white'}`}
                onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
              >
                {STATUS_MAP[s].label}
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[0.7rem] font-bold ${filterStatus === s ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'}`}>{counts[s]}</span>
              </button>
            ) : null)}
          </div>
        </div>

        {/* Error state */}
        {activeError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-[0.75rem] px-4 py-3.5 text-[0.85rem] text-red-700 font-medium mb-4">
            <span><AlertTriangle size={18} /></span> {activeError}
          </div>
        )}

        {/* Loading skeleton */}
        {activeLoading && (
          <div className="flex flex-col gap-2">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="flex gap-4 px-5 py-4 bg-white border border-[#e5eaf0] rounded-[0.75rem] items-center">
                <div className="animate-shimmer bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] rounded-[0.375rem] w-40 h-4" />
                <div className="animate-shimmer bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] rounded-[0.375rem] w-20 h-3.5" />
                <div className="animate-shimmer bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] rounded-full w-[90px] h-6" />
                <div className="animate-shimmer bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] rounded-[0.375rem] w-[100px] h-3.5 mr-auto" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!activeLoading && !activeError && activeFiltered.length === 0 && (
          <EmptyState
            icon={<div className="text-[3.5rem] text-gray-300"><User size={18} /></div>}
            heading={search || filterStatus !== 'all' ? 'لا توجد نتائج مطابقة' : (isOrphans ? 'لا يوجد أيتام مسجّلون بعد' : 'لا توجد أسر مسجّلة بعد')}
            description={search || filterStatus !== 'all' ? 'جرّب تغيير معايير البحث أو الفلتر' : (isOrphans ? 'ابدأ بتسجيل يتيم جديد' : 'ابدأ بتسجيل أسرة جديدة')}
            action={!search && filterStatus === 'all' && (
              <Button variant="primary" onClick={() => router.push(isOrphans ? '/orphans/new' : '/families/new')}>
                {isOrphans ? '+ تسجيل يتيم جديد' : '+ تسجيل أسرة جديدة'}
              </Button>
            )}
            className="min-h-[320px]"
          />
        )}

        {/* Orphans table */}
        {isOrphans && !loading && filtered.length > 0 && (
          <DataTable
            columns={[
              { label: 'الاسم الكامل' },
              { label: 'المحافظة' },
              { label: 'العمر', className: 'hidden md:table-cell' },
              { label: 'الجنس', className: 'hidden md:table-cell' },
              { label: 'الحالة' },
              { label: 'تاريخ التسجيل', className: 'hidden md:table-cell' },
              { label: '' },
            ]}
            className="rounded-[1rem]"
            footer={`عرض ${filtered.length} من ${orphans.length} يتيم`}
          >
                {filtered.map((o) => (
                  <tr
                    key={o.id}
                    className="cursor-pointer transition-colors duration-120 hover:bg-[#f8fbff] focus:outline focus:outline-2 focus:outline-primary focus:-outline-offset-2"
                    onClick={() => setSelected(o)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setSelected(o)}
                    aria-label={`عرض تفاصيل ${o.full_name}`}
                  >
                    <td className="px-5 py-3.5 text-[0.85rem] border-b border-slate-50 align-middle">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800">{o.full_name}</span>
                        {o.is_gifted && (
                          <span className="inline-block text-[0.68rem] font-semibold text-amber-500 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">🌟 موهوب</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[0.85rem] border-b border-slate-50 align-middle text-slate-500">{o.governorate_ar || '—'}</td>
                    <td className="hidden md:table-cell px-5 py-3.5 text-[0.85rem] border-b border-slate-50 align-middle text-slate-500">{calcAge(o.date_of_birth)}</td>
                    <td className="hidden md:table-cell px-5 py-3.5 text-[0.85rem] border-b border-slate-50 align-middle text-slate-500">{GENDER_MAP[o.gender] || '—'}</td>
                    <td className="px-5 py-3.5 text-[0.85rem] border-b border-slate-50 align-middle"><StatusBadge status={o.status} /></td>
                    <td className="hidden md:table-cell px-5 py-3.5 text-[0.85rem] border-b border-slate-50 align-middle text-slate-500">{formatDate(o.created_at)}</td>
                    <td className="px-5 py-3.5 text-[0.85rem] border-b border-slate-50 align-middle">
                      <button className="bg-transparent border-[1.5px] border-[#e5eaf0] rounded-[0.5rem] px-3 py-1 text-[0.78rem] font-semibold text-primary cursor-pointer transition-all duration-150 hover:bg-[#f0f7ff] hover:border-primary whitespace-nowrap" onClick={(e) => { e.stopPropagation(); setSelected(o); }}>
                        عرض ←
                      </button>
                    </td>
                  </tr>
                ))}
          </DataTable>
        )}

        {/* Families table */}
        {!isOrphans && !famLoading && filteredFamilies.length > 0 && (
          <DataTable
            columns={[
              { label: 'اسم الأسرة' },
              { label: 'المعيل', className: 'hidden md:table-cell' },
              { label: 'عدد الأفراد', className: 'hidden md:table-cell' },
              { label: 'المحافظة' },
              { label: 'الحالة' },
              { label: 'تاريخ التسجيل', className: 'hidden md:table-cell' },
              { label: '' },
            ]}
            className="rounded-[1rem]"
            footer={`عرض ${filteredFamilies.length} من ${families.length} أسرة`}
          >
            {filteredFamilies.map((f) => (
              <tr
                key={f.id}
                className="cursor-pointer transition-colors duration-120 hover:bg-[#f8fbff] focus:outline focus:outline-2 focus:outline-primary focus:-outline-offset-2"
                onClick={() => setSelectedFam(f)}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedFam(f)}
                aria-label={`عرض تفاصيل ${f.family_name}`}
              >
                <td className="px-5 py-3.5 text-[0.85rem] border-b border-slate-50 align-middle font-bold text-gray-800">{f.family_name}</td>
                <td className="hidden md:table-cell px-5 py-3.5 text-[0.85rem] border-b border-slate-50 align-middle text-slate-500">{f.head_of_family || '—'}</td>
                <td className="hidden md:table-cell px-5 py-3.5 text-[0.85rem] border-b border-slate-50 align-middle text-slate-500">{f.member_count ?? '—'}</td>
                <td className="px-5 py-3.5 text-[0.85rem] border-b border-slate-50 align-middle text-slate-500">{f.governorate_ar || '—'}</td>
                <td className="px-5 py-3.5 text-[0.85rem] border-b border-slate-50 align-middle"><StatusBadge status={f.status} /></td>
                <td className="hidden md:table-cell px-5 py-3.5 text-[0.85rem] border-b border-slate-50 align-middle text-slate-500">{formatDate(f.created_at)}</td>
                <td className="px-5 py-3.5 text-[0.85rem] border-b border-slate-50 align-middle">
                  <button className="bg-transparent border-[1.5px] border-[#e5eaf0] rounded-[0.5rem] px-3 py-1 text-[0.78rem] font-semibold text-primary cursor-pointer transition-all duration-150 hover:bg-[#f0f7ff] hover:border-primary whitespace-nowrap" onClick={(e) => { e.stopPropagation(); setSelectedFam(f); }}>
                    عرض ←
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      {/* Family detail drawer */}
      {selectedFam && (
        <DetailDrawer open onClose={() => setSelectedFam(null)}>
          <div className="flex items-start justify-between gap-4 p-6 border-b border-[#f0f4f8]">
            <div>
              <h2 className="text-[1.15rem] font-extrabold text-[#0d3d5c] mb-2">{selectedFam.family_name}</h2>
              <StatusBadge status={selectedFam.status} />
            </div>
            <button className="bg-transparent border-none text-[1.1rem] text-gray-400 cursor-pointer px-1.5 py-1 rounded-[6px] transition-all duration-150 hover:bg-gray-100 hover:text-gray-700 flex-shrink-0" onClick={() => setSelectedFam(null)} aria-label="إغلاق"><X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
            <div className="info-section">
              <h3 className="text-[0.78rem] font-bold text-slate-400 uppercase tracking-[0.06em] mb-3">بيانات الأسرة</h3>
              <div className="flex flex-col gap-2">
                <InfoRow label="المعيل"         value={selectedFam.head_of_family || '—'} />
                <InfoRow label="عدد الأفراد"    value={selectedFam.member_count ?? '—'} />
                <InfoRow label="المحافظة"       value={selectedFam.governorate_ar || '—'} />
                <InfoRow label="تاريخ التسجيل" value={formatDate(selectedFam.created_at)} />
                {selectedFam.notes && <InfoRow label="ملاحظات" value={selectedFam.notes} />}
              </div>
            </div>

            {selectedFam.status === 'under_sponsorship' && famDetail && (
              <div className="info-section">
                <h3 className="text-[0.78rem] font-bold text-slate-400 uppercase tracking-[0.06em] mb-3">بيانات الكفالة</h3>
                <div className="flex flex-col gap-2">
                  <InfoRow label="اسم الكافل"    value={famDetail.sponsor_name || '—'} />
                  <InfoRow label="المبلغ الشهري" value={famDetail.monthly_amount ? `${Number(famDetail.monthly_amount).toLocaleString('ar-YE')} ر.ي` : '—'} />
                  <InfoRow label="تاريخ البداية" value={formatDate(famDetail.sponsorship_start)} />
                </div>
              </div>
            )}

            {selectedFam.status === 'rejected' && selectedFam.notes && (
              <div className="flex gap-3 bg-red-50 border border-red-200 rounded-[0.75rem] p-4">
                <span className="text-[1.1rem] flex-shrink-0 text-red-600"><AlertTriangle size={18} /></span>
                <div>
                  <strong className="block text-[0.85rem] font-bold text-red-700 mb-1">سبب الرفض</strong>
                  <p className="text-[0.82rem] text-red-600 m-0 leading-relaxed">{selectedFam.notes}</p>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-[#f0f4f8] flex gap-3 justify-end">
            <Button variant="outline" className="rounded-[0.625rem] text-[0.82rem]" onClick={() => setSelectedFam(null)}>إغلاق</Button>
          </div>
        </DetailDrawer>
      )}

      {/* Orphan detail drawer */}
      {selected && (
        <DetailDrawer open onClose={() => setSelected(null)}>
          {/* Header */}
          <div className="flex items-start justify-between gap-4 p-6 border-b border-[#f0f4f8]">
            <div>
              <h2 className="text-[1.15rem] font-extrabold text-[#0d3d5c] mb-2">{selected.full_name}</h2>
              <StatusBadge status={selected.status} />
            </div>
            <button className="bg-transparent border-none text-[1.1rem] text-gray-400 cursor-pointer px-1.5 py-1 rounded-[6px] transition-all duration-150 hover:bg-gray-100 hover:text-gray-700 flex-shrink-0" onClick={() => setSelected(null)} aria-label="إغلاق"><X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

            {/* Info grid */}
            <div className="info-section">
              <h3 className="text-[0.78rem] font-bold text-slate-400 uppercase tracking-[0.06em] mb-3">البيانات الأساسية</h3>
              <div className="flex flex-col gap-2">
                <InfoRow label="العمر"          value={calcAge(selected.date_of_birth)} />
                <InfoRow label="تاريخ الميلاد"  value={formatDate(selected.date_of_birth)} />
                <InfoRow label="الجنس"          value={GENDER_MAP[selected.gender] || '—'} />
                <InfoRow label="المحافظة"       value={selected.governorate_ar || '—'} />
                <InfoRow label="اسم الوصي"     value={selected.guardian_name || '—'} />
                <InfoRow label="صلة الوصي"     value={RELATION_MAP[selected.guardian_relation] || '—'} />
                <InfoRow label="تاريخ التسجيل" value={formatDate(selected.created_at)} />
                {selected.is_gifted && <InfoRow label="موهوب" value={<span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} /> نعم</span>} highlight />}
              </div>
            </div>

            {/* Sponsorship info */}
            {selected.status === 'under_sponsorship' && (
              <div className="info-section">
                <h3 className="text-[0.78rem] font-bold text-slate-400 uppercase tracking-[0.06em] mb-3">بيانات الكفالة</h3>
                <div className="flex flex-col gap-2">
                  <InfoRow label="اسم الكافل"    value={selected.sponsor_name || '—'} />
                  <InfoRow label="المبلغ الشهري" value={selected.monthly_amount ? `${selected.monthly_amount.toLocaleString('ar-YE')} ر.ي` : '—'} />
                  <InfoRow label="تاريخ البداية" value={formatDate(selected.sponsorship_start)} />
                </div>
              </div>
            )}

            {/* Rejection notes */}
            {selected.status === 'rejected' && selected.notes && (
              <div className="flex gap-3 bg-red-50 border border-red-200 rounded-[0.75rem] p-4">
                <span className="text-[1.1rem] flex-shrink-0 text-red-600"><AlertTriangle size={18} /></span>
                <div>
                  <strong className="block text-[0.85rem] font-bold text-red-700 mb-1">سبب الرفض</strong>
                  <p className="text-[0.82rem] text-red-600 m-0 leading-relaxed">{selected.notes}</p>
                </div>
              </div>
            )}

            {/* Documents */}
            <div className="info-section">
              <h3 className="text-[0.78rem] font-bold text-slate-400 uppercase tracking-[0.06em] mb-3">المستندات المرفوعة</h3>
              {docsLoading ? (
                <p className="text-[0.83rem] text-slate-400 m-0">جارٍ التحميل…</p>
              ) : docs.length === 0 ? (
                <p className="text-[0.83rem] text-slate-400 m-0">لا توجد مستندات مرفوعة</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {docs.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 border border-[#e5eaf0] rounded-[0.5rem] text-[0.78rem]">
                      <span><FileText size={16} /></span>
                      <span className="flex-1 text-gray-700 font-medium overflow-hidden text-ellipsis whitespace-nowrap [direction:ltr] text-left">{d.original_name || d.doc_type}</span>
                      <span className="text-slate-400 flex-shrink-0">{formatDate(d.uploaded_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-[#f0f4f8] flex gap-3 justify-end">
            {selected.status === 'rejected' && (
              <a href={`/orphans/${selected.id}/edit`} className="inline-flex items-center px-4 py-2 bg-gradient-to-br from-[#1B5E8C] to-[#134569] text-white text-[.82rem] font-bold rounded-lg no-underline hover:from-[#2E7EB8] hover:to-[#1B5E8C] transition-all">
                تعديل وإعادة الإرسال
              </a>
            )}
            <Button variant="outline" className="rounded-[0.625rem] text-[0.82rem]" onClick={() => setSelected(null)}>إغلاق</Button>
          </div>
        </DetailDrawer>
      )}
    </AppShell>
  );
}
