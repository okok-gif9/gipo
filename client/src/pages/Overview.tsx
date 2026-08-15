import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { BookOpen, Compass, MessageCircleMore, Plus, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

export default function Overview() {
  const [, setLocation] = useLocation();
  const { data: runs, isLoading } = trpc.storyRuns.list.useQuery();
  const activeRuns = runs?.filter(item => item.run.status === "active") ?? [];

  return <div className="story-grain min-h-screen p-5 sm:p-10">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-medium tracking-[.28em] text-primary">STORYVERSE / آرشیو شخصی</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">داستان‌های تو</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">هر جهان یک مسیر مستقل دارد؛ انتخاب‌هایت باقی می‌مانند و گفتگو از تلگرام تا اینجا ادامه پیدا می‌کند.</p></div>
        <Button onClick={() => setLocation("/characters/new")} className="rounded-xl"><Plus className="ml-2 size-4" />ساخت شخصیت تازه</Button>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="story-panel p-5"><p className="text-xs text-muted-foreground">داستان‌های فعال</p><p className="mt-2 text-3xl font-semibold">{isLoading ? "—" : activeRuns.length}</p><p className="mt-1 text-xs text-primary">هر انتخاب مسیر را تغییر می‌دهد</p></div>
        <div className="story-panel p-5"><p className="text-xs text-muted-foreground">حافظهٔ مشترک</p><p className="mt-2 flex items-center gap-2 text-lg font-semibold"><Sparkles className="size-4 text-primary" />وب و تلگرام</p><p className="mt-2 text-xs text-muted-foreground">تاریخچه در هر دو کانال یکسان است.</p></div>
        <div className="story-panel p-5"><p className="text-xs text-muted-foreground">شروع سریع</p><Button variant="outline" onClick={() => setLocation("/discover")} className="mt-3 rounded-xl border-white/10"><Compass className="ml-2 size-4" />کشف جهان‌های عمومی</Button></div>
      </section>

      <section className="mt-10"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">ادامهٔ روایت</h2><Button variant="ghost" size="sm" onClick={() => setLocation("/characters")}>مدیریت شخصیت‌ها</Button></div>
        {isLoading ? <div className="story-panel p-8 text-muted-foreground">داستان‌ها در حال بارگیری هستند…</div> : activeRuns.length === 0 ? <div className="story-panel flex flex-col items-center px-6 py-16 text-center"><div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><BookOpen className="size-6" /></div><h3 className="mt-5 text-xl font-semibold">اولین در را باز کن</h3><p className="mt-2 max-w-md leading-7 text-muted-foreground">یک شخصیت بساز یا یکی از جهان‌های عمومی را انتخاب کن؛ سپس نقش خودت را برگزین و داستان را شروع کن.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Button onClick={() => setLocation("/characters/new")} className="rounded-xl">ساخت جهان</Button><Button variant="outline" onClick={() => setLocation("/discover")} className="rounded-xl border-white/10">کشف جهان‌ها</Button></div></div> : <div className="grid gap-4 md:grid-cols-2">{activeRuns.map(({ run, storyBot }) => <button key={run.id} onClick={() => setLocation(`/chat/${run.id}`)} className="story-panel group p-5 text-right transition duration-200 hover:-translate-y-1 hover:border-primary/45"><div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center rounded-xl bg-primary/12 text-lg text-primary">{storyBot.avatarSymbol}</span><Badge variant="outline" className="border-primary/30 text-primary">فعال</Badge></div><h3 className="mt-5 text-lg font-semibold">{run.title}</h3><p className="mt-1 text-sm text-primary/90">{storyBot.name} · نقش تو: {run.selectedRole}</p><p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">{run.stateSummary}</p><div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><MessageCircleMore className="size-3.5" />{run.messageCount} پیام · ادامه دادن</div></button>)}</div>}</section>
    </div>
  </div>;
}
