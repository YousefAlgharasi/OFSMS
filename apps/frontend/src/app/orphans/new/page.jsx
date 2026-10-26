'use client';

/**
 * page.jsx
 * Route:  /orphans/new  (Agent only)
 * API:    POST /api/orphans  (multipart/form-data)
 *
 * Fixes applied:
 *  [Fix 3a] Progress bar uses Fragment with key prop — no more React key warning
 *  [Fix 3b] onSubmit guards gender + guardianRelation before building FormData
 *  [Fix 3c] All fd.append calls use || '' fallback — never sends undefined/null
 */

import { useState, useEffect, useRef, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Upload, FileText, Image, X, Plus, AlertCircle, CheckCircle2, File, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Spinner from '@/components/ui/Spinner';
import PageHeader from '@/components/ui/PageHeader';
import WizardProgressBar from '@/components/ui/WizardProgressBar';

// ── Constants ──────────────────────────────────────────────────────────────────

const TALENT_CATEGORIES = [
  { key: 'creativity', label: 'الإبداع والكتابة',   options: ['كتابة قصص', 'شعر', 'رسم', 'تصميم'] },
  { key: 'sports',     label: 'الرياضة',             options: ['كرة قدم', 'سباحة', 'كاراتيه', 'أخرى'] },
  { key: 'arts',       label: 'الفنون والأداء',      options: ['إنشاد', 'تمثيل', 'إلقاء'] },
  { key: 'tech',       label: 'المهارات التقنية',    options: ['استخدام الحاسب', 'تصميم', 'برمجة', 'صيانة أجهزة'] },
  { key: 'social',     label: 'المهارات الاجتماعية', options: ['قيادة', 'تعاون', 'خدمة مجتمعية'] },
  { key: 'life',       label: 'المهارات الحياتية',   options: ['الطبخ', 'الخياطة', 'البستنة', 'حرف يدوية'] },
];

const GUARDIAN_RELATIONS = [
  { value: 'uncle',          label: 'عم' },
  { value: 'maternal_uncle', label: 'خال' },
  { value: 'grandfather',    label: 'جد' },
  { value: 'sibling',        label: 'أخ / أخت' },
  { value: 'other',          label: 'أخرى' },
];

const KINSHIP_OPTIONS = [
  { value: 'أم', label: 'أم' },
  { value: 'أب', label: 'أب' },
  { value: 'أخ', label: 'أخ' },
  { value: 'أخت', label: 'أخت' },
  { value: 'عم', label: 'عم (أخ الأب)' },
  { value: 'عمة', label: 'عمة (أخت الأب)' },
  { value: 'خال', label: 'خال (أخ الأم)' },
  { value: 'خالة', label: 'خالة (أخت الأم)' },
  { value: 'جد', label: 'جد' },
  { value: 'جدة', label: 'جدة' },
  { value: 'ابن عم / قريب', label: 'ابن عم / قريب' },
  { value: 'وصي شرعي', label: 'وصي شرعي / كافل قانوني' },
  { value: 'زوج الأم / زوجة الأب', label: 'زوج الأم / زوجة الأب' },
  { value: 'أخرى', label: 'صلة قرابة أخرى' },
];

const VALID_RELATIONS = ['uncle', 'maternal_uncle', 'grandfather', 'sibling', 'other'];
const VALID_GENDERS   = ['male', 'female'];
const ALLOWED_TYPES   = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_BYTES  = 5 * 1024 * 1024;

// ── Tailwind shorthand constants ───────────────────────────────────────────────

const CLS_CARD  = 'bg-white border border-[#e5eaf0] rounded-2xl p-7 shadow-sm shadow-sky-900/5';
const CLS_GRID  = 'grid grid-cols-1 sm:grid-cols-2 gap-[1.1rem]';
const CLS_FG    = 'flex flex-col gap-1';
const CLS_FG2   = 'flex flex-col gap-1 col-span-1 sm:col-span-full';
const CLS_LBL   = 'text-[0.82rem] font-semibold text-[#374151]';
const CLS_REQ   = 'text-[#dc2626] mr-0.5';
const CLS_OPT   = 'text-[#94a3b8] font-normal text-[0.75rem]';
const CLS_FERR  = "text-[0.77rem] text-[#dc2626] m-0 flex items-center gap-1 before:content-['•'] before:ml-1";
const CLS_CHIP  = (sel) => `flex items-center px-4 py-2.5 border-[1.5px] rounded-[2rem] text-[0.83rem] font-semibold cursor-pointer transition-all duration-150 select-none ${sel ? 'border-[#1B5E8C] bg-[#1B5E8C] text-white' : 'border-gray-300 bg-gray-50 text-[#6b7280] hover:border-[#1B5E8C] hover:text-[#1B5E8C]'}`;
const CLS_RADIO = (err) => `flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-[1.5px] rounded-xl text-sm font-semibold cursor-pointer transition-all duration-150 bg-gray-50 select-none hover:border-[#1B5E8C] has-[:checked]:border-[#1B5E8C] has-[:checked]:bg-[#f0f7ff] has-[:checked]:text-[#1B5E8C] has-[:checked]:shadow-[0_0_0_2px_rgba(27,94,140,0.12)] ${err ? 'border-red-500' : 'border-gray-300 text-gray-500'}`;
const CLS_RADIO_STATE = (sel) => `flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-[1.5px] rounded-xl text-sm font-semibold cursor-pointer transition-all duration-150 select-none ${sel ? 'border-[#1B5E8C] bg-[#f0f7ff] text-[#1B5E8C] shadow-[0_0_0_2px_rgba(27,94,140,0.12)]' : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-[#1B5E8C]'}`;

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatBytes = (b) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

const validateFile = (file) => {
  if (!ALLOWED_TYPES.includes(file.type))
    return 'نوع الملف غير مسموح. المقبول: PDF، JPG، PNG';
  if (file.size > MAX_FILE_BYTES)
    return `الحجم تجاوز الحد الأقصى (${formatBytes(MAX_FILE_BYTES)})`;
  return null;
};

const FileTypeIcon = ({ type, size = 18 }) =>
  type === 'application/pdf'
    ? <FileText size={size} strokeWidth={1.8} />
    : type?.startsWith('image/')
      ? <Image size={size} strokeWidth={1.8} />
      : <File size={size} strokeWidth={1.8} />;

// ── FileDropZone ───────────────────────────────────────────────────────────────

function FileDropZone({ label, hint, accept, multiple = false, onChange, error, value }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files) => {
    const arr = Array.from(files);
    onChange(multiple ? arr : arr[0] || null);
  };

  const removeFile = (idx) => {
    if (!multiple) { onChange(null); return; }
    const next = [...(value || [])];
    next.splice(idx, 1);
    onChange(next);
  };

  const files = multiple ? (value || []) : value ? [value] : [];
  const hasFiles = files.length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`border-2 border-dashed rounded-xl p-5 transition-all duration-150 bg-white min-h-[110px] flex items-center justify-center ${dragging ? 'border-[#1B5E8C] bg-[#f0f7ff]' : 'border-[#cbd5e1] hover:border-[#1B5E8C] hover:bg-[#f0f7ff]'} ${error ? 'border-red-500 bg-red-50' : ''} ${hasFiles ? 'border-solid border-[#93c5fd] bg-[#f8fbff]' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        aria-label={label}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />

        {!hasFiles ? (
          <div className="flex flex-col items-center gap-1.5 text-center" dir="rtl">
            <p className="text-[0.82rem] font-semibold text-[#334155] m-0">اسحب الملف هنا</p>
            <p className="text-[0.72rem] text-[#94a3b8] m-0">{hint}</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 mt-3.5 px-5 py-2 bg-gradient-to-br from-[#1B5E8C] to-[#134569] text-white border-none rounded-xl text-[0.83rem] font-bold font-cairo cursor-pointer whitespace-nowrap shadow-sm shadow-[#1B5E8C]/20 transition-all duration-150 hover:from-[#2E7EB8] hover:to-[#1B5E8C] hover:shadow-md hover:shadow-[#1B5E8C]/35 hover:-translate-y-0.5 active:translate-y-0"
            >
              <Upload size={15} strokeWidth={2} />
              اختر ملفاً
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 w-full" onClick={(e) => e.stopPropagation()}>
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center gap-2.5 p-2 px-3 bg-white border border-[#e2e8f0] rounded-xl transition-all hover:border-[#93c5fd]">
                <span className="text-[#1B5E8C] shrink-0 flex"><FileTypeIcon type={f.type} /></span>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[0.78rem] font-semibold text-[#1e293b] overflow-hidden text-ellipsis whitespace-nowrap" dir="ltr" title={f.name}>{f.name}</span>
                  <span className="text-[0.7rem] text-[#94a3b8]">{formatBytes(f.size)}</span>
                </div>
                <button
                  type="button"
                  className="flex items-center justify-center w-[22px] h-[22px] bg-[#f1f5f9] border-none rounded-md cursor-pointer text-[#64748b] transition-all hover:bg-red-100 hover:text-red-600 shrink-0"
                  onClick={() => removeFile(i)}
                  aria-label="حذف الملف"
                >
                  <X size={13} strokeWidth={2.5} />
                </button>
              </div>
            ))}
            {multiple && files.length < 5 && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 bg-transparent border-[1.5px] border-dashed border-[#93c5fd] rounded-lg px-3.5 py-1.5 text-[0.78rem] text-[#1B5E8C] cursor-pointer font-cairo font-semibold transition-all duration-150 hover:bg-[#eff6ff] hover:border-[#1B5E8C] self-start mt-1"
                onClick={() => inputRef.current?.click()}
              >
                <Plus size={14} strokeWidth={2.5} />
                إضافة ملف آخر
              </button>
            )}
          </div>
        )}
      </div>
      {error && (
        <p className={CLS_FERR}>
          <AlertCircle size={13} strokeWidth={2} style={{ flexShrink: 0 }} />
          {error}
        </p>
      )}
    </div>
  );
}

// ── SectionHeader ──────────────────────────────────────────────────────────────

function SectionHeader({ number, title, subtitle }) {
  return (
    <div className="flex items-start gap-4 mb-6 pb-4 border-b-[1.5px] border-[#f0f4f8]">
      <div className="w-[38px] h-[38px] rounded-xl bg-gradient-to-br from-[#1B5E8C] to-[#0d3d5c] text-white flex items-center justify-center text-[1.1rem] font-bold shrink-0 font-cairo">
        {number}
      </div>
      <div>
        <h2 className="text-[1.05rem] font-bold text-[#0d3d5c] m-0 mb-0.5">{title}</h2>
        {subtitle && <p className="text-[0.78rem] text-[#94a3b8] m-0">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function OrphanRegistrationPage() {
  const router = useRouter();
  const [governorates, setGovernorates] = useState([]);
  const [govLoading,   setGovLoading]   = useState(true);
  const [submitState,  setSubmitState]  = useState('idle'); // idle | loading | success | error
  const [apiError,     setApiError]     = useState('');

  const [currentPage,     setCurrentPage]     = useState(1);

  const [repeatedYear,    setRepeatedYear]    = useState('');
  const [ownershipType,   setOwnershipType]   = useState('');
  const [buildingType,    setBuildingType]    = useState('');
  const [hasChronicDisease,    setHasChronicDisease]    = useState('');
  const [hasRegularTreatment,  setHasRegularTreatment]  = useState('');
  const [hasHealthInsurance,   setHasHealthInsurance]   = useState('');
  const [incomeSource,         setIncomeSource]         = useState('');
  const [hasCharitySupport,    setHasCharitySupport]    = useState('');
  const [selectedTalents,      setSelectedTalents]      = useState(new Set());
  const [familyRelations,      setFamilyRelations]      = useState('');
  const [communityRelation,    setCommunityRelation]    = useState('');
  const [schoolRelation,       setSchoolRelation]       = useState('');
  const [socialBehavior,       setSocialBehavior]       = useState('');
  const [needsSocialSupport,   setNeedsSocialSupport]   = useState('');
  const [quranLevel,           setQuranLevel]           = useState('');
  const [prayerCommitment,     setPrayerCommitment]     = useState('');
  const [moralBehavior,        setMoralBehavior]        = useState('');
  const [generalAppearance,    setGeneralAppearance]    = useState('');
  const [selfExpression,       setSelfExpression]       = useState('');
  const [psychFamilyRelations, setPsychFamilyRelations] = useState('');
  const [peerRelations,        setPeerRelations]        = useState('');
  const [sleepAppetite,        setSleepAppetite]        = useState('');
  const [psychSigns,           setPsychSigns]           = useState('');
  const [needsPsychSupport,    setNeedsPsychSupport]    = useState('');

  const [stateErrors,      setStateErrors]      = useState({});

  const [deathCertFile,   setDeathCertFile]   = useState(null);
  const [birthCertFile,   setBirthCertFile]   = useState(null);
  const [additionalFiles, setAdditionalFiles] = useState([]);
  const [fileErrors,      setFileErrors]      = useState({});

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError,
    trigger,
    watch,
  } = useForm({
    defaultValues: {
      fullName: '', dateOfBirth: '', gender: '',
      governorateId: '', motherGovernorate: '',
      birthPlace: '', residence: '',
      phone1: '', phone1Relation: '',
      phone2: '', phone2Relation: '', address: '',
      schoolGrade: '', sectorType: '', directorate: '', schoolOrg: '',
      favoriteSubject: '', difficultySubject: '', generalLevel: '',
      repeatedYearReason: '', gradeDetail: '', generalGrade: '',
      lastResultAvg: '', highestGrade: '', lowestGrade: '',
      eduResponsible: '', eduResponsiblePhone: '', eduLevel: '',
      guardianName: '', guardianRelation: '',
      guardianAge: '', guardianEduLevel: '', guardianJob: '', guardianHealth: '',
      familyMaleCount: '', familyFemaleCount: '', familyProblems: '',
      floorsCount: '', roomsCount: '', water: '', electricity: '', rentAmount: '', housingDetails: '',
      chronicDiseaseDetails: '',
      monthlyIncome: '', charitySupportDetails: '',
      talentsOther: '',
      recommendations: '',
      notes: '',
    },
  });

  // Fetch governorates on mount
  useEffect(() => {
    const fetchGovernorates = async () => {
      try {
        const { data } = await api.get('/governorates');
        setGovernorates(data.data || []);
      } catch (err) {
        console.error('Error fetching governorates:', err);
        setGovernorates([]);
      } finally {
        setGovLoading(false);
      }
    };
    fetchGovernorates();
  }, []);

  // Validate file fields (outside RHF)
  const validateFiles = () => {
    const errs = {};
    if (!deathCertFile) errs.deathCert = 'شهادة وفاة الأب مطلوبة';
    else { const e = validateFile(deathCertFile); if (e) errs.deathCert = e; }
    if (!birthCertFile) errs.birthCert = 'شهادة الميلاد مطلوبة';
    else { const e = validateFile(birthCertFile); if (e) errs.birthCert = e; }
    additionalFiles.forEach((f, i) => {
      const e = validateFile(f); if (e) errs[`add_${i}`] = e;
    });
    setFileErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = async () => {
    let isValid = true;
    if (currentPage === 1) {
      isValid = await trigger(['fullName', 'dateOfBirth', 'gender', 'governorateId', 'motherGovernorate', 'birthPlace', 'residence', 'phone1', 'phone1Relation', 'phone2', 'phone2Relation', 'address']);
    } else if (currentPage === 2) {
      isValid = await trigger(['schoolGrade', 'sectorType', 'directorate', 'schoolOrg', 'favoriteSubject', 'difficultySubject', 'generalLevel', 'repeatedYearReason', 'gradeDetail', 'generalGrade', 'lastResultAvg', 'highestGrade', 'lowestGrade', 'eduResponsible', 'eduResponsiblePhone', 'eduLevel', 'guardianName', 'guardianRelation', 'guardianAge', 'guardianEduLevel', 'guardianJob', 'guardianHealth', 'familyMaleCount', 'familyFemaleCount', 'familyProblems']);
      const sErr = { ...stateErrors };
      if (!repeatedYear) { sErr.repeatedYear = 'يرجى الإجابة على هذا السؤال'; isValid = false; } else delete sErr.repeatedYear;
      setStateErrors(sErr);
    } else if (currentPage === 3) {
      isValid = await trigger(['floorsCount', 'roomsCount', 'water', 'electricity', 'rentAmount', 'housingDetails', 'chronicDiseaseDetails', 'monthlyIncome', 'charitySupportDetails']);
      const sErr = { ...stateErrors };
      if (!ownershipType) { sErr.ownershipType = 'نوع السكن مطلوب'; isValid = false; } else delete sErr.ownershipType;
      if (!buildingType) { sErr.buildingType = 'نوع البناء مطلوب'; isValid = false; } else delete sErr.buildingType;
      if (!hasChronicDisease) { sErr.hasChronicDisease = 'يرجى الإجابة'; isValid = false; } else delete sErr.hasChronicDisease;
      if (!hasRegularTreatment) { sErr.hasRegularTreatment = 'يرجى الإجابة'; isValid = false; } else delete sErr.hasRegularTreatment;
      if (!hasHealthInsurance) { sErr.hasHealthInsurance = 'يرجى الإجابة'; isValid = false; } else delete sErr.hasHealthInsurance;
      if (!incomeSource) { sErr.incomeSource = 'مصدر الدخل مطلوب'; isValid = false; } else delete sErr.incomeSource;
      if (!hasCharitySupport) { sErr.hasCharitySupport = 'يرجى الإجابة'; isValid = false; } else delete sErr.hasCharitySupport;
      setStateErrors(sErr);
    } else if (currentPage === 4) {
      isValid = await trigger(['talentsOther', 'recommendations', 'notes']);
      const sErr = { ...stateErrors };
      if (!familyRelations) { sErr.familyRelations = 'يرجى الاختيار'; isValid = false; } else delete sErr.familyRelations;
      if (!communityRelation) { sErr.communityRelation = 'يرجى الاختيار'; isValid = false; } else delete sErr.communityRelation;
      if (!schoolRelation) { sErr.schoolRelation = 'يرجى الاختيار'; isValid = false; } else delete sErr.schoolRelation;
      if (!socialBehavior) { sErr.socialBehavior = 'يرجى الاختيار'; isValid = false; } else delete sErr.socialBehavior;
      if (!needsSocialSupport) { sErr.needsSocialSupport = 'يرجى الاختيار'; isValid = false; } else delete sErr.needsSocialSupport;
      if (!quranLevel) { sErr.quranLevel = 'يرجى الاختيار'; isValid = false; } else delete sErr.quranLevel;
      if (!prayerCommitment) { sErr.prayerCommitment = 'يرجى الاختيار'; isValid = false; } else delete sErr.prayerCommitment;
      if (!moralBehavior) { sErr.moralBehavior = 'يرجى الاختيار'; isValid = false; } else delete sErr.moralBehavior;
      if (!generalAppearance) { sErr.generalAppearance = 'يرجى الاختيار'; isValid = false; } else delete sErr.generalAppearance;
      if (!selfExpression) { sErr.selfExpression = 'يرجى الاختيار'; isValid = false; } else delete sErr.selfExpression;
      if (!psychFamilyRelations) { sErr.psychFamilyRelations = 'يرجى الاختيار'; isValid = false; } else delete sErr.psychFamilyRelations;
      if (!peerRelations) { sErr.peerRelations = 'يرجى الاختيار'; isValid = false; } else delete sErr.peerRelations;
      if (!sleepAppetite) { sErr.sleepAppetite = 'يرجى الاختيار'; isValid = false; } else delete sErr.sleepAppetite;
      if (!psychSigns) { sErr.psychSigns = 'يرجى الاختيار'; isValid = false; } else delete sErr.psychSigns;
      if (!needsPsychSupport) { sErr.needsPsychSupport = 'يرجى الاختيار'; isValid = false; } else delete sErr.needsPsychSupport;
      setStateErrors(sErr);
    }

    if (isValid) {
      setCurrentPage(p => p + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const onSubmit = async (data) => {
    // Only the last page submits (blocks Enter-key and stray submits on earlier pages)
    if (currentPage < 5) return;
    // ── [Fix 3b] Guard radio fields before touching FormData ──────────────────
    let hasRadioError = false;

    if (!data.gender || !VALID_GENDERS.includes(data.gender)) {
      setError('gender', { type: 'manual', message: 'يرجى اختيار الجنس' });
      hasRadioError = true;
    }

    if (!data.guardianRelation || !VALID_RELATIONS.includes(data.guardianRelation)) {
      setError('guardianRelation', { type: 'manual', message: 'يرجى اختيار صلة الوصي' });
      hasRadioError = true;
    }

    if (hasRadioError) return;

    // Validate custom state fields
    const sErr = {};
    if (!repeatedYear)            sErr.repeatedYear            = 'يرجى الإجابة على هذا السؤال';
    if (!ownershipType)           sErr.ownershipType           = 'نوع السكن مطلوب';
    if (!buildingType)            sErr.buildingType            = 'نوع البناء مطلوب';
    if (!hasChronicDisease)       sErr.hasChronicDisease       = 'يرجى الإجابة على هذا السؤال';
    if (!hasRegularTreatment)     sErr.hasRegularTreatment     = 'يرجى الإجابة على هذا السؤال';
    if (!hasHealthInsurance)      sErr.hasHealthInsurance      = 'يرجى الإجابة على هذا السؤال';
    if (!incomeSource)            sErr.incomeSource            = 'مصدر الدخل مطلوب';
    if (!hasCharitySupport)       sErr.hasCharitySupport       = 'يرجى الإجابة على هذا السؤال';
    if (!familyRelations)         sErr.familyRelations         = 'يرجى الاختيار';
    if (!communityRelation)       sErr.communityRelation       = 'يرجى الاختيار';
    if (!schoolRelation)          sErr.schoolRelation          = 'يرجى الاختيار';
    if (!socialBehavior)          sErr.socialBehavior          = 'يرجى الاختيار';
    if (!needsSocialSupport)      sErr.needsSocialSupport      = 'يرجى الاختيار';
    if (!quranLevel)              sErr.quranLevel              = 'يرجى الاختيار';
    if (!prayerCommitment)        sErr.prayerCommitment        = 'يرجى الاختيار';
    if (!moralBehavior)           sErr.moralBehavior           = 'يرجى الاختيار';
    if (!generalAppearance)       sErr.generalAppearance       = 'يرجى الاختيار';
    if (!selfExpression)          sErr.selfExpression          = 'يرجى الاختيار';
    if (!psychFamilyRelations)    sErr.psychFamilyRelations    = 'يرجى الاختيار';
    if (!peerRelations)           sErr.peerRelations           = 'يرجى الاختيار';
    if (!sleepAppetite)           sErr.sleepAppetite           = 'يرجى الاختيار';
    if (!psychSigns)              sErr.psychSigns              = 'يرجى الاختيار';
    if (!needsPsychSupport)       sErr.needsPsychSupport       = 'يرجى الاختيار';
    setStateErrors(sErr);
    if (Object.keys(sErr).length > 0) return;

    // Validate file uploads
    if (!validateFiles()) return;

    setSubmitState('loading');
    setApiError('');

    // ── [Fix 3c] Build FormData — always send strings, never undefined ────────
    const fd = new FormData();
    fd.append('fullName',          (data.fullName         || '').trim());
    fd.append('dateOfBirth',       data.dateOfBirth       || '');
    fd.append('gender',            data.gender            || '');
    fd.append('governorateId',     data.governorateId     || '');
    fd.append('guardianName',      (data.guardianName     || '').trim());
    fd.append('guardianRelation',  data.guardianRelation  || '');
    fd.append('birthPlace',        data.birthPlace.trim());
    fd.append('residence',         data.residence.trim());
    fd.append('motherGovernorate', data.motherGovernorate);
    fd.append('phone1',            data.phone1.trim());
    fd.append('phone1Relation',    data.phone1Relation.trim());
    fd.append('phone2',            data.phone2.trim());
    fd.append('phone2Relation',    data.phone2Relation.trim());
    fd.append('address',           data.address.trim());
    fd.append('schoolGrade',          data.schoolGrade.trim());
    fd.append('sectorType',           data.sectorType);
    fd.append('directorate',          data.directorate.trim());
    fd.append('schoolOrg',            data.schoolOrg.trim());
    fd.append('favoriteSubject',      data.favoriteSubject.trim());
    fd.append('difficultySubject',    data.difficultySubject.trim());
    fd.append('generalLevel',         data.generalLevel.trim());
    fd.append('repeatedYear',         repeatedYear);
    if (data.repeatedYearReason?.trim()) fd.append('repeatedYearReason', data.repeatedYearReason.trim());
    fd.append('gradeDetail',          data.gradeDetail.trim());
    fd.append('generalGrade',         data.generalGrade.trim());
    fd.append('lastResultAvg',        data.lastResultAvg.trim());
    fd.append('highestGrade',         data.highestGrade.trim());
    fd.append('lowestGrade',          data.lowestGrade.trim());
    fd.append('eduResponsible',       data.eduResponsible.trim());
    fd.append('eduResponsiblePhone',  data.eduResponsiblePhone.trim());
    fd.append('eduLevel',             data.eduLevel.trim());
    fd.append('guardianAge',          data.guardianAge.trim());
    fd.append('guardianEduLevel',     data.guardianEduLevel.trim());
    fd.append('guardianJob',          data.guardianJob.trim());
    fd.append('guardianHealth',       data.guardianHealth.trim());
    fd.append('familyMaleCount',      String(data.familyMaleCount));
    fd.append('familyFemaleCount',    String(data.familyFemaleCount));
    fd.append('familyProblems',       data.familyProblems.trim());
    fd.append('ownershipType',     ownershipType);
    fd.append('buildingType',      buildingType);
    fd.append('floorsCount',       String(data.floorsCount));
    fd.append('roomsCount',        String(data.roomsCount));
    fd.append('water',             data.water.trim());
    fd.append('electricity',       data.electricity.trim());
    if (data.rentAmount?.trim())          fd.append('rentAmount',           data.rentAmount.trim());
    if (data.housingDetails?.trim())      fd.append('housingDetails',       data.housingDetails.trim());
    fd.append('hasChronicDisease',     hasChronicDisease);
    if (data.chronicDiseaseDetails?.trim()) fd.append('chronicDiseaseDetails', data.chronicDiseaseDetails.trim());
    fd.append('hasRegularTreatment',   hasRegularTreatment);
    fd.append('hasHealthInsurance',    hasHealthInsurance);
    fd.append('incomeSource',          incomeSource);
    fd.append('monthlyIncome',         data.monthlyIncome.trim());
    fd.append('hasCharitySupport',     hasCharitySupport);
    if (data.charitySupportDetails?.trim()) fd.append('charitySupportDetails', data.charitySupportDetails.trim());
    if (selectedTalents.size > 0) {
      fd.append('isGifted', 'true');
      fd.append('talents', JSON.stringify([...selectedTalents]));
    }
    if (data.talentsOther?.trim())    fd.append('talentsOther',        data.talentsOther.trim());
    fd.append('familyRelations',     familyRelations);
    fd.append('communityRelation',   communityRelation);
    fd.append('schoolRelation',      schoolRelation);
    fd.append('socialBehavior',      socialBehavior);
    fd.append('needsSocialSupport',  needsSocialSupport);
    fd.append('quranLevel',          quranLevel);
    fd.append('prayerCommitment',    prayerCommitment);
    fd.append('moralBehavior',       moralBehavior);
    fd.append('generalAppearance',   generalAppearance);
    fd.append('selfExpression',      selfExpression);
    fd.append('psychFamilyRelations',psychFamilyRelations);
    fd.append('peerRelations',       peerRelations);
    fd.append('sleepAppetite',       sleepAppetite);
    fd.append('psychSigns',          psychSigns);
    fd.append('needsPsychSupport',   needsPsychSupport);
    fd.append('recommendations',     data.recommendations.trim());
    if (data.notes?.trim())          fd.append('notes', data.notes.trim());

    fd.append('deathCert', deathCertFile);
    fd.append('birthCert', birthCertFile);
    additionalFiles.forEach((f) => fd.append('additionalDocs', f));

    try {
      await api.post('/orphans', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSubmitState('success');
      reset();
      setDeathCertFile(null);
      setBirthCertFile(null);
      setAdditionalFiles([]);
      setFileErrors({});
    } catch (err) {
      console.error('Error submitting orphan registration:', err);
      setSubmitState('error');
      setApiError(
        err.response?.data?.errors?.[0]?.msg ||
        err.response?.data?.error ||
        'حدث خطأ أثناء الإرسال. يرجى المحاولة مجدداً'
      );
    }
  };

  const handleRegisterAnother = () => {
    setSubmitState('idle');
    setCurrentPage(1);
  };

  // ── Main form ──────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <style jsx global>{`
        @keyframes fadeIn  { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }
      `}</style>

      {/* ── Success toast popup ─────────────────────────────────────────── */}
      <Modal open={submitState === 'success'} className="p-9 px-8 text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle2 size={40} color="#10B981" strokeWidth={1.8} />
        </div>
        <h3 className="text-[1.2rem] font-extrabold text-[#0d3d5c] m-0 mb-2.5">تم التسجيل بنجاح</h3>
        <p className="text-[0.875rem] text-gray-500 leading-[1.7] m-0 mb-6">
          تم إرسال بيانات اليتيم إلى قائمة انتظار مراجعة المشرف.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Button variant="primary" onClick={handleRegisterAnother}>
            تسجيل يتيم آخر
          </Button>
          <Button
            variant="outline"
            className="py-3"
            onClick={() => router.push('/my-orphans')}
          >
            عرض أيتامي
          </Button>
        </div>
      </Modal>

      <div className="max-w-[860px] mx-auto pb-16 font-cairo" dir="rtl">

        {/* Page header */}
        <PageHeader
          title="تسجيل يتيم جديد"
          subtitle="أدخل بيانات اليتيم والمستندات المطلوبة لإرسالها للمراجعة"
          className="flex-col sm:flex-row sm:items-start mb-6"
          action={
            <Button variant="outline" type="button" className="py-3" onClick={() => router.back()}>
              ← رجوع
            </Button>
          }
        />

        <WizardProgressBar
          steps={['البيانات الأساسية', 'الأسرة والتعليم', 'السكن والصحة', 'المواهب والجوانب', 'المستندات']}
          currentStep={currentPage}
        />

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">

          {/* ══ PAGE 1: البيانات الأساسية والتواصل ══ */}
          {currentPage === 1 && <Fragment>
          <div className={CLS_CARD}>
            <SectionHeader number="١" title="البيانات الأساسية" subtitle="معلومات اليتيم الشخصية" />
            <div className={CLS_GRID}>

              {/* Full name */}
              <div className={CLS_FG2}>
                <label className={CLS_LBL} htmlFor="fullName">
                  الاسم الكامل <span className={CLS_REQ}>*</span>
                </label>
                <Input
                  id="fullName"
                  className="rounded-xl" error={errors.fullName?.message}
                  placeholder="مثال: محمد أحمد علي"
                  {...register('fullName', {
                    required: 'الاسم الكامل مطلوب',
                    validate: (v) => {
                      if (!v || !v.trim()) return 'الاسم الكامل مطلوب';
                      const parts = v.trim().split(/\s+/).filter(Boolean);
                      if (parts.length < 2) {
                        return 'الاسم يجب أن يكون ثنائياً على الأقل، ويحتوي على أحرف فقط';
                      }
                      const nameRegex = /^[\p{L}\p{M}]+(?:[-'ـ][\p{L}\p{M}]+)*$/u;
                      if (!parts.every((p) => nameRegex.test(p))) {
                        return 'الاسم يجب أن يحتوي على أحرف فقط';
                      }
                      return true;
                    },
                  })}
                />
                {errors.fullName && <p className={CLS_FERR}>{errors.fullName.message}</p>}
              </div>

              {/* Date of birth */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="dateOfBirth">
                  تاريخ الميلاد <span className={CLS_REQ}>*</span>
                </label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  className="rounded-xl direction-ltr text-left" error={errors.dateOfBirth?.message}
                  max={new Date().toISOString().split('T')[0]}
                  {...register('dateOfBirth', {
                    required: 'تاريخ الميلاد مطلوب',
                    validate: (v) => new Date(v) < new Date() || 'يجب أن يكون في الماضي',
                  })}
                />
                {errors.dateOfBirth && <p className={CLS_FERR}>{errors.dateOfBirth.message}</p>}
              </div>

              {/* Gender */}
              <div className={CLS_FG}>
                <label className={CLS_LBL}>الجنس <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-3">
                  {[['male', 'ذكر'], ['female', 'أنثى']].map(([val, lbl]) => (
                    <label key={val} className={CLS_RADIO(errors.gender)}>
                      <Input
                        type="radio"
                        value={val}
                        className="hidden"
                        {...register('gender', { required: 'يرجى اختيار الجنس' })}
                      />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {errors.gender && <p className={CLS_FERR}>{errors.gender.message}</p>}
              </div>

              {/* Governorate */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="governorateId">
                  المحافظة <span className={CLS_REQ}>*</span>
                </label>
                <Select
                  id="governorateId"
                  className="rounded-xl"
                  error={errors.governorateId?.message}
                  disabled={govLoading}
                  {...register('governorateId', { required: 'المحافظة مطلوبة' })}
                >
                  <option value="">{govLoading ? 'جارٍ التحميل…' : 'اختر المحافظة'}</option>
                  {governorates.map((g) => (
                    <option key={g.id} value={g.id}>{g.name_ar}</option>
                  ))}
                </Select>
                {errors.governorateId && <p className={CLS_FERR}>{errors.governorateId.message}</p>}
              </div>

              {/* Birth place */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="birthPlace">
                  محل الميلاد <span className={CLS_REQ}>*</span>
                </label>
                <Input
                  id="birthPlace"
                  className="rounded-xl" error={errors.birthPlace?.message}
                  placeholder="المدينة أو المنطقة"
                  {...register('birthPlace', { required: 'محل الميلاد مطلوب' })}
                />
                {errors.birthPlace && <p className={CLS_FERR}>{errors.birthPlace.message}</p>}
              </div>

              {/* Residence */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="residence">
                  مكان السكن <span className={CLS_REQ}>*</span>
                </label>
                <Input
                  id="residence"
                  className="rounded-xl" error={errors.residence?.message}
                  placeholder="العنوان الحالي"
                  {...register('residence', { required: 'مكان السكن مطلوب' })}
                />
                {errors.residence && <p className={CLS_FERR}>{errors.residence.message}</p>}
              </div>

              {/* Mother's governorate */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="motherGovernorate">
                  المحافظة الأم <span className={CLS_REQ}>*</span>
                </label>
                <Select
                  id="motherGovernorate"
                  className="rounded-xl"
                  error={errors.motherGovernorate?.message}
                  disabled={govLoading}
                  {...register('motherGovernorate', { required: 'المحافظة الأم مطلوبة' })}
                >
                  <option value="">{govLoading ? 'جارٍ التحميل…' : 'اختر المحافظة'}</option>
                  {governorates.map((g) => (
                    <option key={g.id} value={g.id}>{g.name_ar}</option>
                  ))}
                </Select>
                {errors.motherGovernorate && <p className={CLS_FERR}>{errors.motherGovernorate.message}</p>}
              </div>

              {/* Notes */}
              <div className={CLS_FG2}>
                <label className={CLS_LBL} htmlFor="notes">
                  ملاحظات <span className={CLS_OPT}>(اختياري)</span>
                </label>
                <Textarea id="notes"
                  className="rounded-xl resize-y min-h-[80px]"
                  rows={3}
                  placeholder="أي معلومات إضافية مفيدة عن اليتيم…"
                  {...register('notes')}
                />
              </div>
            </div>
          </div>

          {/* ── Section 2: Contact Info ──────────────────────────────────────── */}
          <div className={CLS_CARD}>
            <SectionHeader number="٢" title="معلومات التواصل" subtitle="أرقام التواصل والعنوان" />
            <div className={CLS_GRID}>

              {/* Phone 1 */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="phone1">
                  الرقم الأول <span className={CLS_REQ}>*</span>
                </label>
                <Input
                  id="phone1"
                  className="rounded-xl direction-ltr text-left" error={errors.phone1?.message}
                  placeholder="07XXXXXXXX"
                  {...register('phone1', { required: 'الرقم الأول مطلوب' })}
                />
                {errors.phone1 && <p className={CLS_FERR}>{errors.phone1.message}</p>}
              </div>

              {/* Phone 1 relation */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="phone1Relation">
                  صلة القرابة <span className={CLS_REQ}>*</span>
                </label>
                <select
                  id="phone1Relation"
                  className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:border-[#1B5E8C] focus:bg-white transition cursor-pointer ${
                    errors.phone1Relation ? 'border-red-500 bg-red-50/50' : 'border-gray-300'
                  }`}
                  {...register('phone1Relation', { required: 'صلة القرابة مطلوبة' })}
                >
                  <option value="">-- اختر صلة القرابة --</option>
                  {KINSHIP_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.phone1Relation && <p className={CLS_FERR}>{errors.phone1Relation.message}</p>}
              </div>

              {/* Phone 2 */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="phone2">الرقم الثاني</label>
                <Input
                  id="phone2"
                  className="rounded-xl direction-ltr text-left" error={errors.phone2?.message}
                  placeholder="07XXXXXXXX"
                  {...register('phone2')}
                />
                {errors.phone2 && <p className={CLS_FERR}>{errors.phone2.message}</p>}
              </div>

              {/* Phone 2 relation */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="phone2Relation">
                  صلة القرابة {watch('phone2') && <span className={CLS_REQ}>*</span>}
                </label>
                <select
                  id="phone2Relation"
                  className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:border-[#1B5E8C] focus:bg-white transition cursor-pointer ${
                    errors.phone2Relation ? 'border-red-500 bg-red-50/50' : 'border-gray-300'
                  }`}
                  {...register('phone2Relation', {
                    validate: (val) => !watch('phone2') || !!val || 'صلة القرابة مطلوبة عند إدخال الرقم الثاني',
                  })}
                >
                  <option value="">-- اختر صلة القرابة (اختياري) --</option>
                  {KINSHIP_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.phone2Relation && <p className={CLS_FERR}>{errors.phone2Relation.message}</p>}
              </div>

              {/* Address */}
              <div className={CLS_FG2}>
                <label className={CLS_LBL} htmlFor="address">
                  العنوان <span className={CLS_REQ}>*</span>
                </label>
                <Input
                  id="address"
                  className="rounded-xl" error={errors.address?.message}
                  placeholder="الحي، الشارع، رقم المنزل…"
                  {...register('address', { required: 'العنوان مطلوب' })}
                />
                {errors.address && <p className={CLS_FERR}>{errors.address.message}</p>}
              </div>

            </div>
          </div>
          </Fragment>}

          {/* ══ PAGE 2: الأسرة والتعليم ══ */}
          {currentPage === 2 && <Fragment>
          {/* ── Section 3: Guardian + Family ─────────────────────────────── */}
          <div className={CLS_CARD}>
            <SectionHeader number="٣" title="معلومات الأسرة" subtitle="بيانات ولي الأمر وأفراد الأسرة" />
            <div className={CLS_GRID}>

              {/* Guardian name */}
              <div className={CLS_FG2}>
                <label className={CLS_LBL} htmlFor="guardianName">
                  اسم ولي الأمر <span className={CLS_REQ}>*</span>
                </label>
                <Input
                  id="guardianName"
                  className="rounded-xl" error={errors.guardianName?.message}
                  placeholder="الأم / الجد / العم / غيره"
                  {...register('guardianName', { required: 'اسم الوصي مطلوب' })}
                />
                {errors.guardianName && <p className={CLS_FERR}>{errors.guardianName.message}</p>}
              </div>

              {/* Guardian relation */}
              <div className={CLS_FG2}>
                <label className={CLS_LBL}>صلة القرابة باليتيم <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {GUARDIAN_RELATIONS.map(({ value, label }) => (
                    <label key={value} className={`flex items-center px-4 py-2.5 border-[1.5px] rounded-[2rem] text-[0.83rem] font-semibold cursor-pointer transition-all duration-150 select-none ${errors.guardianRelation ? 'border-red-400' : ''} has-[:checked]:border-[#1B5E8C] has-[:checked]:bg-[#1B5E8C] has-[:checked]:text-white border-gray-300 bg-gray-50 text-[#6b7280] hover:border-[#1B5E8C] hover:text-[#1B5E8C]`}>
                      <input type="radio" value={value} className="hidden"
                        {...register('guardianRelation', { required: 'يرجى اختيار صلة الوصي' })} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                {errors.guardianRelation && <p className={CLS_FERR}>{errors.guardianRelation.message}</p>}
              </div>

              {/* Guardian age */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="guardianAge">عمر ولي الأمر <span className={CLS_REQ}>*</span></label>
                <Input id="guardianAge" className="rounded-xl direction-ltr text-left" error={errors.guardianAge?.message} placeholder="مثال: 45" {...register('guardianAge', { required: 'عمر ولي الأمر مطلوب' })} />
                {errors.guardianAge && <p className={CLS_FERR}>{errors.guardianAge.message}</p>}
              </div>

              {/* Guardian education level */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="guardianEduLevel">المستوى التعليمي <span className={CLS_REQ}>*</span></label>
                <Input id="guardianEduLevel" className="rounded-xl" error={errors.guardianEduLevel?.message} placeholder="مثال: ثانوية، جامعي" {...register('guardianEduLevel', { required: 'المستوى التعليمي مطلوب' })} />
                {errors.guardianEduLevel && <p className={CLS_FERR}>{errors.guardianEduLevel.message}</p>}
              </div>

              {/* Guardian job */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="guardianJob">المهنة <span className={CLS_REQ}>*</span></label>
                <Input id="guardianJob" className="rounded-xl" error={errors.guardianJob?.message} placeholder="مثال: موظف، تاجر" {...register('guardianJob', { required: 'المهنة مطلوبة' })} />
                {errors.guardianJob && <p className={CLS_FERR}>{errors.guardianJob.message}</p>}
              </div>

              {/* Guardian health */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="guardianHealth">الحالة الصحية <span className={CLS_REQ}>*</span></label>
                <Input id="guardianHealth" className="rounded-xl" error={errors.guardianHealth?.message} placeholder="مثال: جيدة، مريض" {...register('guardianHealth', { required: 'الحالة الصحية مطلوبة' })} />
                {errors.guardianHealth && <p className={CLS_FERR}>{errors.guardianHealth.message}</p>}
              </div>

              {/* Family members count */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="familyMaleCount">عدد الذكور في الأسرة <span className={CLS_REQ}>*</span></label>
                <Input id="familyMaleCount" className="rounded-xl direction-ltr text-left" error={errors.familyMaleCount?.message} type="number" min="0" placeholder="0" {...register('familyMaleCount', { required: 'عدد الذكور مطلوب' })} />
                {errors.familyMaleCount && <p className={CLS_FERR}>{errors.familyMaleCount.message}</p>}
              </div>

              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="familyFemaleCount">عدد الإناث في الأسرة <span className={CLS_REQ}>*</span></label>
                <Input id="familyFemaleCount" className="rounded-xl direction-ltr text-left" error={errors.familyFemaleCount?.message} type="number" min="0" placeholder="0" {...register('familyFemaleCount', { required: 'عدد الإناث مطلوب' })} />
                {errors.familyFemaleCount && <p className={CLS_FERR}>{errors.familyFemaleCount.message}</p>}
              </div>

              {/* Family problems */}
              <div className={CLS_FG2}>
                <label className={CLS_LBL} htmlFor="familyProblems">أهم المشاكل التي تواجهها الأسرة <span className={CLS_REQ}>*</span></label>
                <Textarea id="familyProblems" className="rounded-xl resize-y min-h-[80px]" error={errors.familyProblems?.message} rows={3}
                  placeholder="اذكر أبرز المشاكل والتحديات…" {...register('familyProblems', { required: 'هذا الحقل مطلوب' })} />
                {errors.familyProblems && <p className={CLS_FERR}>{errors.familyProblems.message}</p>}
              </div>

            </div>
          </div>

          {/* ── Section 4: Educational Data ──────────────────────────────── */}
          <div className={CLS_CARD}>
            <SectionHeader number="٤" title="البيانات الدراسية" subtitle="معلومات عن المستوى التعليمي للأيتام" />
            <div className={CLS_GRID}>

              {/* Grade */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="schoolGrade">الصف <span className={CLS_REQ}>*</span></label>
                <Input id="schoolGrade" className="rounded-xl" error={errors.schoolGrade?.message} placeholder="مثال: السادس الابتدائي" {...register('schoolGrade', { required: 'الصف مطلوب' })} />
                {errors.schoolGrade && <p className={CLS_FERR}>{errors.schoolGrade.message}</p>}
              </div>

              {/* Sector type */}
              <div className={CLS_FG}>
                <label className={CLS_LBL}>نوع القطاع <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-3">
                  {[['government', 'حكومي'], ['private', 'خاص']].map(([val, lbl]) => (
                    <label key={val} className={CLS_RADIO(errors.sectorType)}>
                      <input type="radio" value={val} className="hidden" {...register('sectorType', { required: 'نوع القطاع مطلوب' })} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {errors.sectorType && <p className={CLS_FERR}>{errors.sectorType.message}</p>}
              </div>

              {/* Directorate */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="directorate">المديرية <span className={CLS_REQ}>*</span></label>
                <Input id="directorate" className="rounded-xl" error={errors.directorate?.message} placeholder="اسم المديرية" {...register('directorate', { required: 'المديرية مطلوبة' })} />
                {errors.directorate && <p className={CLS_FERR}>{errors.directorate.message}</p>}
              </div>

              {/* Organization */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="schoolOrg">الجهة <span className={CLS_REQ}>*</span></label>
                <Input id="schoolOrg" className="rounded-xl" error={errors.schoolOrg?.message} placeholder="اسم المدرسة أو الجهة" {...register('schoolOrg', { required: 'الجهة مطلوبة' })} />
                {errors.schoolOrg && <p className={CLS_FERR}>{errors.schoolOrg.message}</p>}
              </div>

              {/* Favorite subject */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="favoriteSubject">المادة المفضلة <span className={CLS_REQ}>*</span></label>
                <Input id="favoriteSubject" className="rounded-xl" error={errors.favoriteSubject?.message} placeholder="مثال: الرياضيات" {...register('favoriteSubject', { required: 'المادة المفضلة مطلوبة' })} />
                {errors.favoriteSubject && <p className={CLS_FERR}>{errors.favoriteSubject.message}</p>}
              </div>

              {/* Difficulty subject */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="difficultySubject">يواجه صعوبة في <span className={CLS_REQ}>*</span></label>
                <Input id="difficultySubject" className="rounded-xl" error={errors.difficultySubject?.message} placeholder="مثال: اللغة الإنجليزية" {...register('difficultySubject', { required: 'هذا الحقل مطلوب' })} />
                {errors.difficultySubject && <p className={CLS_FERR}>{errors.difficultySubject.message}</p>}
              </div>

              {/* General level */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="generalLevel">المستوى العام <span className={CLS_REQ}>*</span></label>
                <Input id="generalLevel" className="rounded-xl" error={errors.generalLevel?.message} placeholder="مثال: جيد، متوسط، ضعيف" {...register('generalLevel', { required: 'المستوى العام مطلوب' })} />
                {errors.generalLevel && <p className={CLS_FERR}>{errors.generalLevel.message}</p>}
              </div>

              {/* General grade */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="generalGrade">التقدير العام <span className={CLS_REQ}>*</span></label>
                <Input id="generalGrade" className="rounded-xl" error={errors.generalGrade?.message} placeholder="مثال: جيد جداً" {...register('generalGrade', { required: 'التقدير العام مطلوب' })} />
                {errors.generalGrade && <p className={CLS_FERR}>{errors.generalGrade.message}</p>}
              </div>

              {/* Repeated year */}
              <div className={CLS_FG2}>
                <label className={CLS_LBL}>هل أعاد سنة مسبقة؟ <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-3 max-w-[200px]">
                  {[['yes', 'نعم'], ['no', 'لا']].map(([val, lbl]) => (
                    <label key={val} className={CLS_RADIO_STATE(repeatedYear === val)}>
                      <input type="radio" value={val} checked={repeatedYear === val} className="hidden"
                        onChange={() => setRepeatedYear(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.repeatedYear && <p className={CLS_FERR}>{stateErrors.repeatedYear}</p>}
              </div>

              {/* Reason — only if repeated */}
              {repeatedYear === 'yes' && (
                <div className={CLS_FG2}>
                  <label className={CLS_LBL} htmlFor="repeatedYearReason">السبب</label>
                  <Input id="repeatedYearReason" className="rounded-xl" placeholder="سبب الإعادة" {...register('repeatedYearReason')} />
                </div>
              )}

              {/* Last result average */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="lastResultAvg">معدل آخر نتيجة <span className={CLS_REQ}>*</span></label>
                <Input id="lastResultAvg" className="rounded-xl direction-ltr text-left" error={errors.lastResultAvg?.message} placeholder="مثال: 85%" {...register('lastResultAvg', { required: 'معدل آخر نتيجة مطلوب' })} />
                {errors.lastResultAvg && <p className={CLS_FERR}>{errors.lastResultAvg.message}</p>}
              </div>

              {/* Grade detail */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="gradeDetail">التفصيل <span className={CLS_REQ}>*</span></label>
                <Input id="gradeDetail" className="rounded-xl" error={errors.gradeDetail?.message} placeholder="تفاصيل النتيجة" {...register('gradeDetail', { required: 'التفصيل مطلوب' })} />
                {errors.gradeDetail && <p className={CLS_FERR}>{errors.gradeDetail.message}</p>}
              </div>

              {/* Highest grade */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="highestGrade">أعلى درجة في مادة <span className={CLS_REQ}>*</span></label>
                <Input id="highestGrade" className="rounded-xl" error={errors.highestGrade?.message} placeholder="المادة والدرجة" {...register('highestGrade', { required: 'هذا الحقل مطلوب' })} />
                {errors.highestGrade && <p className={CLS_FERR}>{errors.highestGrade.message}</p>}
              </div>

              {/* Lowest grade */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="lowestGrade">أدنى درجة في مادة <span className={CLS_REQ}>*</span></label>
                <Input id="lowestGrade" className="rounded-xl" error={errors.lowestGrade?.message} placeholder="المادة والدرجة" {...register('lowestGrade', { required: 'هذا الحقل مطلوب' })} />
                {errors.lowestGrade && <p className={CLS_FERR}>{errors.lowestGrade.message}</p>}
              </div>

              {/* Edu responsible */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="eduResponsible">المسؤول تعليمياً <span className={CLS_REQ}>*</span></label>
                <Input id="eduResponsible" className="rounded-xl" error={errors.eduResponsible?.message} placeholder="الاسم" {...register('eduResponsible', { required: 'المسؤول التعليمي مطلوب' })} />
                {errors.eduResponsible && <p className={CLS_FERR}>{errors.eduResponsible.message}</p>}
              </div>

              {/* Edu responsible phone */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="eduResponsiblePhone">رقم هاتفه <span className={CLS_REQ}>*</span></label>
                <Input id="eduResponsiblePhone" className="rounded-xl direction-ltr text-left" error={errors.eduResponsiblePhone?.message} placeholder="07XXXXXXXX" {...register('eduResponsiblePhone', { required: 'رقم الهاتف مطلوب' })} />
                {errors.eduResponsiblePhone && <p className={CLS_FERR}>{errors.eduResponsiblePhone.message}</p>}
              </div>

              {/* Edu level */}
              <div className={CLS_FG2}>
                <label className={CLS_LBL} htmlFor="eduLevel">المستوى التعليمي للمسؤول <span className={CLS_REQ}>*</span></label>
                <Input id="eduLevel" className="rounded-xl" error={errors.eduLevel?.message} placeholder="مثال: ثانوية، جامعي" {...register('eduLevel', { required: 'المستوى التعليمي مطلوب' })} />
                {errors.eduLevel && <p className={CLS_FERR}>{errors.eduLevel.message}</p>}
              </div>

            </div>
          </div>
          </Fragment>}

          {/* ══ PAGE 3: السكن والصحة والاقتصاد ══ */}
          {currentPage === 3 && <Fragment>
          {/* ── Section 5: Housing ───────────────────────────────────────── */}
          <div className={CLS_CARD}>
            <SectionHeader number="٥" title="الوضع السكني" subtitle="معلومات عن السكن والمرافق" />
            <div className={CLS_GRID}>

              {/* Ownership type */}
              <div className={CLS_FG2}>
                <label className={CLS_LBL}>نوع السكن <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {[['owned', 'ملك'], ['rented', 'إيجار'], ['free', 'سكن مجاني']].map(([val, lbl]) => (
                    <label key={val} className={CLS_CHIP(ownershipType === val)}>
                      <input type="radio" value={val} checked={ownershipType === val} className="hidden"
                        onChange={() => setOwnershipType(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.ownershipType && <p className={CLS_FERR}>{stateErrors.ownershipType}</p>}
              </div>

              {/* Building type */}
              <div className={CLS_FG2}>
                <label className={CLS_LBL}>نوع البناء <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {[['popular', 'شعبي'], ['reinforced', 'مسلح'], ['other', 'آخر']].map(([val, lbl]) => (
                    <label key={val} className={CLS_CHIP(buildingType === val)}>
                      <input type="radio" value={val} checked={buildingType === val} className="hidden"
                        onChange={() => setBuildingType(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.buildingType && <p className={CLS_FERR}>{stateErrors.buildingType}</p>}
              </div>

              {/* Floors */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="floorsCount">عدد الطوابق <span className={CLS_REQ}>*</span></label>
                <Input id="floorsCount" className="rounded-xl direction-ltr text-left" error={errors.floorsCount?.message} type="number" min="1" placeholder="1" {...register('floorsCount', { required: 'عدد الطوابق مطلوب' })} />
                {errors.floorsCount && <p className={CLS_FERR}>{errors.floorsCount.message}</p>}
              </div>

              {/* Rooms */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="roomsCount">عدد الغرف <span className={CLS_REQ}>*</span></label>
                <Input id="roomsCount" className="rounded-xl direction-ltr text-left" error={errors.roomsCount?.message} type="number" min="1" placeholder="1" {...register('roomsCount', { required: 'عدد الغرف مطلوب' })} />
                {errors.roomsCount && <p className={CLS_FERR}>{errors.roomsCount.message}</p>}
              </div>

              {/* Water */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="water">الماء <span className={CLS_REQ}>*</span></label>
                <Input id="water" className="rounded-xl" error={errors.water?.message} placeholder="مثال: شبكة عامة، خزان" {...register('water', { required: 'مصدر الماء مطلوب' })} />
                {errors.water && <p className={CLS_FERR}>{errors.water.message}</p>}
              </div>

              {/* Electricity */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="electricity">الكهرباء <span className={CLS_REQ}>*</span></label>
                <Input id="electricity" className="rounded-xl" error={errors.electricity?.message} placeholder="مثال: متصل، مولد" {...register('electricity', { required: 'مصدر الكهرباء مطلوب' })} />
                {errors.electricity && <p className={CLS_FERR}>{errors.electricity.message}</p>}
              </div>

              {/* Rent amount — only if rented */}
              {ownershipType === 'rented' && (
                <div className={CLS_FG}>
                  <label className={CLS_LBL} htmlFor="rentAmount">مقدار الإيجار <span className={CLS_OPT}>(اختياري)</span></label>
                  <Input id="rentAmount" className="rounded-xl direction-ltr text-left" placeholder="بالريال" {...register('rentAmount')} />
                </div>
              )}

              {/* Other details */}
              <div className={ownershipType === 'rented' ? CLS_FG : CLS_FG2}>
                <label className={CLS_LBL} htmlFor="housingDetails">تفاصيل أخرى <span className={CLS_OPT}>(اختياري)</span></label>
                <Input id="housingDetails" className="rounded-xl" placeholder="أي تفاصيل إضافية" {...register('housingDetails')} />
              </div>

            </div>
          </div>

          {/* ── Section 6: Health ────────────────────────────────────────── */}
          <div className={CLS_CARD}>
            <SectionHeader number="٦" title="الحالة الصحية" subtitle="معلومات عن الوضع الصحي لليتيم" />
            <div className={CLS_GRID}>

              {/* Chronic disease */}
              <div className={CLS_FG2}>
                <label className={CLS_LBL}>هل يعاني من أمراض مزمنة؟ <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-3 max-w-[200px]">
                  {[['yes', 'نعم'], ['no', 'لا']].map(([val, lbl]) => (
                    <label key={val} className={CLS_RADIO_STATE(hasChronicDisease === val)}>
                      <input type="radio" value={val} checked={hasChronicDisease === val} className="hidden"
                        onChange={() => setHasChronicDisease(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.hasChronicDisease && <p className={CLS_FERR}>{stateErrors.hasChronicDisease}</p>}
              </div>

              {/* Disease details — only if yes */}
              {hasChronicDisease === 'yes' && (
                <div className={CLS_FG2}>
                  <label className={CLS_LBL} htmlFor="chronicDiseaseDetails">التفاصيل</label>
                  <Input id="chronicDiseaseDetails" className="rounded-xl"
                    placeholder="اذكر الأمراض المزمنة…" {...register('chronicDiseaseDetails')} />
                </div>
              )}

              {/* Regular treatment */}
              <div className={CLS_FG}>
                <label className={CLS_LBL}>هل يتلقى علاجاً منتظماً؟ <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-3">
                  {[['yes', 'نعم'], ['no', 'لا']].map(([val, lbl]) => (
                    <label key={val} className={CLS_RADIO_STATE(hasRegularTreatment === val)}>
                      <input type="radio" value={val} checked={hasRegularTreatment === val} className="hidden"
                        onChange={() => setHasRegularTreatment(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.hasRegularTreatment && <p className={CLS_FERR}>{stateErrors.hasRegularTreatment}</p>}
              </div>

              {/* Health insurance */}
              <div className={CLS_FG}>
                <label className={CLS_LBL}>هل يتوفر تأمين صحي؟ <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-3">
                  {[['yes', 'نعم'], ['no', 'لا']].map(([val, lbl]) => (
                    <label key={val} className={CLS_RADIO_STATE(hasHealthInsurance === val)}>
                      <input type="radio" value={val} checked={hasHealthInsurance === val} className="hidden"
                        onChange={() => setHasHealthInsurance(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.hasHealthInsurance && <p className={CLS_FERR}>{stateErrors.hasHealthInsurance}</p>}
              </div>

            </div>
          </div>

          {/* ── Section 7: Economic ──────────────────────────────────────── */}
          <div className={CLS_CARD}>
            <SectionHeader number="٧" title="الوضع الاقتصادي" subtitle="مصادر الدخل والدعم المالي للأسرة" />
            <div className={CLS_GRID}>

              {/* Income source */}
              <div className={CLS_FG2}>
                <label className={CLS_LBL}>مصدر الدخل الرئيسي <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {[
                    ['salary',    'راتب شهري'],
                    ['assistance','مساعدات'],
                    ['freelance', 'أعمال حرة'],
                    ['none',      'لا يوجد'],
                  ].map(([val, lbl]) => (
                    <label key={val} className={CLS_CHIP(incomeSource === val)}>
                      <input type="radio" value={val} checked={incomeSource === val} className="hidden"
                        onChange={() => setIncomeSource(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.incomeSource && <p className={CLS_FERR}>{stateErrors.incomeSource}</p>}
              </div>

              {/* Monthly income */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="monthlyIncome">
                  متوسط الدخل الشهري <span className={CLS_REQ}>*</span>
                </label>
                <div className="relative">
                  <Input id="monthlyIncome" className="rounded-xl direction-ltr text-left pl-12" error={errors.monthlyIncome?.message}
                    placeholder="0" {...register('monthlyIncome', { required: 'متوسط الدخل الشهري مطلوب' })} />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.8rem] text-gray-400 pointer-events-none">ريال</span>
                </div>
                {errors.monthlyIncome && <p className={CLS_FERR}>{errors.monthlyIncome.message}</p>}
              </div>

              {/* Charity support */}
              <div className={CLS_FG}>
                <label className={CLS_LBL}>
                  هل تتلقى الأسرة دعماً من جهة خيرية؟ <span className={CLS_REQ}>*</span>
                </label>
                <div className="flex gap-3">
                  {[['yes', 'نعم'], ['no', 'لا']].map(([val, lbl]) => (
                    <label key={val} className={CLS_RADIO_STATE(hasCharitySupport === val)}>
                      <input type="radio" value={val} checked={hasCharitySupport === val} className="hidden"
                        onChange={() => setHasCharitySupport(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.hasCharitySupport && <p className={CLS_FERR}>{stateErrors.hasCharitySupport}</p>}
              </div>

              {/* Support details — only if yes */}
              {hasCharitySupport === 'yes' && (
                <div className={CLS_FG2}>
                  <label className={CLS_LBL} htmlFor="charitySupportDetails">تفصيل الدعم</label>
                  <Textarea id="charitySupportDetails" className="rounded-xl resize-y min-h-[80px]" rows={2}
                    placeholder="اذكر الجهة ومقدار الدعم…"
                    {...register('charitySupportDetails')} />
                </div>
              )}

            </div>
          </div>
          </Fragment>}

          {/* ══ PAGE 4: المواهب والجوانب الشخصية ══ */}
          {currentPage === 4 && <Fragment>
          {/* ── Section 8: Skills & Talents ──────────────────────────────── */}
          <div className={CLS_CARD}>
            <SectionHeader
              number="٨"
              title="المهارات والمواهب"
              subtitle={
                selectedTalents.size > 0
                  ? `⭐ سيتم تصنيف اليتيم كموهوب تلقائياً (${selectedTalents.size} موهبة)`
                  : 'اختر المهارات والمواهب — أي اختيار يصنّف اليتيم كموهوب تلقائياً'
              }
            />

            {selectedTalents.size > 0 && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 px-4 mb-5 text-[0.85rem] text-emerald-800 font-semibold">
                <span>⭐</span>
                <span>سيتم تصنيف هذا اليتيم كموهوب بناءً على المهارات المختارة</span>
              </div>
            )}

            <div className="flex flex-col gap-4">
              {TALENT_CATEGORIES.map(({ key, label, options }) => (
                <div key={key}>
                  <p className="text-[0.82rem] font-bold text-gray-700 m-0 mb-2">
                    {label}
                  </p>
                  <div className="flex gap-2.5 flex-wrap">
                    {options.map((opt) => {
                      const id = `${key}__${opt}`;
                      const checked = selectedTalents.has(id);
                      return (
                        <label key={id} className={`flex items-center px-3.5 py-1.5 border-[1.5px] rounded-[2rem] text-[0.82rem] font-semibold cursor-pointer transition-all duration-150 select-none ${checked ? 'border-[#1B5E8C] bg-[#1B5E8C] text-white' : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-[#1B5E8C] hover:text-[#1B5E8C]'}`}>
                          <Input
                            type="checkbox"
                            className="hidden"
                            checked={checked}
                            onChange={() => {
                              setSelectedTalents(prev => {
                                const next = new Set(prev);
                                next.has(id) ? next.delete(id) : next.add(id);
                                return next;
                              });
                            }}
                          />
                          {opt}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Other talents */}
              <div className={CLS_FG}>
                <label className={CLS_LBL} htmlFor="talentsOther">
                  أخرى يود تعلمها أو تطويرها <span className={CLS_OPT}>(اختياري)</span>
                </label>
                <Input id="talentsOther" className="rounded-xl"
                  placeholder="مثال: العزف، الطيران…"
                  {...register('talentsOther')} />
              </div>
            </div>
          </div>

          {/* ── Section 9a: Social Aspect ────────────────────────────────── */}
          <div className={CLS_CARD}>
            <SectionHeader number="٩" title="الجانب الاجتماعي" subtitle="العلاقات الاجتماعية والسلوك" />
            <div className={CLS_GRID}>

              <div className={CLS_FG2}>
                <label className={CLS_LBL}>العلاقات داخل الأسرة <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {[['connected','مترابطة'],['tense','متوترة بعض الشيء'],['fragmented','مفككة']].map(([val,lbl]) => (
                    <label key={val} className={CLS_CHIP(familyRelations===val)}>
                      <input type="radio" checked={familyRelations===val} className="hidden" onChange={()=>setFamilyRelations(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.familyRelations && <p className={CLS_FERR}>{stateErrors.familyRelations}</p>}
              </div>

              <div className={CLS_FG2}>
                <label className={CLS_LBL}>العلاقة مع المجتمع <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {[['active','يشارك في أنشطة'],['shy','خجول ومنعزل'],['needs_push','يحتاج تشجيعاً على الاندماج']].map(([val,lbl]) => (
                    <label key={val} className={CLS_CHIP(communityRelation===val)}>
                      <input type="radio" checked={communityRelation===val} className="hidden" onChange={()=>setCommunityRelation(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.communityRelation && <p className={CLS_FERR}>{stateErrors.communityRelation}</p>}
              </div>

              <div className={CLS_FG2}>
                <label className={CLS_LBL}>العلاقة بالمدرسة والمعلمين <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {[['positive','إيجابية'],['average','متوسطة'],['weak','ضعيفة أو فيها مشكلات']].map(([val,lbl]) => (
                    <label key={val} className={CLS_CHIP(schoolRelation===val)}>
                      <input type="radio" checked={schoolRelation===val} className="hidden" onChange={()=>setSchoolRelation(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.schoolRelation && <p className={CLS_FERR}>{stateErrors.schoolRelation}</p>}
              </div>

              <div className={CLS_FG2}>
                <label className={CLS_LBL}>سلوكيات اجتماعية ملحوظة <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {[['cooperative','متعاون'],['introverted','انطوائي'],['aggressive','عدواني'],['leader','قيادي']].map(([val,lbl]) => (
                    <label key={val} className={CLS_CHIP(socialBehavior===val)}>
                      <input type="radio" checked={socialBehavior===val} className="hidden" onChange={()=>setSocialBehavior(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.socialBehavior && <p className={CLS_FERR}>{stateErrors.socialBehavior}</p>}
              </div>

              <div className={CLS_FG2}>
                <label className={CLS_LBL}>يحتاج إلى دعم اجتماعي إضافي؟ <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {[['yes','نعم'],['no','لا'],['pending','قيد المتابعة']].map(([val,lbl]) => (
                    <label key={val} className={CLS_CHIP(needsSocialSupport===val)}>
                      <input type="radio" checked={needsSocialSupport===val} className="hidden" onChange={()=>setNeedsSocialSupport(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.needsSocialSupport && <p className={CLS_FERR}>{stateErrors.needsSocialSupport}</p>}
              </div>

            </div>
          </div>

          {/* ── Section 9b: Religious/Spiritual ──────────────────────────── */}
          <div className={CLS_CARD}>
            <SectionHeader number="١٠" title="الجانب الروحي الديني" subtitle="مستوى الالتزام الديني والأخلاقي" />
            <div className={CLS_GRID}>

              <div className={CLS_FG2}>
                <label className={CLS_LBL}>حفظ القرآن الكريم <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {[
                    ['none',      'لا يحفظ'],
                    ['few_suras', 'يحفظ سور قليلة'],
                    ['few_parts', 'يحفظ أجزاء قليلة'],
                    ['half',      'يحفظ نصف القرآن'],
                    ['full',      'يحفظ كامل'],
                  ].map(([val, lbl]) => (
                    <label key={val} className={CLS_CHIP(quranLevel === val)}>
                      <input type="radio" checked={quranLevel === val} className="hidden" onChange={() => setQuranLevel(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.quranLevel && <p className={CLS_FERR}>{stateErrors.quranLevel}</p>}
              </div>

              <div className={CLS_FG2}>
                <label className={CLS_LBL}>الالتزام بالصلاة <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {[
                    ['always',    'دائم الالتزام'],
                    ['sometimes', 'أحياناً'],
                    ['rarely',    'نادراً'],
                  ].map(([val, lbl]) => (
                    <label key={val} className={CLS_CHIP(prayerCommitment === val)}>
                      <input type="radio" checked={prayerCommitment === val} className="hidden" onChange={() => setPrayerCommitment(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.prayerCommitment && <p className={CLS_FERR}>{stateErrors.prayerCommitment}</p>}
              </div>

              <div className={CLS_FG2}>
                <label className={CLS_LBL}>السلوك والأخلاق <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {[
                    ['good',         'مهذب ومتعاون'],
                    ['needs_follow', 'يحتاج متابعة بسيطة'],
                    ['needs_guide',  'لديه سلوكيات تحتاج توجيه'],
                  ].map(([val, lbl]) => (
                    <label key={val} className={CLS_CHIP(moralBehavior === val)}>
                      <input type="radio" checked={moralBehavior === val} className="hidden" onChange={() => setMoralBehavior(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.moralBehavior && <p className={CLS_FERR}>{stateErrors.moralBehavior}</p>}
              </div>

            </div>
          </div>

          {/* ── Section 9c: Psychological ────────────────────────────────── */}
          <div className={CLS_CARD}>
            <SectionHeader number="١١" title="الجانب النفسي" subtitle="الحالة النفسية والعاطفية لليتيم" />
            <div className={CLS_GRID}>

              <div className={CLS_FG2}>
                <label className={CLS_LBL}>المظهر العام والتفاعل <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {[['smiling','مبتسم ومتفاعل'],['shy','خجول'],['introverted','منطوٍ'],['aggressive','عدواني بعض الشيء']].map(([val,lbl]) => (
                    <label key={val} className={CLS_CHIP(generalAppearance===val)}>
                      <input type="radio" checked={generalAppearance===val} className="hidden" onChange={()=>setGeneralAppearance(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.generalAppearance && <p className={CLS_FERR}>{stateErrors.generalAppearance}</p>}
              </div>

              <div className={CLS_FG2}>
                <label className={CLS_LBL}>التعبير عن الذات <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {[['confident','يتحدث بثقة'],['hesitant','يتردد في الكلام'],['silent','صامت أغلب الوقت']].map(([val,lbl]) => (
                    <label key={val} className={CLS_CHIP(selfExpression===val)}>
                      <input type="radio" checked={selfExpression===val} className="hidden" onChange={()=>setSelfExpression(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.selfExpression && <p className={CLS_FERR}>{stateErrors.selfExpression}</p>}
              </div>

              <div className={CLS_FG2}>
                <label className={CLS_LBL}>العلاقات الأسرية <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {[['stable','جيدة ومستقرة'],['tense','متوترة قليلاً'],['troubled','مضطربة وتحتاج تدخل']].map(([val,lbl]) => (
                    <label key={val} className={CLS_CHIP(psychFamilyRelations===val)}>
                      <input type="radio" checked={psychFamilyRelations===val} className="hidden" onChange={()=>setPsychFamilyRelations(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.psychFamilyRelations && <p className={CLS_FERR}>{stateErrors.psychFamilyRelations}</p>}
              </div>

              <div className={CLS_FG2}>
                <label className={CLS_LBL}>العلاقة مع الزملاء والأصدقاء <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {[['positive','إيجابية'],['limited','محدودة'],['none','لا يملك أصدقاء']].map(([val,lbl]) => (
                    <label key={val} className={CLS_CHIP(peerRelations===val)}>
                      <input type="radio" checked={peerRelations===val} className="hidden" onChange={()=>setPeerRelations(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.peerRelations && <p className={CLS_FERR}>{stateErrors.peerRelations}</p>}
              </div>

              <div className={CLS_FG2}>
                <label className={CLS_LBL}>النوم والشهية <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {[['normal','طبيعية'],['poor_sleep','قلة نوم'],['poor_appetite','فقدان شهية'],['anxiety','قلق أو أحلام مزعجة']].map(([val,lbl]) => (
                    <label key={val} className={CLS_CHIP(sleepAppetite===val)}>
                      <input type="radio" checked={sleepAppetite===val} className="hidden" onChange={()=>setSleepAppetite(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.sleepAppetite && <p className={CLS_FERR}>{stateErrors.sleepAppetite}</p>}
              </div>

              <div className={CLS_FG2}>
                <label className={CLS_LBL}>علامات نفسية ظاهرة <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {[['none','لا يوجد'],['sadness','حزن / بكاء متكرر'],['fear','خوف / قلق'],['aggression','عدوانية / غضب']].map(([val,lbl]) => (
                    <label key={val} className={CLS_CHIP(psychSigns===val)}>
                      <input type="radio" checked={psychSigns===val} className="hidden" onChange={()=>setPsychSigns(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.psychSigns && <p className={CLS_FERR}>{stateErrors.psychSigns}</p>}
              </div>

              <div className={CLS_FG2}>
                <label className={CLS_LBL}>يحتاج إلى متابعة نفسية متخصصة؟ <span className={CLS_REQ}>*</span></label>
                <div className="flex gap-2.5 flex-wrap">
                  {[['yes','نعم'],['no','لا'],['pending','قيد الملاحظة']].map(([val,lbl]) => (
                    <label key={val} className={CLS_CHIP(needsPsychSupport===val)}>
                      <input type="radio" checked={needsPsychSupport===val} className="hidden" onChange={()=>setNeedsPsychSupport(val)} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                {stateErrors.needsPsychSupport && <p className={CLS_FERR}>{stateErrors.needsPsychSupport}</p>}
              </div>

            </div>
          </div>

          {/* ── Section 9d: Recommendations ──────────────────────────────── */}
          <div className={CLS_CARD}>
            <SectionHeader number="١٢" title="التوصيات" subtitle="ملاحظات وتوصيات الأخصائية" />
            <div className={CLS_FG}>
              <label className={CLS_LBL} htmlFor="recommendations">
                التوصيات <span className={CLS_REQ}>*</span>
              </label>
              <Textarea id="recommendations"
                className="rounded-xl resize-y min-h-[80px]" error={errors.recommendations?.message}
                rows={5}
                placeholder="اكتب توصياتك وملاحظاتك هنا…"
                {...register('recommendations', { required: 'التوصيات مطلوبة' })}
              />
              {errors.recommendations && <p className={CLS_FERR}>{errors.recommendations.message}</p>}
            </div>
          </div>
          </Fragment>}

          {/* ══ PAGE 5: المستندات ══ */}
          {currentPage === 5 && <div className={CLS_CARD}>
            <SectionHeader
              number="١٣"
              title="المستندات المطلوبة"
              subtitle="ارفع المستندات المطلوبة لإتمام التسجيل"
            />

            {/* Format badge strip */}
            <div className="flex items-center gap-2 flex-wrap mb-6">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 border border-slate-200 rounded-[2rem] text-xs font-semibold text-slate-600"><FileText size={13} strokeWidth={2} /> PDF</span>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 border border-slate-200 rounded-[2rem] text-xs font-semibold text-slate-600"><Image size={13} strokeWidth={2} /> JPG</span>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 border border-slate-200 rounded-[2rem] text-xs font-semibold text-slate-600"><Image size={13} strokeWidth={2} /> PNG</span>
              <span className="flex-1" />
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#fef9ec] border border-[#fcd34d] rounded-[2rem] text-xs font-semibold text-[#92400e]">الحد الأقصى 5 MB لكل ملف</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[1.1rem]">

              {/* Death certificate */}
              <div className="bg-[#f8fafc] border border-[#e5eaf0] rounded-[0.875rem] p-[1.1rem] flex flex-col gap-3.5 transition-colors focus-within:border-[#1B5E8C]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[0.625rem] flex items-center justify-center shrink-0 bg-red-100 text-red-600">
                    <FileText size={20} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-[0.88rem] font-bold text-slate-800 m-0 mb-0.5">شهادة وفاة الأب <span className="text-red-600 mr-0.5">*</span></p>
                    <p className="text-[0.75rem] text-slate-400 m-0">وثيقة رسمية تُثبت وفاة الأب</p>
                  </div>
                  {deathCertFile && <CheckCircle2 size={18} className="text-emerald-600 mr-auto" strokeWidth={2} />}
                </div>
                <FileDropZone
                  label="شهادة وفاة الأب"
                  hint="PDF أو JPG أو PNG — حتى 5 MB"
                  accept=".pdf,.jpg,.jpeg,.png"
                  value={deathCertFile}
                  onChange={setDeathCertFile}
                  error={fileErrors.deathCert}
                />
              </div>

              {/* Birth certificate */}
              <div className="bg-[#f8fafc] border border-[#e5eaf0] rounded-[0.875rem] p-[1.1rem] flex flex-col gap-3.5 transition-colors focus-within:border-[#1B5E8C]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[0.625rem] flex items-center justify-center shrink-0 bg-blue-100 text-blue-600">
                    <FileText size={20} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-[0.88rem] font-bold text-slate-800 m-0 mb-0.5">شهادة الميلاد <span className="text-red-600 mr-0.5">*</span></p>
                    <p className="text-[0.75rem] text-slate-400 m-0">وثيقة رسمية تُثبت ميلاد اليتيم</p>
                  </div>
                  {birthCertFile && <CheckCircle2 size={18} className="text-emerald-600 mr-auto" strokeWidth={2} />}
                </div>
                <FileDropZone
                  label="شهادة الميلاد"
                  hint="PDF أو JPG أو PNG — حتى 5 MB"
                  accept=".pdf,.jpg,.jpeg,.png"
                  value={birthCertFile}
                  onChange={setBirthCertFile}
                  error={fileErrors.birthCert}
                />
              </div>

              {/* Additional docs */}
              <div className="bg-[#f8fafc] border border-[#e5eaf0] rounded-[0.875rem] p-[1.1rem] flex flex-col gap-3.5 transition-colors focus-within:border-[#1B5E8C] sm:col-span-full">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[0.625rem] flex items-center justify-center shrink-0 bg-slate-200 text-slate-500">
                    <File size={20} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-[0.88rem] font-bold text-slate-800 m-0 mb-0.5">مستندات إضافية <span className="text-[#94a3b8] font-normal text-xs">(اختياري)</span></p>
                    <p className="text-[0.75rem] text-slate-400 m-0">أي وثائق داعمة — حتى 5 ملفات</p>
                  </div>
                  {additionalFiles.length > 0 && (
                    <span className="mr-auto text-[0.75rem] font-bold text-[#1B5E8C] bg-[#e0f2fe] px-2 py-1 rounded-[2rem]">{additionalFiles.length} / 5</span>
                  )}
                </div>
                <FileDropZone
                  label="مستندات إضافية"
                  hint="اسحب ملفات متعددة أو اضغط للاختيار — حتى 5 ملفات"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  value={additionalFiles}
                  onChange={(files) => setAdditionalFiles(files.slice(0, 5))}
                  error={
                    Object.entries(fileErrors)
                      .filter(([k]) => k.startsWith('add_'))
                      .map(([, v]) => v)[0]
                  }
                />
              </div>
            </div>
          </div>}

          {/* API error banner */}
          {submitState === 'error' && apiError && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 px-5 animate-[fadeIn_0.2s_ease]" role="alert">
              <span className="text-xl shrink-0 text-red-600"><AlertTriangle size={18} /></span>
              <div>
                <strong className="block text-sm font-bold text-red-800 mb-0.5">فشل الإرسال</strong>
                <p className="text-xs text-red-600 m-0">{apiError}</p>
              </div>
            </div>
          )}

          {/* Navigation row */}
          <div className="flex justify-end items-center gap-4 p-4 px-5 bg-white border border-[#e5eaf0] rounded-2xl">
            {currentPage === 1 ? (
              <Button variant="outline" type="button" className="py-3" onClick={() => router.back()}>
                إلغاء
              </Button>
            ) : (
              <Button variant="outline" type="button" className="py-3" onClick={() => setCurrentPage(p => p - 1)}>
                ← رجوع
              </Button>
            )}

            {currentPage < 5 ? (
              <Button key="next" variant="primary" type="button" onClick={handleNext}>
                التالي ←
              </Button>
            ) : (
              <Button
                key="submit"
                variant="primary"
                type="submit"
                disabled={submitState === 'loading'}
              >
                {submitState === 'loading'
                  ? <><Spinner size="sm" /> جارٍ الإرسال…</>
                  : 'إرسال للمراجعة ←'}
              </Button>
            )}
          </div>

        </form>
      </div>

    </AppShell>
  );
}

