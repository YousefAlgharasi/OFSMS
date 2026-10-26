'use client';

/**
 * AgentDashboard.jsx
 * Component: rendered inside /dashboard when role === 'agent'
 * Task:   feature/ui-dashboard-agent
 * API:    GET /api/dashboard/agent
 *         → { my_orphans[], pending_reports[] }
 *
 * Usage in apps/frontend/src/app/dashboard/page.jsx:
 *   import AgentDashboard from '@/components/dashboards/AgentDashboard';
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import { Users, CheckCircle, Clock, BookOpen, ClipboardList, AlertTriangle, Star, Home } from 'lucide-react';
import StatusBadge, { STATUS_MAP } from '@/components/ui/StatusBadge';
import StatCard from '@/components/ui/StatCard';

const ORPHAN_STATUS_KEYS = ['under_review', 'under_marketing', 'under_sponsorship', 'rejected', 'inactive'];

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ar-YE', { dateStyle: 'medium' });
};

const calcAge = (dob) => {
  if (!dob) return '—';
  return `${Math.floor((Date.now() - new Date(dob)) / (1000 * 60 * 60 * 24 * 365.25))} سنة`;
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionTitle({ children, action }) {
  return (
    <div className="section-title-row">
      <h2 className="section-title">{children}</h2>
      {action}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skel skel-icon" />
      <div style={{ flex: 1 }}>
        <div className="skel skel-val" />
        <div className="skel skel-lbl" />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AgentDashboard() {
  const router = useRouter();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get('/dashboard/agent')
      .then(({ data: res }) => setData(res))
      .catch(() => setError('تعذّر تحميل البيانات. يرجى تحديث الصفحة.'))
      .finally(() => setLoading(false));
  }, []);

  const orphans        = data?.my_orphans      || [];
  const pendingReports = data?.pending_reports || [];

  const counts = orphans.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const today = new Date().toLocaleDateString('ar-YE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="agent-dash" dir="rtl">

      {/* Greeting */}
      <div className="greeting">
        <div>
          <h1 className="greeting-title">مرحباً</h1>
          <p className="greeting-sub">{today}</p>
        </div>
        <Button variant="primary" onClick={() => router.push('/orphans/new')} className="max-sm:w-full max-sm:justify-center">
          + تسجيل يتيم جديد
        </Button>
      </div>

      {error && <div className="err-banner"><AlertTriangle size={15}/> {error}</div>}

      {/* Stat cards */}
      <div className="stats-grid">
        {loading ? (
          [1,2,3,4].map(i => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard icon={<Users size={20}/>}       label="إجمالي الأيتام" value={orphans.length}
              sub="المسجّلون باسمك" color="#1B5E8C" onClick={() => router.push('/my-orphans')} />
            <StatCard icon={<CheckCircle size={20}/>} label="تحت الكفالة" value={counts.under_sponsorship || 0}
              sub="يتيم مكفول حالياً" color="#10b981" />
            <StatCard icon={<Clock size={20}/>}       label="قيد المراجعة" value={counts.under_review || 0}
              sub="بانتظار قرار المشرف" color="#f59e0b" />
            <StatCard icon={<BookOpen size={20}/>}    label="تقارير معلّقة" value={pendingReports.length}
              sub={pendingReports.length > 0 ? 'يرجى رفعها قبل نهاية الشهر' : 'لا تقارير معلّقة'}
              color={pendingReports.length > 0 ? '#ef4444' : '#10b981'} />
          </>
        )}
      </div>

      {/* Pending reports alert */}
      {!loading && pendingReports.length > 0 && (
        <div className="alert-card">
          <div className="alert-icon"><ClipboardList size={24}/></div>
          <div className="alert-body">
            <strong>تقارير الحفظ الشهرية</strong>
            <p>لديك <strong>{pendingReports.length}</strong> يتيم لم يُرفع تقرير حفظ القرآن لهم هذا الشهر. يُرجى الرفع قبل الـ 28.</p>
            <div className="alert-names">
              {pendingReports.slice(0, 5).map((o) => (
                <span key={o.id} className="alert-chip">{o.full_name}</span>
              ))}
              {pendingReports.length > 5 && (
                <span className="alert-chip alert-more">+{pendingReports.length - 5} آخرون</span>
              )}
            </div>
          </div>
          <button className="alert-action" onClick={() => router.push('/quran-reports/new')}>
            رفع التقارير ←
          </button>
        </div>
      )}

      {/* Rejected submissions alert */}
      {!loading && data?.rejected_submissions?.length > 0 && (
        <div className="alert-card alert-danger">
          <div className="alert-icon"><AlertTriangle size={24}/></div>
          <div className="alert-body">
            <strong>طلبات تسجيل مرفوضة</strong>
            <p>لديك <strong>{data.rejected_submissions.length}</strong> طلب تسجيل تم رفضه من قبل المشرف ويحتاج إلى تعديل.</p>
            <div className="rejected-list">
              {data.rejected_submissions.map((sub) => (
                <div key={`${sub.type}-${sub.id}`} className="rejected-item">
                  <div className="rej-info">
                    <span className="rej-type">{sub.type === 'orphan' ? 'يتيم' : 'أسرة'}</span>
                    <span className="rej-name">{sub.name}</span>
                  </div>
                  {sub.notes && (
                    <div className="rej-notes">
                      <span className="rej-notes-lbl">سبب الرفض:</span> {sub.notes}
                    </div>
                  )}
                  <button 
                    className="rej-btn"
                    onClick={() => router.push(`/${sub.type === 'orphan' ? 'orphans' : 'families'}/${sub.id}/edit`)}
                  >
                    تعديل وإعادة إرسال ←
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status breakdown */}
      {!loading && orphans.length > 0 && (
        <div className="section">
          <SectionTitle>توزيع الحالات</SectionTitle>
          <div className="breakdown-card">
            {ORPHAN_STATUS_KEYS.map((status) => {
              const cfg = STATUS_MAP[status];
              const count = counts[status] || 0;
              const pct = orphans.length ? Math.round((count / orphans.length) * 100) : 0;
              return (
                <div key={status} className="breakdown-item">
                  <div className="breakdown-top">
                    <span style={{ fontSize: '.78rem', fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                    <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#374151' }}>{count}</span>
                  </div>
                  <div className="bar-bg">
                    <div className="bar-fill" style={{ width: `${pct}%`, background: cfg.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Latest orphans table */}
      <div className="section">
        <SectionTitle action={
          <button className="link-btn" onClick={() => router.push('/my-orphans')}>عرض الكل →</button>
        }>
          آخر الأيتام المسجّلين
        </SectionTitle>

        {loading ? (
          <div className="table-wrap">
            {[1,2,3].map(i => (
              <div key={i} className="ts-row">
                <div className="skel" style={{ width: 34, height: 34, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div className="skel" style={{ width: '55%', height: 13, marginBottom: 5 }} />
                  <div className="skel" style={{ width: '30%', height: 11 }} />
                </div>
                <div className="skel" style={{ width: 85, height: 22, borderRadius: '2rem' }} />
              </div>
            ))}
          </div>
        ) : orphans.length === 0 ? (
          <div className="empty">
            <Users size={40} color="#9ca3af"/>
            <p style={{ fontSize: '.9rem', color: '#6b7a8d', margin: 0, fontWeight: 600 }}>لا يوجد أيتام مسجّلون بعد</p>
            <Button variant="primary" onClick={() => router.push('/orphans/new')} className="max-sm:w-full max-sm:justify-center">+ تسجيل يتيم جديد</Button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>المحافظة</th>
                  <th>العمر</th>
                  <th>الحالة</th>
                  <th>تاريخ التسجيل</th>
                </tr>
              </thead>
              <tbody>
                {orphans.slice(0, 8).map((o) => (
                  <tr key={o.id} className="trow" onClick={() => router.push('/my-orphans')}
                    tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && router.push('/my-orphans')}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem' }}>
                        <div className="avatar">{o.full_name?.charAt(0) || '؟'}</div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#1f2937' }}>{o.full_name}</div>
                          {o.is_gifted && <span className="gifted"><Star size={10} style={{display:'inline',verticalAlign:'middle'}}/> موهوب</span>}
                        </div>
                      </div>
                    </td>
                    <td className="muted">{o.governorate_ar || '—'}</td>
                    <td className="muted">{calcAge(o.date_of_birth)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="muted">{formatDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orphans.length > 8 && (
              <div style={{ padding: '.75rem 1.1rem', borderTop: '1px solid #f0f4f8' }}>
                <button className="link-btn" onClick={() => router.push('/my-orphans')}>
                  عرض جميع الأيتام ({orphans.length}) →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="section">
        <SectionTitle>إجراءات سريعة</SectionTitle>
        <div className="actions-grid">
          {[
            { icon: <Users size={20}/>,       label: 'تسجيل يتيم جديد',  href: '/orphans/new',       color: '#1B5E8C' },
            { icon: <Home size={20}/>,        label: 'تسجيل أسرة جديدة', href: '/families/new',      color: '#7c3aed' },
            { icon: <BookOpen size={20}/>,    label: 'رفع تقرير حفظ',     href: '/quran-reports/new', color: '#059669' },
            { icon: <CheckCircle size={20}/>, label: 'تأكيد الاستلام',    href: '/receipts/batch',    color: '#db2777' },
            { icon: <ClipboardList size={20}/>, label: 'عرض أيتامي',       href: '/my-orphans',        color: '#d97706' },
          ].map(({ icon, label, href, color }) => (
            <button key={href} className="action-card" onClick={() => router.push(href)}
              style={{ '--ac': color }}>
              <span className="action-icon" style={{ background: `${color}15`, color }}>{icon}</span>

              <span style={{ fontSize: '.82rem', fontWeight: 700, color: '#1f2937' }}>{label}</span>
              <span style={{ fontSize: '.82rem', fontWeight: 700, color, alignSelf: 'flex-end', marginTop: 'auto' }}>←</span>
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .agent-dash { display:flex; flex-direction:column; gap:1.75rem; font-family:'Cairo','Tajawal',sans-serif; }
        .greeting { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
        .greeting-title { font-size:1.6rem; font-weight:800; color:#0d3d5c; margin:0 0 .2rem; }
        .greeting-sub { font-size:.82rem; color:#94a3b8; margin:0; }
        .err-banner { background:#fef2f2; border:1px solid #fecaca; border-radius:.75rem; padding:.85rem 1rem; font-size:.85rem; color:#b91c1c; font-weight:500; }

        /* ── StatCard responsive classes ── */
        .sc-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:.25rem; }
        .sc-icon { width:42px; height:42px; border-radius:.75rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .sc-val { font-size:1.8rem; font-weight:800; line-height:1; font-family:'Cairo',sans-serif; }
        .sc-label { font-size:.82rem; font-weight:600; color:#4b5563; }
        .sc-sub { font-size:.71rem; color:#b0bac8; }

        .stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; }
        .stat-card { position:relative; background:#fff; border:1px solid #edf0f5; border-radius:1.1rem; padding:1.3rem 1.3rem 1.1rem; display:flex; flex-direction:column; gap:.35rem; box-shadow:0 2px 8px rgba(27,94,140,.06); transition:box-shadow .18s,transform .18s; overflow:hidden; }
        .stat-card:hover { box-shadow:0 8px 24px rgba(27,94,140,.13); transform:translateY(-2px); }
        .stat-card-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:.3rem; }
        .stat-icon { width:46px; height:46px; border-radius:.875rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .stat-value { font-size:1.9rem; font-weight:800; line-height:1; font-family:'Cairo',sans-serif; }
        .stat-label { font-size:.8rem; font-weight:600; color:#6b7a8d; }
        .stat-sub { font-size:.71rem; color:#b0bac8; margin-top:.05rem; }
        .stat-bar { position:absolute; bottom:0; right:0; left:0; height:3px; border-radius:0 0 1.1rem 1.1rem; }

        .alert-card { background:#fff7ed; border:1.5px solid #fed7aa; border-radius:1rem; padding:1.25rem 1.5rem; display:flex; align-items:flex-start; gap:1rem; }
        .alert-icon { font-size:1.5rem; flex-shrink:0; }
        .alert-body { flex:1; }
        .alert-body strong { display:block; font-size:.92rem; font-weight:700; color:#9a3412; margin-bottom:.35rem; }
        .alert-body p { font-size:.83rem; color:#c2410c; margin:0 0 .65rem; line-height:1.6; }
        .alert-names { display:flex; flex-wrap:wrap; gap:.4rem; }
        .alert-chip { font-size:.73rem; font-weight:600; padding:.2rem .6rem; background:#fff; border:1px solid #fed7aa; border-radius:2rem; color:#9a3412; }
        .alert-more { color:#6b7280; border-color:#e5eaf0; background:#f9fafb; }
        .alert-action { flex-shrink:0; display:inline-flex; align-items:center; padding:.6rem 1.1rem; background:#ea580c; color:#fff; font-family:'Cairo',sans-serif; font-size:.82rem; font-weight:700; border:none; border-radius:.625rem; cursor:pointer; transition:all .15s; white-space:nowrap; }
        .alert-action:hover { background:#c2410c; }

        .alert-danger { background:#fef2f2; border-color:#fecaca; }
        .alert-danger .alert-body strong { color:#991b1b; }
        .alert-danger .alert-body p { color:#b91c1c; }
        .rejected-list { display:flex; flex-direction:column; gap:.75rem; margin-top:1rem; }
        .rejected-item { background:#fff; border:1px solid #fecaca; border-radius:.75rem; padding:.85rem 1rem; display:flex; flex-direction:column; gap:.5rem; }
        .rej-info { display:flex; align-items:center; gap:.5rem; }
        .rej-type { font-size:.7rem; font-weight:700; padding:.15rem .5rem; background:#fee2e2; color:#991b1b; border-radius:1rem; }
        .rej-name { font-size:.85rem; font-weight:700; color:#1f2937; }
        .rej-notes { font-size:.8rem; color:#dc2626; background:#fef2f2; padding:.5rem .75rem; border-radius:.5rem; margin-bottom:.25rem; }
        .rej-notes-lbl { font-weight:700; }
        .rej-btn { align-self:flex-start; background:none; border:none; font-family:'Cairo',sans-serif; font-size:.78rem; font-weight:700; color:#dc2626; cursor:pointer; padding:0; transition:opacity .15s; }
        .rej-btn:hover { opacity:.7; }

        .section { display:flex; flex-direction:column; gap:.85rem; }
        .section-title-row { display:flex; align-items:center; justify-content:space-between; }
        .section-title { font-size:1rem; font-weight:800; color:#0d3d5c; margin:0; }

        .breakdown-card { background:#fff; border:1px solid #e5eaf0; border-radius:1rem; padding:1.25rem 1.5rem; display:flex; flex-direction:column; gap:.85rem; box-shadow:0 1px 4px rgba(27,94,140,.05); }
        .breakdown-item { display:flex; flex-direction:column; gap:.3rem; }
        .breakdown-top { display:flex; justify-content:space-between; }
        .bar-bg { height:6px; background:#f0f4f8; border-radius:3px; overflow:hidden; }
        .bar-fill { height:100%; border-radius:3px; transition:width .4s ease; }

        .table-wrap { background:#fff; border:1px solid #e5eaf0; border-radius:1rem; overflow:hidden; box-shadow:0 1px 4px rgba(27,94,140,.05); }
        .table { width:100%; border-collapse:collapse; }
        .table thead tr { background:#f8fafc; }
        .table th { padding:.75rem 1.1rem; text-align:right; font-size:.72rem; font-weight:700; color:#6b7a8d; white-space:nowrap; border-bottom:1px solid #e5eaf0; }
        .table td { padding:.8rem 1.1rem; font-size:.83rem; border-bottom:1px solid #f8fafc; vertical-align:middle; }
        .trow { cursor:pointer; transition:background .12s; }
        .trow:hover { background:#f8fbff; }
        .trow:last-child td { border-bottom:none; }
        .avatar { width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg,#1B5E8C,#0d3d5c); color:#fff; display:flex; align-items:center; justify-content:center; font-size:.88rem; font-weight:700; flex-shrink:0; }
        .gifted { display:inline-block; font-size:.65rem; font-weight:600; color:#f59e0b; background:#fffbeb; border:1px solid #fde68a; border-radius:2rem; padding:.1rem .4rem; }
        .muted { color:#6b7a8d; }

        .ts-row { display:flex; align-items:center; gap:1rem; padding:.85rem 1.1rem; border-bottom:1px solid #f8fafc; }
        .ts-row:last-child { border-bottom:none; }
        .skeleton-card { background:#fff; border:1px solid #e5eaf0; border-radius:1rem; padding:1.25rem; display:flex; align-items:flex-start; gap:.85rem; }
        .skel { background:linear-gradient(90deg,#f0f4f8 25%,#e5eaf0 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:.375rem; }
        .skel-icon { width:44px; height:44px; border-radius:.75rem; flex-shrink:0; }
        .skel-val { width:60px; height:22px; margin-bottom:.4rem; }
        .skel-lbl { width:90px; height:12px; }
        @keyframes shimmer { to { background-position:-200% 0; } }

        .actions-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:.85rem; }
        .action-card { background:#fff; border:1.5px solid #e5eaf0; border-radius:1rem; padding:1.1rem; display:flex; flex-direction:column; align-items:flex-start; gap:.6rem; cursor:pointer; transition:all .15s; font-family:'Cairo',sans-serif; }
        .action-card:hover { border-color:var(--ac); box-shadow:0 4px 16px rgba(0,0,0,.06); transform:translateY(-1px); }
        .action-icon { width:40px; height:40px; border-radius:.65rem; display:flex; align-items:center; justify-content:center; font-size:1.2rem; }

        .empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:3rem; gap:.75rem; text-align:center; background:#fff; border:1px solid #e5eaf0; border-radius:1rem; }

        .link-btn { background:none; border:none; font-family:'Cairo',sans-serif; font-size:.82rem; font-weight:700; color:#1B5E8C; cursor:pointer; padding:0; transition:opacity .15s; }
        .link-btn:hover { opacity:.7; }

        @media (max-width: 900px) {
          .stats-grid, .actions-grid { grid-template-columns:repeat(2,1fr); }
        }
        @media (max-width: 600px) {
          .agent-dash { gap:1.25rem; }
          .greeting { flex-direction:column; align-items:flex-start; gap:.75rem; }
          .greeting-title { font-size:1.3rem; }
.alert-card { flex-direction:column; gap:.75rem; padding:1rem; }
          .alert-action { width:100%; justify-content:center; }
          .table th:nth-child(3), .table td:nth-child(3),
          .table th:nth-child(5), .table td:nth-child(5) { display:none; }
          .table-wrap { overflow-x:auto; }
        }
        @media (max-width: 600px) {
          .sc-top { flex-direction:column; align-items:flex-start; gap:.5rem; }
          .sc-val { font-size:1.5rem; }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns:1fr 1fr; gap:.6rem; }
          .actions-grid { grid-template-columns:1fr 1fr; gap:.6rem; }
          .action-card { padding:.75rem; }
          .sc-val { font-size:1.3rem; }
          .sc-icon { width:36px; height:36px; }
          .table th:nth-child(2), .table td:nth-child(2) { display:none; }
        }
        @media (max-width: 360px) {
          .stats-grid { grid-template-columns:1fr; }
          .actions-grid { grid-template-columns:1fr; }
        }
      `}</style>
    </div>
  );
}
