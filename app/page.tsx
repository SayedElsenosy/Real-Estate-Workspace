const milestones = [
  ["01", "Setup & Foundation", "نشطة: الشركات والمستخدمون وعزل البيانات"],
  ["02", "Inventory Core", "مؤجلة حتى الموافقة"],
  ["03", "Atomic Booking", "مؤجلة حتى الموافقة"],
  ["04", "Contracts & Installments", "مؤجلة حتى الموافقة"],
] as const;
export default function Home() {
  return <main className="min-h-screen px-6 py-12 md:px-14">
    <header className="mx-auto max-w-5xl border-b border-slate-200 pb-8">
      <p className="text-sm font-semibold tracking-wide text-indigo-700">[Project Name] · Foundational Version</p>
      <h1 className="mt-4 text-3xl font-bold md:text-5xl">نواة منصة إدارة شركات التطوير العقاري</h1>
      <p className="mt-4 max-w-3xl leading-8 text-slate-600">إصدار التأسيس: Next.js وPostgreSQL وعزل بيانات الشركات. لم تُنشأ بعد شاشات المخزون أو الحجز أو العقود، ولا توجد بيانات إنتاجية أو نظام دخول فعلي.</p>
    </header>
    <section className="mx-auto mt-10 max-w-5xl">
      <h2 className="text-xl font-bold">مراحل المشروع</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {milestones.map(([n, title, description], index) =>
          <article key={n} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-sm text-indigo-700">{n} / {index===0 ? "Current" : "Locked"}</span>
            <h3 dir="ltr" className="mt-2 text-left text-lg font-semibold">{title}</h3>
            <p className="mt-3 text-sm text-slate-500">{description}</p>
          </article>)}
      </div>
    </section>
  </main>;
}
