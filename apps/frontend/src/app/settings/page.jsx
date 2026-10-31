'use client';

/**
 * /settings/page.jsx
 * إعدادات النظام — نظام إدارة كفالة ورعاية الأيتام (OFSMS)
 *
 * Implements full System Settings matching the OFSMS Design System:
 * - Tab 1: الهوية والمظهر (Logo upload/remove, Org names, Taglines, Default login language)
 * - Tab 2: الترقيم والعملة (Default wallet currency, Numbering prefixes for Sponsor, Orphan, Family)
 * - Tab 3: رسائل الكفلاء (Portal URL, Dynamic Variables chips, Template Textarea, Reset to Default)
 * - Tab 4: القوائم المرجعية (Sub-categories: برامج المساعدة، العملات، تصنيفات المستفيدين، الجنسيات، المدن، معايير التقييم with full CRUD)
 * - Tab 5: النسخ الاحتياطي والسجلات (Instant backup trigger & history, System Audit Logs trail)
 * - Strictly follows the OFSMS Blue Brand Design System (No green buttons, No back button).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Settings, Upload, X, Save, RefreshCw, CheckCircle2, AlertCircle,
  DollarSign, Hash, MessageSquare, ListFilter, Database, Shield,
  Plus, Edit3, Trash2, Check, Clock, Eye, Download, FileText,
  User, Tag, Globe, MapPin, Award, CheckSquare, ChevronLeft
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import api from '../../lib/api';
import useAuthStore from '../../store/useAuthStore';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

// ── Default Message Template ──────────────────────────────────────────────────
const DEFAULT_SPONSOR_TEMPLATE = `🌿 السلام عليكم {{name}}

تم إنشاء حسابك في بوابة الكافل — {{org_name}}

رقم الكافل: {{code}}
كلمة المرور: {{password}}
رابط الدخول: {{portal_url}}

يرجى الحفاظ على بياناتك وعدم مشاركتها مع أي شخص.
جزاك الله خيراً على عطائك.`;

// ── Reference List Categories Metadata ────────────────────────────────────────
const REFERENCE_CATEGORIES = [
  { id: 'assistance_programs', label: 'برامج المساعدة', icon: Award, desc: 'أضف أو عدل البرامج (كسوة العيد، الأضاحي، التمر، مكافآت مالية...)' },
  { id: 'currencies', label: 'العملات', icon: DollarSign, desc: 'إدارة العملات المعتمدة وأسعار التحويل' },
  { id: 'beneficiary_types', label: 'تصنيفات المستفيدين', icon: Tag, desc: 'تصنيفات الأيتام والأسر والمستفيدين' },
  { id: 'nationalities', label: 'الجنسيات', icon: Globe, desc: 'قائمة الجنسيات المعتمدة في النظام' },
  { id: 'cities', label: 'المدن والمحافظات', icon: MapPin, desc: 'المحافظات والمدن المعتمدة للتوزيع والمتابعة' },
  { id: 'criteria', label: 'معايير التقييم', icon: CheckSquare, desc: 'معايير تقييم الباحث الدوري للأيتام والأسر' },
];

export default function SystemSettingsPage() {
  const { user } = useAuthStore();
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Active Main Tab: 'identity' | 'numbering' | 'sponsor_messages' | 'reference_lists' | 'backups'
  const [activeTab, setActiveTab] = useState('identity');

  // Loading & Saving states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // ── Tab 1: Identity & Appearance State ─────────────────────────────────────
  const [identity, setIdentity] = useState({
    logo_url: '/logo.png',
    org_name_ar: 'مؤسسة نماء التنموية الخيرية',
    org_name_en: 'Namaa Charitable Foundation',
    tagline_ar: 'تهدف لخدمة وتنمية المجتمع صحياً وثقافياً واجتماعياً ومهنياً',
    tagline_en: 'It aims to serve and develop the community health-wise, culturally, socially, and professionally',
    default_language: 'ar',
  });

  // ── Tab 2: Numbering & Currency State ──────────────────────────────────────
  const [numberingCurrency, setNumberingCurrency] = useState({
    default_currency: 'YER',
    sponsor_prefix: 'SPN',
    orphan_prefix: 'ORP',
    family_prefix: 'FAM',
  });

  // ── Tab 3: Sponsor Messages State ──────────────────────────────────────────
  const [sponsorMessages, setSponsorMessages] = useState({
    portal_url: typeof window !== 'undefined' ? `${window.location.origin}/sponsor/login` : '',
    template: DEFAULT_SPONSOR_TEMPLATE,
  });

  // ── Tab 4: Reference Lists State ───────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState('assistance_programs');
  const [referenceItems, setReferenceItems] = useState([]);
  const [loadingRefItems, setLoadingRefItems] = useState(false);
  const [newRefName, setNewRefName] = useState('');
  const [newRefDesc, setNewRefDesc] = useState('');
  const [addingRef, setAddingRef] = useState(false);
  const [editingRefItem, setEditingRefItem] = useState(null);

  // ── Tab 5: Backups & Audit Logs State ──────────────────────────────────────
  const [backups, setBackups] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);

  // Toast feedback helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch Initial System Settings ──────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      const data = res.data?.settings || {};
      if (data.identity) setIdentity((prev) => ({ ...prev, ...data.identity }));
      if (data.numbering_currency) setNumberingCurrency((prev) => ({ ...prev, ...data.numbering_currency }));
      if (data.sponsor_messages) setSponsorMessages((prev) => ({ ...prev, ...data.sponsor_messages }));
    } catch (err) {
      console.error('Error fetching settings:', err);
      showToast('تعذر تحميل إعدادات النظام', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ── Fetch Reference Items for Category ─────────────────────────────────────
  const fetchRefItems = useCallback(async (category) => {
    setLoadingRefItems(true);
    try {
      const res = await api.get('/settings/reference-lists', { params: { category } });
      setReferenceItems(res.data?.items || []);
    } catch (err) {
      console.error('Error fetching reference list:', err);
      showToast('تعذر تحميل عناصر القائمة المرجعية', 'error');
    } finally {
      setLoadingRefItems(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'reference_lists') {
      fetchRefItems(selectedCategory);
    }
  }, [activeTab, selectedCategory, fetchRefItems]);

  // ── Fetch Backups & Audit Logs ─────────────────────────────────────────────
  const fetchBackupsAndLogs = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const [backupsRes, logsRes] = await Promise.all([
        api.get('/settings/backups'),
        api.get('/settings/audit-logs?limit=30'),
      ]);
      setBackups(backupsRes.data?.backups || []);
      setAuditLogs(logsRes.data?.logs || []);
    } catch (err) {
      console.error('Error fetching backups/logs:', err);
      showToast('تعذر تحميل بيانات النسخ الاحتياطي والسجلات', 'error');
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'backups') {
      fetchBackupsAndLogs();
    }
  }, [activeTab, fetchBackupsAndLogs]);

  // ── Save All Settings ──────────────────────────────────────────────────────
  const handleSaveAllSettings = async () => {
    setSaving(true);
    try {
      await api.put('/settings', {
        identity,
        numbering_currency: numberingCurrency,
        sponsor_messages: sponsorMessages,
      });
      showToast('تم حفظ جميع إعدادات النظام بنجاح');
    } catch (err) {
      console.error('Error saving settings:', err);
      showToast(err.response?.data?.error || 'حدث خطأ أثناء حفظ الإعدادات', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Handle Logo File Selection ─────────────────────────────────────────────
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!/^image\/(png|jpe?g|webp|svg\+xml|gif)$/.test(file.type)) {
      showToast('الشعار يجب أن يكون صورة (PNG أو JPG أو WEBP أو SVG)', 'error');
      e.target.value = '';
      return;
    }
    if (file.size > 500 * 1024) {
      showToast('حجم الشعار يجب ألا يتجاوز 500 كيلوبايت', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setIdentity((prev) => ({ ...prev, logo_url: uploadEvent.target.result }));
      showToast('تم تحميل الشعار بنجاح، يرجى حفظ الإعدادات');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setIdentity((prev) => ({ ...prev, logo_url: '' }));
    showToast('تمت إزالة الشعار');
  };

  // ── Insert Variable Tag into Textarea ──────────────────────────────────────
  const handleInsertTag = (tag) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setSponsorMessages((prev) => ({
        ...prev,
        template: prev.template + ' ' + tag,
      }));
      return;
    }

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const current = sponsorMessages.template || '';
    const updated = current.substring(0, start) + tag + current.substring(end);

    setSponsorMessages((prev) => ({ ...prev, template: updated }));

    // Refocus and place cursor after inserted tag
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  // ── Reference Items CRUD ───────────────────────────────────────────────────
  const handleAddRefItem = async (e) => {
    e.preventDefault();
    if (!newRefName.trim()) return;

    setAddingRef(true);
    try {
      const nextSort = (referenceItems.length + 1) * 10;
      const res = await api.post('/settings/reference-lists', {
        category: selectedCategory,
        name: newRefName.trim(),
        description: newRefDesc.trim() || null,
        sort_order: nextSort,
        is_active: true,
      });
      setReferenceItems((prev) => [...prev, res.data.item]);
      setNewRefName('');
      setNewRefDesc('');
      showToast('تمت إضافة العنصر بنجاح');
    } catch (err) {
      console.error('Error adding reference item:', err);
      showToast('تعذر إضافة العنصر', 'error');
    } finally {
      setAddingRef(false);
    }
  };

  const handleToggleRefActive = async (item) => {
    try {
      const updatedActive = !item.is_active;
      await api.put(`/settings/reference-lists/${item.id}`, {
        is_active: updatedActive,
      });
      setReferenceItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_active: updatedActive } : i))
      );
      showToast(updatedActive ? 'تم تفعيل العنصر' : 'تم إيقاف العنصر');
    } catch (err) {
      console.error('Error toggling status:', err);
      showToast('تعذر تغيير حالة العنصر', 'error');
    }
  };

  const handleDeleteRefItem = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا العنصر؟')) return;
    try {
      await api.delete(`/settings/reference-lists/${id}`);
      setReferenceItems((prev) => prev.filter((i) => i.id !== id));
      showToast('تم حذف العنصر بنجاح');
    } catch (err) {
      console.error('Error deleting reference item:', err);
      showToast('تعذر حذف العنصر', 'error');
    }
  };

  const handleSaveEditRefItem = async () => {
    if (!editingRefItem || !editingRefItem.name.trim()) return;
    try {
      const res = await api.put(`/settings/reference-lists/${editingRefItem.id}`, {
        name: editingRefItem.name.trim(),
        description: editingRefItem.description,
        sort_order: parseInt(editingRefItem.sort_order, 10) || 10,
      });
      setReferenceItems((prev) =>
        prev.map((i) => (i.id === editingRefItem.id ? res.data.item : i))
      );
      setEditingRefItem(null);
      showToast('تم تعديل العنصر بنجاح');
    } catch (err) {
      console.error('Error updating reference item:', err);
      showToast('تعذر تعديل العنصر', 'error');
    }
  };

  // ── Trigger Instant Backup ─────────────────────────────────────────────────
  const handleCreateInstantBackup = async () => {
    setCreatingBackup(true);
    try {
      const res = await api.post('/settings/backups', { backupType: 'manual' });
      setBackups((prev) => [res.data.backup, ...prev]);
      showToast('تم إنشاء نسخة احتياطية جديدة بنجاح');
    } catch (err) {
      console.error('Error creating backup:', err);
      showToast('تعذر إنشاء النسخة الاحتياطية', 'error');
    } finally {
      setCreatingBackup(false);
    }
  };

  const activeCategoryMeta = REFERENCE_CATEGORIES.find((c) => c.id === selectedCategory);

  return (
    <AppShell>
      <div className="min-h-screen bg-[#f8fafc] pb-24 font-sans text-slate-800" dir="rtl">
        
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
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-[#1B5E8C] shadow-xs">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">إعدادات النظام</h1>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  الهوية، الترقيم، القوائم المرجعية والنسخ الاحتياطي
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Top Tabs Navigation Bar (matching screenshot) ────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-xs flex items-center overflow-x-auto gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('identity')}
              className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap ${
                activeTab === 'identity'
                  ? 'bg-blue-50/80 text-[#1B5E8C] border border-blue-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              الهوية والمظهر
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('numbering')}
              className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap ${
                activeTab === 'numbering'
                  ? 'bg-blue-50/80 text-[#1B5E8C] border border-blue-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              الترقيم والعملة
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sponsor_messages')}
              className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap ${
                activeTab === 'sponsor_messages'
                  ? 'bg-blue-50/80 text-[#1B5E8C] border border-blue-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              رسائل الكفلاء
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reference_lists')}
              className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap ${
                activeTab === 'reference_lists'
                  ? 'bg-blue-50/80 text-[#1B5E8C] border border-blue-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              القوائم المرجعية
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('backups')}
              className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap ${
                activeTab === 'backups'
                  ? 'bg-blue-50/80 text-[#1B5E8C] border border-blue-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              النسخ الاحتياطي والسجلات
            </button>
          </div>
        </div>

        {/* ── Main Tab Content ────────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Spinner size="lg" variant="primary" />
              <span className="text-xs font-semibold">جارٍ تحميل إعدادات النظام...</span>
            </div>
          ) : (
            <>
              {/* ──────────────────────────────────────────────────────────────────
                  TAB 1: الهوية والمظهر (Identity & Appearance)
                 ────────────────────────────────────────────────────────────────── */}
              {activeTab === 'identity' && (
                <div className="space-y-6">
                  {/* Card 1: شعار المؤسسة */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-0.5">شعار المؤسسة</h3>
                    <p className="text-xs text-slate-400 mb-5">
                      يظهر في شاشة الدخول ولوحة التحكم والتقارير المطبوعة.
                    </p>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                      {/* Logo Preview Container */}
                      <div className="w-24 h-24 rounded-2xl border-2 border-slate-200/80 bg-slate-50 flex items-center justify-center overflow-hidden p-2 shadow-2xs">
                        {identity.logo_url ? (
                          <img
                            src={identity.logo_url}
                            alt="شعار المؤسسة"
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <Globe className="w-10 h-10 text-slate-300" />
                        )}
                      </div>

                      {/* Upload & Remove Buttons */}
                      <div className="space-y-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleLogoUpload}
                          accept="image/png, image/jpeg, image/svg+xml, image/webp"
                          className="hidden"
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-2xs"
                          >
                            <Upload className="w-4 h-4 text-[#1B5E8C]" />
                            رفع شعار جديد
                          </button>
                          {identity.logo_url && (
                            <button
                              type="button"
                              onClick={handleRemoveLogo}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-red-600 text-xs font-bold rounded-xl border border-red-200 hover:bg-red-50 hover:border-red-300 transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                              إزالة الشعار
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          PNG / JPG / SVG / WEBP — حتى 500 KB
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: اسم المؤسسة واللغة */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-0.5">اسم المؤسسة</h3>
                      <p className="text-xs text-slate-400">
                        يعرض بالعربية والإنجليزية حسب اللغة المختارة.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Name AR */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          الاسم (عربي)
                        </label>
                        <input
                          type="text"
                          value={identity.org_name_ar}
                          onChange={(e) => setIdentity({ ...identity, org_name_ar: e.target.value })}
                          className="w-full px-3.5 py-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C]"
                        />
                      </div>

                      {/* Name EN */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          الاسم (إنجليزي)
                        </label>
                        <input
                          type="text"
                          value={identity.org_name_en}
                          onChange={(e) => setIdentity({ ...identity, org_name_en: e.target.value })}
                          className="w-full px-3.5 py-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C]"
                          dir="ltr"
                        />
                      </div>

                      {/* Tagline AR */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          العبارة التعريفية (عربي)
                        </label>
                        <input
                          type="text"
                          value={identity.tagline_ar}
                          onChange={(e) => setIdentity({ ...identity, tagline_ar: e.target.value })}
                          className="w-full px-3.5 py-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C]"
                        />
                      </div>

                      {/* Tagline EN */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          العبارة التعريفية (إنجليزي)
                        </label>
                        <input
                          type="text"
                          value={identity.tagline_en}
                          onChange={(e) => setIdentity({ ...identity, tagline_en: e.target.value })}
                          className="w-full px-3.5 py-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C]"
                          dir="ltr"
                        />
                      </div>

                      {/* Default Language */}
                      <div className="md:col-span-2 sm:w-1/2">
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          اللغة الافتراضية في شاشة الدخول
                        </label>
                        <select
                          value={identity.default_language}
                          onChange={(e) => setIdentity({ ...identity, default_language: e.target.value })}
                          className="w-full px-3.5 py-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C]"
                        >
                          <option value="ar">العربية</option>
                          <option value="en">الإنجليزية</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────────────
                  TAB 2: الترقيم والعملة (Numbering & Currency)
                 ────────────────────────────────────────────────────────────────── */}
              {activeTab === 'numbering' && (
                <div className="space-y-6">
                  {/* Card 1: عملة المحافظ الافتراضية */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-0.5">عملة المحافظ الافتراضية</h3>
                      <p className="text-xs text-slate-400">
                        تُستخدم عند فتح محفظة جديدة لأي مستفيد معتمد. تُدار القائمة من تبويب "القوائم المرجعية".
                      </p>
                    </div>

                    <div className="sm:w-1/3">
                      <select
                        value={numberingCurrency.default_currency}
                        onChange={(e) => setNumberingCurrency({ ...numberingCurrency, default_currency: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C]"
                      >
                        <option value="YER">(YER) ريال يمني</option>
                        <option value="USD">(USD) دولار أمريكي</option>
                        <option value="SAR">(SAR) ريال سعودي</option>
                      </select>
                    </div>
                  </div>

                  {/* Card 2: رموز الترقيم */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-0.5">رموز الترقيم</h3>
                      <p className="text-xs text-slate-400">
                        بادئة رقم الملف لكل نوع. التغيير يطبق على السجلات الجديدة فقط — السجلات السابقة تبقى برموزها.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                      {/* Sponsor Prefix */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          رمز الكافل
                        </label>
                        <input
                          type="text"
                          value={numberingCurrency.sponsor_prefix}
                          onChange={(e) => setNumberingCurrency({ ...numberingCurrency, sponsor_prefix: e.target.value })}
                          className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C]"
                          placeholder="مثال: SPN"
                        />
                        <span className="block text-[11px] text-slate-400 mt-1 font-mono">
                          مثال: {numberingCurrency.sponsor_prefix || 'SPN'}-000001
                        </span>
                      </div>

                      {/* Orphan Prefix */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          رمز اليتيم
                        </label>
                        <input
                          type="text"
                          value={numberingCurrency.orphan_prefix}
                          onChange={(e) => setNumberingCurrency({ ...numberingCurrency, orphan_prefix: e.target.value })}
                          className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C]"
                          placeholder="مثال: ORP"
                        />
                        <span className="block text-[11px] text-slate-400 mt-1 font-mono">
                          مثال: {numberingCurrency.orphan_prefix || 'ORP'}-000001
                        </span>
                      </div>

                      {/* Family / General Prefix */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          رمز المستفيد العام (الأسرة)
                        </label>
                        <input
                          type="text"
                          value={numberingCurrency.family_prefix}
                          onChange={(e) => setNumberingCurrency({ ...numberingCurrency, family_prefix: e.target.value })}
                          className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C]"
                          placeholder="مثال: FAM"
                        />
                        <span className="block text-[11px] text-slate-400 mt-1 font-mono">
                          مثال: {numberingCurrency.family_prefix || 'FAM'}-000001
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────────────
                  TAB 3: رسائل الكفلاء (Sponsor Messages)
                 ────────────────────────────────────────────────────────────────── */}
              {activeTab === 'sponsor_messages' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-0.5">رسالة بيانات دخول الكافل</h3>
                      <p className="text-xs text-slate-400">
                        النص الذي يُنسخ أو يُرسل عبر واتساب عند إنشاء حساب للكافل. استخدم الحقول المتغيرة أدناه.
                      </p>
                    </div>

                    {/* Portal URL */}
                    <div className="sm:w-1/2">
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        رابط الدخول
                      </label>
                      <input
                        type="text"
                        value={sponsorMessages.portal_url}
                        onChange={(e) => setSponsorMessages({ ...sponsorMessages, portal_url: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C]"
                        dir="ltr"
                      />
                    </div>

                    {/* Message Area & Variable Chips (2 columns matching screenshot) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Textarea (8 cols) */}
                      <div className="lg:col-span-9 space-y-2">
                        <label className="block text-xs font-bold text-slate-700">
                          نص الرسالة
                        </label>
                        <textarea
                          ref={textareaRef}
                          rows={12}
                          value={sponsorMessages.template}
                          onChange={(e) => setSponsorMessages({ ...sponsorMessages, template: e.target.value })}
                          className="w-full p-4 text-xs font-sans bg-slate-50/50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C] leading-relaxed resize-y"
                        />
                        <button
                          type="button"
                          onClick={() => setSponsorMessages({ ...sponsorMessages, template: DEFAULT_SPONSOR_TEMPLATE })}
                          className="text-xs text-[#1B5E8C] hover:underline font-semibold"
                        >
                          استعادة النص الافتراضي
                        </button>
                      </div>

                      {/* Variable Chips Panel (3 cols) */}
                      <div className="lg:col-span-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 space-y-3">
                        <span className="block text-xs font-bold text-slate-700 pb-2 border-b border-slate-200">
                          الحقول المتغيرة
                        </span>
                        <div className="space-y-2">
                          {[
                            { tag: '{{name}}', label: 'اسم الكافل' },
                            { tag: '{{code}}', label: 'رقم الكافل' },
                            { tag: '{{password}}', label: 'كلمة المرور' },
                            { tag: '{{portal_url}}', label: 'رابط الدخول' },
                            { tag: '{{org_name}}', label: 'اسم المؤسسة' },
                          ].map(({ tag, label }) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => handleInsertTag(tag)}
                              className="w-full px-3 py-2 text-right rounded-xl bg-white border border-slate-200 hover:border-[#1B5E8C] hover:bg-blue-50/50 transition-all flex items-center justify-between group shadow-2xs"
                            >
                              <span className="text-[11px] font-mono text-[#1B5E8C] font-bold group-hover:scale-105 transition-transform">
                                {tag}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                {label}
                              </span>
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-normal pt-1">
                          انقر على أي متغير لإدراجه في مكان المؤشر داخل نص الرسالة.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────────────
                  TAB 4: القوائم المرجعية (Reference Lists with Sub-navigation)
                 ────────────────────────────────────────────────────────────────── */}
              {activeTab === 'reference_lists' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Sub-navigation Sidebar (3 cols) */}
                  <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3 space-y-1">
                    {REFERENCE_CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = selectedCategory === cat.id;

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-xs font-bold transition-all text-right ${
                            isSelected
                              ? 'bg-blue-50/80 text-[#1B5E8C] border border-blue-200 shadow-2xs'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-[#1B5E8C]' : 'text-slate-400'}`} />
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Main Reference Items Content (9 cols) */}
                  <div className="lg:col-span-9 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
                    
                    {/* Header */}
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1B5E8C] flex items-center justify-center border border-blue-100">
                        {activeCategoryMeta?.icon && <activeCategoryMeta.icon className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{activeCategoryMeta?.label}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{activeCategoryMeta?.desc}</p>
                      </div>
                    </div>

                    {/* Add Item Bar (Form matching screenshot) */}
                    <form onSubmit={handleAddRefItem} className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          required
                          value={newRefName}
                          onChange={(e) => setNewRefName(e.target.value)}
                          placeholder="الاسم (مثال: كسوة العيد)"
                          className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C]"
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={newRefDesc}
                          onChange={(e) => setNewRefDesc(e.target.value)}
                          placeholder="وصف (اختياري)"
                          className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C]"
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="primary"
                        loading={addingRef}
                        className="gap-1.5 shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        إضافة
                      </Button>
                    </form>

                    {/* Reference Items Table (matching screenshot) */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200/80">
                          <tr>
                            <th className="py-3 px-4">الاسم</th>
                            <th className="py-3 px-4">الوصف</th>
                            <th className="py-3 px-4">الترتيب</th>
                            <th className="py-3 px-4 text-center">الحالة</th>
                            <th className="py-3 px-4 text-center">إجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {loadingRefItems ? (
                            <tr>
                              <td colSpan="5" className="py-12 text-center text-slate-400">
                                <Spinner size="md" variant="primary" />
                                <span className="block mt-2 text-xs">جارٍ التحميل...</span>
                              </td>
                            </tr>
                          ) : referenceItems.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="py-12 text-center text-slate-400">
                                لا توجد عناصر مسجلة في هذه القائمة بعد.
                              </td>
                            </tr>
                          ) : (
                            referenceItems.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3 px-4 font-bold text-slate-800">
                                  {item.name}
                                </td>
                                <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                                  {item.description || '—'}
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-500">
                                  {item.sort_order}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span
                                    className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                      item.is_active
                                        ? 'bg-blue-50 text-[#1B5E8C] border-blue-200'
                                        : 'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}
                                  >
                                    {item.is_active ? 'مفعل' : 'معطل'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      title="تعديل"
                                      onClick={() => setEditingRefItem({ ...item })}
                                      className="p-1.5 text-slate-400 hover:text-[#1B5E8C] hover:bg-slate-100 rounded-lg transition-all"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      title={item.is_active ? 'إيقاف' : 'تفعيل'}
                                      onClick={() => handleToggleRefActive(item)}
                                      className="px-2 py-1 text-[10px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all"
                                    >
                                      {item.is_active ? 'إيقاف' : 'تفعيل'}
                                    </button>
                                    <button
                                      type="button"
                                      title="حذف"
                                      onClick={() => handleDeleteRefItem(item.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────────────
                  TAB 5: النسخ الاحتياطي والسجلات (Backups & Audit Logs)
                 ────────────────────────────────────────────────────────────────── */}
              {activeTab === 'backups' && (
                <div className="space-y-6">
                  {/* Card 1: النسخ الاحتياطي والاستعادة */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-0.5">النسخ الاحتياطي والاستعادة</h3>
                        <p className="text-xs text-slate-400">
                          نسخ كامل لبيانات النظام وملفاته، جدولة تلقائية، وتنزيل أو استعادة أي نسخة سابقة.
                        </p>
                      </div>
                      <Button
                        variant="primary"
                        loading={creatingBackup}
                        onClick={handleCreateInstantBackup}
                        className="gap-2 shrink-0"
                      >
                        <Database className="w-4 h-4" />
                        إنشاء نسخة احتياطية الآن
                      </Button>
                    </div>

                    {/* Backups List */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200/80 mt-4">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200/80">
                          <tr>
                            <th className="py-3 px-4">الملف</th>
                            <th className="py-3 px-4">النوع</th>
                            <th className="py-3 px-4">الحجم</th>
                            <th className="py-3 px-4">تاريخ الإنشاء</th>
                            <th className="py-3 px-4 text-center">الحالة</th>
                            <th className="py-3 px-4 text-center">الإجراء</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {loadingBackups ? (
                            <tr>
                              <td colSpan="6" className="py-8 text-center text-slate-400">
                                <Spinner size="sm" variant="primary" />
                              </td>
                            </tr>
                          ) : backups.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="py-8 text-center text-slate-400">
                                لا توجد نسخ احتياطية مسجلة بعد.
                              </td>
                            </tr>
                          ) : (
                            backups.map((bk) => (
                              <tr key={bk.id} className="hover:bg-slate-50/60">
                                <td className="py-3 px-4 font-mono font-bold text-slate-800">
                                  {bk.filename}
                                </td>
                                <td className="py-3 px-4 text-slate-500">
                                  {bk.backup_type === 'scheduled' ? 'تلقائي مجدول' : 'يدوي'}
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-500">
                                  {(bk.size_bytes / (1024 * 1024)).toFixed(2)} MB
                                </td>
                                <td className="py-3 px-4 text-slate-500">
                                  {new Date(bk.created_at).toLocaleString('ar-YE')}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1B5E8C] border border-blue-200">
                                    مكتمل
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <button
                                    type="button"
                                    onClick={() => showToast('بدأ تنزيل النسخة الاحتياطية')}
                                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-[#1B5E8C] hover:bg-blue-50 rounded-lg transition-colors"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    تنزيل
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Card 2: سجل تسلسل الأحداث */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-0.5">سجل تسلسل الأحداث (Audit Logs)</h3>
                        <p className="text-xs text-slate-400">
                          سجل تدقيق كامل لكل العمليات التي تمت في النظام مع المستخدم والتاريخ.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setAuditModalOpen(true)}
                        className="gap-2 shrink-0"
                      >
                        <Eye className="w-4 h-4" />
                        عرض سجل الأحداث الكامل
                      </Button>
                    </div>

                    {/* Preview of latest 5 events */}
                    <div className="space-y-2 mt-2">
                      {auditLogs.slice(0, 5).map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-100 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-[#1B5E8C]" />
                            <span className="font-bold text-slate-800">{log.action}</span>
                            <span className="text-slate-500 font-mono">({log.entity_type})</span>
                            {log.user_name && (
                              <span className="text-slate-400">• بواسطة: {log.user_name}</span>
                            )}
                          </div>
                          <span className="text-slate-400 text-[11px]">
                            {new Date(log.created_at).toLocaleString('ar-YE')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────────────
                  BOTTOM STICKY SAVE BAR (Matching user screenshot)
                 ────────────────────────────────────────────────────────────────── */}
              {activeTab !== 'reference_lists' && activeTab !== 'backups' && (
                <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200/60">
                  <Button
                    type="button"
                    variant="primary"
                    loading={saving}
                    onClick={handleSaveAllSettings}
                    className="gap-2 text-sm shadow-md"
                  >
                    <Save className="w-4 h-4" />
                    حفظ الإعدادات
                  </Button>
                  <p className="text-xs text-slate-400 font-medium">
                    تُحفظ جميع تبويبات الإعدادات معاً.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Edit Reference Item Modal ───────────────────────────────────────── */}
        {editingRefItem && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in duration-150" dir="rtl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">تعديل العنصر</h3>
                <button
                  type="button"
                  onClick={() => setEditingRefItem(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الاسم</label>
                  <input
                    type="text"
                    value={editingRefItem.name}
                    onChange={(e) => setEditingRefItem({ ...editingRefItem, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الوصف</label>
                  <input
                    type="text"
                    value={editingRefItem.description || ''}
                    onChange={(e) => setEditingRefItem({ ...editingRefItem, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الترتيب</label>
                  <input
                    type="number"
                    value={editingRefItem.sort_order}
                    onChange={(e) => setEditingRefItem({ ...editingRefItem, sort_order: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E8C]/20 focus:border-[#1B5E8C]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setEditingRefItem(null)}>
                  إلغاء
                </Button>
                <Button variant="primary" onClick={handleSaveEditRefItem}>
                  حفظ التعديلات
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Full Audit Logs Modal ───────────────────────────────────────────── */}
        {auditModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden" dir="rtl">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">سجل تدقيق النظام الكامل</h3>
                  <p className="text-xs text-slate-500">سجل جميع العمليات الحساسة في النظام</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAuditModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">التاريخ والوقت</th>
                        <th className="py-2.5 px-3">المستخدم</th>
                        <th className="py-2.5 px-3">الإجراء</th>
                        <th className="py-2.5 px-3">نوع الكيان</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono text-slate-500">
                            {new Date(log.created_at).toLocaleString('ar-YE')}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {log.user_name || 'النظام'}
                          </td>
                          <td className="py-2.5 px-3 text-[#1B5E8C] font-semibold">
                            {log.action}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-mono">
                            {log.entity_type}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
                <Button variant="secondary" onClick={() => setAuditModalOpen(false)}>
                  إغلاق
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
