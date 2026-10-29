'use client';

/**
 * page.jsx
 * Route:  /quran-thresholds  (GM only)
 * API:    GET /api/quran-thresholds        → load all thresholds
 *         PUT /api/quran-thresholds/:id    → update a single threshold
 *         POST /api/quran-thresholds       → create a new threshold
 *
 * Lets the GM view and edit the age-based Quran memorization thresholds.
 * Each row is independently editable with inline save + visual feedback.
 */

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, X, Info, Check, Plus } from 'lucide-react';

import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';

// ── Constants ──────────────────────────────────────────────────────────────────

const API_ENDPOINTS = {
  THRESHOLDS: '/quran-thresholds',
  THRESHOLD: (id) => `/quran-thresholds/${id}`,
};

const JUZ_PRESETS = [0.25, 0.5, 1, 1.5, 2];

/** How long (ms) the "saved" indicator stays visible before resetting. */
const SAVE_FEEDBACK_DELAY = 2500;

/** Skeleton placeholder widths for the label / age / juz fields. */
const SKELETON_WIDTHS = [220, 160, 130];

// ── SaveIndicator ──────────────────────────────────────────────────────────────

function SaveIndicator({ state }) {
  if (state === 'idle') return null;
  if (state === 'saving') return (
    <span className="text-[0.72rem] font-semibold text-gray-500">جارٍ الحفظ…</span>
  );
  if (state === 'saved') return (
    <span className="text-[0.72rem] font-bold text-emerald-600 flex items-center gap-1 animate-[fadeInScale_0.2s_ease]">
      <Check size={14} /> تم الحفظ
    </span>
  );
  if (state === 'error') return (
    <span className="text-[0.72rem] font-bold text-red-600 flex items-center gap-1">
      <X size={14} /> فشل الحفظ
    </span>
  );
  return null;
}

// ── ThresholdRow (independently editable) ────────────────────────────────────

