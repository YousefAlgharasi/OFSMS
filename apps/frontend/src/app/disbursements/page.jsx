'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X, DollarSign } from 'lucide-react';

import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import useAuthStore from '@/store/useAuthStore';
import { MONTHS_AR, formatDate, formatAmount } from '@/components/disbursements/_constants';
import StatusBadge from '@/components/ui/StatusBadge';
import ItemsDrawer from '@/components/disbursements/ItemsDrawer';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/ui/PageHeader';

const ROLE_AR = { gm: 'المدير العام', supervisor: 'مشرف', finance: 'القسم المالي', agent: 'مندوب' };

export default function DisbursementsPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  const [lists,      setLists]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error,      setError]      = useState('');
  const [selected,   setSelected]   = useState(null); // selected list ID

  const fetchLists = () => {
    setLoading(true);
    api.get('/disbursements')
      .then(({ data }) => setLists(data.lists || []))
      .catch(() => setError('تعذّر تحميل البيانات'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLists(); }, []);

  const handleGenerate = async () => {
    const now = new Date();
    const thisMonth = lists.find((l) => Number(l.month) === now.getMonth() + 1 && Number(l.year) === now.getFullYear());
    if (thisMonth && ['draft', 'rejected'].includes(thisMonth.status)
      && !window.confirm('يوجد كشف لهذا الشهر لم يُعتمد بعد. سيتم إعادة إنشائه ببيانات اليوم (تقارير الحفظ والكفالات). هل تريد المتابعة؟')) {
      return;
    }
    setGenerating(true);
    setError('');
    try {
      await api.post('/disbursements/generate');
      fetchLists();
    } catch (err) {
      setError(err.response?.data?.error || 'فشل إنشاء الكشف');
    } finally { setGenerating(false); }
  };

  const selectedList = lists.find(l => l.id === selected);

  // Count lists that need THIS user's action
  const pendingCount = lists.filter(l =>
    (role === 'supervisor' && l.status === 'draft') ||
    (role === 'finance'    && l.status === 'supervisor_approved') ||
    (role === 'gm'         && l.status === 'finance_approved')
  ).length;

  if (!user) {
    return (
      <AppShell>
        <div dir="rtl" className="flex justify-center items-center py-16">
          <p className="flex items-center gap-2 text-red-600 font-bold text-sm">
            <AlertTriangle size={18} /> لم يتم التعرف على المستخدم. يرجى تسجيل الخروج وإعادة تسجيل الدخول.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-[1100px] mx-auto pb-16 flex flex-col gap-5" dir="rtl">

        {/* Header */}
        <PageHeader
          title="كشوف الصرف الشهري"
          subtitle={loading ? 'جارٍ التحميل…' : `${lists.length} كشف · دورك: ${ROLE_AR[role] || role}`}
          action={(role === 'supervisor' || role === 'gm') && (
            <button
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-br from-primary to-primary-dark text-white text-[0.9rem] font-bold rounded-xl border-none cursor-pointer shadow-[0_2px_8px_rgba(27,94,140,0.25)] hover:from-primary-light hover:to-primary hover:-translate-y-px disabled:opacity-65 disabled:cursor-not-allowed transition-all"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating
                ? <><Spinner size="sm" />جارٍ الإنشاء…</>
                : '+ إنشاء كشف هذا الشهر'}
            </button>
          )}
        />

        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3.5 text-[0.85rem] text-red-700 font-medium">
            <AlertTriangle size={18} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <button className="bg-transparent border-none cursor-pointer text-red-700 hover:text-red-900 transition-colors" onClick={() => setError('')}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Pending action alert */}
        {!loading && pendingCount > 0 && (
          <div className="flex items-start gap-3.5 bg-amber-50 border-[1.5px] border-amber-200 rounded-2xl px-5 py-4">
            <span className="text-2xl">🔔</span>
            <div>
              <strong className="block text-[0.9rem] font-bold text-amber-800 mb-1">
                لديك {pendingCount} {pendingCount === 1 ? 'كشف' : 'كشوف'} بانتظار إجراءك
              </strong>
              <p className="text-[0.82rem] text-amber-700 m-0">اضغط على أي كشف مميّز بنقطة برتقالية لمراجعته واعتماده.</p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(27,94,140,0.05)]">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-[1.1rem] py-[0.85rem] border-b border-slate-50 last:border-b-0">
                <div className="h-3.5 w-20 rounded bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-[shimmer_1.4s_infinite]" />
                <div className="flex-1">
                  <div className="h-3.5 w-[40%] rounded bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-[shimmer_1.4s_infinite]" />
                </div>
                <div className="h-6 w-24 rounded-full bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-[shimmer_1.4s_infinite]" />
                <div className="h-3.5 w-[90px] rounded bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-[shimmer_1.4s_infinite]" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && lists.length === 0 && (
          <EmptyState
            icon={
              <div className="w-16 h-16 rounded-full bg-blue-50 border-[1.5px] border-blue-100 flex items-center justify-center">
                <DollarSign size={32} className="text-primary" />
              </div>
            }
            heading="لا توجد كشوف صرف بعد"
            description={role === 'supervisor' || role === 'gm'
              ? 'اضغط على "إنشاء كشف هذا الشهر" للبدء'
              : 'لم يتم إنشاء كشف لهذا الشهر بعد'}
            card
            className="min-h-[300px] border-slate-200"
          />
        )}

        {/* Table */}
        {!loading && lists.length > 0 && (
          <DataTable
            columns={[
              { label: 'الشهر / السنة' },
              { label: 'المستفيدون' },
              { label: 'المبلغ الإجمالي' },
              { label: 'الحالة' },
              { label: 'تاريخ الإنشاء' },
              { label: '' },
            ]}
            minWidth="520px"
            className="border-slate-200"
          >
            {lists.map((list) => {
              const needsMyAction =
                (role === 'supervisor' && list.status === 'draft') ||
                (role === 'finance'    && list.status === 'supervisor_approved') ||
                (role === 'gm'         && list.status === 'finance_approved');

              return (
                <tr
                  key={list.id}
                  onClick={() => setSelected(list.id)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelected(list.id)}
                  className={[
                    'cursor-pointer transition-colors duration-100 last:border-b-0',
                    'border-b border-slate-50',
                    needsMyAction  ? 'bg-amber-50 hover:bg-amber-100/60' : 'hover:bg-blue-50/40',
                    selected === list.id ? '!bg-blue-50 border-r-[3px] border-r-primary' : '',
                  ].join(' ')}
                >
                  <td className="px-[1.1rem] py-[0.85rem] text-[0.83rem] align-middle whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {needsMyAction && (
                        <span
                          title="يحتاج إجراءك"
                          className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-[pulse_1.5s_infinite]"
                        />
                      )}
                      <span className="text-[0.85rem] font-bold text-[#0d3d5c]">
                        {MONTHS_AR[list.month]} {list.year}
                      </span>
                    </div>
                  </td>
                  <td className="px-[1.1rem] py-[0.85rem] text-[0.83rem] align-middle whitespace-nowrap text-slate-500">
                    <span className="font-bold text-emerald-500">{list.included_count}</span>
                    {list.excluded_count > 0 && (
                      <span className="text-red-500 mr-1.5">(-{list.excluded_count})</span>
                    )}
                  </td>
                  <td className="px-[1.1rem] py-[0.85rem] text-[0.83rem] align-middle whitespace-nowrap font-bold text-primary">
                    {formatAmount(list.total_amount)}
                  </td>
                  <td className="px-[1.1rem] py-[0.85rem] text-[0.83rem] align-middle whitespace-nowrap">
                    <StatusBadge status={list.status} />
                  </td>
                  <td className="px-[1.1rem] py-[0.85rem] text-[0.83rem] align-middle whitespace-nowrap text-slate-500">
                    {formatDate(list.created_at)}
                  </td>
                  <td className="px-[1.1rem] py-[0.85rem] text-[0.83rem] align-middle whitespace-nowrap">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelected(list.id); }}
                      className={[
                        'bg-transparent border rounded-lg px-2.5 py-1.5 text-[0.78rem] font-semibold cursor-pointer whitespace-nowrap transition-all',
                        needsMyAction
                          ? 'border-amber-300 text-amber-700 bg-amber-50 font-bold hover:bg-amber-100'
                          : 'border-slate-200 text-primary hover:bg-blue-50 hover:border-primary',
                      ].join(' ')}
                    >
                      {needsMyAction ? 'مراجعة واعتماد ←' : 'عرض ←'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </div>

      {/* Detail drawer */}
      <ItemsDrawer
        listId={selected}
        listInfo={selectedList}
        role={role}
        onClose={() => setSelected(null)}
        onAction={fetchLists}
      />


    </AppShell>
  );
}
