'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, User, Users, DollarSign, Zap, Search } from 'lucide-react';

import api from '@/lib/api';
import DetailDrawer from '@/components/ui/DetailDrawer';
import StatusBadge from '@/components/ui/StatusBadge';
import RejectModal from '@/components/RejectModal';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import { MONTHS_AR, formatAmount } from './_constants';

export default function ItemsDrawer({ listId, listInfo, role, onClose, onAction }) {
  const [detail,     setDetail]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [acting,     setActing]     = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [actionErr,  setActionErr]  = useState('');

  useEffect(() => {
    if (!listId) return;
    setLoading(true);
    setActionErr('');
    api.get(`/disbursements/${listId}`)
      .then(({ data }) => setDetail(data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [listId]);

  if (!listId) return null;

  const items    = detail?.items || [];
  const included = items.filter(i => i.included);
  const excluded = items.filter(i => !i.included);
  const total    = included.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
  const status   = listInfo?.status;

  const nonFinal      = status && status !== 'released' && status !== 'rejected';
  const canSupApprove = role === 'gm' ? nonFinal && status !== 'supervisor_approved' && status !== 'finance_approved'
                                      : role === 'supervisor' && status === 'draft';
  const canSupReject  = role === 'gm' ? nonFinal : role === 'supervisor' && status === 'draft';
  const canFinApprove = role === 'gm' ? nonFinal && status !== 'finance_approved'
                                      : role === 'finance' && status === 'supervisor_approved';
  const canFinReject  = role === 'gm' ? nonFinal : role === 'finance' && status === 'supervisor_approved';
  const canGmRelease  = role === 'gm' && nonFinal;
  const hasAnyAction  = canSupApprove || canSupReject || canFinApprove || canFinReject || canGmRelease;

  const doAction = async (endpoint) => {
    setActing(true);
    setActionErr('');
    try {
      await api.patch(`/disbursements/${listId}/${endpoint}`);
      onAction();
      onClose();
    } catch (err) {
      setActionErr(err.response?.data?.error || 'حدث خطأ أثناء تنفيذ العملية');
    } finally {
      setActing(false);
    }
  };

  const doReject = async (notes) => {
    setActing(true);
    setActionErr('');
    try {
      const endpoint = role === 'finance' ? 'finance-reject' : 'reject';
      await api.patch(`/disbursements/${listId}/${endpoint}`, { notes });
      onAction();
      onClose();
    } catch (err) {
      setActionErr(err.response?.data?.error || 'حدث خطأ');
    } finally {
      setActing(false);
      setShowReject(false);
    }
  };

  return (
    <DetailDrawer open onClose={onClose} className="w-[540px] max-w-[96vw]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 gap-4">
          <div>
            <h2 className="text-[1.05rem] font-extrabold text-[#0d3d5c] m-0">
              كشف الصرف — {MONTHS_AR[listInfo?.month]} {listInfo?.year}
            </h2>
            <div className="mt-1.5">
              {listInfo && <StatusBadge status={listInfo.status} />}
            </div>
          </div>
          <button
            className="bg-transparent border-none text-gray-400 cursor-pointer p-1 shrink-0 hover:text-gray-600 transition-colors"
            onClick={onClose}
            aria-label="إغلاق"
          >
            <X size={16} />
          </button>
        </div>

        {/* Summary strip */}
        <div className="flex items-center px-6 py-4 bg-slate-50 border-b border-slate-200 gap-4">
          <div className="flex flex-col items-center gap-0.5 flex-1">
            <span className="text-base font-extrabold text-emerald-500">{included.length}</span>
            <span className="text-[0.68rem] text-slate-400 font-semibold">مشمول</span>
          </div>
          <div className="w-px h-8 bg-slate-200 shrink-0" />
          <div className="flex flex-col items-center gap-0.5 flex-1">
            <span className="text-base font-extrabold text-red-500">{excluded.length}</span>
            <span className="text-[0.68rem] text-slate-400 font-semibold">مستبعد</span>
          </div>
          <div className="w-px h-8 bg-slate-200 shrink-0" />
          <div className="flex flex-col items-center gap-0.5 flex-1">
            <span className="text-[0.9rem] font-extrabold text-primary">{formatAmount(total)}</span>
            <span className="text-[0.68rem] text-slate-400 font-semibold">الإجمالي</span>
          </div>
        </div>

        {/* Action zone */}
        {hasAnyAction && (
          <div className="px-6 py-5 bg-gradient-to-br from-blue-50 to-blue-50 border-b-2 border-blue-100">
            <p className="flex items-center gap-1.5 text-[0.82rem] font-bold text-blue-700 mb-3">
              {role === 'supervisor' && <><Search size={16} /> دورك: اعتماد أو رفض هذا الكشف</>}
              {role === 'finance'    && <><DollarSign size={16} /> دورك: التصديق المالي على هذا الكشف</>}
              {role === 'gm'        && <><Zap size={16} /> دورك: إصدار الأموال للمناديب</>}
            </p>

            <div className="flex gap-2.5 flex-wrap">
              {canSupApprove && (
                <button
                  disabled={acting}
                  onClick={() => doAction('approve')}
                  className="inline-flex items-center gap-1.5 px-6 py-3 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white text-[0.9rem] font-bold rounded-xl border-none cursor-pointer shadow-[0_3px_12px_rgba(5,150,105,0.35)] hover:-translate-y-px hover:shadow-[0_5px_18px_rgba(5,150,105,0.45)] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {acting ? <><Spinner size="sm" variant="white" />جارٍ الاعتماد…</> : <><CheckCircle2 size={16} /> اعتماد الكشف</>}
                </button>
              )}

              {canFinApprove && (
                <button
                  disabled={acting}
                  onClick={() => doAction('finance-approve')}
                  className="inline-flex items-center gap-1.5 px-6 py-3 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white text-[0.9rem] font-bold rounded-xl border-none cursor-pointer shadow-[0_3px_12px_rgba(5,150,105,0.35)] hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {acting ? <><Spinner size="sm" variant="white" />جارٍ التصديق…</> : <><CheckCircle2 size={16} /> تصديق مالي</>}
                </button>
              )}

              {canGmRelease && (
                <button
                  disabled={acting}
                  onClick={() => doAction('release')}
                  className="inline-flex items-center gap-1.5 px-6 py-3 bg-gradient-to-br from-primary to-primary-dark text-white text-[0.9rem] font-bold rounded-xl border-none cursor-pointer shadow-[0_3px_12px_rgba(27,94,140,0.35)] hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {acting ? <><Spinner size="sm" variant="white" />جارٍ الإصدار…</> : <><Zap size={16} /> إصدار الأموال</>}
                </button>
              )}

              {(canSupReject || canFinReject) && (
                <button
                  disabled={acting}
                  onClick={() => setShowReject(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-3 bg-white border border-red-300 text-red-600 text-[0.88rem] font-bold rounded-xl cursor-pointer hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <X size={16} /> رفض الكشف
                </button>
              )}
            </div>

            {actionErr && (
              <div className="mt-3 flex items-center gap-2 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-[0.82rem] text-red-700">
                <AlertTriangle size={16} /> {actionErr}
              </div>
            )}
          </div>
        )}

        {/* No action info */}
        {!hasAnyAction && status && status !== 'released' && (
          <div className="flex gap-3 items-start px-6 py-4 bg-amber-50 border-b border-amber-200 text-[0.82rem]">
            <span className="text-lg">ℹ️</span>
            <div>
              <strong className="block text-amber-800 mb-1">لا يوجد إجراء متاح لك</strong>
              <p className="text-amber-700 m-0 flex items-center gap-1.5 flex-wrap">
                الحالة الحالية: <StatusBadge status={status} />
                {' '}· دورك: <strong>{role}</strong>
              </p>
            </div>
          </div>
        )}

        {/* Rejection notes */}
        {listInfo?.rejection_notes && (
          <div className="flex gap-3 bg-red-50 border-b border-red-200 px-6 py-4">
            <span className="text-red-500 shrink-0"><AlertTriangle size={18} /></span>
            <div>
              <strong className="block text-[0.85rem] text-red-700 mb-1">سبب الرفض</strong>
              <p className="text-[0.82rem] text-red-600 m-0 leading-relaxed">{listInfo.rejection_notes}</p>
            </div>
          </div>
        )}

        {/* Items body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-[shimmer_1.4s_infinite] shrink-0" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="h-3 w-[55%] rounded bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-[shimmer_1.4s_infinite]" />
                    <div className="h-2.5 w-[35%] rounded bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-[shimmer_1.4s_infinite]" />
                  </div>
                  <div className="h-3 w-20 rounded bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-[shimmer_1.4s_infinite]" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<span className="text-3xl">📋</span>}
              description="لا توجد بنود في هذا الكشف"
              className="py-12 gap-2"
            />
          ) : (
            <>
              <p className="text-[0.75rem] font-bold text-slate-500 uppercase tracking-wide mt-2 mb-2.5">
                المشمولون ({included.length})
              </p>
              {included.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 hover:bg-blue-50/40 transition-colors">
                  <div className="w-[34px] h-[34px] rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-500">
                    {item.beneficiary_type === 'orphan' ? <User size={18} /> : <Users size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.83rem] font-bold text-gray-800">{item.beneficiary_name}</div>
                    <div className="flex gap-1.5 text-[0.7rem] text-slate-500 flex-wrap mt-0.5">
                      <span>{item.governorate_ar || '—'}</span>
                      {item.sponsor_name && <span>· {item.sponsor_name}</span>}
                      {item.biometric_confirmed_at && (
                        <span className="text-emerald-500 font-bold flex items-center gap-0.5">
                          <CheckCircle2 size={12} /> تم التسليم
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[0.83rem] font-bold text-primary shrink-0">{formatAmount(item.amount)}</div>
                </div>
              ))}

              {excluded.length > 0 && (
                <>
                  <p className="text-[0.75rem] font-bold text-red-500 uppercase tracking-wide mt-4 mb-2.5">
                    المستبعدون ({excluded.length})
                  </p>
                  {excluded.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 bg-red-50/30">
                      <div className="w-[34px] h-[34px] rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-400 opacity-50">
                        {item.beneficiary_type === 'orphan' ? <User size={18} /> : <Users size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.83rem] font-bold text-gray-800 opacity-60">{item.beneficiary_name}</div>
                        <div className="flex gap-1.5 text-[0.7rem] flex-wrap mt-0.5">
                          <span className="text-red-500 font-semibold">{item.exclusion_reason || 'مستبعد'}</span>
                        </div>
                      </div>
                      <div className="text-[0.83rem] font-bold text-primary shrink-0 opacity-40">{formatAmount(item.amount)}</div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
        <button
          className="inline-flex items-center px-4 py-2.5 bg-transparent text-primary text-[0.82rem] font-semibold border border-slate-200 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors"
          onClick={onClose}
        >
          إغلاق
        </button>
      </div>

      {showReject && (
        <RejectModal
          title="رفض كشف الصرف"
          onConfirm={doReject}
          onClose={() => setShowReject(false)}
          loading={acting}
        />
      )}
    </DetailDrawer>
  );
}
