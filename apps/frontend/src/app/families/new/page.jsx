'use client';

/**
 * page.jsx
 * Route:  /families/new  (Agent only)
 * Task:   feature/ui-family-registration-form
 * API:    POST /api/families  (application/json)
 *
 * Mirrors the orphan registration form structure but with
 * family-specific fields: family name, head of family, member count.
 * No file uploads required for families.
 */

import { useState, useEffect, Fragment } from 'react';
import { AlertTriangle, User, Users, CheckCircle2, Check } from 'lucide-react';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Spinner from '@/components/ui/Spinner';
import CounterInput from '@/components/ui/CounterInput';
import PageHeader from '@/components/ui/PageHeader';
import WizardProgressBar from '@/components/ui/WizardProgressBar';

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ number, title, subtitle }) {
  return (
    <div className="flex items-start gap-4 mb-6 pb-4 border-b-[1.5px] border-[#f0f4f8]">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1B5E8C] to-[#0d3d5c] text-white flex items-center justify-center text-[1.1rem] font-bold shrink-0 font-sans">{number}</div>
      <div>
        <h2 className="text-[1.05rem] font-bold text-[#0d3d5c] m-0 mb-0.5">{title}</h2>
        {subtitle && <p className="text-[0.78rem] text-slate-400 m-0">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function FamilyRegistrationPage() {
  const router = useRouter();
  const [governorates, setGovernorates] = useState([]);
  const [govLoading,   setGovLoading]   = useState(true);
  const [memberCount,  setMemberCount]  = useState(3);
  const [submitState,  setSubmitState]  = useState('idle');
  const [apiError,     setApiError]     = useState('');
  const [step,         setStep]         = useState(1); // Wizard step state

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: {
      familyName: '', headOfFamily: '', governorateId: '', notes: '',
    },
  });

  useEffect(() => {
    api.get('/governorates')
      .then(({ data }) => setGovernorates(data.data || []))
      .catch(() => setGovernorates([]))
      .finally(() => setGovLoading(false));
  }, []);

  const handleNext = async () => {
    let valid = false;
    if (step === 1) {
      valid = await trigger(['familyName', 'governorateId']);
    } else if (step === 2) {
      valid = await trigger(['headOfFamily']);
    }
    
    if (valid) {
      setStep(s => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    setStep(s => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = async (data) => {
    // Only the last step submits (blocks Enter-key and stray submits on earlier steps)
    if (step < 3) return;
    setSubmitState('loading');
    setApiError('');

    try {
      await api.post('/families', {
        familyName:   data.familyName.trim(),
        headOfFamily: data.headOfFamily.trim(),
        memberCount,
        governorateId: parseInt(data.governorateId, 10),
        notes: data.notes?.trim() || undefined,
      });

      setSubmitState('success');
      reset();
      setMemberCount(3);
      setStep(1);
    } catch (err) {
      setSubmitState('error');
      setApiError(
        err.response?.data?.errors?.[0]?.msg ||
        err.response?.data?.error ||
        'حدث خطأ أثناء الإرسال. يرجى المحاولة مجدداً'
      );
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────

  if (submitState === 'success') {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-[420px] bg-white rounded-3xl py-12 px-8 border border-[#e5eaf0] shadow-sm">
            <div className="text-[3rem] mb-4 text-emerald-500 flex justify-center"><CheckCircle2 size={48} strokeWidth={1.5} /></div>
            <h2 className="text-[1.4rem] font-extrabold text-[#0d3d5c] m-0 mb-3">تم تسجيل الأسرة بنجاح</h2>
            <p className="text-[0.88rem] text-[#6b7a8d] leading-relaxed m-0 mb-8">
              تم إرسال بيانات الأسرة إلى قائمة انتظار مراجعة المشرف.
              ستتلقى إشعاراً عند اتخاذ قرار بشأن الطلب.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button variant="primary" onClick={() => setSubmitState('idle')}>
                تسجيل أسرة أخرى
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                العودة للوحة التحكم
              </Button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="max-w-[760px] mx-auto pb-16 font-sans" dir="rtl">

        {/* Page header */}
        <PageHeader
          title="تسجيل أسرة محتاجة"
          subtitle="أدخل بيانات الأسرة لإرسالها للمراجعة"
          className="flex-col sm:flex-row sm:items-start mb-6"
          action={
            <Button variant="outline" onClick={() => router.back()}>
              ← رجوع
            </Button>
          }
        />

        <WizardProgressBar
          steps={['بيانات الأسرة', 'المعيل', 'التفاصيل']}
          currentStep={step}
        />

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">

          {/* ── Section 1: Family Info ──────────────────────────────────── */}
          {step === 1 && (
            <Fragment>
              <div className="bg-white border border-[#e5eaf0] rounded-2xl p-7 shadow-sm mb-5 animate-[fadeIn_0.3s_ease-out]">
                <SectionHeader number="1" title="بيانات الأسرة" subtitle="المعلومات الأساسية للأسرة المحتاجة" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-[0.82rem] font-semibold text-gray-700" htmlFor="familyName">
                      اسم الأسرة <span className="text-red-600 mr-[2px]">*</span>
                    </label>
                    <Input
                      id="familyName"
                      placeholder="مثال: أسرة محمد أحمد"
                      error={errors.familyName?.message}
                      {...register('familyName', {
                        required: 'اسم الأسرة مطلوب',
                        minLength: { value: 3, message: 'الاسم يجب أن يكون 3 أحرف على الأقل' },
                      })}
                    />
                    {errors.familyName && <p className="text-red-600 text-xs mt-1">{errors.familyName.message}</p>}
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-[0.82rem] font-semibold text-gray-700" htmlFor="governorateId">
                      المحافظة <span className="text-red-600 mr-[2px]">*</span>
                    </label>
                    <Select
                      id="governorateId"
                      error={errors.governorateId?.message}
                      disabled={govLoading}
                      {...register('governorateId', { required: 'المحافظة مطلوبة' })}
                    >
                      <option value="">{govLoading ? 'جارٍ التحميل…' : 'اختر المحافظة'}</option>
                      {governorates.map((g) => (
                        <option key={g.id} value={g.id}>{g.name_ar}</option>
                      ))}
                    </Select>
                    {errors.governorateId && <p className="text-red-600 text-xs mt-1">{errors.governorateId.message}</p>}
                  </div>
                </div>
              </div>
            </Fragment>
          )}

          {/* ── Section 2: Head of Family ───────────────────────────────── */}
          {step === 2 && (
            <Fragment>
              <div className="bg-white border border-[#e5eaf0] rounded-2xl p-7 shadow-sm mb-5 animate-[fadeIn_0.3s_ease-out]">
                <SectionHeader number="2" title="المعيل" subtitle="بيانات رب الأسرة أو المسؤول عنها" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-[0.82rem] font-semibold text-gray-700" htmlFor="headOfFamily">
                      اسم المعيل <span className="text-red-600 mr-[2px]">*</span>
                    </label>
                    <Input
                      id="headOfFamily"
                      placeholder="الاسم الكامل لرب الأسرة أو المسؤول"
                      error={errors.headOfFamily?.message}
                      {...register('headOfFamily', {
                        required: 'اسم المعيل مطلوب',
                        minLength: { value: 3, message: 'الاسم يجب أن يكون 3 أحرف على الأقل' },
                      })}
                    />
                    {errors.headOfFamily && <p className="text-red-600 text-xs mt-1">{errors.headOfFamily.message}</p>}
                  </div>
                </div>
              </div>
            </Fragment>
          )}

          {/* ── Section 3: Details ─────────────────────────────────────── */}
          {step === 3 && (
            <Fragment>
              <div className="bg-white border border-[#e5eaf0] rounded-2xl p-7 shadow-sm mb-5 animate-[fadeIn_0.3s_ease-out]">
                <SectionHeader number="3" title="التفاصيل" subtitle="عدد الأفراد وملاحظات إضافية" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-[0.82rem] font-semibold text-gray-700">
                      عدد أفراد الأسرة <span className="text-red-600 mr-[2px]">*</span>
                    </label>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-6 flex-wrap">
                      <CounterInput
                        value={memberCount}
                        onChange={setMemberCount}
                        min={1}
                        max={30}
                      />
                      <div className="flex flex-col gap-2 pt-1">
                        <div className="flex items-center gap-2 text-[0.8rem] text-slate-500">
                          <span className="text-[1rem]"><Users size={18} />‍<User size={18} /></span>
                          <span>يشمل جميع أفراد الأسرة المعيشية بما فيهم المعيل</span>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {[
                            { max: 3,  label: 'أسرة صغيرة',  color: '#10b981' },
                            { max: 6,  label: 'أسرة متوسطة', color: '#f59e0b' },
                            { max: 30, label: 'أسرة كبيرة',   color: '#ef4444' },
                          ].map(({ max, label, color }) => (
                            <span
                              key={max}
                              className="text-[0.72rem] py-1 px-2.5 rounded-full font-medium"
                              style={{
                                color,
                                background: `${color}15`,
                                border: `1px solid ${color}30`,
                                fontWeight: memberCount <= max && (max === 3 || memberCount > (max === 6 ? 3 : 6)) ? 700 : 500,
                              }}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-[0.82rem] font-semibold text-gray-700" htmlFor="notes">
                      ملاحظات إضافية <span className="text-slate-400 font-normal text-[0.75rem]">(اختياري)</span>
                    </label>
                    <Textarea
                      id="notes"
                      className="min-h-[100px]"
                      rows={4}
                      placeholder="أي معلومات إضافية عن الأسرة — وضعها الاجتماعي، ظروفها الخاصة، احتياجاتها…"
                      {...register('notes')}
                    />
                  </div>
                </div>
              </div>

              {/* Summary preview */}
              <div className="bg-blue-50/50 border-[1.5px] border-blue-100 rounded-2xl py-5 px-6 animate-[fadeIn_0.4s_ease-out]">
                <div className="text-[0.85rem] font-bold text-[#1B5E8C] mb-3.5">📋 ملخص الطلب</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[0.72rem] font-semibold text-slate-400">نوع الطلب</span>
                    <span className="text-[0.85rem] font-bold text-gray-800">تسجيل أسرة محتاجة</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[0.72rem] font-semibold text-slate-400">عدد الأفراد</span>
                    <span className="text-[0.85rem] font-bold text-gray-800">{memberCount} فرد</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[0.72rem] font-semibold text-slate-400">الحالة بعد الإرسال</span>
                    <span className="text-[0.85rem] font-bold text-amber-500">قيد المراجعة</span>
                  </div>
                </div>
              </div>

              {/* API error */}
              {submitState === 'error' && apiError && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl py-4 px-5 text-red-600 text-[0.83rem]" role="alert">
                  <span className="text-[1.2rem] shrink-0"><AlertTriangle size={18} /></span>
                  <div>
                    <strong className="block text-[0.9rem] text-red-700 mb-1">فشل الإرسال</strong>
                    <p className="m-0 text-red-600">{apiError}</p>
                  </div>
                </div>
              )}
            </Fragment>
          )}

          {/* Wizard Navigation / Submit row */}
          <div className="flex justify-end items-center gap-4 py-4 px-5 bg-white border border-[#e5eaf0] rounded-2xl">
            {step > 1 ? (
              <Button variant="outline" type="button" onClick={handlePrev}>
                السابق
              </Button>
            ) : (
              <Button variant="outline" type="button" onClick={() => router.back()}>
                إلغاء
              </Button>
            )}
            
            {step < 3 ? (
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
                  ? <><Spinner size="sm" />جارٍ الإرسال…</>
                  : <span className="flex items-center gap-1.5">إرسال للمراجعة <Check size={16} /></span>}
              </Button>
            )}
          </div>

        </form>
      </div>
    </AppShell>
  );
}
