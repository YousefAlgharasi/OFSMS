'use client';

/**
 * apps/frontend/src/app/receipts/batch/page.jsx
 * Route:  /receipts/batch          → shows agent's released lists to pick from
 *         /receipts/batch?listId=X → shows the agent's own orphans for that list
 *
 * Agent only.
 * Workflow:
 *   1. Agent lands on this page → sees all released lists that include orphans they registered
 *   2. Clicks a list → sees only the orphans the agent registered, each with a "تأكيد الاستلام" button
 *   3. Confirms after handing over the money → POST /api/receipts/confirm
 *   4. Progress bar updates as each orphan is confirmed
 *
 * API:
 *   GET  /api/disbursements/agent/released   → agent's released lists
 *   GET  /api/receipts/my-items/:listId      → agent's own orphans in the list
 *   GET  /api/receipts/summary/:listId       → confirmed count
 *   POST /api/receipts/confirm               → confirm receipt (no fingerprint)
 */

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, User, Handshake, CheckCircle2 } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';

// ── Constants ──────────────────────────────────────────────────────────────────

const MONTHS_AR = [
  '', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatAmount = (n) =>
  n != null ? `${Number(n).toLocaleString('ar-YE')} ر.ي` : '—';

// ── Tailwind shorthand constants ───────────────────────────────────────────────

const CLS_CARD     = 'bg-white border border-[#e5eaf0] rounded-2xl';
const CLS_ERR_BANNER = 'flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-bold';
const CLS_SKEL     = 'bg-gradient-to-r from-[#f0f4f8] via-[#e5eaf0] to-[#f0f4f8] bg-[length:200%_100%] animate-[shimmer_1.4s_infinite] rounded';

// ── ConfirmReceipt ─────────────────────────────────────────────────────────────

function ConfirmReceipt({ item, onConfirmed }) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleConfirm = async () => {
    if (!window.confirm(`هل سلّمت المبلغ لـ ${item.beneficiary_name}؟`)) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/receipts/confirm', { itemId: item.id });
      onConfirmed(item.id);
    } catch (err) {
      console.error('Error confirming receipt:', err);
      setError(err.response?.data?.error || 'فشل تأكيد الاستلام');
    } finally {
      setSaving(false);
    }
  };

  // Already confirmed
  if (item.confirmed_at) {
    return (
      <div className="flex flex-col items-end gap-[0.15rem] shrink-0">
        <span className="inline-flex items-center gap-1.5 text-[0.8rem] font-bold text-[#059669] bg-[#ecfdf5] border border-[#6ee7b7] rounded-lg px-3 py-1.5 whitespace-nowrap">
          <CheckCircle2 size={15} strokeWidth={2} /> تم التأكيد
        </span>
        <span className="text-[0.68rem] text-gray-400">
          {new Date(item.confirmed_at).toLocaleDateString('ar-YE', { dateStyle: 'short' })}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0">
      <button
        className={`inline-flex items-center gap-1.5 px-4 py-2 bg-[#1B5E8C] text-white font-cairo text-[0.82rem] font-bold border-none rounded-[0.625rem] cursor-pointer transition-colors duration-150 whitespace-nowrap hover:bg-[#134569] disabled:opacity-60 disabled:cursor-not-allowed`}
        onClick={handleConfirm}
        disabled={saving}
      >
        {saving ? <><Spinner size="xs" /> جارٍ الحفظ…</> : '✅ تأكيد الاستلام'}
      </button>
      {error && <p className="text-[0.72rem] text-red-600 m-0">{error}</p>}
    </div>
  );
}

// ── ListPicker — shows all released lists for the agent ───────────────────────