function ThresholdRow({ threshold, index }) {
  const [form, setForm] = useState({
    age_min:           threshold.age_min,
    age_max:           threshold.age_max,
    min_juz_per_month: threshold.min_juz_per_month,
    label:             threshold.label || '',
  });
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [dirty, setDirty]         = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
    if (saveState !== 'idle') setSaveState('idle');
  };

  const handleSave = useCallback(async () => {
    setSaveState('saving');
    try {
      await api.put(API_ENDPOINTS.THRESHOLD(threshold.id), {
        age_min:           parseInt(form.age_min),
        age_max:           parseInt(form.age_max),
        min_juz_per_month: parseFloat(form.min_juz_per_month),
        label:             form.label.trim() || null,
      });
      setSaveState('saved');
      setDirty(false);
      setTimeout(() => setSaveState('idle'), SAVE_FEEDBACK_DELAY);
    } catch {
      setSaveState('error');
    }
  }, [form, threshold.id]);

  const handleReset = () => {
    setForm({
      age_min:           threshold.age_min,
      age_max:           threshold.age_max,
      min_juz_per_month: threshold.min_juz_per_month,
      label:             threshold.label || '',
    });
    setDirty(false);
    setSaveState('idle');
  };

  const isValid =
    parseInt(form.age_min) >= 0 &&
    parseInt(form.age_max) > parseInt(form.age_min) &&
    parseFloat(form.min_juz_per_month) > 0;

  return (
    <div
      className={`flex items-start gap-4 py-5 px-6 border-b border-gray-100 transition-colors last:border-b-0 animate-[rowIn_0.35s_ease_both] ${dirty ? 'bg-amber-50 !border-r-[3px] border-r-amber-400 shadow-[inset_3px_0_0_theme(colors.amber.400)]' : 'hover:bg-blue-50/40'}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* ── Index badge ── */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1B5E8C] to-[#134569] text-white text-[0.78rem] font-extrabold flex items-center justify-center shrink-0 mt-6 shadow-[0_2px_6px_rgba(27,94,140,0.25)]">
        {index + 1}
      </div>

      {/* ── Fields ── */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-[2fr_1.6fr_1.4fr] gap-4 min-w-0">

        {/* Label */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.72rem] font-bold text-gray-500 tracking-wide">التسمية</label>
          <Input
            className="rounded-xl border-gray-200 py-2 px-3"
            value={form.label}
            onChange={(e) => handleChange('label', e.target.value)}
            placeholder="مثال: أطفال صغار (5-9)"
          />
        </div>

        {/* Age range */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.72rem] font-bold text-gray-500 tracking-wide">الفئة العمرية (سنة)</label>
          <div className="flex items-center gap-2">
            <Input
              className="flex-1 text-center rounded-xl border-gray-200 py-2 px-2"
              type="number"
              min={0}
              max={98}
              value={form.age_min}
              onChange={(e) => handleChange('age_min', e.target.value)}
              placeholder="من"
            />
            <span className="text-gray-400 text-[0.85rem] shrink-0">—</span>
            <Input
              className="flex-1 text-center rounded-xl border-gray-200 py-2 px-2"
              type="number"
              min={1}
              max={99}
              value={form.age_max}
              onChange={(e) => handleChange('age_max', e.target.value)}
              placeholder="إلى"
            />
          </div>
        </div>

        {/* Min juz */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.72rem] font-bold text-gray-500 tracking-wide">الحد الأدنى (جزء/شهر)</label>
          <div className="flex items-center gap-2">
            <Input
              className="flex-1 text-center rounded-xl border-gray-200 py-2 px-2"
              type="number"
              min={0}
              step={0.25}
              value={form.min_juz_per_month}
              onChange={(e) => handleChange('min_juz_per_month', e.target.value)}
            />
            <span className="text-[0.78rem] font-semibold text-gray-500 shrink-0">جزء</span>
          </div>
          {/* Quick-pick presets */}
          <div className="flex gap-1.5 flex-wrap mt-0.5">
            {JUZ_PRESETS.map((v) => (
              <button
                key={v}
                type="button"
                className={`py-0.5 px-2 border-[1.5px] rounded-full text-[0.72rem] font-bold font-sans cursor-pointer transition-colors ${parseFloat(form.min_juz_per_month) === v ? 'border-[#1B5E8C] bg-[#1B5E8C] text-white' : 'border-gray-200 bg-white text-gray-500 hover:border-[#1B5E8C] hover:text-[#1B5E8C]'}`}
                onClick={() => handleChange('min_juz_per_month', v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-col items-end gap-2 pt-6 shrink-0">
        <SaveIndicator state={saveState} />
        {dirty && (
          <button
            className="bg-transparent border-none cursor-pointer text-[1rem] text-gray-400 p-0.5 transition-all hover:text-gray-700 hover:rotate-[-45deg]"
            onClick={handleReset}
            title="تراجع عن التغييرات"
          >
            ↺
          </button>
        )}
        <button
          className={`py-2 px-4 bg-gradient-to-br from-[#1B5E8C] to-[#134569] text-white font-sans text-[0.82rem] font-bold border-none rounded-xl min-w-[64px] flex items-center justify-center shadow-[0_2px_6px_rgba(27,94,140,0.2)] transition-all ${(!dirty || !isValid) ? 'opacity-40 cursor-not-allowed shadow-none' : 'hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(27,94,140,0.3)]'}`}
          onClick={handleSave}
          disabled={!dirty || !isValid || saveState === 'saving'}
        >
          {saveState === 'saving' ? (
            <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-[spin_0.6s_linear_infinite]" />
          ) : (
            'حفظ'
          )}
        </button>
      </div>
    </div>
  );
}

// ── AddThresholdModal ─────────────────────────────────────────────────────────

function AddThresholdModal({ onClose, onSaved }) {
  const [form, setForm]   = useState({ label: '', age_min: '', age_max: '', min_juz_per_month: '' });
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const isValid =
    parseInt(form.age_min) >= 0 &&
    parseInt(form.age_max) > parseInt(form.age_min) &&
    parseFloat(form.min_juz_per_month) > 0;

  const handleSubmit = async () => {
    setSaving(true);
    setApiErr('');
    try {
      const { data } = await api.post(API_ENDPOINTS.THRESHOLDS, {
        label:             form.label.trim() || null,
        age_min:           parseInt(form.age_min),
        age_max:           parseInt(form.age_max),
        min_juz_per_month: parseFloat(form.min_juz_per_month),
      });
      onSaved(data.threshold);
      onClose();
    } catch (err) {
      setApiErr(
        err.response?.data?.error ||
        err.response?.data?.errors?.[0]?.msg ||
        'حدث خطأ أثناء الحفظ. يرجى المحاولة مجدداً'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/45 z-[100] animate-[fadeIn_0.2s]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] max-w-[94vw] bg-white rounded-2xl z-[101] shadow-[0_24px_64px_rgba(0,0,0,0.2)] font-sans animate-[slideUp_0.22s_ease]" dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between py-4 px-5 border-b border-gray-100">
          <h2 className="text-[0.97rem] font-extrabold text-[#0d3d5c] m-0">إضافة فئة عمرية جديدة</h2>
          <button className="flex items-center p-1 rounded-md text-gray-400 hover:text-gray-700 transition-colors bg-transparent border-none cursor-pointer" onClick={onClose} aria-label="إغلاق">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-3.5 p-5">
          {apiErr && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl py-2.5 px-3.5 text-[0.82rem] text-red-700">
              <AlertTriangle size={16} className="shrink-0" /> {apiErr}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[0.82rem] font-semibold text-gray-700">التسمية</label>
            <Input
              className="rounded-xl"
              value={form.label}
              onChange={e => set('label', e.target.value)}
              placeholder="مثال: أطفال صغار (5-9)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.82rem] font-semibold text-gray-700">من (سنة)</label>
              <Input
                className="rounded-xl"
                type="number"
                min={0}
                value={form.age_min}
                onChange={e => set('age_min', e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.82rem] font-semibold text-gray-700">إلى (سنة)</label>
              <Input
                className="rounded-xl"
                type="number"
                min={1}
                value={form.age_max}
                onChange={e => set('age_max', e.target.value)}
                placeholder="18"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[0.82rem] font-semibold text-gray-700">الحد الأدنى (جزء/شهر)</label>
            <Input
              className="rounded-xl"
              type="number"
              min={0}
              step={0.25}
              value={form.min_juz_per_month}
              onChange={e => set('min_juz_per_month', e.target.value)}
              placeholder="1"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 py-3.5 px-5 border-t border-gray-100">
          <button
            className="inline-flex items-center py-2 px-5 bg-transparent text-gray-500 font-semibold text-[0.85rem] font-sans border-[1.5px] border-gray-200 rounded-xl cursor-pointer transition-colors hover:border-gray-400 hover:text-gray-700"
            onClick={onClose}
          >
            إلغاء
          </button>
          <Button variant="primary" disabled={!isValid || saving} onClick={handleSubmit}>
            {saving
              ? <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-[spin_0.6s_linear_infinite]" />
              : 'إضافة'}
          </Button>
        </div>
      </div>
    </>
  );
}

// ── SkeletonRow ───────────────────────────────────────────────────────────────

function SkeletonRow({ index }) {
  const shimmer = 'bg-gradient-to-r from-gray-100 to-gray-200 animate-[shimmer_1.4s_infinite] bg-[length:200%_100%]';
  return (
    <div className="flex items-start gap-4 py-5 px-6 border-b border-gray-100 last:border-b-0 pointer-events-none" style={{ animationDelay: `${index * 60}ms` }}>
      <div className={`w-7 h-7 rounded-lg shrink-0 mt-6 ${shimmer}`} />
      <div className="flex-1 grid grid-cols-[2fr_1.6fr_1.4fr] gap-4">
        {SKELETON_WIDTHS.map((w, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className={`h-2.5 w-20 rounded-full ${shimmer}`} />
            <div className={`h-9 rounded-xl ${shimmer}`} style={{ width: w }} />
          </div>
        ))}
      </div>
      <div className="pt-6 shrink-0">
        <div className={`w-16 h-8 rounded-xl ${shimmer}`} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QuranThresholdsPage() {
  const [thresholds, setThresholds] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showAdd, setShowAdd]       = useState(false);

  useEffect(() => {
    api.get(API_ENDPOINTS.THRESHOLDS)
      .then((res) => setThresholds(res.data.thresholds || []))
      .catch(() => setError('تعذّر تحميل الإعدادات. يرجى تحديث الصفحة.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="max-w-[860px] mx-auto flex flex-col gap-5 font-sans pb-12" dir="rtl">

        {/* ── Page header ── */}
        <PageHeader
          title="إعدادات حفظ القرآن"
          subtitle="حدود مرجعية لعدد الأجزاء الشهرية لكل فئة عمرية (يستند إليها المشرف عند المراجعة)"
          subtitleClassName="text-[0.82rem] text-gray-400"
          action={
            <button
              className="inline-flex items-center gap-1.5 py-2.5 px-4 bg-gradient-to-br from-[#1B5E8C] to-[#134569] text-white font-sans text-[0.85rem] font-bold border-none rounded-xl cursor-pointer shadow-[0_2px_8px_rgba(27,94,140,0.25)] transition-all shrink-0 self-center hover:from-[#2E7EB8] hover:to-[#1B5E8C] hover:-translate-y-px"
              onClick={() => setShowAdd(true)}
            >
              <Plus size={16} /> إضافة فئة جديدة
            </button>
          }
        />

        {/* ── Info banner ── */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-[0.875rem] py-3.5 px-4 shadow-[0_1px_3px_rgba(37,99,235,0.06)]">
          <div className="flex shrink-0 mt-0.5 text-blue-600">
            <Info size={16} />
          </div>
          <p className="text-[0.82rem] text-blue-700 m-0 leading-relaxed">
            هذه الحدود مرجع للمشرف فقط: يكتب المندوب ما حفظه اليتيم كنص حر، ولا يقارن النظام شيئاً تلقائياً.
            المشرف هو من يقرر اعتماد التقرير أو رفضه، وعند الرفض يُوقَف صرف ذلك الشهر فقط مع بقاء الكفالة سارية.
          </p>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 py-3 px-4 rounded-xl text-[0.85rem]">
            <AlertTriangle size={18} /> {error}
          </div>
        )}

        {/* ── Thresholds card ── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          {/* Card header */}
          <div className="flex items-center justify-between py-4 px-6 bg-gradient-to-r from-[#0d3d5c] to-[#1B5E8C] text-white">
            <span className="text-[0.9rem] font-bold tracking-wide flex items-center gap-2">الفئات العمرية</span>
            <span className="text-[0.78rem] text-white/60 bg-white/[0.12] py-0.5 px-2.5 rounded-full">
              {loading ? '…' : `${thresholds.length} فئات`}
            </span>
          </div>

          {/* Rows */}
          <div className="flex flex-col">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} index={i} />)
              : thresholds.length === 0
                ? (
                  <EmptyState
                    icon={<span className="text-[2rem]">📋</span>}
                    description="لا توجد فئات محددة بعد"
                    className="py-12 px-4 gap-2"
                  />
                )
                : thresholds.map((t, i) => (
                  <ThresholdRow key={t.id} threshold={t} index={i} />
                ))
            }
          </div>
        </div>

        {/* ── Help card ── */}
        <div className="bg-white border border-gray-200 rounded-2xl py-5 px-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-[0.9rem] font-extrabold text-[#0d3d5c] m-0 mb-4 flex items-center gap-2 before:content-[''] before:inline-block before:w-[3px] before:h-4 before:bg-gradient-to-b before:from-[#1B5E8C] before:to-[#134569] before:rounded-sm">
            كيف تعمل هذه الإعدادات؟
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { num: '١', title: 'المندوب يرفع التقرير',     body: 'يكتب بنص حر ما حفظه كل يتيم في نهاية الشهر.' },
              { num: '٢', title: 'النظام يعرض المرجع',        body: 'يعرض بجانب التقرير الحد المرجعي لعمر اليتيم من هذه القائمة، دون أي حكم تلقائي.' },
              { num: '٣', title: 'المشرف يراجع ويقرر',       body: 'يقرأ ما كتبه المندوب ويقرر القبول أو الرفض.' },
              { num: '٤', title: 'الأثر المالي',              body: 'القبول → يُصرف المبلغ. الرفض → يُوقف صرف هذا الشهر فقط.' },
            ].map(({ num, title, body }) => (
              <div key={num} className="flex gap-3 items-start bg-gray-50 border border-gray-200 rounded-xl py-3.5 px-4 transition-colors hover:border-[#1B5E8C]/30">
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1B5E8C] to-[#134569] text-white text-[0.75rem] font-extrabold flex items-center justify-center shrink-0 font-sans shadow-[0_2px_6px_rgba(27,94,140,0.25)]">
                  {num}
                </span>
                <div>
                  <strong className="block text-[0.82rem] font-bold text-gray-800 mb-1">{title}</strong>
                  <p className="text-[0.78rem] text-gray-500 m-0 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {showAdd && (
        <AddThresholdModal
          onClose={() => setShowAdd(false)}
          onSaved={(t) => setThresholds((prev) => [...prev, t])}
        />
      )}
    </AppShell>
  );
}
