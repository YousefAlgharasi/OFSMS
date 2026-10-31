'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Search, Share2, X } from 'lucide-react';

import api from '../lib/api';

export default function ShareAdModal({
  isOpen,
  onClose,
  onSuccess,
  endpoint,
  title,
  subtitle,
}) {
  const [sponsors, setSponsors] = useState([]);
  const [selected, setSelected] = useState([]);
  const [targetAll, setTargetAll] = useState(true);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTargetAll(true);
    setSelected([]);
    setSearch('');
    setError('');
    setLoading(true);
    api.get('/sponsors')
      .then(({ data }) => setSponsors(data.sponsors || []))
      .catch(() => setError('تعذّر تحميل قائمة الكفلاء'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sponsors;
    return sponsors.filter((sponsor) =>
      sponsor.full_name?.toLowerCase().includes(q)
      || sponsor.email?.toLowerCase().includes(q)
      || sponsor.phone?.includes(q)
    );
  }, [search, sponsors]);

  if (!isOpen) return null;

  const toggleSponsor = (id) => {
    setTargetAll(false);
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const submit = async () => {
    if (!targetAll && selected.length === 0) {
      setError('اختر كافلاً واحداً على الأقل أو اختر جميع الكفلاء');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post(endpoint, {
        targetAll,
        sponsorIds: targetAll ? [] : selected,
      });
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.error || 'تعذّرت مشاركة الإعلان');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !saving && onClose()}>
      <div className="modal" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-icon"><Share2 size={18} /></div>
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="close" onClick={onClose} disabled={saving}><X size={17} /></button>
        </div>

        {error && <div className="error"><AlertTriangle size={16} /> {error}</div>}

        <div className="target-row">
          <button
            className={`target ${targetAll ? 'active' : ''}`}
            onClick={() => { setTargetAll(true); setSelected([]); }}
            type="button"
          >
            كل الكفلاء
          </button>
          <button
            className={`target ${!targetAll ? 'active' : ''}`}
            onClick={() => setTargetAll(false)}
            type="button"
          >
            كفلاء محددون
          </button>
        </div>

        {!targetAll && (
          <>
            <div className="search-wrap">
              <Search size={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو البريد أو الهاتف…"
              />
            </div>

            <div className="sponsor-list">
              {loading ? (
                <p className="empty">جارٍ التحميل…</p>
              ) : filtered.length === 0 ? (
                <p className="empty">لا يوجد كفلاء مطابقون</p>
              ) : filtered.map((sponsor) => {
                const checked = selected.includes(sponsor.id);
                return (
                  <button
                    key={sponsor.id}
                    className={`sponsor-row ${checked ? 'selected' : ''}`}
                    type="button"
                    onClick={() => toggleSponsor(sponsor.id)}
                  >
                    <span className="avatar">{sponsor.full_name?.[0] || '؟'}</span>
                    <span className="sponsor-info">
                      <strong>{sponsor.full_name}</strong>
                      <small>{sponsor.email || sponsor.phone || 'بدون بيانات اتصال'}</small>
                    </span>
                    {checked && <Check size={16} />}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="modal-foot">
          <button className="ghost" onClick={onClose} disabled={saving}>إلغاء</button>
          <button className="primary" onClick={submit} disabled={saving || loading}>
            {saving ? 'جارٍ المشاركة…' : 'مشاركة مع الكفلاء'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed; inset: 0; z-index: 1100; background: rgba(15, 23, 42, .45);
          display: flex; align-items: center; justify-content: center; padding: 1rem;
        }
        .modal {
          width: min(520px, 100%); max-height: 90vh; overflow: hidden;
          background: #fff; border-radius: 1rem; box-shadow: 0 24px 70px rgba(0,0,0,.24);
          display: flex; flex-direction: column; font-family: 'Cairo', 'Tajawal', sans-serif;
        }
        .modal-head {
          display: flex; gap: .75rem; align-items: flex-start; padding: 1rem 1.2rem;
          border-bottom: 1px solid #e5eaf0; background: #f8fafc;
        }
        .modal-icon { color: #0f766e; margin-top: .1rem; }
        h2 { margin: 0; font-size: 1rem; color: #0d3d5c; font-weight: 800; }
        p { margin: .15rem 0 0; color: #64748b; font-size: .8rem; }
        .close {
          margin-right: auto; border: none; background: transparent; color: #64748b;
          width: 2rem; height: 2rem; display: inline-flex; align-items: center; justify-content: center;
          cursor: pointer;
        }
        .error {
          display: flex; align-items: center; gap: .45rem; margin: .9rem 1.2rem 0;
          background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;
          border-radius: .65rem; padding: .6rem .75rem; font-size: .82rem;
        }
        .target-row { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; padding: 1rem 1.2rem .7rem; }
        .target {
          border: 1.5px solid #dbe4ee; background: #fff; color: #475569;
          border-radius: .7rem; padding: .65rem; font-family: inherit; font-weight: 800; cursor: pointer;
        }
        .target.active { background: #ecfdf5; border-color: #0f766e; color: #0f766e; }
        .search-wrap {
          margin: 0 1.2rem .7rem; display: flex; align-items: center; gap: .5rem;
          border: 1.5px solid #dbe4ee; border-radius: .7rem; padding: .55rem .75rem; color: #94a3b8;
        }
        .search-wrap input { border: none; outline: none; flex: 1; font-family: inherit; font-size: .84rem; }
        .sponsor-list { overflow-y: auto; max-height: 260px; padding: 0 1.2rem; display: flex; flex-direction: column; gap: .45rem; }
        .sponsor-row {
          display: flex; align-items: center; gap: .65rem; width: 100%; text-align: right;
          border: 1px solid #e5eaf0; background: #fff; border-radius: .75rem; padding: .65rem .75rem;
          font-family: inherit; cursor: pointer; color: #0d3d5c;
        }
        .sponsor-row.selected { border-color: #0f766e; background: #f0fdfa; }
        .avatar {
          width: 34px; height: 34px; border-radius: 50%; background: #0f766e; color: #fff;
          display: inline-flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0;
        }
        .sponsor-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .sponsor-info strong { font-size: .86rem; }
        .sponsor-info small { color: #94a3b8; font-size: .72rem; direction: ltr; text-align: right; }
        .empty { text-align: center; color: #94a3b8; padding: 1rem; }
        .modal-foot {
          display: flex; gap: .65rem; padding: 1rem 1.2rem; border-top: 1px solid #e5eaf0; margin-top: .8rem;
        }
        .ghost, .primary {
          flex: 1; border-radius: .75rem; padding: .7rem; font-family: inherit; font-weight: 800; cursor: pointer;
        }
        .ghost { background: #fff; border: 1.5px solid #dbe4ee; color: #475569; }
        .primary { background: #0f766e; border: 1.5px solid #0f766e; color: #fff; }
        .ghost:disabled, .primary:disabled { opacity: .6; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
