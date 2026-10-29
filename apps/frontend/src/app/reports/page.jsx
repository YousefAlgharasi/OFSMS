'use client';

/**
 * Route: /reports  (GM + Supervisor + Finance)
 *
 * Tabs:
 *   1. كشوف الصرف  — select one or more → export PDF / Excel
 *   2. المحافظات   — select one → export orphan list PDF / Excel
 *
 * All styles are inline JS objects to avoid styled-jsx cross-component issues.
 * Fully responsive (stacks on mobile).
 */

import { useEffect, useState } from 'react';
import { Search, X, CheckCircle2, FileText, Check, Wallet, MapPin, FileSpreadsheet, Lightbulb } from 'lucide-react';
import SearchField from '@/components/ui/SearchField';
import { SkeletonRows } from '@/components/ui/Skeleton';

import api from '../../lib/api';
import { saveBlobFile } from '../../lib/saveFile';
import AppShell from '../../components/AppShell';

// ── Constants ────────────────────────────────────────────────────────────────
const EXPORT_DELAY_MS = 600;

// ── Status labels ─────────────────────────────────────────────────────────────
const DISB_STATUS = {
  draft:               { label: 'مسودة',        className: 'bg-amber-100 text-amber-800' },
  supervisor_approved: { label: 'اعتمد المشرف', className: 'bg-blue-50 text-blue-800' },
  finance_approved:    { label: 'اعتمد المالي', className: 'bg-purple-50 text-purple-800' },
  released:            { label: 'مُصدَر',        className: 'bg-emerald-50 text-emerald-800' },
  rejected:            { label: 'مرفوض',         className: 'bg-red-50 text-red-800' },
};

