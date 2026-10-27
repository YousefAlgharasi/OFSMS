'use client';

/**
 * apps/frontend/src/app/receipts/supervisor/page.jsx
 * Route:  /receipts/supervisor
 * Roles:  supervisor, gm
 *
 * Shows a per-agent breakdown of fingerprint receipts for a selected
 * disbursement list. Supervisors can see which beneficiaries have been
 * confirmed and view the uploaded fingerprint image.
 *
 * API:
 *   GET /api/disbursements                         → all lists (for selector)
 *   GET /api/receipts/supervisor-log/:listId       → per-agent receipt log
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * NOTE (security): The fingerprint URL is constructed using the public S3
 * bucket name env var. This works for public buckets but exposes the bucket
 * name client-side. For private buckets, the backend should return a
 * pre-signed URL instead.
 * TODO: Replace with GET /api/receipts/fingerprint-url/:key when the backend
 *       supports signed URLs.
 */
const S3_BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET_NAME || '';

const buildFingerprintUrl = (key) =>
  S3_BUCKET ? `https://${S3_BUCKET}.s3.amazonaws.com/${key}` : '';

// ── Tailwind shorthand constants ───────────────────────────────────────────────

const CLS_ERR_BANNER = 'flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-bold';

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SupervisorBiometricLogPage() {
  const router = useRouter();

  const [lists,           setLists]           = useState([]);
  const [selectedListId,  setSelectedListId]  = useState('');
  const [logData,         setLogData]         = useState(null);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');

  // 1. Fetch available lists
  useEffect(() => {
    const fetchLists = async () => {
      try {
        const { data } = await api.get('/disbursements');
        setLists(data.lists);
        // Default to the first (latest) released/approved list
        if (data.lists.length > 0) {
          setSelectedListId(data.lists[0].id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching disbursement lists:', err);
        setError('تعذّر تحميل كشوفات الصرف.');
        setLoading(false);
      }
    };
    fetchLists();
  }, []);

  // 2. Fetch supervisor log when list changes
  useEffect(() => {
    if (!selectedListId) return;

    const fetchLog = async () => {
      setLoading(true);
      setLogData(null);
      setSelectedAgentId('');
      try {
        const { data } = await api.get(`/receipts/supervisor-log/${selectedListId}`);
        setLogData(data);
        if (data.agents?.length > 0) {
          setSelectedAgentId(data.agents[0].agent_id);
        }
      } catch (err) {
        console.error('Error fetching supervisor log:', err);
        setError(err.response?.data?.error || 'تعذّر تحميل سجل الاستلام.');
      } finally {
        setLoading(false);
      }
    };
    fetchLog();
  }, [selectedListId]);

  const activeAgent = logData?.agents?.find((a) => a.agent_id === selectedAgentId);

  return (
    <AppShell>
      <div className="flex flex-col gap-7 font-cairo max-w-[1100px] mx-auto pb-12" dir="rtl">


        {/* Header row */}
        <PageHeader
          title="متابعة استلام الصرف"
          subtitle="عرض تقرير إنجاز المندوبين لتسليم مبالغ الصرف"
          subtitleClassName="text-[0.9rem]"
          className="items-center"
          action={lists.length > 0 && (
            <select
              className="px-4 py-2.5 border border-gray-300 rounded-lg font-cairo text-[0.9rem] font-bold text-[#1f2937] bg-white outline-none cursor-pointer transition-all duration-150 focus:border-[#1B5E8C] focus:shadow-[0_0_0_3px_rgba(27,94,140,0.1)]"
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
            >
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  كشف شهر {list.month} / {list.year}
                </option>
              ))}
            </select>
          )}
        />

        {/* Error */}
        {error && <div className={CLS_ERR_BANNER}><AlertTriangle size={18} /> {error}</div>}

        {/* Loading skeleton */}
        {loading ? (
          <div
            className="h-[300px] mt-8 rounded-2xl bg-gradient-to-r from-[#f0f4f8] via-[#e5eaf0] to-[#f0f4f8] bg-[length:200%_100%] animate-[shimmer_1.4s_infinite]"
          />
        ) : !logData ? (
          <EmptyState
            heading="لا توجد بيانات"
            description="لم يتم العثور على سجل استلام لهذا الكشف."
            card
            className="py-16 px-8"
          />
        ) : logData.agents.length === 0 ? (
          <EmptyState
            heading="لا يوجد مندوبين"
            description="لا يوجد مستفيدين معتمدين في هذا الكشف."
            card
            className="py-16 px-8"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6 items-start">

            {/* Sidebar: Agents List */}
            <div className="bg-white border border-[#e5eaf0] rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="m-0 text-base font-bold text-[#0d3d5c]">
                المندوبين ({logData.agents.length})
              </h3>
              <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
                {logData.agents.map((agent) => (
                  <div
                    key={agent.agent_id}
                    className={`px-4 py-3.5 border rounded-xl cursor-pointer transition-all duration-150 flex flex-col gap-1.5 ${
                      selectedAgentId === agent.agent_id
                        ? 'border-[#1B5E8C] bg-[#f0f9ff] shadow-[0_2px_4px_rgba(27,94,140,0.1)]'
                        : 'border-[#e5eaf0] hover:border-[#cbd5e1] hover:bg-[#f8fafc]'
                    }`}
                    onClick={() => setSelectedAgentId(agent.agent_id)}
                  >
                    <div className="text-[0.95rem] font-extrabold text-[#1f2937]">{agent.agent_name}</div>
                    <div className="flex justify-between items-center">
                      <span className="text-[0.85rem] font-bold text-[#475569]">
                        {agent.confirmed_items} / {agent.total_items}
                      </span>
                      <span
                        className="text-[0.7rem] font-extrabold px-2 py-0.5 rounded-full"
                        style={{
                          background: agent.all_confirmed ? '#ecfdf5' : '#fffbeb',
                          color:      agent.all_confirmed ? '#059669' : '#d97706',
                        }}
                      >
                        {agent.all_confirmed
                          ? <span className="flex items-center gap-1"><CheckCircle2 size={13} strokeWidth={2.5} /> مكتمل</span>
                          : 'قيد التسليم ⏳'}
                      </span>
                    </div>
                    {agent.batch_confirmed_at && (
                      <div className="flex items-center gap-1 text-[0.75rem] font-bold text-[#059669] mt-0.5">
                        تم تسليم الكشف <Check size={14} strokeWidth={2.5} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Main Content: Agent Details */}
            <div className="bg-white border border-[#e5eaf0] rounded-2xl p-6 flex flex-col gap-6">
              {activeAgent ? (
                <>
                  <div className="flex justify-between items-center flex-wrap gap-4 border-b border-[#f1f5f9] pb-4">
                    <h2 className="m-0 text-[1.4rem] font-extrabold text-[#0d3d5c]">{activeAgent.agent_name}</h2>
                    <div className="flex gap-3">
                      <div className="px-3.5 py-1.5 bg-[#f1f5f9] text-[#475569] rounded-full text-[0.85rem]">
                        الإجمالي: <strong>{activeAgent.total_items}</strong>
                      </div>
                      <div className="px-3.5 py-1.5 bg-[#ecfdf5] text-[#065f46] rounded-full text-[0.85rem]">
                        المسلمة: <strong>{activeAgent.confirmed_items}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-right">
                      <thead>
                        <tr>
                          {['المستفيد', 'النوع', 'الحالة', 'إثبات الاستلام'].map((h) => (
                            <th key={h} className="px-3 py-3 border-b-2 border-[#e5eaf0] text-[#6b7a8d] text-[0.85rem] font-bold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeAgent.items.map((item) => {
                          const fpUrl = item.fingerprint_key
                            ? buildFingerprintUrl(item.fingerprint_key)
                            : '';
                          return (
                            <tr key={item.item_id}>
                              <td className="px-3 py-3.5 border-b border-[#f1f5f9] text-[0.9rem] font-bold text-[#1f2937]">
                                {item.beneficiary_name}
                              </td>
                              <td className="px-3 py-3.5 border-b border-[#f1f5f9] text-[0.9rem] text-[#6b7a8d]">
                                {item.beneficiary_type === 'orphan' ? 'يتيم' : 'أسرة'}
                              </td>
                              <td className="px-3 py-3.5 border-b border-[#f1f5f9]">
                                {item.receipt_id ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.75rem] font-extrabold bg-[#ecfdf5] text-[#059669]">
                                    <CheckCircle2 size={14} strokeWidth={2} /> تم التسليم
                                  </span>
                                ) : (
                                  <span className="inline-block px-2.5 py-1 rounded-full text-[0.75rem] font-extrabold bg-[#fffbeb] text-[#d97706]">
                                    ⏳ قيد التسليم
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3.5 border-b border-[#f1f5f9]">
                                {fpUrl ? (
                                  <a
                                    href={fpUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block bg-[#eff6ff] text-[#2563eb] px-3 py-1.5 rounded-lg text-[0.8rem] font-bold no-underline transition-colors duration-150 hover:bg-[#dbeafe]"
                                  >
                                    عرض البصمة 👆
                                  </a>
                                ) : item.receipt_id && item.confirmed_at ? (
                                  <span className="text-[0.8rem] text-[#6b7a8d]">
                                    تأكيد المندوب {new Date(item.confirmed_at).toLocaleDateString('ar-YE', { dateStyle: 'short' })}
                                  </span>
                                ) : (
                                  <span className="text-[#6b7a8d]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-16 text-[#6b7a8d]">
                  <p className="m-0 text-sm">اختر مندوباً لعرض التفاصيل</p>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      <style jsx global>{`
        @keyframes shimmer { to { background-position: -200% 0; } }
      `}</style>
    </AppShell>
  );
}
