'use client';

/**
 * GmDashboard.jsx
 * Component: rendered inside /dashboard when role === 'gm'
 * API: GET /api/dashboard/gm
 * → { total_orphans, orphans_per_governorate[], orphans_per_sponsor[],
 *     latest_orphans[], pending_count, monthly_disbursement_summary }
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import SendNotificationModal from '../SendNotificationModal';
import { Users, CheckCircle, ClipboardList, BookOpen, Banknote, Clock, Megaphone, Star, AlertTriangle } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import StatCard from '@/components/ui/StatCard';

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ar-YE', { dateStyle: 'medium' });
};



function Skel({ w, h, r }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: r || 6 }} />;
}

export default function GmDashboard() {
  const router = useRouter();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [showNotifModal, setShowNotifModal] = useState(false);

  useEffect(() => {
    api.get('/dashboard/gm')
      .then(({ data: res }) => setData(res))
      .catch(() => setError('تعذّر تحميل البيانات. يرجى تحديث الصفحة.'))
      .finally(() => setLoading(false));
  }, []);

  const govData     = data?.orphans_per_governorate || [];
  const sponsorData = data?.orphans_per_sponsor     || [];
  const latest      = data?.latest_orphans          || [];
  const pending     = data?.pending_count           || {};
  const finance     = data?.monthly_disbursement_summary || {};
  const maxGov      = Math.max(...govData.map(g => g.count), 1);

  const today = new Date().toLocaleDateString('ar-YE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="gm-dash" dir="rtl">

      {/* Header */}
      <div className="greeting">
        <div>
          <h1 className="greeting-title">لوحة تحكم المدير العام</h1>
          <p className="greeting-sub">{today}</p>
        </div>
        <button className="btn-notif" onClick={() => setShowNotifModal(true)}>
          <Megaphone size={16} /> إرسال إشعار
        </button>
      </div>

      {error && <div className="err-banner"><AlertTriangle size={15} /> {error}</div>}

      {/* Stat cards */}
      <div className="stats-grid">
        {loading ? (
          [1,2,3,4,5,6].map(i => (
            <div key={i} className="stat-card">
              <Skel w={44} h={44} r={12} />
              <div style={{ flex: 1 }}>
                <Skel w={50} h={22} r={6} />
                <div style={{ marginTop: 6 }}><Skel w={80} h={12} r={4} /></div>
              </div>
            </div>
          ))
        ) : (
          <>
            <StatCard icon={<Users size={20}/>}         label="إجمالي الأيتام"      value={data?.total_orphans}        color="#1B5E8C" onClick={() => router.push('/orphans')} />
            <StatCard icon={<CheckCircle size={20}/>}   label="تحت الكفالة"         value={data?.sponsored_orphans ?? '—'} color="#10b981" />
            <StatCard icon={<ClipboardList size={20}/>} label="تسجيلات معلّقة"      value={pending.registrations}       color="#f59e0b" onClick={() => router.push('/registrations')} />
            <StatCard icon={<BookOpen size={20}/>}      label="تقارير حفظ معلّقة"   value={pending.quran_reports}       color="#8b5cf6" />
            <StatCard icon={<Banknote size={20}/>}      label="صرف الشهر الحالي"    value={finance.total != null ? `${Number(finance.total).toLocaleString()} ر.ي` : '—'} color="#059669" />
            <StatCard icon={<Clock size={20}/>}         label="كشوف صرف معلّقة"     value={pending.disbursements}       color="#ef4444" onClick={() => router.push('/disbursements')} />
          </>
        )}
      </div>

      {/* Two-column: Governorate chart + Sponsor ranking */}
      <div className="two-col">

        {/* Orphans per governorate */}
        <div className="card">
          <h2 className="card-title">الأيتام حسب المحافظة</h2>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
              {[1,2,3,4].map(i => <Skel key={i} w="100%" h={28} />)}
            </div>
          ) : govData.length === 0 ? (
            <p className="empty-text">لا توجد بيانات</p>
          ) : (
            <div className="gov-list">
              {govData.slice(0, 10).map((g) => (
                <div key={g.governorate_ar} className="gov-row">
                  <span className="gov-name">{g.governorate_ar}</span>
                  <div className="gov-bar-wrap">
                    <div
                      className="gov-bar"
                      style={{ width: `${Math.round((g.count / maxGov) * 100)}%` }}
                    />
                  </div>
                  <span className="gov-count">{g.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top sponsors */}
        <div className="card">
          <h2 className="card-title">أكثر الكفلاء كفالةً</h2>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
              {[1,2,3,4].map(i => <Skel key={i} w="100%" h={44} />)}
            </div>
          ) : sponsorData.length === 0 ? (
            <p className="empty-text">لا توجد كفالات مسجّلة</p>
          ) : (
            <div className="sponsor-list">
              {sponsorData.slice(0, 8).map((s, i) => (
                <div key={s.sponsor_id} className="sponsor-row">
                  <div className="sponsor-rank">{i + 1}</div>
                  <div className="sponsor-name">{s.sponsor_name}</div>
                  <div className="sponsor-count">
                    <span className="sponsor-num">{s.count}</span>
                    <span className="sponsor-unit">يتيم</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Latest orphans */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 className="card-title" style={{ margin: 0 }}>آخر الأيتام المضافين</h2>
          <button className="link-btn" onClick={() => router.push('/orphans')}>عرض الكل →</button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <Skel w={34} h={34} r="50%" />
                <div style={{ flex: 1 }}><Skel w="50%" h={13} /></div>
                <Skel w={85} h={22} r="2rem" />
              </div>
            ))}
          </div>
        ) : latest.length === 0 ? (
          <p className="empty-text">لا يوجد أيتام مسجّلون بعد</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>المحافظة</th>
                <th>الحالة</th>
                <th>تاريخ التسجيل</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((o) => (
                <tr key={o.id} className="trow" onClick={() => router.push('/orphans')}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                      <div className="avatar">{o.full_name?.charAt(0) || '؟'}</div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#1f2937', fontSize: '.85rem' }}>{o.full_name}</div>
                        {o.is_gifted && <span className="gifted"><Star size={10} style={{display:'inline',verticalAlign:'middle'}}/> موهوب</span>}
                      </div>
                    </div>
                  </td>
                  <td className="muted">{o.governorate_ar || '—'}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td className="muted">{formatDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Financial summary */}
      {!loading && finance.total != null && (
        <div className="finance-card">
          <h2 className="card-title">ملخص الصرف الشهري</h2>
          <div className="finance-grid">
            <div className="finance-item">
              <span className="finance-label">الإجمالي</span>
              <span className="finance-value" style={{ color: '#ffffff', fontWeight: 800 }}>
                {Number(finance.total).toLocaleString()} ر.ي
              </span>
            </div>
            <div className="finance-item">
              <span className="finance-label">تم الصرف</span>
              <span className="finance-value" style={{ color: '#10b981' }}>
                {Number(finance.released).toLocaleString()} ر.ي
              </span>
            </div>
            <div className="finance-item">
              <span className="finance-label">معلّق</span>
              <span className="finance-value" style={{ color: '#f59e0b' }}>
                {Number(finance.pending).toLocaleString()} ر.ي
              </span>
            </div>
          </div>
          {finance.total > 0 && (
            <div className="finance-bar-bg">
              <div
                className="finance-bar-fill"
                style={{ width: `${Math.round((finance.released / finance.total) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .gm-dash { display:flex; flex-direction:column; gap:1.75rem; font-family:'Cairo','Tajawal',sans-serif; }
        .greeting { display:flex; align-items:center; justify-content:space-between; }
        .greeting-title { font-size:1.6rem; font-weight:800; color:#0d3d5c; margin:0 0 .2rem; }
        .greeting-sub { font-size:.82rem; color:#94a3b8; margin:0; }
        .err-banner { background:#fef2f2; border:1px solid #fecaca; border-radius:.75rem; padding:.85rem 1rem; font-size:.85rem; color:#b91c1c; font-weight:500; }
        //new styles for notification button and other elements are added below
        .btn-notif {
          display: inline-flex; align-items: center; gap: .4rem;
          padding: .65rem 1.25rem;
          background: linear-gradient(135deg, #F0A500, #d97706);
          color: #fff; font-family: 'Cairo',sans-serif;
          font-size: .88rem; font-weight: 700; border: none;
          border-radius: .75rem; cursor: pointer; transition: all .15s;
          box-shadow: 0 2px 8px rgba(240,165,0,.3); white-space: nowrap;
        }
        .btn-notif:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(240,165,0,.4); }

        .stats-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; }
        .stat-card {
          position:relative; background:#fff; border:1px solid #edf0f5;
          border-radius:1.1rem; padding:1.3rem 1.3rem 1.1rem;
          display:flex; flex-direction:column; gap:.35rem;
          box-shadow:0 2px 8px rgba(27,94,140,.06);
          transition:box-shadow .18s, transform .18s;
          overflow:hidden;
        }
        .stat-card:hover { box-shadow:0 8px 24px rgba(27,94,140,.13); transform:translateY(-2px); }
        .stat-card-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:.3rem; }
        .stat-icon { width:46px; height:46px; border-radius:.875rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .stat-value { font-size:1.9rem; font-weight:800; line-height:1; font-family:'Cairo',sans-serif; }
        .stat-label { font-size:.8rem; font-weight:600; color:#6b7a8d; }
        .stat-sub { font-size:.71rem; color:#b0bac8; margin-top:.05rem; }
        .stat-bar { position:absolute; bottom:0; right:0; left:0; height:3px; border-radius:0 0 1.1rem 1.1rem; }

        .two-col { display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; }
        .card { background:#fff; border:1px solid #e5eaf0; border-radius:1rem; padding:1.5rem; box-shadow:0 1px 4px rgba(27,94,140,.05); }
        .card-title { font-size:.95rem; font-weight:800; color:#0d3d5c; margin:0 0 1.1rem; }

        .gov-list { display:flex; flex-direction:column; gap:.55rem; }
        .gov-row { display:flex; align-items:center; gap:.75rem; }
        .gov-name { font-size:.78rem; font-weight:600; color:#374151; width:110px; flex-shrink:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .gov-bar-wrap { flex:1; height:8px; background:#f0f4f8; border-radius:4px; overflow:hidden; }
        .gov-bar { height:100%; background:linear-gradient(90deg,#1B5E8C,#2E7EB8); border-radius:4px; transition:width .4s ease; }
        .gov-count { font-size:.78rem; font-weight:700; color:#1B5E8C; width:28px; text-align:left; flex-shrink:0; }

        .sponsor-list { display:flex; flex-direction:column; gap:.45rem; }
        .sponsor-row { display:flex; align-items:center; gap:.75rem; padding:.55rem .65rem; border-radius:.625rem; transition:background .12s; }
        .sponsor-row:hover { background:#f8fbff; }
        .sponsor-rank { width:24px; height:24px; border-radius:50%; background:#f0f4f8; color:#6b7a8d; font-size:.72rem; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .sponsor-name { flex:1; font-size:.83rem; font-weight:600; color:#1f2937; }
        .sponsor-count { display:flex; align-items:baseline; gap:.25rem; }
        .sponsor-num { font-size:1rem; font-weight:800; color:#1B5E8C; }
        .sponsor-unit { font-size:.72rem; color:#94a3b8; }

        .table { width:100%; border-collapse:collapse; }
        .table thead tr { background:#f8fafc; }
        .table th { padding:.7rem 1rem; text-align:right; font-size:.72rem; font-weight:700; color:#6b7a8d; border-bottom:1px solid #e5eaf0; }
        .table td { padding:.75rem 1rem; font-size:.83rem; border-bottom:1px solid #f8fafc; vertical-align:middle; }
        .trow { cursor:pointer; transition:background .12s; }
        .trow:hover { background:#f8fbff; }
        .trow:last-child td { border-bottom:none; }
        .avatar { width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#1B5E8C,#0d3d5c); color:#fff; display:flex; align-items:center; justify-content:center; font-size:.85rem; font-weight:700; flex-shrink:0; }
        .gifted { display:inline-block; font-size:.65rem; font-weight:600; color:#f59e0b; background:#fffbeb; border:1px solid #fde68a; border-radius:2rem; padding:.1rem .4rem; }
        .muted { color:#6b7a8d; font-size:.82rem; }

        .finance-card { background:linear-gradient(135deg,#0d3d5c 0%,#1B5E8C 100%); border-radius:1rem; padding:1.5rem; color:#fff; }
        .finance-card .card-title { color:#fff; opacity:.85; }
        .finance-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin-bottom:1rem; }
        .finance-item { display:flex; flex-direction:column; gap:.3rem; }
        .finance-label { font-size:.75rem; color:rgba(255,255,255,.65); font-weight:600; }
        .finance-value { font-size:1.2rem; font-weight:800; font-family:'Cairo',sans-serif; }
        .finance-bar-bg { height:8px; background:rgba(255,255,255,.2); border-radius:4px; overflow:hidden; }
        .finance-bar-fill { height:100%; background:#10b981; border-radius:4px; transition:width .4s ease; }

        .empty-text { font-size:.83rem; color:#94a3b8; margin:0; text-align:center; padding:1rem 0; }

        .skel { background:linear-gradient(90deg,#f0f4f8 25%,#e5eaf0 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; }
        @keyframes shimmer { to { background-position:-200% 0; } }

        .link-btn { background:none; border:none; font-family:'Cairo',sans-serif; font-size:.82rem; font-weight:700; color:#1B5E8C; cursor:pointer; padding:0; }
        .link-btn:hover { opacity:.7; }

        @media (max-width: 900px) {
          .stats-grid { grid-template-columns:repeat(2,1fr); }
          .two-col { grid-template-columns:1fr; }
        }
        @media (max-width: 600px) {
          .gm-dash { gap:1.25rem; }
          .greeting { flex-direction:column; align-items:flex-start; gap:.75rem; }
          .greeting-title { font-size:1.3rem; }
          .stats-grid { grid-template-columns:1fr 1fr; gap:.6rem; }
          .finance-grid { grid-template-columns:1fr 1fr; gap:.75rem; }
          .card { padding:1rem; }
          .sc-top { flex-direction:column; align-items:flex-start; gap:.5rem; }
          .sc-val { font-size:1.5rem; }
          .table th:nth-child(4), .table td:nth-child(4) { display:none; }
        }
        @media (max-width: 480px) {
          .sc-val { font-size:1.3rem; }
          .sc-icon { width:36px; height:36px; }
        }
        @media (max-width: 420px) {
          .stats-grid { grid-template-columns:1fr 1fr; }
          .finance-grid { grid-template-columns:1fr; }
          .btn-notif { width:100%; justify-content:center; }
          .gov-name { width:80px; }
        }
      `}</style>
      <style jsx global>{`
        @media (max-width: 600px) { .stat-val { font-size:1.5rem !important; } }
        @media (max-width: 480px) { .stat-val { font-size:1.25rem !important; } }
        .stat-val { font-size:2rem; font-weight:800; line-height:1; font-family:'Cairo',sans-serif; }
      `}</style>
      {showNotifModal && (
        <SendNotificationModal
          onClose={() => setShowNotifModal(false)}
          onSent={() => setShowNotifModal(false)}
        />
      )}
    </div>
  );
}
