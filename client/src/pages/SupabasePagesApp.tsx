import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { productIdentity } from "@/lib/productIdentity";
import type { Session } from "@supabase/supabase-js";
import { BookOpen, LogOut, Plus, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

type StoryBot = { id: string; name: string; description: string; visibility: "public" | "private"; avatar_symbol: string; created_at: string };

const initialBot = { name: "", description: "", behavioralInstruction: "", storyPremise: "", role: "راوی" };

export default function SupabasePagesApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [bots, setBots] = useState<StoryBot[]>([]);
  const [form, setForm] = useState(initialBot);
  const [creating, setCreating] = useState(false);

  const loadBots = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("story_bots").select("id,name,description,visibility,avatar_symbol,created_at").order("created_at", { ascending: false });
    if (error) return toast.error("بارگذاری آرشیو ممکن نشد.");
    setBots((data ?? []) as StoryBot[]);
  };

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); if (data.session) void loadBots(); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); if (nextSession) void loadBots(); else setBots([]); });
    return () => listener.subscription.unsubscribe();
  }, []);

  const requestMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
    if (error) toast.error("ارسال پیوند ورود ناموفق بود.");
    else toast.success("پیوند ورود به ایمیل شما ارسال شد.");
  };

  const createBot = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !session) return;
    setCreating(true);
    const { error } = await supabase.from("story_bots").insert({
      owner_id: session.user.id,
      name: form.name,
      description: form.description,
      behavioral_instruction: form.behavioralInstruction,
      story_premise: form.storyPremise,
      role_options: [form.role],
      world_rules: "به انتخاب‌های کاربر احترام بگذار و انسجام جهان را حفظ کن.",
      ending_conditions: "وقتی انتخاب‌ها به یک نتیجهٔ معنادار رسیدند، داستان را با پایانی روشن ببند.",
    });
    setCreating(false);
    if (error) return toast.error("ثبت پروندهٔ جهان ممکن نشد.");
    setForm(initialBot); toast.success("پروندهٔ جهان به آرشیو افزوده شد."); void loadBots();
  };

  if (!hasSupabaseConfig) return <main className="archive-page grid min-h-screen place-items-center p-6" dir="rtl"><p className="archive-stamp">اتصال Supabase برای این ساخت پیکربندی نشده است.</p></main>;
  if (loading) return <main className="archive-page grid min-h-screen place-items-center p-6" dir="rtl"><p className="archive-kicker">آرشیو در حال گشایش است…</p></main>;

  if (!session) return <main className="archive-page grid min-h-screen place-items-center p-6" dir="rtl"><section className="archive-hero w-full max-w-xl p-8 text-center"><Sparkles className="mx-auto size-7 text-primary" /><p className="archive-kicker mt-5">{productIdentity.romanName} · GitHub Pages</p><h1 className="mt-3 text-4xl font-semibold">به آرشیو گیپو خوش آمدید</h1><p className="mx-auto mt-4 max-w-md leading-8 text-muted-foreground">برای ساخت جهان، نگهداری حافظه و ادامهٔ روایت وارد شوید.</p><form onSubmit={requestMagicLink} className="mx-auto mt-7 flex max-w-sm gap-2"><Input value={email} onChange={event => setEmail(event.target.value)} type="email" required placeholder="you@example.com" /><Button type="submit">ارسال پیوند ورود</Button></form></section></main>;

  return <main className="archive-page min-h-screen" dir="rtl"><header className="archive-header"><a className="archive-brand" href="./"><BookOpen className="size-5" /><span>{productIdentity.name}</span></a><div className="flex items-center gap-3"><span className="hidden text-sm text-muted-foreground sm:inline">{session.user.email}</span><Button variant="ghost" size="icon" onClick={() => supabase?.auth.signOut()} aria-label="خروج"><LogOut className="size-4" /></Button></div></header><div className="container grid gap-8 py-10 lg:grid-cols-[1fr_360px]"><section><p className="archive-kicker">آرشیو شخصی</p><h1 className="mt-2 text-4xl font-semibold">جهان‌های ثبت‌شده</h1><div className="mt-7 grid gap-4 sm:grid-cols-2">{bots.map(bot => <article key={bot.id} className="archive-card p-5"><span className="archive-stamp">{bot.avatar_symbol} {bot.visibility === "public" ? "عمومی" : "خصوصی"}</span><h2 className="mt-5 text-xl font-semibold">{bot.name}</h2><p className="mt-2 line-clamp-3 leading-7 text-muted-foreground">{bot.description}</p></article>)}{bots.length === 0 && <div className="archive-card col-span-full p-7 text-muted-foreground">نخستین جهان خود را از پروندهٔ کناری بسازید.</div>}</div></section><aside className="archive-card h-fit p-5"><p className="archive-kicker">پروندهٔ جدید</p><h2 className="mt-2 text-2xl font-semibold">ساخت جهان</h2><form onSubmit={createBot} className="mt-5 space-y-3"><Input required placeholder="نام شخصیت یا جهان" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /><Textarea required placeholder="توضیح کوتاه" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /><Textarea required placeholder="دستور رفتاری شخصیت" value={form.behavioralInstruction} onChange={event => setForm({ ...form, behavioralInstruction: event.target.value })} /><Textarea required placeholder="آغاز داستان" value={form.storyPremise} onChange={event => setForm({ ...form, storyPremise: event.target.value })} /><Input required placeholder="نقش کاربر" value={form.role} onChange={event => setForm({ ...form, role: event.target.value })} /><Button type="submit" className="w-full" disabled={creating}><Plus className="size-4" />ثبت در آرشیو</Button></form></aside></div></main>;
}
