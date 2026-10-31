'use client';

/**
 * ProfileDetails — shows the case-study fields saved with an orphan
 * (contact, education, family, housing, health, income, behaviour, recommendations).
 */

const GROUPS = [
  ['بيانات شخصية واتصال', {
    birthPlace: 'مكان الميلاد', residence: 'مكان الإقامة', motherGovernorate: 'محافظة الأم',
    phone1: 'رقم الهاتف', phone1Relation: 'صلة صاحب الهاتف', phone2: 'رقم هاتف آخر', phone2Relation: 'صلة صاحب الهاتف الآخر',
    address: 'العنوان',
  }],
  ['الحالة التعليمية', {
    schoolGrade: 'الصف الدراسي', sectorType: 'نوع القطاع', directorate: 'المديرية', schoolOrg: 'المدرسة / الجهة',
    favoriteSubject: 'المادة المفضلة', difficultySubject: 'المادة الصعبة', generalLevel: 'المستوى العام',
    repeatedYear: 'أعاد سنة دراسية', repeatedYearReason: 'سبب الإعادة', gradeDetail: 'تفاصيل الدرجات',
    generalGrade: 'التقدير العام', lastResultAvg: 'معدل آخر نتيجة', highestGrade: 'أعلى درجة', lowestGrade: 'أدنى درجة',
    eduResponsible: 'المسؤول عن التعليم', eduResponsiblePhone: 'هاتف المسؤول عن التعليم', eduLevel: 'المرحلة التعليمية',
  }],
  ['الوصي والأسرة', {
    guardianAge: 'عمر الوصي', guardianEduLevel: 'تعليم الوصي', guardianJob: 'عمل الوصي', guardianHealth: 'صحة الوصي',
    familyMaleCount: 'عدد الذكور في الأسرة', familyFemaleCount: 'عدد الإناث في الأسرة', familyProblems: 'مشكلات الأسرة',
  }],
  ['السكن', {
    ownershipType: 'نوع الملكية', buildingType: 'نوع المبنى', floorsCount: 'عدد الطوابق', roomsCount: 'عدد الغرف',
    water: 'المياه', electricity: 'الكهرباء', rentAmount: 'قيمة الإيجار', housingDetails: 'تفاصيل السكن',
  }],
  ['الحالة الصحية والدخل', {
    hasChronicDisease: 'مرض مزمن', chronicDiseaseDetails: 'تفاصيل المرض', hasRegularTreatment: 'علاج منتظم',
    hasHealthInsurance: 'تأمين صحي', incomeSource: 'مصدر الدخل', monthlyIncome: 'الدخل الشهري',
    hasCharitySupport: 'يتلقى دعماً خيرياً', charitySupportDetails: 'تفاصيل الدعم',
  }],
  ['المواهب', { talents: 'المواهب', talentsOther: 'مواهب أخرى' }],
  ['الحالة الاجتماعية والسلوكية', {
    familyRelations: 'العلاقات الأسرية', communityRelation: 'العلاقة بالمجتمع', schoolRelation: 'العلاقة بالمدرسة',
    socialBehavior: 'السلوك الاجتماعي', needsSocialSupport: 'يحتاج دعماً اجتماعياً', quranLevel: 'مستوى القرآن',
    prayerCommitment: 'الالتزام بالصلاة', moralBehavior: 'السلوك الأخلاقي',
  }],
  ['الحالة النفسية', {
    generalAppearance: 'المظهر العام', selfExpression: 'التعبير عن النفس', psychFamilyRelations: 'العلاقات الأسرية (نفسياً)',
    peerRelations: 'العلاقة بالأقران', sleepAppetite: 'النوم والشهية', psychSigns: 'مؤشرات نفسية', needsPsychSupport: 'يحتاج دعماً نفسياً',
  }],
  ['التوصيات', { recommendations: 'توصيات الباحث' }],
];

const show = (v) => {
  if (v === true || v === 'true') return 'نعم';
  if (v === false || v === 'false') return 'لا';
  if (Array.isArray(v)) return v.join('، ');
  if (v && typeof v === 'object') return Object.values(v).join('، ');
  return String(v);
};

export default function ProfileDetails({ profile }) {
  let p = profile;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch { p = null; } }
  if (!p || typeof p !== 'object') return null;

  const groups = GROUPS
    .map(([title, fields]) => [title, Object.entries(fields).filter(([k]) => p[k] !== undefined && p[k] !== null && p[k] !== '')])
    .filter(([, rows]) => rows.length > 0);
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      {groups.map(([title, rows]) => (
        <div key={title}>
          <h4 className="m-0 mb-2 text-[0.8rem] font-extrabold text-[#1B5E8C]">{title}</h4>
          <dl className="m-0 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {rows.map(([k, label]) => (
              <div key={k} className="flex flex-col">
                <dt className="text-[0.72rem] text-gray-400">{label}</dt>
                <dd className="m-0 text-[0.84rem] text-gray-800 whitespace-pre-wrap break-words">{show(p[k])}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