function ListPicker({ onSelect }) {
  const [lists,   setLists]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    const fetchLists = async () => {
      try {
        const { data } = await api.get('/disbursements/agent/released');
        setLists(data.lists || []);
      } catch (err) {
        console.error('Error fetching released lists:', err);
        setError('تعذّر تحميل الكشوف. يرجى تحديث الصفحة.');
      } finally {
        setLoading(false);
      }
    };
    fetchLists();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[0.88rem] font-semibold text-[#6b7a8d] m-0">جارٍ تحميل كشوفك…</p>
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${CLS_CARD} p-5 flex flex-col gap-2`}>
              <div className={`${CLS_SKEL} h-[18px] w-[100px]`} />
              <div className={`${CLS_SKEL} h-[14px] w-[70px]`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className={CLS_ERR_BANNER}><AlertTriangle size={18} /> {error}</div>;
  }

  if (lists.length === 0) {
    return (
      <EmptyState
        icon={<span className="text-5xl">📋</span>}
        heading="لا توجد كشوف صرف جاهزة"
        description="ستظهر هنا الكشوف الشهرية بعد أن يصدرها المدير العام ويصبح بإمكانك تأكيد استلام الأيتام الذين سجّلتهم."
        card
        className="min-h-[280px] p-10"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[0.88rem] font-semibold text-[#6b7a8d] m-0">اختر كشف الصرف الذي تريد تأكيد استلامه:</p>
      <div className="flex flex-col gap-3">
        {lists.map((list) => {
          const confirmed = Number(list.confirmed_items ?? 0);
          const total     = Number(list.total_items ?? 0);
          const pct       = total > 0 ? Math.round((confirmed / total) * 100) : 0;
          const done      = pct === 100 && total > 0;

          return (
            <button
              key={list.id}
              className={`flex items-center justify-between gap-4 w-full text-right font-cairo px-5 py-4 border-[1.5px] rounded-2xl cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(27,94,140,0.1)] ${done ? 'border-[#a7f3d0] bg-[#f0fdf4] hover:border-[#34d399]' : 'bg-white border-[#e5eaf0] hover:border-[#1B5E8C]'}`}
              onClick={() => onSelect(list.id)}
            >
              <div className="flex flex-col gap-1 items-start">
                <span className="text-[1rem] font-extrabold text-[#0d3d5c]">
                  {MONTHS_AR[list.month]} {list.year}
                </span>
                <span className="text-[0.75rem] font-medium text-[#6b7a8d]">
                  {done ? '🎉 اكتمل' : `${confirmed} من ${total} يتيم`}
                </span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-[100px] h-[7px] bg-[#f0f4f8] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width_0.4s]"
                    style={{ width: `${pct}%`, background: done ? '#10b981' : '#1B5E8C' }}
                  />
                </div>
                <span className="text-[0.82rem] font-extrabold min-w-[35px] text-left" style={{ color: done ? '#10b981' : '#1B5E8C' }}>
                  {pct}%
                </span>
                <span className="text-[0.85rem] text-gray-400">←</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── BatchView — shows items for a specific list ────────────────────────────────

function BatchView({ listId }) {
  const [listDetail, setListDetail] = useState(null);
  const [summary,    setSummary]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [detailRes, summaryRes] = await Promise.all([
        api.get(`/receipts/my-items/${listId}`),
        api.get(`/receipts/summary/${listId}`),
      ]);
      setListDetail(detailRes.data);
      setSummary(summaryRes.data.summary);
    } catch (err) {
      console.error('Error fetching batch data:', err);
      const status = err.response?.status;
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        `تعذّر تحميل البيانات (${status ? `رمز ${status}` : 'لا يوجد اتصال بالخادم'})`
      );
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConfirmed = (itemId) => {
    setListDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((i) =>
          i.id === itemId
            ? { ...i, confirmed_at: new Date().toISOString() }
            : i
        ),
      };
    });
    setSummary((prev) =>
      prev ? {
        ...prev,
        confirmed_items: Number(prev.confirmed_items) + 1,
        pending_items:   Number(prev.pending_items) - 1,
      } : prev
    );
  };

  // The API already returns only the orphans this agent registered
  const items = listDetail?.items || [];

  const confirmed = Number(summary?.confirmed_items ?? 0);
  const total     = Number(summary?.total_items ?? items.length);
  const pct       = total > 0 ? Math.round((confirmed / total) * 100) : 0;
  const allDone   = pct === 100 && total > 0;

  const month = listDetail?.list?.month;
  const year  = listDetail?.list?.year;

  return (
    <div className="flex flex-col gap-5">

      {/* Title */}
      <div className="flex items-start gap-3">
        <div>
          <h2 className="text-[1.45rem] font-extrabold text-[#0d3d5c] m-0 mb-1 flex items-center gap-2.5 flex-wrap">
            تأكيد الاستلام
            {month && year && (
              <span className="text-[0.78rem] font-bold text-[#1d4ed8] bg-[#dbeafe] border border-[#bfdbfe] rounded-lg px-2.5 py-1">
                {MONTHS_AR[month]} {year}
              </span>
            )}
          </h2>
          <p className="text-[0.82rem] text-[#6b7a8d] m-0">أكّد استلام كل يتيم سجّلته بعد تسليم المبلغ يدوياً</p>
        </div>
      </div>

      {error && <div className={CLS_ERR_BANNER}><AlertTriangle size={18} /> {error}</div>}

      {/* Progress bar */}
      {!loading && total > 0 && (
        <div className={`${CLS_CARD} px-6 py-5`}>
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-[0.88rem] font-bold text-[#374151]">
              {allDone ? '🎉 اكتمل تأكيد جميع الأيتام!' : `${confirmed} من ${total} يتيم`}
            </span>
            <span
              className="text-[1.1rem] font-extrabold"
              style={{ color: allDone ? '#10b981' : '#1B5E8C' }}
            >
              {pct}%
            </span>
          </div>
          <div className="h-[10px] bg-[#f0f4f8] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-[width_0.4s_ease]"
              style={{
                width: `${pct}%`,
                background: allDone
                  ? 'linear-gradient(90deg,#10b981,#059669)'
                  : 'linear-gradient(90deg,#1B5E8C,#2E7EB8)',
              }}
            />
          </div>
          {allDone && (
            <p className="flex items-center gap-1.5 text-[0.82rem] text-[#059669] font-semibold mt-2.5 mb-0">
              <CheckCircle2 size={16} /> رائع! تم تأكيد استلام جميع الأيتام في هذا الكشف.
            </p>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`${CLS_CARD} px-5 py-4 flex items-center gap-4 pointer-events-none`}>
              <div className={`${CLS_SKEL} w-[42px] h-[42px] rounded-full shrink-0`} />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className={`${CLS_SKEL} h-[14px] w-[55%]`} />
                <div className={`${CLS_SKEL} h-[12px] w-[30%]`} />
              </div>
              <div className={`${CLS_SKEL} h-[36px] w-[110px] rounded-lg shrink-0`} />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && items.length === 0 && !error && (
        <EmptyState
          icon={<span className="text-4xl">📋</span>}
          description="لا يوجد أيتام مسجّلون باسمك في هذا الكشف"
          card
          className="min-h-[200px]"
        />
      )}

      {/* Items list */}
      {!loading && items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`${CLS_CARD} px-5 py-4 flex items-center gap-4 transition-colors duration-150 sm:flex-row flex-wrap ${item.confirmed_at ? 'border-[#a7f3d0] bg-[#f0fdf4]' : ''}`}
            >
              {/* Avatar */}
              <div className="w-[42px] h-[42px] rounded-full bg-[#f0f4f8] flex items-center justify-center shrink-0 text-[#64748b]">
                <User size={18} strokeWidth={1.8} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-[0.9rem] font-bold text-[#1f2937]">{item.beneficiary_name}</div>
                <div className="flex gap-2 flex-wrap items-center mt-1 text-[0.75rem] text-[#6b7a8d]">
                  <span>{item.governorate_ar || '—'}</span>
                  <span className="font-bold text-[#1B5E8C]">{formatAmount(item.amount)}</span>
                  {item.sponsor_name && (
                    <span className="flex items-center gap-1 text-gray-500">
                      <Handshake size={14} strokeWidth={1.8} /> {item.sponsor_name}
                    </span>
                  )}
                </div>
              </div>

              {/* Confirm / Confirmed */}
              <ConfirmReceipt item={item} onConfirmed={handleConfirmed} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AgentReceiptsBatchPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const listId       = searchParams.get('listId');

  const selectList = (id) => router.push(`/receipts/batch?listId=${id}`);

  return (
    <AppShell>
      <style jsx global>{`
        @keyframes shimmer { to { background-position: -200% 0; } }
      `}</style>

      <div className="max-w-[760px] mx-auto pb-16 font-cairo flex flex-col gap-5" dir="rtl">

        {/* Page heading — only on list-picker view */}
        {!listId && (
          <div>
            <h1 className="text-[1.55rem] font-extrabold text-[#0d3d5c] m-0 mb-1">تأكيد استلام الأيتام</h1>
            <p className="text-[0.83rem] text-[#6b7a8d] m-0">
              اختر كشف الصرف ثم أكّد استلام كل يتيم سجّلته بعد تسليم المبلغ
            </p>
          </div>
        )}

        {listId
          ? <BatchView listId={listId} />
          : <ListPicker onSelect={selectList} />}

      </div>
    </AppShell>
  );
}