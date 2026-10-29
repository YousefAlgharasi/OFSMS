'use client';

/**
 * page.jsx
 * Route:  /marketing-pool  (GM only)
 *
 * Shows all orphans + families with status = under_marketing.
 * Clicking a row navigates to the profile where a GM can assign a sponsor.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, X, Download,
  Filter, Star, RefreshCw, Users,
} from 'lucide-react';
import SearchField from '@/components/ui/SearchField';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonTableRow } from '@/components/ui/Skeleton';
import StatPill from '@/components/ui/StatPill';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/ui/PageHeader';

// ── Shared styles ─────────────────────────────────────────────────────────────

import api from '../../lib/api';
import AppShell from '../../components/AppShell';
import useAuthStore from '../../store/useAuthStore';
import { saveBlobFile } from '../../lib/saveFile';
import Select from '@/components/ui/Select';

// ── Constants ─────────────────────────────────────────────────────────────────
const DATE_LOCALE = 'ar-YE';
const EXPORT_DELAY_MS = 300;
const FILENAME_UNSAFE_CHARS = /[\\/:*?"<>|]/g;

const API = {
  ORPHANS_MARKETING: '/orphans/marketing',
  FAMILIES_MARKETING: '/families/marketing',
  GOVERNORATES: '/governorates',
  PDF_REPORT: (type, id) => `/reports/${type}/${id}/pdf`,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const calcAge = (dob) => {
  if (!dob) return '—';
  return `${Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000))} سنة`;
};

const itemKey = (item) => `${item.type}:${item.id}`;

const formatDate = (dateStr) =>
  dateStr
    ? new Date(dateStr).toLocaleDateString(DATE_LOCALE, { dateStyle: 'medium' })
    : '—';

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MarketingPoolPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [items, setItems] = useState([]);
  const [governorates, setGovernorates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [govFilter, setGovFilter] = useState('');
  const [giftedFilter, setGiftedFilter] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [exporting, setExporting] = useState(false);

  // ── GM role guard ──────────────────────────────────────────────────────────
  const isGM = user?.role === 'gm';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [oRes, fRes, gRes] = await Promise.all([
        api.get(API.ORPHANS_MARKETING),
        api.get(API.FAMILIES_MARKETING),
        api.get(API.GOVERNORATES).catch(() => ({ data: { data: [] } })),
      ]);

      const orphans = (oRes.data.orphans || []).map((o) => ({
        id: o.id,
        type: 'orphan',
        name: o.full_name,
        age: calcAge(o.date_of_birth),
        governorate: o.governorate_ar || '—',
        governorateId: o.governorate_id,
        agent: o.agent_name || '—',
        agent_id: o.agent_id,
        isGifted: o.is_gifted,
        addedAt: o.created_at,
      }));

      const families = (fRes.data.families || []).map((f) => ({
        id: f.id,
        type: 'family',
        name: f.family_name,
        age: `${f.member_count || '—'} فرد`,
        governorate: f.governorate_ar || '—',
        governorateId: f.governorate_id,
        agent: f.agent_name || '—',
        agent_id: f.agent_id,
        isGifted: false,
        addedAt: f.created_at,
      }));

      setItems(
        [...orphans, ...families].sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt))
      );
      setGovernorates(gRes.data.data || []);
    } catch {
      setError('تعذّر تحميل قائمة التسويق');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = items.filter((item) => {
    const matchSearch =
      !search ||
      item.name?.includes(search) ||
      item.governorate?.includes(search) ||
      item.agent?.includes(search);
    const matchType = filterType === 'all' || item.type === filterType;
    const matchGov = !govFilter || item.governorate === govFilter;
    const matchGifted = !giftedFilter || String(item.isGifted) === giftedFilter;
    return matchSearch && matchType && matchGov && matchGifted;
  });

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((item) => selectedItems.includes(itemKey(item)));

  const hasActiveFilters = search || filterType !== 'all' || govFilter || giftedFilter;

  const clearFilters = () => {
    setSearch('');
    setFilterType('all');
    setGovFilter('');
    setGiftedFilter('');
  };

  // ── Selection ──────────────────────────────────────────────────────────────
  const toggleItem = (item) => {
    const key = itemKey(item);
    setSelectedItems((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    );
  };

  const toggleFilteredItems = () => {
    if (allFilteredSelected) {
      setSelectedItems((current) =>
        current.filter((key) => !filtered.some((item) => itemKey(item) === key))
      );
      return;
    }
    setSelectedItems((current) =>
      Array.from(new Set([...current, ...filtered.map(itemKey)]))
    );
  };

  // ── Row navigation ─────────────────────────────────────────────────────────
  const handleRowClick = (item) => {
    if (item.type === 'orphan') {
      router.push(`/orphans/${item.id}`);
    } else {
      router.push(`/families/${item.id}`);
    }
  };

  // ── PDF export ─────────────────────────────────────────────────────────────
  const downloadBlob = (blob, filename) => saveBlobFile(blob, filename);

  const exportSelected = async () => {
    if (selectedItems.length === 0) return;
    setExporting(true);
    setError('');
    try {
      for (const selectedKey of selectedItems) {
        const [type, id] = selectedKey.split(':');
        const item = items.find((i) => i.type === type && i.id === id);
        const res = await api.get(API.PDF_REPORT(type, id), { responseType: 'blob' });
        const safeName = (item?.name || id).replace(FILENAME_UNSAFE_CHARS, '-');
        await downloadBlob(res.data, `${type}-${safeName}.pdf`);
        await new Promise((resolve) => setTimeout(resolve, EXPORT_DELAY_MS));
      }
    } catch (err) {
      const failedKey = selectedItems.find((k) => {
        const [type, id] = k.split(':');
        return items.find((i) => i.type === type && i.id === id);
      });
      const failedItem = failedKey
        ? items.find((i) => itemKey(i) === failedKey)
        : null;
      setError(
        failedItem
          ? `تعذّر تصدير ملف PDF للمستفيد: ${failedItem.name}`
          : 'تعذّر تصدير ملفات PDF المحددة'
      );
    } finally {
      setExporting(false);
    }
  };

  // ── Derived counts ─────────────────────────────────────────────────────────
  const orphanCount = items.filter((i) => i.type === 'orphan').length;
  const familyCount = items.filter((i) => i.type === 'family').length;

  // ── GM guard ───────────────────────────────────────────────────────────────
  if (!isGM) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center" dir="rtl">
          <AlertTriangle size={40} className="text-amber-500" />
          <h2 className="text-xl font-bold text-gray-700">غير مصرح</h2>
          <p className="text-gray-500 text-sm">هذه الصفحة متاحة للمدير العام فقط</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-[1100px] mx-auto pb-12 flex flex-col gap-5 font-sans" dir="rtl">

        {/* ── Page header ─────────────────────────────────────────── */}
        <PageHeader
          title="مجمع التسويق"
          subtitle={loading ? 'جارٍ التحميل…' : 'جميع الحالات بانتظار كافل'}
          subtitleClassName="text-[0.82rem] text-gray-400"
          action={
            <button
              className="flex items-center justify-center w-9 h-9 border-[1.5px] border-gray-200 rounded-[0.625rem] bg-white text-gray-500 cursor-pointer transition-all hover:border-[#1B5E8C] hover:text-[#1B5E8C] hover:bg-blue-50"
              onClick={load}
              title="تحديث"
              aria-label="تحديث القائمة"
            >
              <RefreshCw size={14} />
            </button>
          }
        />

        {/* ── Stat pills ──────────────────────────────────────────── */}
        {!loading && items.length > 0 && (
          <div className="flex gap-2.5 flex-wrap">
            <StatPill label="الإجمالي" count={items.length} color="#1B5E8C" />
            <StatPill label="أيتام" count={orphanCount} color="#3B82F6" />
            <StatPill label="أسر" count={familyCount} color="#10B981" />
          </div>
        )}

        {/* ── Filters bar ─────────────────────────────────────────── */}
        <div className="flex gap-2.5 flex-wrap items-center bg-white border border-[#e5eaf0] rounded-[0.875rem] px-4 py-3.5 shadow-sm">
          {/* Search */}
          <SearchField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="ابحث بالاسم أو المحافظة أو المندوب…"
            className="flex-1 min-w-[200px]"
            inputClassName="py-[0.55rem] font-sans placeholder:text-[#c4cdd8] focus:shadow-[0_0_0_3px_rgba(27,94,140,0.1)] focus:ring-0"
          />

          {/* Type filter */}
          <div className="relative">
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 flex pointer-events-none z-[1]">
              <Filter size={15} />
            </span>
            <Select
              className="py-[0.55rem] pr-9 pl-7 border-gray-200 text-[0.82rem] text-gray-700 focus:ring-0"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              aria-label="تصفية حسب النوع"
            >
              <option value="all">الكل (أيتام + أسر)</option>
              <option value="orphan">الأيتام فقط</option>
              <option value="family">الأسر فقط</option>
            </Select>
          </div>

          {/* Governorate filter */}
          <div className="relative">
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 flex pointer-events-none z-[1]">
              <Filter size={15} />
            </span>
            <Select
              className="py-[0.55rem] pr-9 pl-7 border-gray-200 text-[0.82rem] text-gray-700 focus:ring-0"
              value={govFilter}
              onChange={(e) => setGovFilter(e.target.value)}
              aria-label="تصفية حسب المحافظة"
            >
              <option value="">جميع المحافظات</option>
              {governorates.map((g) => (
                <option key={g.id} value={g.name_ar}>{g.name_ar}</option>
              ))}
            </Select>
          </div>

          {/* Gifted filter */}
          <div className="relative">
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 flex pointer-events-none z-[1]">
              <Filter size={15} />
            </span>
            <Select
              className="py-[0.55rem] pr-9 pl-7 border-gray-200 text-[0.82rem] text-gray-700 focus:ring-0"
              value={giftedFilter}
              onChange={(e) => setGiftedFilter(e.target.value)}
              aria-label="تصفية حسب الموهبة"
            >
              <option value="">الكل (موهوب + عادي)</option>
              <option value="true">الموهوبون فقط ⭐</option>
              <option value="false">غير الموهوبين</option>
            </Select>
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              className="inline-flex items-center gap-1.5 py-2 px-3.5 bg-red-50 border border-red-200 rounded-[0.625rem] text-red-700 font-sans text-[0.78rem] font-semibold cursor-pointer whitespace-nowrap transition-colors hover:bg-red-100"
              onClick={clearFilters}
            >
              مسح الفلاتر <X size={16} />
            </button>
          )}

          {/* Export button */}
          <button
            className="inline-flex items-center gap-1.5 py-2 px-4 bg-teal-700 border border-teal-700 rounded-[0.625rem] text-white font-sans text-[0.78rem] font-extrabold cursor-pointer whitespace-nowrap transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:not(:disabled):bg-teal-800 hover:not(:disabled):-translate-y-px"
            onClick={exportSelected}
            disabled={selectedItems.length === 0 || exporting}
            title="تصدير ملف PDF منفصل لكل مستفيد محدد"
          >
            <Download size={16} />
            {exporting ? 'جارٍ التصدير…' : `تصدير PDF (${selectedItems.length})`}
          </button>
        </div>

        {/* ── Error ───────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 py-3 px-4 rounded-xl text-[0.875rem]" role="alert">
            <span className="flex items-center gap-2"><AlertTriangle size={18} /> {error}</span>
            <button
              onClick={load}
              className="bg-transparent border border-red-300 rounded-lg text-red-700 py-1 px-3 cursor-pointer font-sans text-[0.78rem] font-semibold hover:bg-red-100"
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* ── Table card ──────────────────────────────────────────── */}
        <DataTable
          columns={[
            {
              label: (
                <input
                  type="checkbox"
                  className="w-4 h-4 cursor-pointer accent-teal-700"
                  checked={allFilteredSelected}
                  disabled={filtered.length === 0}
                  onChange={toggleFilteredItems}
                  aria-label="تحديد كل المستفيدين الظاهرين"
                />
              ),
              className: 'w-[46px] text-center',
            },
            { label: 'الاسم' },
            { label: 'النوع' },
            { label: 'المحافظة' },
            { label: 'العمر / الأفراد' },
            { label: 'المندوب' },
            { label: 'تاريخ الاعتماد' },
          ]}
          minWidth="760px"
          footer={!loading && filtered.length > 0 && (
            filtered.length === items.length
              ? `${items.length} مستفيد`
              : `${filtered.length} من أصل ${items.length} مستفيد`
          )}
        >
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonTableRow key={i} widths={[80, 50, 70, 90, 60]} cellClassName="py-4 px-4 border-b border-gray-50" barClassName="h-4" />)
                ) : !error && filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7">
                      <EmptyState
                        icon={<Users size={48} strokeWidth={1.2} className="opacity-30" />}
                        heading={items.length === 0 ? 'لا يوجد مستفيدون بانتظار كافل' : 'لا توجد نتائج مطابقة'}
                        description={items.length === 0 ? 'جميع الحالات المعتمدة تم تعيين كفلاء لها' : 'جرّب تغيير الفلاتر أو مسحها'}
                        action={hasActiveFilters && (
                          <button
                            className="mt-4 py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-gray-700 font-sans text-[0.78rem] font-semibold cursor-pointer transition-colors hover:bg-gray-50 hover:border-gray-300"
                            onClick={clearFilters}
                          >
                            مسح الفلاتر
                          </button>
                        )}
                        className="py-16 px-8"
                      />
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr
                      key={itemKey(item)}
                      className="border-b border-[#f1f5f9] last:border-b-0 cursor-pointer transition-colors hover:bg-[#f8fbff] focus:outline-none focus:bg-[#f0f7ff]"
                      onClick={() => handleRowClick(item)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleRowClick(item)}
                      role="button"
                      aria-label={`عرض تفاصيل ${item.name}`}
                    >
                      {/* Checkbox */}
                      <td className="text-center py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="w-4 h-4 cursor-pointer accent-teal-700"
                          checked={selectedItems.includes(itemKey(item))}
                          onChange={() => toggleItem(item)}
                          aria-label={`تحديد ${item.name}`}
                        />
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full shrink-0 bg-gradient-to-br from-[#1B5E8C] to-[#134569] text-white text-[0.78rem] font-bold flex items-center justify-center">
                            {item.name?.[0] || '؟'}
                          </div>
                          <span className="text-[0.875rem] font-bold text-[#0d3d5c] flex items-center gap-1.5">
                            {item.name}
                            {item.isGifted && (
                              <span className="text-amber-500 inline-flex items-center shrink-0" title="موهوب">
                                <Star size={11} fill="currentColor" stroke="none" />
                              </span>
                            )}
                          </span>
                        </div>
                      </td>

                      {/* Type badge */}
                      <td className="py-3.5 px-4 align-middle">
                        <span className={`inline-flex py-[0.2rem] px-[0.65rem] rounded-full text-[0.72rem] font-bold ${
                          item.type === 'orphan'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {item.type === 'orphan' ? 'يتيم' : 'أسرة'}
                        </span>
                      </td>

                      {/* Governorate */}
                      <td className="py-3.5 px-4 align-middle text-gray-700">{item.governorate}</td>

                      {/* Age / Members */}
                      <td className="py-3.5 px-4 align-middle font-semibold text-gray-700">{item.age}</td>

                      {/* Agent */}
                      <td className="py-3.5 px-4 align-middle text-gray-500 text-[0.78rem]">{item.agent}</td>

                      {/* Date */}
                      <td className="py-3.5 px-4 align-middle text-gray-400 text-[0.75rem] whitespace-nowrap">
                        {formatDate(item.addedAt)}
                      </td>
                    </tr>
                  ))
                )}
        </DataTable>
      </div>
    </AppShell>
  );
}
