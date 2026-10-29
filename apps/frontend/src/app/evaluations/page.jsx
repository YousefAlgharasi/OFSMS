'use client';

/**
 * /evaluations/page.jsx
 * تقييم الباحث الدوري (الأيتام والأسر) — نظام إدارة كفالة ورعاية الأيتام (OFSMS)
 *
 * Implements complete Periodic Researcher Evaluations for both Orphans and Families:
 * - 2-Column layout: Beneficiary search & list on right, Evaluation profile & history on left.
 * - Toggle switcher between الأيتام (Orphans) and الأسر (Families).
 * - Rich evaluation cards with progress bars for each criterion, notes, scores (/ 5), and overall %.
 * - "+ تقييم جديد" modal with dynamic criteria templates (قرآني، تعليمي، صحي، سلوكي، أسري، حديث).
 * - Real-time overall score calculation.
 * - Edit & Delete functionality with confirmation.
 * - Adheres strictly to the OFSMS Blue Brand Design System (No green buttons!).
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardCheck, Search, Plus, Edit3, Trash2, Calendar, CheckCircle2,
  AlertCircle, X, ChevronDown, Check, User, Home, BookOpen, Heart,
  Shield, Activity, GraduationCap, Sparkles, Eye, EyeOff, Save, RefreshCw,
  FileText, ArrowRight
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import api from '../../lib/api';
import useAuthStore from '../../store/useAuthStore';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

// ── Criteria Templates ────────────────────────────────────────────────────────
const ORPHAN_CRITERIA_TEMPLATE = [
  {
    category: 'قرآني',
    criteria_id: 'quran_commitment',
    title: 'الالتزام بحفظ القرآن الكريم',
    max_score: 5,
    score: 5,
    notes: '',
  },
  {
    category: 'تعليمي',
    criteria_id: 'academic_level',
    title: 'المستوى الدراسي العام',
    max_score: 5,
    score: 5,
    notes: '',
  },
  {
    category: 'تعليمي',
    criteria_id: 'summer_program',
    title: 'البرنامج الصيفي لعام 1448',
    max_score: 5,
    score: 5,
    notes: '',
  },
  {
    category: 'صحي',
    criteria_id: 'health_status',
    title: 'الحالة الصحية',
    max_score: 5,
    score: 5,
    notes: '',
  },
  {
    category: 'سلوكي',
    criteria_id: 'psychological_behavioral',
    title: 'الحالة النفسية والسلوكية',
    max_score: 5,
    score: 5,
    notes: '',
  },
  {
    category: 'سلوكي',
    criteria_id: 'cleanliness_appearance',
    title: 'النظافة والمظهر العام',
    max_score: 5,
    score: 5,
    notes: '',
  },
  {
    category: 'أسري',
    criteria_id: 'family_stability',
    title: 'الحالة الأسرية والاستقرار',
    max_score: 5,
    score: 5,
    notes: '',
  },
  {
    category: 'حديث',
    criteria_id: 'hadith_memorization',
    title: 'حفظ 50 حديث نبوي',
    max_score: 5,
    score: 5,
    notes: '',
  },
];

const FAMILY_CRITERIA_TEMPLATE = [
  {
    category: 'معيشي',
    criteria_id: 'living_income',
    title: 'الوضع المعيشي ومصادر الدخل',
    max_score: 5,
    score: 5,
    notes: '',
  },
  {
    category: 'سكني',
    criteria_id: 'housing_environment',
    title: 'صلاحية ونظافة بيئة السكن',
    max_score: 5,
    score: 5,
    notes: '',
  },
  {
    category: 'صحي',
    criteria_id: 'family_health',
    title: 'الحالة الصحية العامة لأفراد الأسرة',
    max_score: 5,
    score: 5,
    notes: '',
  },
  {
    category: 'تعليمي',
    criteria_id: 'children_education',
    title: 'متابعة واستقرار تعليم الأبناء',
    max_score: 5,
    score: 5,
    notes: '',
  },
  {
    category: 'اجتماعي',
    criteria_id: 'family_cohesion',
    title: 'التماسك والاستقرار الأسري',
    max_score: 5,
    score: 5,
    notes: '',
  },
  {
    category: 'ديني وقيمي',
    criteria_id: 'moral_religious',
    title: 'الالتزام الأخلاقي والقيمي وحلقات الذكر',
    max_score: 5,
    score: 5,
    notes: '',
  },
];

// ── Formatting Helpers ────────────────────────────────────────────────────────
const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  } catch {
    return String(dateStr);
  }
};

const formatDateInput = (dateStr) => {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  try {
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};

export default function EvaluationsPage() {
  const { user } = useAuthStore();
  const canEdit = ['gm', 'supervisor', 'agent'].includes(user?.role);
  const canDelete = ['gm', 'supervisor'].includes(user?.role);

  // Beneficiary filter & list state
  const [beneficiaryType, setBeneficiaryType] = useState('orphan'); // 'orphan' | 'family'
  const [search, setSearch] = useState('');
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(true);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);

  // Evaluations history state
  const [evaluations, setEvaluations] = useState([]);
  const [loadingEvaluations, setLoadingEvaluations] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState(null);
  const [formData, setFormData] = useState({
    evaluationDate: new Date().toISOString().split('T')[0],
    periodName: '',
    showInSponsorPortal: true,
    criteriaScores: [],
    generalSummary: '',
    recommendations: '',
  });
  const [saving, setSaving] = useState(false);

  // Delete modal state
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch Beneficiaries List ────────────────────────────────────────────────
  const fetchBeneficiaries = useCallback(async (type, queryStr = '') => {
    setLoadingBeneficiaries(true);
    try {
      const res = await api.get('/evaluations/beneficiaries', {
        params: { type, search: queryStr }
      });
      const list = res.data?.beneficiaries || [];
      setBeneficiaries(list);

      // Preserve or set selected beneficiary
      // On a laptop the first one opens beside the list; on a phone nothing opens until the user taps
      // (the details open as a popup there, which must not appear by itself)
      const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
      setSelectedBeneficiary((prev) => {
        if (!prev) return wide ? list[0] || null : null;
        const exists = list.find((b) => b.id === prev.id && b.type === type);
        return exists || (wide ? list[0] || null : null);
      });
    } catch (err) {
      console.error('Error fetching beneficiaries:', err);
      showToast('تعذر تحميل قائمة المستفيدين', 'error');
    } finally {
      setLoadingBeneficiaries(false);
    }
  }, []);

  useEffect(() => {
    fetchBeneficiaries(beneficiaryType, search);
  }, [beneficiaryType, search, fetchBeneficiaries]);

  // ── Fetch Evaluations for Selected Beneficiary ─────────────────────────────
  const fetchEvaluations = useCallback(async (type, id) => {
    if (!id) {
      setEvaluations([]);
      return;
    }
    setLoadingEvaluations(true);
    try {
      const res = await api.get('/evaluations', {
        params: { beneficiaryType: type, beneficiaryId: id }
      });
      setEvaluations(res.data?.evaluations || []);
    } catch (err) {
      console.error('Error fetching evaluations:', err);
      showToast('تعذر تحميل سجل التقييمات', 'error');
    } finally {
      setLoadingEvaluations(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBeneficiary?.id) {
      fetchEvaluations(beneficiaryType, selectedBeneficiary.id);
    } else {
      setEvaluations([]);
    }
  }, [selectedBeneficiary, beneficiaryType, fetchEvaluations]);

  // ── Calculate Live Overall Score for Form ──────────────────────────────────
  const liveOverallScore = useMemo(() => {
    if (!formData.criteriaScores || formData.criteriaScores.length === 0) return 0;
    let totalScore = 0;
    let totalMax = 0;
    formData.criteriaScores.forEach((c) => {
      totalScore += parseFloat(c.score || 0);
      totalMax += parseFloat(c.max_score || 5);
    });
    if (totalMax <= 0) return 0;
    return Math.round((totalScore / totalMax) * 100);
  }, [formData.criteriaScores]);

  // ── Open Create Modal ──────────────────────────────────────────────────────
  const handleOpenCreateModal = () => {
    const template = beneficiaryType === 'family' ? FAMILY_CRITERIA_TEMPLATE : ORPHAN_CRITERIA_TEMPLATE;
    setEditingEvaluation(null);
    setFormData({
      evaluationDate: new Date().toISOString().split('T')[0],
      periodName: '',
      showInSponsorPortal: true,
      criteriaScores: template.map((c) => ({ ...c, score: 5, notes: '' })),
      generalSummary: '',
      recommendations: '',
    });
    setModalOpen(true);
  };

  // ── Open Edit Modal ────────────────────────────────────────────────────────
  const handleOpenEditModal = (evalItem) => {
    if (!evalItem) return;
    setEditingEvaluation(evalItem);
    setFormData({
      evaluationDate: formatDateInput(evalItem.evaluation_date),
      periodName: evalItem.period_name || '',
      showInSponsorPortal: evalItem.show_in_sponsor_portal !== false,
      criteriaScores: Array.isArray(evalItem.criteria_scores)
        ? evalItem.criteria_scores.map((c) => ({
            category: c.category || '',
            criteria_id: c.criteria_id || '',
            title: c.title || '',
            max_score: c.max_score || 5,
            score: c.score ?? 5,
            notes: c.notes || '',
          }))
        : [],
      generalSummary: evalItem.general_summary || '',
      recommendations: evalItem.recommendations || '',
    });
    setModalOpen(true);
  };

  // ── Save Evaluation (Create or Update) ─────────────────────────────────────
  const handleSaveEvaluation = async (e) => {
    e.preventDefault();
    if (!selectedBeneficiary?.id) return;

    if (!formData.criteriaScores || formData.criteriaScores.length === 0) {
      showToast('يرجى تحديد درجات معايير التقييم', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingEvaluation) {
        // Update
        await api.put(`/evaluations/${editingEvaluation.id}`, {
          evaluationDate: formData.evaluationDate,
          periodName: formData.periodName,
          showInSponsorPortal: formData.showInSponsorPortal,
          criteriaScores: formData.criteriaScores,
          generalSummary: formData.generalSummary,
          recommendations: formData.recommendations,
        });
        showToast('تم تحديث التقييم بنجاح');
      } else {
        // Create
        await api.post('/evaluations', {
          beneficiaryType,
          beneficiaryId: selectedBeneficiary.id,
          evaluationDate: formData.evaluationDate,
          periodName: formData.periodName,
          showInSponsorPortal: formData.showInSponsorPortal,
          criteriaScores: formData.criteriaScores,
          generalSummary: formData.generalSummary,
          recommendations: formData.recommendations,
        });
        showToast('تم حفظ التقييم بنجاح');
      }

      setModalOpen(false);
      // Refresh list & evaluations
      await fetchEvaluations(beneficiaryType, selectedBeneficiary.id);
      await fetchBeneficiaries(beneficiaryType, search);
    } catch (err) {
      console.error('Error saving evaluation:', err);
      showToast(err.response?.data?.error || 'حدث خطأ أثناء حفظ التقييم', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete Evaluation ──────────────────────────────────────────────────────
  const handleDeleteEvaluation = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await api.delete(`/evaluations/${deleteConfirmId}`);
      showToast('تم حذف التقييم بنجاح');
      setDeleteConfirmId(null);
      await fetchEvaluations(beneficiaryType, selectedBeneficiary.id);
      await fetchBeneficiaries(beneficiaryType, search);
    } catch (err) {
      console.error('Error deleting evaluation:', err);
      showToast(err.response?.data?.error || 'تعذر حذف التقييم', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Group modal criteria by category
  const groupedModalCriteria = useMemo(() => {
    const groups = {};
    formData.criteriaScores.forEach((item, index) => {
      const cat = item.category || 'عام';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ item, index });
    });
    return groups;
  }, [formData.criteriaScores]);

  return (
    <AppShell>
      <div className="min-h-screen bg-[#f8fafc] pb-16 font-sans text-slate-800" dir="rtl">
        {/* Toast Feedback */}
        {toast && (
          <div
            className={`fixed bottom-6 left-6 z-50 flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all duration-200 ${
              toast.type === 'error'
                ? 'bg-red-600 text-white shadow-red-500/20'
                : 'bg-[#1B5E8C] text-white shadow-[#1B5E8C]/25'
            }`}
          >
            {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            {toast.message}
          </div>
        )}

        {/* ── Page Header ──────────────────────────────────────────────────────── */}
        <div className="bg-white border-b border-slate-200/80 px-6 py-5 shadow-xs">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-[#1B5E8C] shadow-xs">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">تقييم الباحث الدوري</h1>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  اختر اليتيم أو الأسرة ثم حدّث التقييم وفق المعايير المعتمدة لضمان جودة الرعاية
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Type Switcher Tabs */}
              <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setBeneficiaryType('orphan');
                    setSearch('');
                  }}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    beneficiaryType === 'orphan'
                      ? 'bg-white text-[#1B5E8C] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  الأيتام
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBeneficiaryType('family');
                    setSearch('');
                  }}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    beneficiaryType === 'family'
                      ? 'bg-white text-[#1B5E8C] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  الأسر
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main 2-Column Layout ────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* ── Right Column: Beneficiaries Search & List (4 cols) ────────────── */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col h-[calc(100vh-180px)] min-h-[580px]">
              
              {/* Search Header */}
              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ابحث عن {beneficiaryType === 'family' ? 'الأسرة' : 'اليتيم'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="الاسم أو الرقم..."
                    className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C] transition-all"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Beneficiaries Scrollable List */}
              <div className="flex-1 overflow-y-auto pr-0.5 space-y-2 divide-y-0">
                {loadingBeneficiaries ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Spinner size="md" variant="primary" />
                    <span className="text-xs">جارٍ التحميل...</span>
                  </div>
                ) : beneficiaries.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-semibold">لا توجد نتائج مطابقة</p>
                  </div>
                ) : (
                  beneficiaries.map((b) => {
                    const isSelected = selectedBeneficiary?.id === b.id;
                    const code = b.type === 'family'
                      ? `FAM-${String(b.id).padStart(6, '0')}`
                      : `ORP-${String(b.id).padStart(6, '0')}`;

                    return (
                      <div
                        key={`${b.type}-${b.id}`}
                        onClick={() => setSelectedBeneficiary(b)}
                        className={`group p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-50/70 border-[#1B5E8C] shadow-xs'
                            : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                b.type === 'family'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                                  : 'bg-blue-100 text-[#1B5E8C] border border-blue-200/60'
                              }`}
                            >
                              {b.type === 'family' ? 'أسرة' : 'يتيم'}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {code}
                            </span>
                          </div>
                          <h3
                            className={`text-xs font-bold truncate ${
                              isSelected ? 'text-[#1B5E8C]' : 'text-slate-800'
                            }`}
                          >
                            {b.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                            <span>{b.governorate_name || 'غير محدد'}</span>
                            {b.head_of_family && <span>• المعيل: {b.head_of_family}</span>}
                            {b.guardian_name && <span>• الولي: {b.guardian_name}</span>}
                          </div>
                        </div>

                        {/* Right side stats badge */}
                        <div className="text-left shrink-0 mr-2">
                          {b.latest_score !== null && b.latest_score !== undefined ? (
                            <span
                              className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                                b.latest_score >= 80
                                  ? 'bg-blue-100 text-[#1B5E8C] border-blue-200'
                                  : b.latest_score >= 60
                                  ? 'bg-sky-50 text-sky-800 border-sky-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {b.latest_score}%
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">جديد</span>
                          )}
                          <div className="text-[10px] text-slate-400 mt-0.5 text-center">
                            {b.evaluations_count > 0 ? `${b.evaluations_count} تقييم` : 'لا يوجد'}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── Left Column: Profile & Evaluation History (8 cols) ─────────── */}
            {/* On a phone the details open as a full-screen popup (so it is obvious that something opened);
                on large screens they stay in the side column as before */}
            <div
              className={`lg:col-span-8 space-y-5 ${
                selectedBeneficiary
                  ? 'fixed inset-0 z-30 overflow-y-auto overscroll-contain bg-[#f8fafc] p-4 pb-24 lg:static lg:z-auto lg:overflow-visible lg:bg-transparent lg:p-0 lg:pb-0 animate-in fade-in slide-in-from-bottom-6 duration-200 lg:animate-none'
                  : ''
              }`}
            >
              {selectedBeneficiary && (
                <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-1 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
                  <button
                    type="button"
                    onClick={() => setSelectedBeneficiary(null)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 active:bg-slate-100"
                  >
                    <ArrowRight className="h-4 w-4" /> رجوع
                  </button>
                  <span className="truncate text-sm font-extrabold text-slate-900">{selectedBeneficiary.name}</span>
                </div>
              )}
              {!selectedBeneficiary ? (
                <div className="hidden lg:block bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 shadow-xs">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-40 text-[#1B5E8C]" />
                  <h3 className="text-sm font-bold text-slate-700 mb-1">لم يتم اختيار أي مستفيد</h3>
                  <p className="text-xs text-slate-500">
                    اختر يتيماً أو أسرة من القائمة الجانبية لعرض التقييمات وإضافة تقييم جديد
                  </p>
                </div>
              ) : (
                <>
                  {/* Beneficiary Header Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 mb-1">
                        {selectedBeneficiary.name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono text-slate-600 font-semibold">
                          {selectedBeneficiary.type === 'family'
                            ? `FAM-${String(selectedBeneficiary.id).padStart(6, '0')}`
                            : `ORP-${String(selectedBeneficiary.id).padStart(6, '0')}`}
                        </span>
                        <span>•</span>
                        <span>{selectedBeneficiary.governorate_name || 'صنعاء'}</span>
                        {selectedBeneficiary.guardian_name && (
                          <>
                            <span>•</span>
                            <span>ولي الأمر: {selectedBeneficiary.guardian_name}</span>
                          </>
                        )}
                        {selectedBeneficiary.head_of_family && (
                          <>
                            <span>•</span>
                            <span>رب الأسرة: {selectedBeneficiary.head_of_family}</span>
                          </>
                        )}
                        {selectedBeneficiary.status && (
                          <>
                            <span>•</span>
                            <span className="text-[#1B5E8C] font-semibold">
                              الحالة: {selectedBeneficiary.status === 'sponsored' ? 'مكفول' : selectedBeneficiary.status}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* New Evaluation Button (OFSMS Blue Brand!) */}
                    {canEdit && (
                      <Button
                        variant="primary"
                        onClick={handleOpenCreateModal}
                        className="gap-2 shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        تقييم جديد
                      </Button>
                    )}
                  </div>

                  {/* Evaluations History Header & Actions */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
                    <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">سجل التقييمات</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          تاريخ التقييمات الدورية للباحث ونتائج المعايير
                        </p>
                      </div>

                      {/* Edit latest evaluation shortcut button */}
                      {canEdit && evaluations.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(evaluations[0])}
                          className="px-3.5 py-1.5 text-xs font-semibold text-[#1B5E8C] bg-blue-50/70 border border-blue-200/80 rounded-xl hover:bg-blue-100/70 transition-all flex items-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          تعديل آخر تقييم
                        </button>
                      )}
                    </div>

                    {/* Evaluations List */}
                    {loadingEvaluations ? (
                      <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                        <Spinner size="md" variant="primary" />
                        <span className="text-xs">جارٍ تحميل التقييمات...</span>
                      </div>
                    ) : evaluations.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        <ClipboardCheck className="w-10 h-10 mx-auto mb-2 opacity-40 text-[#1B5E8C]" />
                        <p className="text-xs font-semibold text-slate-600">
                          لا توجد تقييمات مسجلة لهذا المستفيد بعد
                        </p>
                        {canEdit && (
                          <div className="mt-3">
                            <Button
                              variant="outline"
                              onClick={handleOpenCreateModal}
                              className="text-xs py-1.5 px-3"
                            >
                              + إضافة أول تقييم
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {evaluations.map((item, idx) => {
                          const isLatest = idx === 0;
                          const criteriaList = Array.isArray(item.criteria_scores)
                            ? item.criteria_scores
                            : [];

                          return (
                            <div
                              key={item.id}
                              className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden transition-all hover:border-slate-300"
                            >
                              {/* Evaluation Card Header */}
                              <div className="bg-slate-50/70 px-5 py-3 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                  <ClipboardCheck className="w-4 h-4 text-[#1B5E8C]" />
                                  <span className="text-xs font-bold text-slate-800">
                                    تقييم {formatDateDisplay(item.evaluation_date)}
                                  </span>
                                  {item.period_name && (
                                    <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                      {item.period_name}
                                    </span>
                                  )}
                                  {isLatest && (
                                    <span className="bg-blue-100 text-[#1B5E8C] text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                                      الأحدث
                                    </span>
                                  )}
                                  {item.show_in_sponsor_portal && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                      <Eye className="w-3 h-3" />
                                      يظهر في تقرير الكافل
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3">
                                  {/* Overall Score Badge */}
                                  <div
                                    className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                                      item.overall_score >= 80
                                        ? 'bg-blue-50 text-[#1B5E8C] border-blue-200'
                                        : item.overall_score >= 60
                                        ? 'bg-sky-50 text-sky-800 border-sky-200'
                                        : 'bg-amber-50 text-amber-800 border-amber-200'
                                    }`}
                                  >
                                    التقييم العام {item.overall_score}%
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
                                    {canEdit && (
                                      <button
                                        type="button"
                                        title="تعديل التقييم"
                                        onClick={() => handleOpenEditModal(item)}
                                        className="p-1.5 text-slate-400 hover:text-[#1B5E8C] hover:bg-white rounded-lg transition-all"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {canDelete && (
                                      <button
                                        type="button"
                                        title="حذف التقييم"
                                        onClick={() => setDeleteConfirmId(item.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Card Body: Criteria Grid (2 Columns matching screenshot) */}
                              <div className="p-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {criteriaList.map((crit, cIdx) => {
                                    const max = crit.max_score || 5;
                                    const score = crit.score || 0;
                                    const percent = Math.min(100, Math.max(0, (score / max) * 100));

                                    return (
                                      <div
                                        key={cIdx}
                                        className="p-3 rounded-xl bg-slate-50/50 border border-slate-100 flex flex-col justify-between"
                                      >
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs font-bold text-slate-800">
                                            {crit.title}
                                          </span>
                                          <span className="text-xs font-bold text-slate-600 font-mono">
                                            {max} / {score}
                                          </span>
                                        </div>

                                        {/* Progress Bar in OFSMS Blue */}
                                        <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden mb-1.5">
                                          <div
                                            className="bg-gradient-to-l from-[#1B5E8C] to-[#2E7EB8] h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${percent}%` }}
                                          />
                                        </div>

                                        {/* Criterion Researcher Note */}
                                        {crit.notes ? (
                                          <p className="text-[11px] text-slate-500 mt-1 italic leading-relaxed">
                                            {crit.notes}
                                          </p>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* General Summary & Recommendations */}
                                {(item.general_summary || item.recommendations) && (
                                  <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {item.general_summary && (
                                      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60">
                                        <span className="block text-[11px] font-bold text-slate-700 mb-1">
                                          ملخص عام:
                                        </span>
                                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                                          {item.general_summary}
                                        </p>
                                      </div>
                                    )}

                                    {item.recommendations && (
                                      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60">
                                        <span className="block text-[11px] font-bold text-slate-700 mb-1">
                                          التوصيات:
                                        </span>
                                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                                          {item.recommendations}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Footer: Researcher & Timestamp */}
                                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                                  <span>
                                    الباحث: {item.researcher_name || 'غير محدد'}
                                  </span>
                                  <span>
                                    التاريخ: {formatDateDisplay(item.evaluation_date)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

          </div>
        </div>

        {/* ── Add / Edit Evaluation Modal ─────────────────────────────────────── */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]"
              dir="rtl"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/60">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingEvaluation ? 'تعديل التقييم الدوري' : 'تقييم جديد'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    المستفيد: {selectedBeneficiary?.name} ({selectedBeneficiary?.type === 'family' ? 'أسرة' : 'يتيم'})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body Form */}
              <form onSubmit={handleSaveEvaluation} className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Top Row: Date, Period, Visibility Toggle */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
                  {/* Evaluation Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      تاريخ التقييم <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.evaluationDate}
                      onChange={(e) => setFormData({ ...formData, evaluationDate: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C]"
                    />
                  </div>

                  {/* Period Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      الفترة (اختياري)
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: الربع الأول 2026"
                      value={formData.periodName}
                      onChange={(e) => setFormData({ ...formData, periodName: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C]"
                    />
                  </div>

                  {/* Show in Sponsor Portal Toggle */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      يظهر في تقرير الكافل
                    </label>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            showInSponsorPortal: !formData.showInSponsorPortal,
                          })
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          formData.showInSponsorPortal ? 'bg-[#1B5E8C]' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            formData.showInSponsorPortal ? '-translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className="text-xs font-semibold text-slate-700">
                        {formData.showInSponsorPortal ? 'نعم' : 'لا'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Computed Overall Score Indicator */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#1B5E8C]" />
                    <span className="text-xs font-bold text-[#1B5E8C]">
                      الدرجة الإجمالية المحسوبة للتقييم:
                    </span>
                  </div>
                  <div className="text-sm font-extrabold text-[#1B5E8C] px-3 py-0.5 bg-white rounded-lg border border-blue-200 shadow-2xs">
                    {liveOverallScore}%
                  </div>
                </div>

                {/* Categorized Criteria */}
                <div className="space-y-6">
                  {Object.entries(groupedModalCriteria).map(([category, items]) => (
                    <div key={category} className="space-y-3">
                      {/* Category Header */}
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                        <span className="text-xs font-bold text-[#1B5E8C] bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200/60">
                          {category}
                        </span>
                      </div>

                      {/* Criteria Items in this Category */}
                      <div className="space-y-3">
                        {items.map(({ item, index }) => (
                          <div
                            key={item.criteria_id || index}
                            className="p-4 rounded-xl bg-slate-50/40 border border-slate-200 space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-800">
                                {item.title}
                              </span>

                              {/* Score Stepper / Quick Select */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">/ 5</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="5"
                                  step="0.5"
                                  value={item.score}
                                  onChange={(e) => {
                                    const val = Math.max(0, Math.min(5, parseFloat(e.target.value) || 0));
                                    const next = [...formData.criteriaScores];
                                    next[index].score = val;
                                    setFormData({ ...formData, criteriaScores: next });
                                  }}
                                  className="w-20 px-2.5 py-1 text-center font-bold text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C]"
                                />
                                
                                {/* Quick Score Buttons [1, 2, 3, 4, 5] */}
                                <div className="hidden sm:flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((num) => (
                                    <button
                                      key={num}
                                      type="button"
                                      onClick={() => {
                                        const next = [...formData.criteriaScores];
                                        next[index].score = num;
                                        setFormData({ ...formData, criteriaScores: next });
                                      }}
                                      className={`w-6 h-6 rounded-md text-[10px] font-bold transition-all ${
                                        item.score === num
                                          ? 'bg-[#1B5E8C] text-white shadow-xs'
                                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                      }`}
                                    >
                                      {num}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Criterion Notes */}
                            <textarea
                              rows={2}
                              placeholder="ملاحظة الباحث على هذا المعيار"
                              value={item.notes}
                              onChange={(e) => {
                                const next = [...formData.criteriaScores];
                                next[index].notes = e.target.value;
                                setFormData({ ...formData, criteriaScores: next });
                              }}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C] resize-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Textareas: General Summary & Recommendations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ملخص عام
                    </label>
                    <textarea
                      rows={3}
                      placeholder="خلاصة حالة المستفيد في هذه الفترة"
                      value={formData.generalSummary}
                      onChange={(e) => setFormData({ ...formData, generalSummary: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C] resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      التوصيات
                    </label>
                    <textarea
                      rows={3}
                      placeholder="ما يحتاجه المستفيد في الفترة القادمة"
                      value={formData.recommendations}
                      onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C] resize-none"
                    />
                  </div>
                </div>

                {/* Modal Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setModalOpen(false)}
                    disabled={saving}
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={saving}
                    className="gap-2"
                  >
                    <Save className="w-4 h-4" />
                    حفظ التقييم
                  </Button>
                </div>

              </form>
            </div>
          </div>
        )}

        {/* ── Delete Confirmation Modal ───────────────────────────────────────── */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">تأكيد حذف التقييم</h3>
              <p className="text-xs text-slate-500 mb-6">
                هل أنت متأكد من رغبتك في حذف هذا التقييم الدوري؟ لا يمكن التراجع عن هذا الإجراء.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={deleting}
                >
                  إلغاء
                </Button>
                <Button
                  variant="danger"
                  loading={deleting}
                  onClick={handleDeleteEvaluation}
                >
                  حذف التقييم
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
