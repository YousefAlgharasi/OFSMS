import Link from 'next/link';

export const metadata = { title: 'الصفحة غير موجودة' };

export default function NotFound() {
  return (
    <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-slate-50">
      <div className="text-6xl font-black text-[#1B5E8C]">404</div>
      <h1 className="m-0 text-xl font-extrabold text-slate-800">الصفحة غير موجودة</h1>
      <p className="m-0 text-sm text-slate-500">الرابط الذي فتحته غير صحيح أو تم نقله.</p>
      <Link href="/" className="px-5 py-2.5 rounded-xl bg-[#1B5E8C] text-white font-bold no-underline">العودة للرئيسية</Link>
    </div>
  );
}
