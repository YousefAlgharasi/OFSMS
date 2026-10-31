'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Trash2, RefreshCw, User, Users } from 'lucide-react';

import api from '../../lib/api';
import AppShell from '../../components/AppShell';
import useAuthStore from '../../store/useAuthStore';

const calcAge = (dob) => {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
};

export default function AdsPage() {
  const { user } = useAuthStore();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState('');

  const isAdmin = user?.role === 'gm';

  const loadAds = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/ads');
      setAds(data.ads || []);
    } catch (err) {
      setError(err.response?.data?.error || 'تعذّر تحميل الإعلانات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  const deleteAd = async (ad) => {
    if (!isAdmin) {
      setError('ليس لديك صلاحية لحذف الإعلان');
      return;
    }
    if (!window.confirm('هل أنت متأكد من حذف هذا الإعلان؟ لا يمكن التراجع عن ذلك.')) return;
    setDeletingId(ad.id);
    setError('');
    try {
      await api.delete(`/ads/${ad.id}`);
      setAds((current) => current.filter((item) => item.id !== ad.id));
    } catch (err) {
      setError(err.response?.data?.error || 'تعذّر حذف الإعلان');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <AppShell>
      <div className="max-w-[1100px] mx-auto pb-12 font-sans flex flex-col gap-4" dir="rtl">
        <div className="flex justify-between items-center gap-4">
          <div>
            <h1 className="m-0 text-[#0d3d5c] text-[1.55rem] font-extrabold mb-1">صفحة الإعلانات</h1>
            <p className="m-0 text-slate-500 text-[0.85rem]">
              {loading ? 'جارٍ التحميل…' : `${ads.length} إعلان موجه للكفلاء`}
            </p>
          </div>
          <button className="w-[2.35rem] h-[2.35rem] inline-flex items-center justify-center border-[1.5px] border-[#dbe4ee] rounded-xl bg-white text-teal-700 cursor-pointer hover:bg-slate-50 transition-colors" onClick={loadAds} title="تحديث">
            <RefreshCw size={17} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 py-3 px-4 border border-red-200 rounded-xl bg-red-50 text-red-700 text-[0.85rem]">
            <AlertTriangle size={18} /> {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {[1, 2, 3].map((i) => <div key={i} className="h-[220px] rounded-xl bg-slate-200 animate-pulse" />)}
          </div>
        ) : ads.length === 0 ? (
          <div className="py-12 px-4 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl">لا توجد إعلانات حالياً</div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {ads.map((ad) => (
              <AdCard
                key={ad.id}
                ad={ad}
                canDelete={isAdmin && ad.is_sponsored}
                deleting={deletingId === ad.id}
                onDelete={() => deleteAd(ad)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function AdCard({ ad, canDelete, deleting, onDelete }) {
  const isOrphan = ad.beneficiary_type === 'orphan';
  const age = calcAge(ad.date_of_birth);
  const statusLabel = ad.is_sponsored ? 'مكفول' : 'في انتظار كفيل';

  return (
    <article className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3.5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className="w-[42px] h-[42px] rounded-full bg-emerald-50 text-teal-700 inline-flex items-center justify-center shrink-0">
          {isOrphan ? <User size={20} /> : <Users size={20} />}
        </div>
        <div>
          <h2 className="m-0 text-[0.98rem] text-[#0d3d5c] font-extrabold">{ad.beneficiary_name || '—'}</h2>
          <p className="mt-0.5 mb-0 text-slate-400 text-[0.75rem]">{isOrphan ? 'يتيم' : 'أسرة'}</p>
        </div>
      </div>

      <span className={`w-fit rounded-full px-2.5 py-1 text-[0.74rem] font-extrabold ${ad.is_sponsored ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
        {statusLabel}
      </span>

      <div className="flex flex-col gap-1.5 text-slate-600 text-[0.82rem]">
        <span>المحافظة: {ad.governorate_ar || '—'}</span>
        <span>المندوب: {ad.agent_name || '—'}</span>
        {isOrphan && age !== null && <span>العمر: {age} سنة</span>}
        {!isOrphan && <span>عدد الأفراد: {ad.member_count || '—'}</span>}
        {!isOrphan && <span>رب الأسرة: {ad.head_of_family || '—'}</span>}
      </div>

      {canDelete && (
        <button className="inline-flex items-center justify-center gap-1.5 py-2 px-3 border border-red-200 rounded-xl bg-red-50 text-red-700 font-sans text-[0.8rem] font-extrabold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed hover:bg-red-100 transition-colors mt-auto" onClick={onDelete} disabled={deleting}>
          <Trash2 size={15} /> {deleting ? 'جارٍ الحذف…' : 'حذف الإعلان'}
        </button>
      )}
    </article>
  );
}