const ARABIC_MONTHS = [
  '', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

// ── Download helper ───────────────────────────────────────────────────────────
const readBlobError = async (err) => {
  try {
    const data = err?.response?.data;
    if (data instanceof Blob && data.type?.includes('json')) {
      const text = await data.text();
      return JSON.parse(text)?.error || null;
    }
  } catch {
    // ignore parse failures
  }
  return null;
};

const downloadFile = async (url, filename, ext) => {
  const res  = await api.get(url, { responseType: 'blob' });
  const blob = new Blob([res.data], {
    type: ext === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  await saveBlobFile(blob, `${filename}.${ext}`);
};

// ── Reusable Export Action Bar ────────────────────────────────────────────────
function ExportBar({ selectedCount, onExportPdf, onExportExcel, pdfLoading, excelLoading, label }) {
  const busy = pdfLoading || excelLoading;
  return (
    <div className={`flex items-center justify-between flex-wrap gap-3 py-3 px-[1.1rem] border-b border-[#e5eaf0] transition-colors duration-200 ${
      selectedCount > 0 ? 'bg-gradient-to-r from-[#f0f7ff] to-[#e8f4ff]' : 'bg-[#f8fafc]'
    }`}>
      <span className={`text-[0.83rem] font-bold inline-flex items-center gap-[0.3rem] ${
        selectedCount > 0 ? 'text-[#1B5E8C]' : 'text-gray-400'
      }`}>
        {selectedCount > 0
          ? <><Check size={14} /> تم تحديد {selectedCount} {label}</>
          : `اختر ${label} للتصدير`}
      </span>
      <div className="flex gap-2 items-center flex-wrap">
        {selectedCount > 1 && (
          <span className="text-[0.72rem] text-gray-400 bg-white border border-[#e5eaf0] rounded-[0.5rem] py-[0.2rem] px-[0.6rem]">
            سيتم تنزيل {selectedCount} ملفات
          </span>
        )}
        <button
          onClick={onExportExcel}
          disabled={selectedCount === 0 || busy}
          className={`inline-flex items-center gap-[0.35rem] py-2 px-4 text-[0.82rem] font-bold border-[1.5px] border-[#86efac] rounded-[0.625rem] font-cairo transition-all duration-150 ${
            selectedCount === 0
              ? 'bg-[#f9fafb] text-gray-400 cursor-not-allowed'
              : 'bg-[#f0fdf4] text-[#16a34a] cursor-pointer'
          } ${busy && !excelLoading ? 'opacity-50' : 'opacity-100'}`}
        >
          {excelLoading ? <MiniSpinner color="#16a34a" /> : <FileSpreadsheet size={15} />}
          {excelLoading ? 'جارٍ التصدير…' : 'Excel'}
        </button>
        <button
          onClick={onExportPdf}
          disabled={selectedCount === 0 || busy}
          className={`inline-flex items-center gap-[0.35rem] py-2 px-4 text-[0.82rem] font-bold border-[1.5px] border-[#fca5a5] rounded-[0.625rem] font-cairo transition-all duration-150 ${
            selectedCount === 0
              ? 'bg-[#f9fafb] text-gray-400 cursor-not-allowed'
              : 'bg-[#fef2f2] text-[#dc2626] cursor-pointer'
          } ${busy && !pdfLoading ? 'opacity-50' : 'opacity-100'}`}
        >
          {pdfLoading ? <MiniSpinner color="#dc2626" /> : <FileText size={15} />}
          {pdfLoading ? 'جارٍ التصدير…' : 'PDF'}
        </button>
      </div>
    </div>
  );
}

// ── MiniSpinner ───────────────────────────────────────────────────────────────
function MiniSpinner({ color = '#1B5E8C' }) {
  return (
    <span
      style={{ border: `2px solid ${color}30`, borderTopColor: color }}
      className="inline-block w-[13px] h-[13px] shrink-0 rounded-full animate-spin"
    />
  );
}


// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type = 'error', onClose }) {
  const isSuccess = type === 'success';
  const colorsClass = isSuccess
    ? 'bg-[#ecfdf5] border-[#6ee7b7] text-[#065f46]'
    : 'bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]';
  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[2000] border rounded-xl py-3 px-6 font-semibold text-[0.85rem] shadow-[0_4px_20px_rgba(0,0,0,0.12)] flex items-center gap-3 animate-toastIn font-cairo ${colorsClass}`}>
      {msg}
      <button
        onClick={onClose}
        className="bg-none border-none cursor-pointer font-extrabold p-0 text-base leading-none text-current hover:opacity-85"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// ── Tab: Disbursements ────────────────────────────────────────────────────────
function DisbursementsTab() {
  const [lists, setLists]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pdfLoading, setPdfLoading]     = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [toast, setToast]               = useState(null);

  useEffect(() => {
    const fetchDisbursements = async () => {
      try {
        const { data } = await api.get('/disbursements');
        setLists(data.lists || []);
      } catch (err) {
        console.error('Error fetching disbursements:', err);
        setToast({ msg: 'تعذّر تحميل كشوف الصرف', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchDisbursements();
  }, []);

  const filtered = lists.filter(l => {
    const monthName = ARABIC_MONTHS[l.month] || '';
    const matchSearch = !search ||
      monthName.includes(search) ||
      String(l.year).includes(search) ||
      (l.created_by_name || '').includes(search);
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const toggleAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) setSelected(new Set());
    else setSelected(new Set(filtered.map(l => l.id)));
  };

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedLists = lists.filter(l => selected.has(l.id));

  const doExport = async (ext, setLoading) => {
    setLoading(true);
    try {
      const apiExt = ext === 'xlsx' ? 'excel' : ext;
      for (const list of selectedLists) {
        const monthName = ARABIC_MONTHS[list.month] || list.month;
        await downloadFile(
          `/reports/disbursement/${list.id}/${apiExt}`,
          `كشف-صرف-${monthName}-${list.year}`,
          ext
        );
        if (selectedLists.length > 1) {
          await new Promise(r => setTimeout(r, EXPORT_DELAY_MS));
        }
      }
      setToast({
        msg: (
          <span className="flex items-center gap-1.5 shrink-0">
            <CheckCircle2 size={15} /> تم تصدير {selectedLists.length} ملف بنجاح
          </span>
        ),
        type: 'success',
      });
    } catch (err) {
      console.error('Error exporting disbursements:', err);
      const serverMsg = await readBlobError(err);
      const status    = err?.response?.status;
      const fallback  = status === 403
        ? 'ليس لديك صلاحية لتصدير هذا الملف'
        : status === 401
        ? 'انتهت الجلسة — يرجى تسجيل الدخول مجدداً'
        : 'فشل التصدير — يرجى المحاولة مجدداً';
      setToast({ msg: serverMsg || fallback, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Toolbar */}
      <div className="flex gap-2.5 flex-wrap items-center p-4 border-b border-[#f0f4f8]">
        <SearchField
          value={search}
          onChange={e => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="ابحث بالشهر أو السنة أو المُنشئ…"
          className="flex-1 min-w-[180px]"
          inputClassName="border-gray-300 py-2 text-[0.83rem] font-cairo bg-[#fafafa]"
        />
        <div className="flex gap-1.5 flex-wrap">
          {[{ key: 'all', label: 'الكل' }, ...Object.entries(DISB_STATUS).map(([k, v]) => ({ key: k, label: v.label }))].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`py-1.5 px-3 border-[1.5px] rounded-full text-[0.73rem] font-semibold font-cairo cursor-pointer transition-all duration-150 ${
                statusFilter === key
                  ? 'border-primary bg-primary text-white shadow-[0_2px_8px_rgba(27,94,140,0.2)]'
                  : 'border-[#e5eaf0] bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Export bar */}
      <ExportBar
        selectedCount={selected.size}
        label="كشف صرف"
        pdfLoading={pdfLoading}
        excelLoading={excelLoading}
        onExportPdf={() => doExport('pdf', setPdfLoading)}
        onExportExcel={() => doExport('xlsx', setExcelLoading)}
      />

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-collapse text-[0.82rem]">
          <thead>
            <tr className="bg-[#f8fafc] sticky top-0 z-10">
              <th className="w-11 py-3 px-4 text-center border-b-2 border-[#e5eaf0]">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary cursor-pointer"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < filtered.length; }}
                  onChange={toggleAll}
                />
              </th>
              {['الفترة', 'الحالة', 'المستفيدون', 'الإجمالي', 'أنشأه', 'تاريخ الإنشاء'].map(h => (
                <th
                  key={h}
                  className="py-3 px-4 text-right text-[0.73rem] font-bold text-[#6b7a8d] whitespace-nowrap border-b-2 border-[#e5eaf0]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows count={5} widths={[65, 72, 79, 55, 68]} cellClassName="py-3 px-4 border-b border-[#f8fafc]" barClassName="h-[14px]" />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-[#9ca3af] text-[0.85rem]">
                  <div className="flex items-center justify-center gap-1.5">
                    {lists.length === 0 ? (
                      <>
                        <FileText size={16} className="opacity-40" /> لا توجد كشوف صرف بعد
                      </>
                    ) : (
                      <>
                        <Search size={16} /> لا توجد نتائج مطابقة
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((list, idx) => {
                const cfg = DISB_STATUS[list.status] || DISB_STATUS.draft;
                const isSel = selected.has(list.id);
                return (
                  <tr
                    key={list.id}
                    onClick={() => toggle(list.id)}
                    className={`cursor-pointer transition-colors duration-100 ${
                      isSel
                        ? 'bg-[#f0f7ff]'
                        : idx % 2 === 0
                        ? 'bg-white hover:bg-[#f8fbff]'
                        : 'bg-[#fafafa] hover:bg-[#f8fbff]'
                    }`}
                  >
                    <td
                      className="text-center py-3 px-4 border-b border-[#f0f4f8]"
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-primary cursor-pointer"
                        checked={isSel}
                        onChange={() => toggle(list.id)}
                      />
                    </td>
                    <td className="py-3 px-4 border-b border-[#f0f4f8]">
                      <div className="font-bold text-[#0d3d5c] text-[0.87rem]">
                        {ARABIC_MONTHS[list.month]} {list.year}
                      </div>
                    </td>
                    <td className="py-3 px-4 border-b border-[#f0f4f8]">
                      <span className={`text-[0.72rem] font-bold py-1 px-2.5 rounded-full whitespace-nowrap ${cfg.className}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 border-b border-[#f0f4f8] text-gray-500 text-[0.82rem]">
                      {parseInt(list.total_items || 0)} مستفيد
                    </td>
                    <td className="py-3 px-4 border-b border-[#f0f4f8] font-bold text-primary text-[0.82rem]">
                      {parseFloat(list.total_amount || 0).toLocaleString('ar-YE')} ر.ي
                    </td>
                    <td className="py-3 px-4 border-b border-[#f0f4f8] text-gray-500 text-[0.8rem]">
                      {list.created_by_name || '—'}
                    </td>
                    <td className="py-3 px-4 border-b border-[#f0f4f8] text-gray-400 text-[0.77rem] whitespace-nowrap">
                      {list.created_at ? new Date(list.created_at).toLocaleDateString('ar-YE', { dateStyle: 'medium' }) : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      {!loading && (
        <div className="py-2.5 px-4 text-[0.75rem] text-[#9ca3af] border-t border-[#f0f4f8] bg-[#fafafa] shrink-0">
          {filtered.length} كشف{selected.size > 0 ? ` · ${selected.size} مختار` : ''}
        </div>
      )}
    </div>
  );
}

// ── Tab: Governorates ─────────────────────────────────────────────────────────
function GovernoratesTab() {
  const [govs, setGovs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch]     = useState('');
  const [pdfLoading, setPdfLoading]     = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [toast, setToast]               = useState(null);

  useEffect(() => {
    const fetchGovernoratesAndStats = async () => {
      try {
        const [govsRes, dashRes] = await Promise.all([
          api.get('/governorates'),
          api.get('/dashboard/gm'),
        ]);
        const stats = dashRes.data.orphans_per_governorate || [];
        const merged = (govsRes.data.data || []).map(g => {
          const stat = stats.find(s => s.governorate_ar === g.name_ar);
          return {
            id: g.id,
            name_ar: g.name_ar,
            name_en: g.name_en,
            count: stat ? parseInt(stat.count) : 0,
          };
        }).sort((a, b) => b.count - a.count);
        setGovs(merged);
      } catch (err) {
        console.error('Error fetching governorates statistics:', err);
        setToast({ msg: 'تعذّر تحميل المحافظات', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchGovernoratesAndStats();
  }, []);

  const filtered = govs.filter(g =>
    !search || g.name_ar.includes(search) || g.name_en?.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const withOrphans = filtered.filter(g => g.count > 0);
    if (selected.size === withOrphans.length && withOrphans.length > 0) setSelected(new Set());
    else setSelected(new Set(withOrphans.map(g => g.id)));
  };

  const selectedGovs = govs.filter(g => selected.has(g.id));
  const withOrphans  = filtered.filter(g => g.count > 0);
  const maxCount     = Math.max(...govs.map(g => g.count), 1);

  const doExport = async (ext, setLoading) => {
    setLoading(true);
    try {
      const apiExt = ext === 'xlsx' ? 'excel' : ext;
      for (const gov of selectedGovs) {
        await downloadFile(
          `/reports/governorate/${gov.id}/${apiExt}`,
          `أيتام-${gov.name_ar}`,
          ext
        );
        if (selectedGovs.length > 1) {
          await new Promise(r => setTimeout(r, EXPORT_DELAY_MS));
        }
      }
      setToast({
        msg: (
          <span className="flex items-center gap-1.5 shrink-0">
            <CheckCircle2 size={15} /> تم تصدير {selectedGovs.length} تقرير بنجاح
          </span>
        ),
        type: 'success',
      });
    } catch (err) {
      console.error('Error exporting governorates report:', err);
      const serverMsg = await readBlobError(err);
      const status    = err?.response?.status;
      const fallback  = status === 403
        ? 'ليس لديك صلاحية لتصدير هذا الملف'
        : status === 401
        ? 'انتهت الجلسة — يرجى تسجيل الدخول مجدداً'
        : 'فشل التصدير — يرجى المحاولة مجدداً';
      setToast({ msg: serverMsg || fallback, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Toolbar */}
      <div className="p-4 border-b border-[#f0f4f8]">
        <SearchField
          value={search}
          onChange={e => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="ابحث باسم المحافظة…"
          className="max-w-[340px]"
          inputClassName="border-gray-300 py-2 text-[0.83rem] font-cairo bg-[#fafafa]"
        />
      </div>

      {/* Export bar */}
      <ExportBar
        selectedCount={selected.size}
        label="محافظة"
        pdfLoading={pdfLoading}
        excelLoading={excelLoading}
        onExportPdf={() => doExport('pdf', setPdfLoading)}
        onExportExcel={() => doExport('xlsx', setExcelLoading)}
      />

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-collapse text-[0.82rem]">
          <thead>
            <tr className="bg-[#f8fafc] sticky top-0 z-10">
              <th className="w-11 py-3 px-4 text-center border-b-2 border-[#e5eaf0]">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary cursor-pointer"
                  checked={selected.size === withOrphans.length && withOrphans.length > 0}
                  ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < withOrphans.length; }}
                  onChange={toggleAll}
                />
              </th>
              {['المحافظة', 'بالإنجليزية', 'عدد الأيتام', 'النسبة'].map(h => (
                <th
                  key={h}
                  className="py-3 px-4 text-right text-[0.73rem] font-bold text-[#6b7a8d] whitespace-nowrap border-b-2 border-[#e5eaf0]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows count={8} widths={[65, 72, 79, 55, 68]} cellClassName="py-3 px-4 border-b border-[#f8fafc]" barClassName="h-[14px]" />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-[#9ca3af] text-[0.85rem]">
                  <div className="flex items-center justify-center gap-1.5">
                    <Search size={16} /> لا توجد نتائج
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((gov, idx) => {
                const isSel = selected.has(gov.id);
                const hasOrphans = gov.count > 0;
                const pct = Math.round((gov.count / maxCount) * 100);
                return (
                  <tr
                    key={gov.id}
                    onClick={() => hasOrphans && toggle(gov.id)}
                    className={`transition-colors duration-100 ${
                      isSel
                        ? 'bg-[#f0f7ff]'
                        : idx % 2 === 0
                        ? 'bg-white'
                        : 'bg-[#fafafa]'
                    } ${hasOrphans ? 'cursor-pointer hover:bg-[#f8fbff] opacity-100' : 'cursor-default opacity-45'}`}
                  >
                    <td
                      className="text-center py-3 px-4 border-b border-[#f0f4f8]"
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className={`w-4 h-4 accent-primary ${hasOrphans ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                        checked={isSel}
                        disabled={!hasOrphans}
                        onChange={() => hasOrphans && toggle(gov.id)}
                      />
                    </td>
                    <td className="py-3 px-4 border-b border-[#f0f4f8] font-bold text-[#0d3d5c]">
                      {gov.name_ar}
                    </td>
                    <td className="py-3 px-4 border-b border-[#f0f4f8] text-gray-400 text-[0.78rem] ltr text-left">
                      {gov.name_en}
                    </td>
                    <td className="py-3 px-4 border-b border-[#f0f4f8]">
                      <span className={`font-extrabold text-[0.9rem] ${hasOrphans ? 'text-primary' : 'text-gray-400'}`}>
                        {gov.count}
                      </span>
                      {!hasOrphans && <span className="text-[0.7rem] text-gray-400 mr-1.5">— لا يوجد أيتام</span>}
                    </td>
                    <td className="py-3 px-4 border-b border-[#f0f4f8] min-w-[140px]">
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 h-[7px] bg-[#f0f4f8] rounded-full overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className={`h-full rounded-full transition-[width] duration-400 ease-out ${
                              isSel ? 'bg-primary' : 'bg-gradient-to-r from-blue-300 to-blue-400'
                            }`}
                          />
                        </div>
                        <span className="text-[0.7rem] text-gray-400 min-w-[28px] text-left">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {!loading && (
        <div className="py-2.5 px-4 text-[0.75rem] text-[#9ca3af] border-t border-[#f0f4f8] bg-[#fafafa] shrink-0">
          {filtered.length} محافظة{selected.size > 0 ? ` · ${selected.size} مختارة` : ''}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [tab, setTab] = useState('disbursements');

  const tabs = [
    { key: 'disbursements', label: 'كشوف الصرف',  Icon: Wallet,  desc: 'تصدير كشوف الصرف الشهرية' },
    { key: 'governorates',  label: 'المحافظات',    Icon: MapPin,  desc: 'تصدير تقارير الأيتام بالمحافظة' },
  ];

  return (
    <AppShell>
      <div dir="rtl" className="font-sans min-h-[calc(100vh-80px)] flex flex-col gap-4 pb-6">

        {/* Page header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[#0d3d5c] mb-[0.2rem]">التقارير والتصدير</h1>
            <p className="text-[0.83rem] text-[#6b7a8d]">اختر البيانات من الجدول ثم صدّرها بتنسيق PDF أو Excel</p>
          </div>
          {/* How-to tip */}
          <div className="flex items-center gap-2 bg-[#eff6ff] border border-[#bfdbfe] rounded-[0.625rem] py-2 px-3.5 text-[0.75rem] text-[#1d4ed8] font-semibold">
            <Lightbulb size={14} />
            <span>حدد صفاً أو أكثر ثم اضغط PDF أو Excel</span>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => (
            <button key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 py-2.5 px-5 border-2 rounded-[0.875rem] font-cairo text-[0.85rem] font-bold cursor-pointer transition-all duration-150 ${
                tab === t.key
                  ? 'border-primary bg-primary text-white shadow-[0_2px_8px_rgba(27,94,140,0.2)]'
                  : 'border-[#e5eaf0] bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              <t.Icon size={18} />
              <div className="text-right">
                <div>{t.label}</div>
                <div className="text-[0.68rem] font-normal opacity-80">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Table card */}
        <div className="flex-1 bg-white border-[1.5px] border-[#e5eaf0] rounded-2xl flex flex-col overflow-hidden min-h-0">
          {tab === 'disbursements' && <DisbursementsTab />}
          {tab === 'governorates'  && <GovernoratesTab />}
        </div>

      </div>
    </AppShell>
  );
}