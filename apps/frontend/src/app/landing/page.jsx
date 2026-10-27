'use client';

/**
 * Public Landing Page — الموقع التعريفي العام لمؤسسة نماء التنموية الخيرية
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import useAuthStore from '@/store/useAuthStore';
import {
  Heart,
  Users,
  Award,
  BookOpen,
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowUpLeft,
  ChevronDown,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  CheckCircle,
  Menu,
  X,
  LogIn,
  LayoutDashboard,
} from 'lucide-react';
import api from '@/lib/api';
import ThemeToggleFab from '@/components/ThemeToggleFab';

export default function PublicLandingPage() {
  const { user } = useAuthStore();
  const [content, setContent] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    api
      .get('/landing')
      .then((res) => {
        setContent(res.data.data);
      })
      .catch((err) => {
        console.warn('Using local fallback content:', err);
      });
  }, []);

  // Safe getters with defaults
  const sections = content?.sections || {
    hero: true,
    about: true,
    stats: true,
    programs: true,
    news: true,
    gallery: true,
    achievements: true,
    partners: true,
    contact: true,
  };

  const hero = content?.hero || {
    foundationName: 'مؤسسة نماء التنموية الخيرية',
    slogan: 'ريادة في التمكين وبناء الإنسان ورعاية الأسر المتعففة والأيتام',
    shortBio: 'نعمل برؤية تنموية رائدة وشراكات مجتمعية فاعلة لبناء مجتمع متكافل ومستدام يحفظ كرامة الإنسان ويحقق الأثر الإيجابي المنشود.',
    ctaText: 'تعرف علينا',
    ctaLink: '#about',
    loginText: 'دخول النظام',
    showCta: true,
  };

  const about = content?.about || {
    aboutText: 'مؤسسة نماء التنموية الخيرية مؤسسة غير ربحية تُعنى بتمكين الأفراد والأسر، ورعاية الفئات الأكثر احتياجاً من خلال برامج تنموية واجتماعية وتعليمية مستدامة، تسعى إلى إحداث أثر إيجابي في المجتمع عبر العمل المؤسسي، والشراكات الفاعلة، والحوكمة، والاستثمار الأمثل للموارد بما يحقق التنمية المستدامة ويحفظ كرامة المستفيد.',
    vision: 'أن نكون مؤسسة رائدة في العمل التنموي والخيري، تُسهم في بناء مجتمع متكافل ومستدام، وتحقق أثراً تنموياً ملموساً على المستفيدين.',
    mission: 'تقديم برامج ومبادرات تنموية وخيرية ذات جودة عالية، ترتكز على الاحتياج الحقيقي، وتُنفذ وفق أفضل الممارسات المؤسسية، بالشراكة مع الداعمين والجهات ذات العلاقة، بما يعزز الاستدامة ويحقق أثراً مستداماً للمستفيدين.',
    values: `• الإخلاص: العمل ابتغاء مرضاة الله\n• الأمانة: حفظ الحقوق والموارد\n• الشفافية: الوضوح والمصداقية في جميع الأعمال\n• التميز: تقديم أعلى معايير الجودة في كافة البرامج\n• التعاون والشراكة: تكامل الجهود مع المجتمع والشركاء`,
  };

  const stats = (content?.stats || [
    { id: '1', title: 'الأسر المستفيدة', value: '504,142', description: 'عدد الأسر التي استفادت من برامج المؤسسة.', active: true },
    { id: '2', title: 'الأيتام المكفولون', value: '400', description: 'إجمالي الأيتام الذين ترعاهم المؤسسة.', active: true },
    { id: '3', title: 'البرامج والمشاريع', value: '45,742', description: 'إجمالي البرامج والمشاريع المنفذة.', active: true },
    { id: '4', title: 'المتطوعون', value: '254', description: 'عدد المتطوعين المشاركين في أنشطة المؤسسة.', active: true },
    { id: '5', title: 'البرامج التعليمية والتربوية', value: '451', description: 'عدد البرامج التعليمية والتربوية المنفذة.', active: true },
  ]).filter((s) => s.active !== false);

  const programs = (content?.programs || [
    {
      id: '1',
      title: 'برنامج كفالة ورعاية الأيتام',
      category: 'رعاية اجتماعية',
      description: 'كفالات شهرية، رعاية صحية، ومتابعة تعليمية وتوثيق استلام كل مستفيد يضمن كرامة اليتيم ووصول الحقوق لمستحقيها.',
      beneficiaries: '400+ يتيم',
      active: true,
    },
    {
      id: '2',
      title: 'مبادرة تمكين الأسر المنتجة',
      category: 'تمكين وتنمية',
      description: 'تقديم قروض حسنة وتدريب مهني للأمهات وأرباب الأسر في الخياطة والحرف لتحويلهم لأسر مكتفية ذاتياً.',
      beneficiaries: '150+ أسرة',
      active: true,
    },
    {
      id: '3',
      title: 'حلقات القرآن ومراكز الموهوبين',
      category: 'تعليم وقرآن',
      description: 'رعاية الأيتام الموهوبين دراسياً وحفظة القرآن الكريم وتوفير مستلزمات التعليم والمنح النموذجية لهم.',
      beneficiaries: '320+ طالب',
      active: true,
    },
    {
      id: '4',
      title: 'الإغاثة والمساعدات الموسمية',
      category: 'إغاثة موسمية',
      description: 'توزيع السلال الغذائية، كسوة الشتاء، ومساعدات شهر رمضان وعيد الأضحى المبارك للأسر المتعففة.',
      beneficiaries: '25,000+ مستفيد',
      active: true,
    },
  ]).filter((p) => p.active !== false);

  const news = (content?.news || [
    {
      id: '1',
      title: 'تدشين المرحلة الجديدة لكفالة ورعاية 400 يتيم للعام الجاري',
      date: '15 أكتوبر 2026',
      summary: 'أطلقت المؤسسة خطتها التشغيلية الشاملة لرعاية الأيتام وتحديث سجلات الصرف البيومتري في المحافظات المستهدفة.',
      active: true,
    },
    {
      id: '2',
      title: 'توزيع الحقيبة المدرسية والزي الموحد للموهوبين والمتميزين',
      date: '28 سبتمبر 2026',
      summary: 'توزيع مستلزمات العام الدراسي الجديد لأبناء الأسر المستفيدة في أمانة العاصمة وتعز وعدن.',
      active: true,
    },
    {
      id: '3',
      title: 'اختتام ورشة عمل تطوير الأداء الميداني للمندوبين والمشرفين',
      date: '10 سبتمبر 2026',
      summary: 'اختتام دورة التدريب على استخدام النظام الإلكتروني وإجراءات تدقيق ومصادقة مستحقات الصرف.',
      active: true,
    },
  ]).filter((n) => n.active !== false);

  const achievements = content?.achievements || [
    { id: '1', title: 'أكثر من نصف مليون مستفيد', year: '2026', description: 'وصول أثر البرامج التنموية والإنسانية لأكثر من 504 ألف فرد وأسرة.' },
    { id: '2', title: 'شفافية وموثوقية رقمية 100%', year: '2025', description: 'تطبيق نظام السندات البيومترية المؤتمتة لكافة تسليمات الصرف الميداني.' },
    { id: '3', title: 'رعاية شاملة ومستدامة للموهوبين', year: '2024', description: 'بناء باقات تأهيل متكاملة تغطي المدارس النموذجية والمواصلات والبدلات.' },
  ];

  const partners = content?.partners || [
    { id: '1', name: 'مؤسسة الأمل الخيرية للتنمية', category: 'شريك استراتيجي' },
    { id: '2', name: 'صندوق دعم وتأهيل الأيتام', category: 'شريك حكومي' },
    { id: '3', name: 'مبادرة عطاء بلا حدود الدولية', category: 'شريك دولي' },
    { id: '4', name: 'مجموعة النور التجارية الداعمة', category: 'قطاع خاص' },
  ];

  const contact = content?.contact || {
    phone: '+967 1 450123',
    mobile: '+967 770 000 001',
    whatsapp: '+967 770 000 001',
    email: 'info@namaa-charity.org',
    address: 'الجمهورية اليمنية - صنعاء - شارع الستين الغربي',
    workingHours: 'السبت - الخميس: 8:00 صباحاً - 3:00 مساءً',
    social: {
      facebook: 'https://facebook.com',
      twitter: 'https://x.com',
      instagram: 'https://instagram.com',
      youtube: 'https://youtube.com',
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-blue-100 selection:text-[#134569]" dir="rtl">
      {/* ── 1. Top Navbar ── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link href="/landing" className="flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow-md shadow-[#1B5E8C]/20 border border-slate-200/80 group-hover:scale-105 transition flex items-center justify-center">
              <img src="/logo.png" alt="نماء" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black text-slate-900 group-hover:text-[#1B5E8C] transition">
                {hero.foundationName || 'مؤسسة نماء التنموية الخيرية'}
              </span>
              <span className="text-[11px] text-[#1B5E8C] font-semibold tracking-wide">
                ريادة في التمكين وبناء الإنسان
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-bold text-slate-600">
            {sections.hero && <a href="#hero" className="hover:text-[#1B5E8C] transition">الرئيسية</a>}
            {sections.about && <a href="#about" className="hover:text-[#1B5E8C] transition">من نحن</a>}
            {sections.stats && <a href="#stats" className="hover:text-[#1B5E8C] transition">أرقامنا</a>}
            {sections.programs && <a href="#programs" className="hover:text-[#1B5E8C] transition">برامجنا</a>}
            {sections.news && <a href="#news" className="hover:text-[#1B5E8C] transition">الأخبار</a>}
            {sections.achievements && <a href="#achievements" className="hover:text-[#1B5E8C] transition">الإنجازات</a>}
            {sections.partners && <a href="#partners" className="hover:text-[#1B5E8C] transition">شركاؤنا</a>}
            {sections.contact && <a href="#contact" className="hover:text-[#1B5E8C] transition">تواصل معنا</a>}
          </nav>

          {/* Action Button */}
          <div className="hidden sm:flex items-center gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-[#1B5E8C] to-[#134569] hover:from-[#2E7EB8] hover:to-[#1B5E8C] text-white text-xs font-bold shadow-md shadow-[#1B5E8C]/20 hover:-translate-y-0.5 active:scale-95 transition"
              >
                <LayoutDashboard size={15} />
                <span>لوحة التحكم ({user.name?.split(' ')[0]})</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#1B5E8C] to-[#134569] hover:from-[#2E7EB8] hover:to-[#1B5E8C] text-white text-xs font-bold shadow-md shadow-[#1B5E8C]/20 hover:-translate-y-0.5 active:scale-95 transition"
              >
                <LogIn size={15} />
                <span>{hero.loginText || 'دخول النظام'}</span>
              </Link>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-slate-100 px-4 py-5 space-y-3 shadow-xl">
            <a href="#about" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-bold text-slate-700">من نحن</a>
            <a href="#stats" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-bold text-slate-700">أرقامنا</a>
            <a href="#programs" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-bold text-slate-700">برامجنا ومشاريعنا</a>
            <a href="#news" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-bold text-slate-700">الأخبار</a>
            <a href="#achievements" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-bold text-slate-700">الإنجازات</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-bold text-slate-700">تواصل معنا</a>
            <div className="pt-3 border-t border-slate-100">
              <Link
                href={user ? '/dashboard' : '/login'}
                className="block text-center py-2.5 rounded-xl bg-gradient-to-r from-[#1B5E8C] to-[#134569] text-white text-xs font-bold"
              >
                {user ? 'لوحة التحكم' : 'دخول النظام'}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── 2. Hero Section ── */}
      {sections.hero && (
        <section id="hero" className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32 bg-gradient-to-b from-white via-blue-50/25 to-slate-50">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 rounded-full bg-blue-100/50 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-96 h-96 rounded-full bg-sky-100/40 blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="text-center max-w-3xl mx-auto space-y-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50/80 border border-blue-200/60 text-[#1B5E8C] text-xs font-bold shadow-xs">
                <Sparkles size={14} className="text-[#1B5E8C]" />
                <span>مؤسسة تنموية خيرية رائدة</span>
              </div>

              {/* Main Heading */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight">
                {hero.foundationName}
              </h1>

              {/* Slogan */}
              <p className="text-base sm:text-xl font-bold text-[#1B5E8C] leading-relaxed">
                {hero.slogan}
              </p>

              {/* Bio */}
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
                {hero.shortBio}
              </p>

              {/* CTA Buttons */}
              <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                {hero.showCta && (
                  <a
                    href={hero.ctaLink || '#about'}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-br from-[#1B5E8C] to-[#134569] hover:from-[#2E7EB8] hover:to-[#1B5E8C] text-white text-sm font-bold shadow-lg shadow-[#1B5E8C]/25 hover:-translate-y-0.5 transition active:scale-95"
                  >
                    <span>{hero.ctaText || 'تعرف علينا'}</span>
                    <ArrowUpLeft size={16} />
                  </a>
                )}

                <Link
                  href={user ? '/dashboard' : '/login'}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-sm font-bold shadow-sm hover:-translate-y-0.5 transition active:scale-95"
                >
                  <LogIn size={16} className="text-[#1B5E8C]" />
                  <span>{user ? 'لوحة التحكم' : hero.loginText || 'دخول النظام'}</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 3. Stats Section (أرقامنا) ── */}
      {sections.stats && stats.length > 0 && (
        <section id="stats" className="py-16 bg-white border-y border-slate-200/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="text-xs font-black uppercase tracking-widest text-[#1B5E8C]">أثرنا في الميدان</span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">أرقام وإحصائيات نعتز بها</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
              {stats.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-5 rounded-3xl bg-slate-50 border border-slate-200/80 text-center hover:shadow-md hover:border-blue-200 transition-all group"
                >
                  <div className="text-2xl sm:text-3xl font-black text-[#1B5E8C] group-hover:scale-105 transition-transform duration-200">
                    {item.value}
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 mt-2 mb-1">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 line-clamp-2">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. About Section (من نحن) ── */}
      {sections.about && (
        <section id="about" className="py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="max-w-3xl mx-auto text-center space-y-3">
              <span className="text-xs font-black uppercase tracking-widest text-[#1B5E8C]">هويتنا ومبادئنا</span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900">نبذة عن المؤسسة</h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed pt-2">
                {about.aboutText}
              </p>
            </div>

            {/* Vision, Mission, Values Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Vision */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:border-blue-200 transition space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1B5E8C] flex items-center justify-center font-bold">
                  <Sparkles size={22} />
                </div>
                <h3 className="text-base font-black text-slate-900">الرؤية</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {about.vision}
                </p>
              </div>

              {/* Mission */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:border-blue-200 transition space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1B5E8C] flex items-center justify-center font-bold">
                  <Heart size={22} />
                </div>
                <h3 className="text-base font-black text-slate-900">الرسالة</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {about.mission}
                </p>
              </div>

              {/* Values */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:border-blue-200 transition space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1B5E8C] flex items-center justify-center font-bold">
                  <ShieldCheck size={22} />
                </div>
                <h3 className="text-base font-black text-slate-900">القيم المؤسسية</h3>
                <div className="text-xs sm:text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                  {about.values}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 5. Programs Section (البرامج والمشاريع) ── */}
      {sections.programs && programs.length > 0 && (
        <section id="programs" className="py-20 bg-white border-t border-slate-200/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-2xl mx-auto">
              <span className="text-xs font-black uppercase tracking-widest text-[#1B5E8C]">خدماتنا المجتمعية</span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-1">البرامج والمشاريع</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-2">
                مبادرات مستدامة مصممة لسد الاحتياجات الأساسية وتحقيق التمكين الحقيقي للأسر
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {programs.map((prog, idx) => (
                <div
                  key={prog.id || idx}
                  className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:border-blue-200 hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <span className="inline-block px-3 py-1 rounded-full bg-blue-100/70 text-[#1B5E8C] text-[10px] font-bold">
                      {prog.category}
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      {prog.title}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {prog.description}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-slate-200/60 mt-4 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">المستهدفون:</span>
                    <span className="font-bold text-[#1B5E8C]">{prog.beneficiaries}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 6. News Section (الأخبار والفعاليات) ── */}
      {sections.news && news.length > 0 && (
        <section id="news" className="py-20 bg-slate-50 border-t border-slate-200/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-2xl mx-auto">
              <span className="text-xs font-black uppercase tracking-widest text-[#1B5E8C]">التحديثات والأنشطة</span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-1">أحدث الأخبار والفعاليات</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {news.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:border-blue-200 transition space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[#1B5E8C]">{item.date}</span>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 7. Achievements Section (الإنجازات) ── */}
      {sections.achievements && achievements.length > 0 && (
        <section id="achievements" className="py-16 bg-white border-t border-slate-200/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="text-center">
              <span className="text-xs font-black uppercase tracking-widest text-[#1B5E8C]">محطات النجاح</span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">إنجازاتنا البارزة</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {achievements.map((ach, idx) => (
                <div
                  key={ach.id || idx}
                  className="p-6 rounded-3xl bg-blue-50/40 border border-blue-100 flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#1B5E8C] text-white font-black text-sm flex items-center justify-center flex-shrink-0">
                    {ach.year}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-1">{ach.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{ach.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 8. Partners Section (شركاء النجاح) ── */}
      {sections.partners && partners.length > 0 && (
        <section id="partners" className="py-16 bg-slate-50 border-t border-slate-200/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-[#1B5E8C]">التكامل والتعاون</span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">شركاء النجاح</h2>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              {partners.map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="px-6 py-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col items-center"
                >
                  <span className="text-xs font-bold text-slate-800">{p.name}</span>
                  <span className="text-[10px] text-[#1B5E8C] font-semibold mt-0.5">{p.category}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 9. Contact Section (تواصل معنا) ── */}
      {sections.contact && (
        <section id="contact" className="py-20 bg-slate-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-sky-400">يسعدنا تواصلكم</span>
              <h2 className="text-2xl sm:text-4xl font-black text-white">تواصل معنا</h2>
              <p className="text-xs sm:text-sm text-slate-400">
                فريق مؤسسة نماء على أتم الاستعداد للإجابة على استفساراتكم واستقبال الداعمين والكفلاء
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/60 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-sky-400 flex items-center justify-center font-bold">
                  <Phone size={18} />
                </div>
                <h3 className="text-xs font-bold text-slate-400">الهاتف والجوال</h3>
                <p className="text-sm font-semibold ltr text-right">{contact.phone}</p>
                <p className="text-xs text-slate-400 ltr text-right">{contact.mobile}</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/60 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-sky-400 flex items-center justify-center font-bold">
                  <Mail size={18} />
                </div>
                <h3 className="text-xs font-bold text-slate-400">البريد الإلكتروني</h3>
                <p className="text-xs sm:text-sm font-semibold ltr text-right">{contact.email}</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/60 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-sky-400 flex items-center justify-center font-bold">
                  <MapPin size={18} />
                </div>
                <h3 className="text-xs font-bold text-slate-400">العنوان والمقر</h3>
                <p className="text-xs font-medium leading-relaxed">{contact.address}</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/60 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-sky-400 flex items-center justify-center font-bold">
                  <Clock size={18} />
                </div>
                <h3 className="text-xs font-bold text-slate-400">ساعات الدوام</h3>
                <p className="text-xs font-medium leading-relaxed">{contact.workingHours}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 10. Footer ── */}
      <footer className="bg-slate-950 text-slate-400 py-8 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">مؤسسة نماء التنموية الخيرية</span>
            <span>© {new Date().getFullYear()} — جميع الحقوق محفوظة</span>
          </div>

          <div className="flex items-center gap-5">
            <Link href="/login" className="hover:text-sky-400 transition font-medium">دخول النظام</Link>
            <Link href="/install" className="hover:text-sky-400 transition font-medium">تحميل التطبيق</Link>
            <Link href="/sponsor/login" className="hover:text-sky-400 transition font-medium">بوابة الكافل</Link>
            <Link href="/how-to-use" className="hover:text-sky-400 transition font-medium">كيف تستخدم النظام</Link>
          </div>
        </div>
      </footer>
      <ThemeToggleFab />
    </div>
  );
}
