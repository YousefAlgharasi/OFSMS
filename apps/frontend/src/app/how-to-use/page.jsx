'use client';

/**
 * /how-to-use — دليل استخدام النظام
 *
 * Public page (no login needed) that explains, in Arabic, how each role uses
 * the system and how work flows between roles. When a staff member is logged in
 * the page opens inside the normal app shell and starts on their own role.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen, Crown, ShieldCheck, ClipboardList, Wallet, HeartHandshake,
  ArrowLeft, Lightbulb, CheckCircle2, LogIn, Smartphone,
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import ThemeToggleFab from '../../components/ThemeToggleFab';
import useAuthStore from '../../store/useAuthStore';

// ── مراحل رحلة اليتيم داخل النظام (تظهر في "نظرة عامة") ─────────────────────
const LIFECYCLE = [
  { who: 'المندوب',        what: 'يسجّل اليتيم أو الأسرة ويرفع المستندات',                       status: 'قيد المراجعة' },
  { who: 'المشرف',         what: 'يراجع الطلب ويوافق عليه أو يرفضه مع ذكر السبب',                 status: 'تحت التسويق / مرفوض' },
  { who: 'المدير العام',   what: 'يربط الحالة بكافل من «مجمع التسويق»',                           status: 'تحت الكفالة' },
  { who: 'المندوب',        what: 'يرفع تقرير الحفظ الشهري لكل يتيم',                              status: 'تقرير بانتظار الاعتماد' },
  { who: 'المشرف',         what: 'يعتمد تقارير الحفظ ثم يُنشئ كشف الصرف الشهري ويعتمده',           status: 'كشف معتمد من المشرف' },
  { who: 'القسم المالي',   what: 'يراجع الكشف ويعتمده ماليًا أو يرفضه',                           status: 'معتمد ماليًا' },
  { who: 'المدير العام',   what: 'يُصدر الكشف (الصرف النهائي)',                                   status: 'تم الإصدار' },
  { who: 'المندوب',        what: 'يسلّم المبالغ ويؤكد استلام كل يتيم سجّله',               status: 'تم التأكيد' },
];

// ── الأدلة حسب الدور ──────────────────────────────────────────────────────────
const ROLES = [
  {
    id: 'gm',
    label: 'المدير العام',
    icon: Crown,
    intro: 'صاحب الصلاحية الكاملة: يشرف على كل أقسام النظام، ويربط الأيتام بالكفلاء، ويصدر كشوف الصرف نهائيًا، ويدير المستخدمين والإعدادات.',
    sections: [
      {
        title: 'متابعة العمل اليومي',
        steps: [
          'من «لوحة التحكم» ترى أعداد الأيتام والكفالات والتسجيلات المعلّقة وتقارير الحفظ وكشوف الصرف المعلّقة.',
          'زر «إرسال إشعار» في أعلى اللوحة يرسل إشعارًا لمستخدمين أو أدوار محددة.',
          'من «تحليلات المحافظات» و«التقارير» تستعرض الإحصائيات وتصدّرها (PDF / Excel).',
        ],
      },
      {
        title: 'ربط يتيم أو أسرة بكافل',
        steps: [
          'افتح «مجمع التسويق»: يعرض كل الحالات التي وافق عليها المشرف وتنتظر كافلًا.',
          'اضغط على الحالة لفتح ملفها، ثم اختر الكافل لإتمام الكفالة؛ تتحول الحالة إلى «تحت الكفالة».',
          'لنقل كفالة من كافل إلى آخر استخدم «نقل الكفالة» من صفحة الكفلاء.',
          'لنشر حالة أمام الكفلاء استخدم «مشاركة اليتيم مع الكفلاء» في ملفها؛ يظهر الإعلان في بوابة الكافل.',
        ],
      },
      {
        title: 'إدارة الكفلاء',
        steps: [
          'من «الكفلاء» أضف كافلًا جديدًا؛ ينشئ النظام له رمز بوابة وكلمة مرور تُسلَّم له.',
          'تستطيع تعديل بيانات الكافل أو عرض محفظته (الأيتام المكفولين).',
          'قوالب رسائل الكفلاء تُعدَّل من «إعدادات النظام».',
        ],
      },
      {
        title: 'الصرف الشهري (الخطوة الأخيرة)',
        steps: [
          'بعد اعتماد المشرف والقسم المالي يصبح الكشف جاهزًا للإصدار في «كشف الصرف».',
          'افتح الكشف واضغط «إصدار أمر الصرف النهائي» ليصبح متاحًا للمندوبين للتسليم.',
          'تابع نسبة التسليم والإثباتات من «سجل الإصدارات» وصفحة الإيصالات.',
        ],
      },
      {
        title: 'الإعدادات والمحتوى',
        steps: [
          '«إعدادات الحفظ» تضبط الحدود المرجعية للحفظ (بالأجزاء) حسب عمر اليتيم؛ يراها المشرف بجانب التقرير ولا يحكم بها النظام تلقائيًا.',
          '«الأيتام الموهوبون» لتحديد الموهوبين وضبط مبالغهم الخاصة.',
          '«الإعلانات» تنشر رسائل لجميع المستخدمين أو لفئة محددة.',
          '«إدارة الموقع التعريفي» تعدّل محتوى الصفحة العامة للمؤسسة.',
          '«إدارة المستخدمين» لإضافة موظفين وتعطيلهم وتغيير أدوارهم.',
          '«إعدادات النظام» للقوائم المرجعية والنسخ الاحتياطي وسجل العمليات (Audit Log).',
        ],
      },
    ],
    tips: [
      'كلمة مرور المستخدم الجديد تُسلَّم له مباشرة ويُنصح بتغييرها بعد أول دخول.',
      'سجل العمليات في «إعدادات النظام» يوضح من فعل ماذا ومتى، وهو مفيد عند أي استفسار.',
    ],
  },
  {
    id: 'supervisor',
    label: 'مشرف الأيتام',
    icon: ShieldCheck,
    intro: 'يراجع عمل المندوبين ويعتمد التسجيلات وتقارير الحفظ، ثم يُنشئ كشف الصرف الشهري ويرفعه للقسم المالي.',
    sections: [
      {
        title: 'مراجعة التسجيلات',
        steps: [
          'افتح «طلبات التسجيل»: قائمة موحّدة بالأيتام والأسر الجديدة التي تنتظر قرارك.',
          'اضغط على الطلب لعرض تفاصيله ومستنداته.',
          '«موافقة»: تنتقل الحالة إلى «تحت التسويق» وتظهر للمدير العام.',
          '«رفض»: اكتب سبب الرفض بوضوح؛ يصل إشعار للمندوب ليعدّل الطلب ويعيد إرساله.',
        ],
      },
      {
        title: 'اعتماد تقارير الحفظ',
        steps: [
          'من «تقارير الحفظ» تظهر التقارير التي رفعها المندوبون بانتظار المراجعة، وفيها ما كتبه المندوب عن حفظ اليتيم. النظام لا يحكم على المقدار، فالقرار لك.',
          'وافق على التقرير أو ارفضه (سبب الرفض إلزامي ويصل للمندوب كإشعار). عند إنشاء كشف الصرف يُستبعد اليتيم الذي تقريره مرفوض أو ما زال قيد المراجعة، ويظهر سبب الاستبعاد.',
        ],
      },
      {
        title: 'كشف الصرف الشهري',
        steps: [
          'من «كشف الصرف» اضغط «+ إنشاء كشف هذا الشهر»؛ يجمع النظام تلقائيًا الأيتام والأسر المكفولين. كشف واحد فقط لكل شهر.',
          'راجع البنود (المشمولون والمستبعدون وأسباب الاستبعاد).',
          'افتح الكشف واضغط «اعتماد الكشف» لإرساله للقسم المالي، أو «رفض» مع ذكر السبب.',
          'بعد إصدار المدير العام تتابع الإثباتات عبر صفحة «سجل استلام المندوبين» من داخل الكشف.',
        ],
      },
      {
        title: 'المتابعة والبرامج',
        steps: [
          '«تقييم الباحث الدوري»: أضف تقييمًا دوريًا للأيتام والأسر وتابع تطور درجاتهم.',
          '«برامج الدعم العيني» و«البرامج التربوية والتوعوية»: أنشئ البرامج وسجّل المستفيدين والمشاركين.',
          '«التقارير» و«الإعلانات» للاطلاع على الإحصائيات والتعاميم.',
        ],
      },
    ],
    tips: [
      'اكتب سبب الرفض واضحًا؛ المندوب لن يستطيع التعديل بدقة بدونه.',
      'لا تعتمد الكشف قبل مراجعة المستبعدين؛ فقد يكون سبب الاستبعاد تقريرًا ناقصًا يمكن إكماله.',
    ],
  },
  {
    id: 'agent',
    label: 'المندوب',
    icon: ClipboardList,
    intro: 'العامل الميداني: يسجّل الأيتام والأسر، ويرفع تقارير الحفظ الشهرية، ويسلّم المبالغ ويوثّق الاستلام.',
    sections: [
      {
        title: 'تسجيل يتيم أو أسرة',
        steps: [
          'اختر «تسجيل يتيم» أو «تسجيل أسرة» من القائمة الجانبية.',
          'عبّئ البيانات الأساسية بدقة (الاسم، تاريخ الميلاد، المحافظة، بيانات الوصي أو الأسرة...).',
          'أرفق المستندات المطلوبة (صور الوثائق) ثم اضغط حفظ.',
          'تدخل الحالة بوضع «قيد المراجعة» بانتظار المشرف. تظهر في «أيتامي».',
        ],
      },
      {
        title: 'عند رفض طلب',
        steps: [
          'يصلك إشعار، ويظهر تنبيه في لوحة التحكم بالحالات المرفوضة وسبب الرفض.',
          'افتح الحالة وعدّل البيانات المطلوبة ثم أعد إرسالها؛ تعود إلى «قيد المراجعة».',
        ],
      },
      {
        title: 'تقرير الحفظ الشهري',
        steps: [
          'من «رفع تقرير الحفظ» اختر اليتيم والشهر، ثم اكتب في الخانة ما حفظه اليتيم هذا الشهر (والملاحظات اختياريًا).',
          'يُرسل التقرير للمشرف؛ تابع حالته (بانتظار الاعتماد / معتمد / مرفوض) من لوحة التحكم.',
          'اليتيم الذي تقريره مرفوض أو قيد المراجعة وقت إنشاء الكشف يُستبعد منه، فارفع التقرير مبكرًا.',
        ],
      },
      {
        title: 'تسليم المبالغ وتوثيق الاستلام',
        steps: [
          'عندما يُصدر المدير العام الكشف، افتح «تأكيد الاستلام» من القائمة لترى الكشوف المُصدَرة التي تضم الأيتام الذين سجّلتهم.',
          'اختر الكشف، ثم بعد تسليم المبلغ لكل يتيم اضغط «تأكيد الاستلام». ويمكنك تصدير الكشف بصيغة PDF.',
          'شريط التقدم يوضح عدد المستفيدين الذين تم تأكيدهم؛ أكمل الكل ليكتمل الكشف.',
        ],
      },
      {
        title: 'أعمال أخرى',
        steps: [
          '«تقييم الباحث الدوري» لتقييم الأيتام والأسر الذين تتابعهم.',
          '«البرامج التربوية والتوعوية»: سجّل المشاركين وحدّث حالة البرنامج.',
          '«الإعلانات» لقراءة تعاميم الإدارة.',
        ],
      },
    ],
    tips: [
      'يعمل النظام جزئيًا بدون إنترنت لعرض البيانات المحفوظة، لكن الإرسال والرفع يحتاجان اتصالًا.',
      'ثبّت التطبيق على هاتفك من صفحة «تحميل التطبيق» لتسهيل العمل الميداني.',
    ],
  },
  {
    id: 'finance',
    label: 'القسم المالي',
    icon: Wallet,
    intro: 'يراجع كشوف الصرف التي اعتمدها المشرف ويعتمدها ماليًا أو يعيدها، ويتابع السجل والتقارير المالية.',
    sections: [
      {
        title: 'اعتماد كشف الصرف',
        steps: [
          'تُظهر لوحة التحكم الكشوف التي تنتظر اعتمادك.',
          'افتح «كشف الصرف» وراجع المجاميع والبنود والمستبعدين.',
          '«مصادقة المالية»: ينتقل الكشف إلى المدير العام للإصدار.',
          '«رفض» مع ذكر السبب: يُوقف الكشف ويُعاد للمراجعة.',
        ],
      },
      {
        title: 'المتابعة والتقارير',
        steps: [
          '«سجل الإصدارات» يعرض كل الكشوف السابقة وحالاتها ومبالغها.',
          'يمكنك الاطلاع على سجل استلام المندوبين لأي كشف للتحقق من اكتمال التسليم.',
          '«التقارير» لتصدير البيانات المالية (PDF / Excel).',
          '«الإعلانات» لقراءة التعاميم.',
        ],
      },
    ],
    tips: [
      'قارن إجمالي الكشف بالشهر السابق في «سجل الإصدارات» لاكتشاف أي فرق غير مبرر قبل الاعتماد.',
    ],
  },
  {
    id: 'sponsor',
    label: 'الكافل',
    icon: HeartHandshake,
    intro: 'الكافل لا يستخدم لوحة الموظفين؛ لديه بوابة خاصة يتابع منها الأيتام الذين يكفلهم.',
    sections: [
      {
        title: 'الدخول إلى البوابة',
        steps: [
          'تستلم من المؤسسة رابط البوابة أو رمز البوابة مع كلمة المرور.',
          'افتح الرابط ثم أدخل كلمة المرور، أو ادخل من صفحة «دخول الكافل» بالرمز وكلمة المرور.',
        ],
      },
      {
        title: 'ماذا تجد في البوابة',
        steps: [
          '«محفظتك»: الأيتام والأسر الذين تكفلهم وبياناتهم الأساسية.',
          'صفحة كل يتيم: تقارير الحفظ والتقدم الدراسي المعتمدة.',
          'الإشعارات والإعلانات الجديدة من المؤسسة، ومنها حالات جديدة تحتاج كفالة.',
        ],
      },
    ],
    tips: [
      'لا تشارك كلمة مرور البوابة مع أحد. عند فقدانها تواصل مع المؤسسة لإعادة تعيينها.',
    ],
  },
];

const OVERVIEW = { id: 'overview', label: 'نظرة عامة', icon: BookOpen };

const GENERAL = [
  'الدخول: من صفحة «تسجيل الدخول» بالبريد الإلكتروني وكلمة المرور. تنتهي الجلسة تلقائيًا بعد فترة خمول، فسجّل دخولك مجددًا عند الطلب.',
  'القائمة الجانبية تعرض فقط ما يسمح به دورك؛ إن لم تجد صفحة فهي ليست ضمن صلاحياتك.',
  'الوضع الليلي/النهاري: اضغط أيقونة الشمس أو القمر في أعلى الصفحة أو أسفل القائمة الجانبية. يُحفظ اختيارك.',
  'الإشعارات: أيقونة الجرس تعرض تنبيهات العمل (رفض، اعتماد، كشف جديد...).',
  'تثبيت التطبيق على الهاتف: من صفحة «تحميل التطبيق» (أندرويد وآيفون).',
  'تسجيل الخروج: من أسفل القائمة الجانبية. استخدمه دائمًا على الأجهزة المشتركة.',
];

const ROLE_TO_TAB = { gm: 'gm', supervisor: 'supervisor', agent: 'agent', finance: 'finance', sponsor: 'sponsor' };

function RoleGuide({ role }) {
  const Icon = role.icon;
  return (
    <div className="space-y-5">
      <div className="card flex items-start gap-4">
        <div className="shrink-0 w-12 h-12 rounded-2xl bg-primary/10 dark:bg-sky-500/10 flex items-center justify-center">
          <Icon size={26} className="text-primary dark:text-sky-400" />
        </div>
        <div>
          <h2 className="text-lg font-black text-gray-800 dark:text-slate-100">{role.label}</h2>
          <p className="text-sm text-gray-600 dark:text-slate-300 mt-1 leading-7">{role.intro}</p>
        </div>
      </div>

      {role.sections.map((sec) => (
        <div key={sec.title} className="card">
          <h3 className="text-base font-extrabold text-primary dark:text-sky-400 mb-3">{sec.title}</h3>
          <ol className="space-y-2.5">
            {sec.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700 dark:text-slate-200 leading-7">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}

      {role.tips?.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="flex items-center gap-2 font-extrabold text-amber-800 mb-2">
            <Lightbulb size={18} /> نصائح
          </h3>
          <ul className="space-y-1.5 text-sm text-amber-900 leading-7 list-disc pr-5">
            {role.tips.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function Overview() {
  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="text-lg font-black text-gray-800 dark:text-slate-100 mb-2">ما هو النظام؟</h2>
        <p className="text-sm text-gray-600 dark:text-slate-300 leading-7">
          نظام إدارة الأيتام والأسر لمؤسسة نماء التنموية الخيرية: يسجّل الأيتام والأسر، ويربطهم بالكفلاء، ويتابع حفظ القرآن
          والتقييمات، ويدير الصرف الشهري من المراجعة حتى تسليم المبالغ وتوثيقها. لكل دور واجهة وصلاحيات خاصة، وتنتقل
          الحالات بين الأدوار وفق المراحل التالية:
        </p>
      </div>

      <div className="card">
        <h3 className="text-base font-extrabold text-primary dark:text-sky-400 mb-4">رحلة الحالة داخل النظام</h3>
        <ol className="relative space-y-4 border-r-2 border-primary/20 pr-5">
          {LIFECYCLE.map((s, i) => (
            <li key={i} className="relative">
              <span className="absolute -right-[1.65rem] top-1 w-5 h-5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <p className="text-sm font-bold text-gray-800 dark:text-slate-100">{s.who}</p>
              <p className="text-sm text-gray-600 dark:text-slate-300 leading-7">{s.what}</p>
              <span className="inline-block mt-1 text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary dark:text-sky-400 font-semibold">
                الحالة: {s.status}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="card">
        <h3 className="text-base font-extrabold text-primary dark:text-sky-400 mb-3">أساسيات لجميع المستخدمين</h3>
        <ul className="space-y-2">
          {GENERAL.map((g) => (
            <li key={g} className="flex gap-2 text-sm text-gray-700 dark:text-slate-200 leading-7">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-500 mt-1" />
              <span>{g}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function GuideBody({ initialTab }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);

  const tabs = [OVERVIEW, ...ROLES];
  const current = ROLES.find((r) => r.id === tab);

  return (
    <div className="max-w-3xl mx-auto space-y-5" dir="rtl">
      <div>
        <h1 className="text-2xl font-black text-gray-800 dark:text-slate-100 flex items-center gap-2">
          <BookOpen className="text-primary dark:text-sky-400" /> كيف تستخدم النظام
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          دليل مبسّط لكل دور: ماذا تفعل خطوة بخطوة، ومن أين تبدأ.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition cursor-pointer ${
                active
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white dark:bg-[#111E2E] text-gray-600 dark:text-slate-300 border-gray-200 dark:border-[#1E344B]'
              }`}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {current ? <RoleGuide role={current} /> : <Overview />}
    </div>
  );
}

export default function HowToUsePage() {
  const user = useAuthStore((s) => s.user);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const initialTab = (user && ROLE_TO_TAB[user.role]) || 'overview';

  // Logged-in staff see the guide inside the normal app shell
  if (mounted && user) {
    return (
      <AppShell>
        <GuideBody initialTab={initialTab} />
      </AppShell>
    );
  }

  // Visitors / new staff before login: standalone page
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B131B] px-4 py-6">
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between gap-3" dir="rtl">
        <Link href="/landing" className="text-sm text-primary dark:text-sky-400 font-semibold inline-flex items-center gap-1">
          <ArrowLeft size={16} className="rotate-180" /> الموقع
        </Link>
        <div className="flex items-center gap-4 text-sm font-semibold">
          <Link href="/install" className="text-primary dark:text-sky-400 inline-flex items-center gap-1">
            <Smartphone size={16} /> تحميل التطبيق
          </Link>
          <Link href="/login" className="text-primary dark:text-sky-400 inline-flex items-center gap-1">
            <LogIn size={16} /> تسجيل الدخول
          </Link>
        </div>
      </div>
      <GuideBody initialTab="overview" />
      <ThemeToggleFab />
    </div>
  );
}
