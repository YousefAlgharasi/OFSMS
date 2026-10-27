'use client';

/**
 * SupervisorDashboard.jsx
 * Component: rendered inside /dashboard when role === 'supervisor'
 * API: GET /api/dashboard/supervisor
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import { ClipboardList, BookOpen, Banknote, Calendar, Siren, AlarmClock, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ar-YE', { dateStyle: 'medium' });
};

const daysUntil = (iso) => {
  const diff = new Date(iso) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

function Skel({ w, h, r }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: r || 6 }} />;
}

export default function SupervisorDashboard() {
  const router  = useRouter();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get('/dashboard/supervisor')
      .then(({ data: res }) => setData(res))
      .catch(() => setError('تعذّر تحميل البيانات. يرجى تحديث الصفحة.'))
      .finally(() => setLoading(false));
  }, []);

  const counts        = data?.pending_counts        || {};
  const pendingOrphans  = data?.pending_orphans     || [];
  const pendingFamilies = data?.pending_families    || [];
  const quranReports  = data?.pending_quran_reports || [];
  const disbDate      = data?.next_disbursement_date;
  const daysLeft      = disbDate ? daysUntil(disbDate) : null;
  const disbList      = data?.current_disbursement || null; // this disbursement's list, if generated
  const disbStatus    = disbList?.status || null;
  // Only a missing / draft / rejected list still needs the supervisor
  const disbNeedsAction = !disbStatus || disbStatus === 'draft' || disbStatus === 'rejected';

  const today = new Date().toLocaleDateString('ar-YE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const allPending = [
    ...pendingOrphans.map(o => ({ ...o, record_type: 'orphan' })),
    ...pendingFamilies.map(f => ({ ...f, record_type: 'family' })),
  ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return (
    <div className="sup-dash" dir="rtl">

      {/* Header */}
      <div className="greeting">
        <div>
          <h1 className="greeting-title">لوحة تحكم المشرف</h1>
          <p className="greeting-sub">{today}</p>
        </div>
        <Button variant="primary" onClick={() => router.push('/registrations')} className="max-sm:w-full max-sm:justify-center">
          مراجعة الطلبات ←
        </Button>
      </div>

      {error && <div className="err-banner"><AlertTriangle size={15}/> {error}</div>}

      {/* Stat cards */}
      <div className="stats-grid">
        {loading ? (
          [1,2,3,4].map(i => (
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
            <StatCard
              icon={<ClipboardList size={20}/>} label="طلبات تسجيل معلّقة"
              value={counts.total_registrations}
              sub={`${counts.orphans || 0} يتيم · ${counts.families || 0} أسرة`}
              color="#f59e0b"
              urgent={counts.total_registrations > 0}
              onClick={() => router.push('/registrations')}
            />
            <StatCard
              icon={<BookOpen size={20}/>} label="تقارير حفظ معلّقة"
              value={counts.quran_reports}
              sub="بانتظار المراجعة والاعتماد"
              color="#8b5cf6"
              urgent={counts.quran_reports > 0}
              onClick={() => router.push('/quran-reports')}
            />
            <StatCard
              icon={<Banknote size={20}/>} label="كشوف صرف معلّقة"
              value={counts.disbursements}
              sub="تحتاج اعتمادك"
              color="#ef4444"
              urgent={counts.disbursements > 0}
              onClick={() => router.push('/disbursements')}
            />
            <StatCard
              icon={<Calendar size={20}/>} label="موعد الصرف القادم"
              value={daysLeft !== null ? `${daysLeft} يوم` : '—'}
              sub={disbDate ? formatDate(disbDate) : ''}
              color={daysLeft !== null && daysLeft <= 3 && disbNeedsAction ? '#ef4444' : '#10b981'}
              urgent={daysLeft !== null && daysLeft <= 3 && disbNeedsAction}
            />
          </>
        )}
      </div>

      {/* Disbursement banner — reflects the real state of this month's list */}
      {!loading && daysLeft !== null && daysLeft <= 5 && (() => {
        const dayText = daysLeft === 0 ? 'موعد الصرف اليوم!' : `${daysLeft} ${daysLeft === 1 ? 'يوم' : 'أيام'} على موعد الصرف`;
        const urgent  = daysLeft <= 2;
        const tones = {
          warn:  { border: urgent ? '#fca5a5' : '#fed7aa', bg: urgent ? '#fef2f2' : '#fff7ed', title: urgent ? '#b91c1c' : '#9a3412', text: urgent ? '#dc2626' : '#c2410c' },
          bad:   { border: '#fca5a5', bg: '#fef2f2', title: '#b91c1c', text: '#dc2626' },
          info:  { border: '#bfdbfe', bg: '#eff6ff', title: '#1d4ed8', text: '#2563eb' },
          good:  { border: '#a7f3d0', bg: '#ecfdf5', title: '#047857', text: '#059669' },
        };
        const states = {
          none:                { tone: 'warn', icon: urgent ? <Siren size={24}/> : <AlarmClock size={24}/>, title: dayText, text: 'لم يتم إنشاء كشف الصرف لهذا الشهر بعد', action: 'إنشاء الكشف ←' },
          draft:               { tone: 'warn', icon: urgent ? <Siren size={24}/> : <AlarmClock size={24}/>, title: dayText, text: 'يرجى مراجعة كشف الصرف واعتماده للقسم المالي في أقرب وقت', action: 'مراجعة الكشف ←' },
          rejected:            { tone: 'bad',  icon: <AlertTriangle size={24}/>, title: 'تم رفض كشف الصرف', text: 'الكشف مرفوض ويحتاج إلى معالجة قبل موعد الصرف', action: 'عرض الكشف ←' },
          supervisor_approved: { tone: 'info', icon: <CheckCircle size={24}/>,   title: 'تم اعتماد كشف الصرف', text: 'الكشف جاهز من جهة المشرف — بانتظار اعتماد القسم المالي', action: 'عرض الكشف ←' },
          finance_approved:    { tone: 'info', icon: <CheckCircle size={24}/>,   title: 'اعتمده القسم المالي', text: 'بانتظار إصدار الكشف من المدير العام', action: 'عرض الكشف ←' },
          released:            { tone: 'good', icon: <CheckCircle size={24}/>,   title: 'تم إصدار كشف الصرف', text: 'الكشف جاهز وتم إصداره للمندوبين', action: 'عرض الكشف ←' },
        };
        const st = states[disbStatus || 'none'] || states.none;
        const tone = tones[st.tone];
        return (
          <div className="countdown-banner" style={{ borderColor: tone.border, background: tone.bg }}>
            <div className="countdown-icon" style={{ color: tone.title }}>{st.icon}</div>
            <div>
              <strong style={{ color: tone.title }}>{st.title}</strong>
              <p style={{ color: tone.text, margin: '.25rem 0 0', fontSize: '.82rem' }}>{st.text}</p>
            </div>
            <button className="alert-action" onClick={() => router.push('/disbursements')}>
              {st.action}
            </button>
          </div>
        );
      })()}

      {/* Two-col: pending queue + quran reports */}
      <div className="two-col">

        {/* Pending registrations queue */}
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">طلبات التسجيل المعلّقة</h2>
            <button className="link-btn" onClick={() => router.push('/registrations')}>
              عرض الكل ({counts.total_registrations || 0}) →
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
                  <Skel w={38} h={38} r="50%" />
                  <div style={{ flex: 1 }}>
                    <Skel w="60%" h={13} />
                    <div style={{ marginTop: 5 }}><Skel w="80%" h={11} /></div>
                  </div>
                </div>
              ))}
            </div>
          ) : allPending.length === 0 ? (
            <div className="empty-state">
              <CheckCircle size={32} color="#10b981"/>
              <p>لا توجد طلبات معلّقة</p>
            </div>
          ) : (
            <div className="queue-list">
              {allPending.slice(0, 5).map((item) => (
                <div key={item.id} className="queue-item" onClick={() => router.push('/registrations')}>
                  <div className="queue-avatar">
                    {item.name?.charAt(0) || '؟'}
                  </div>
                  <div className="queue-info">
                    <div className="queue-name">{item.name}</div>
                    <div className="queue-meta">
                      <span className="queue-tag">{item.record_type === 'orphan' ? 'يتيم' : 'أسرة'}</span>
                      <span className="queue-gov">{item.governorate_ar || '—'}</span>
                      <span className="queue-agent">المندوب: {item.agent_name || '—'}</span>
                    </div>
                  </div>
                  <div className="queue-date">{formatDate(item.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quran reports pending */}
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">تقارير الحفظ المعلّقة</h2>
            <button className="link-btn" onClick={() => router.push('/quran-reports')}>
              عرض الكل →
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
                  <Skel w={38} h={38} r="50%" />
                  <div style={{ flex: 1 }}>
                    <Skel w="55%" h={13} />
                    <div style={{ marginTop: 5 }}><Skel w="40%" h={11} /></div>
                  </div>
                </div>
              ))}
            </div>
          ) : quranReports.length === 0 ? (
            <div className="empty-state">
              <CheckCircle size={32} color="#10b981"/>
              <p>لا توجد تقارير معلّقة</p>
            </div>
          ) : (
            <div className="queue-list">
              {quranReports.map((r) => (
                <div key={r.id} className="queue-item" onClick={() => router.push('/quran-reports')}>
                  <div className="queue-avatar" style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }}>
                    {r.orphan_name?.charAt(0) || '؟'}
                  </div>
                  <div className="queue-info">
                    <div className="queue-name">{r.orphan_name}</div>
                    <div className="queue-meta">
                      <span className="queue-tag" style={{ color: '#7c3aed', background: '#f5f3ff' }}>
                        {r.juz_memorized} جزء
                      </span>
                      <span className="queue-agent">المندوب: {r.agent_name}</span>
                    </div>
                  </div>
                  <div className="queue-date">{r.month}/{r.year}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <h2 className="card-title">إجراءات سريعة</h2>
        <div className="actions-grid">
          {[
            { icon: <ClipboardList size={20}/>, label: 'مراجعة التسجيلات',    href: '/registrations',       color: '#f59e0b' },
            { icon: <BookOpen size={20}/>,     label: 'مراجعة تقارير الحفظ', href: '/quran-reports',       color: '#8b5cf6' },
            { icon: <Banknote size={20}/>,     label: 'مراجعة كشف الصرف',    href: '/disbursements',       color: '#ef4444' },
            { icon: <CheckCircle size={20}/>, label: 'متابعة الاستلام',      href: '/receipts/supervisor', color: '#db2777' },
            { icon: <FileText size={20}/>,     label: 'التقارير والتصدير',    href: '/reports',             color: '#059669' },
          ].map(({ icon, label, href, color }) => (
            <button
              key={href}
              className="action-card"
              onClick={() => router.push(href)}
              style={{ '--ac': color }}
            >
              <span className="action-icon" style={{ background: `${color}15`, color }}>{icon}</span>
              <span className="action-label">{label}</span>
              <span className="action-arrow" style={{ color }}>←</span>
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .sup-dash { display:flex; flex-direction:column; gap:1.75rem; font-family:'Cairo','Tajawal',sans-serif; }
        .greeting { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
        .greeting-title { font-size:1.6rem; font-weight:800; color:#0d3d5c; margin:0 0 .2rem; }
        .greeting-sub { font-size:.82rem; color:#94a3b8; margin:0; }
        .err-banner { background:#fef2f2; border:1px solid #fecaca; border-radius:.75rem; padding:.85rem 1rem; font-size:.85rem; color:#b91c1c; }

        /* ── StatCard responsive classes ── */
        .sc-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:.25rem; }
        .sc-icon { width:42px; height:42px; border-radius:.75rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .sc-val { font-size:1.8rem; font-weight:800; line-height:1; font-family:'Cairo',sans-serif; }
        .sc-label { font-size:.82rem; font-weight:600; color:#4b5563; }
        .sc-sub { font-size:.71rem; color:#b0bac8; }

        .stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; }
        .stat-card { position:relative; background:#fff; border:1px solid #edf0f5; border-radius:1.1rem; padding:1.3rem 1.3rem 1.1rem; display:flex; flex-direction:column; gap:.35rem; box-shadow:0 2px 8px rgba(27,94,140,.06); transition:all .18s; overflow:hidden; }
        .stat-card:hover { box-shadow:0 8px 24px rgba(27,94,140,.13); transform:translateY(-2px); }
        .stat-urgent { border-color:var(--c) !important; box-shadow:0 0 0 3px color-mix(in srgb, var(--c) 12%, transparent) !important; }
        .stat-card-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:.3rem; }
        .stat-icon { width:46px; height:46px; border-radius:.875rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .stat-value { font-size:1.9rem; font-weight:800; line-height:1; font-family:'Cairo',sans-serif; }
        .stat-label { font-size:.8rem; font-weight:600; color:#6b7a8d; }
        .stat-sub { font-size:.71rem; color:#b0bac8; margin-top:.05rem; }
        .stat-bar { position:absolute; bottom:0; right:0; left:0; height:3px; border-radius:0 0 1.1rem 1.1rem; }

        .countdown-banner { display:flex; align-items:center; gap:1rem; border:1.5px solid; border-radius:1rem; padding:1.1rem 1.5rem; }
        .countdown-icon { font-size:1.5rem; flex-shrink:0; }
        .countdown-banner strong { display:block; font-size:.92rem; font-weight:700; }
        .countdown-banner div { flex:1; }
        .alert-action { flex-shrink:0; display:inline-flex; align-items:center; padding:.6rem 1.1rem; background:#1B5E8C; color:#fff; font-family:'Cairo',sans-serif; font-size:.82rem; font-weight:700; border:none; border-radius:.625rem; cursor:pointer; transition:all .15s; white-space:nowrap; }
        .alert-action:hover { background:#134569; }

        .two-col { display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; }
        .card { background:#fff; border:1px solid #e5eaf0; border-radius:1rem; padding:1.5rem; box-shadow:0 1px 4px rgba(27,94,140,.05); }
        .card-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.1rem; }
        .card-title { font-size:.95rem; font-weight:800; color:#0d3d5c; margin:0; }

        .queue-list { display:flex; flex-direction:column; gap:.35rem; }
        .queue-item { display:flex; align-items:center; gap:.75rem; padding:.65rem .5rem; border-radius:.625rem; cursor:pointer; transition:background .12s; }
        .queue-item:hover { background:#f8fbff; }
        .queue-avatar { width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#1B5E8C,#0d3d5c); color:#fff; display:flex; align-items:center; justify-content:center; font-size:.88rem; font-weight:700; flex-shrink:0; }
        .queue-info { flex:1; min-width:0; }
        .queue-name { font-size:.83rem; font-weight:700; color:#1f2937; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .queue-meta { display:flex; gap:.4rem; align-items:center; margin-top:.2rem; flex-wrap:wrap; }
        .queue-tag { font-size:.68rem; font-weight:700; padding:.1rem .45rem; border-radius:2rem; background:#eff6ff; color:#3b82f6; }
        .queue-gov { font-size:.72rem; color:#6b7a8d; }
        .queue-agent { font-size:.72rem; color:#94a3b8; }
        .queue-date { font-size:.72rem; color:#94a3b8; flex-shrink:0; white-space:nowrap; }

        .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:2rem; gap:.5rem; }
        .empty-state p { font-size:.83rem; color:#94a3b8; margin:0; font-weight:600; }

        .actions-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:.85rem; margin-top:1rem; }
        .action-card { background:#f8fafc; border:1.5px solid #e5eaf0; border-radius:1rem; padding:1.1rem; display:flex; flex-direction:column; align-items:flex-start; gap:.6rem; cursor:pointer; transition:all .15s; font-family:'Cairo',sans-serif; }
        .action-card:hover { border-color:var(--ac); background:#fff; box-shadow:0 4px 16px rgba(0,0,0,.06); transform:translateY(-1px); }
        .action-icon { width:40px; height:40px; border-radius:.65rem; display:flex; align-items:center; justify-content:center; font-size:1.2rem; }
        .action-label { font-size:.82rem; font-weight:700; color:#1f2937; }
        .action-arrow { font-size:.82rem; font-weight:700; align-self:flex-end; margin-top:auto; }

        .skel { background:linear-gradient(90deg,#f0f4f8 25%,#e5eaf0 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; }
        @keyframes shimmer { to { background-position:-200% 0; } }

        .link-btn { background:none; border:none; font-family:'Cairo',sans-serif; font-size:.78rem; font-weight:700; color:#1B5E8C; cursor:pointer; padding:0; white-space:nowrap; }
        .link-btn:hover { opacity:.7; }

        @media (max-width: 900px) {
          .stats-grid { grid-template-columns:repeat(2,1fr); }
          .two-col { grid-template-columns:1fr; }
          .actions-grid { grid-template-columns:repeat(2,1fr); }
        }
        @media (max-width: 600px) {
          .sup-dash { gap:1.25rem; }
          .greeting { flex-direction:column; align-items:flex-start; gap:.75rem; }
          .greeting-title { font-size:1.3rem; }
.countdown-banner { flex-direction:column; align-items:flex-start; gap:.75rem; padding:1rem; }
          .alert-action { width:100%; justify-content:center; }
          .card { padding:1.1rem; }
          .queue-date { display:none; }
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
        }
        @media (max-width: 360px) {
          .stats-grid { grid-template-columns:1fr; }
          .actions-grid { grid-template-columns:1fr; }
        }
      `}</style>
    </div>
  );
}
