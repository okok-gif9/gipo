import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { ArrowRight, Bot, RotateCcw, SendToBack, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

function authHeaders(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem("manus-cookie");
    const token = raw?.split(";").find(item => item.trim().startsWith("app_session_id="))?.trim().slice("app_session_id=".length);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  } catch { return {}; }
}

export default function StoryChatPage() {
  const [, params] = useRoute("/chat/:id");
  const storyRunId = Number(params?.id ?? 0);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const detail = trpc.storyRuns.get.useQuery({ storyRunId }, { enabled: storyRunId > 0 });
  const integrationStatus = trpc.integrations.status.useQuery();
  const followUpPreference = trpc.integrations.getFollowUp.useQuery({ storyRunId }, { enabled: storyRunId > 0 });
  const restart = trpc.storyRuns.restart.useMutation({ onSuccess: run => { if (run?.run) setLocation(`/chat/${run.run.id}`); } });
  const archive = trpc.storyRuns.archive.useMutation({ onSuccess: () => { utils.storyRuns.list.invalidate(); setLocation("/"); } });
  const setTelegramActive = trpc.integrations.setTelegramActiveStory.useMutation({ onSuccess: () => { utils.integrations.status.invalidate(); toast.success("این داستان برای تلگرام فعال شد."); } });
  const updateFollowUp = trpc.integrations.updateFollowUp.useMutation({ onSuccess: () => { followUpPreference.refetch(); toast.success("تنظیم پیگیری به‌روزرسانی شد."); } });
  const [streamed, setStreamed] = useState("");
  const [pendingUser, setPendingUser] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [followUpHours, setFollowUpHours] = useState(48);
  useEffect(() => { if (followUpPreference.data?.inactivityHours) setFollowUpHours(followUpPreference.data.inactivityHours); }, [followUpPreference.data?.inactivityHours]);
  const chatMessages = useMemo<Message[]>(() => {
    const messages = detail.data?.messages.map(message => ({ role: message.role, content: message.content })) ?? [];
    if (pendingUser) messages.push({ role: "user", content: pendingUser });
    return streamed ? [...messages, { role: "assistant" as const, content: streamed }] : messages;
  }, [detail.data?.messages, streamed]);

  const send = async (content: string) => {
    if (!storyRunId || isSending) return;
    setIsSending(true); setStreamed(""); setPendingUser(content);
    try {
      const response = await fetch(`/api/story-runs/${storyRunId}/stream`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ content }) });
      if (!response.ok || !response.body) { const payload = await response.json().catch(() => null); throw new Error(payload?.error?.message ?? "ارتباط با داستان برقرار نشد."); }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { value, done } = await reader.read(); buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const frames = buffer.split("\n\n"); buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const event = frame.split("\n").find(line => line.startsWith("event:"))?.slice(6).trim();
          const data = frame.split("\n").find(line => line.startsWith("data:"))?.slice(5).trim();
          if (!data) continue;
          const parsed = JSON.parse(data) as { delta?: string; message?: string };
          if (event === "delta" && parsed.delta) setStreamed(current => current + parsed.delta);
          if (event === "error") throw new Error(parsed.message ?? "پاسخ داستان متوقف شد.");
        }
        if (done) break;
      }
      setStreamed(""); setPendingUser(""); await Promise.all([utils.storyRuns.get.invalidate({ storyRunId }), utils.storyRuns.list.invalidate()]);
    } catch (error) { setStreamed(""); toast.error(error instanceof Error ? error.message : "خطایی رخ داد."); await utils.storyRuns.get.invalidate({ storyRunId }); }
    finally { setPendingUser(""); setIsSending(false); }
  };

  if (detail.isLoading) return <div className="story-grain min-h-screen p-10 text-muted-foreground">در حال ورود به جهان…</div>;
  if (!detail.data) return <div className="story-grain min-h-screen p-10"><Button variant="outline" onClick={() => setLocation("/")}>بازگشت به داستان‌ها</Button></div>;
  const { run, storyBot } = detail.data;
  const ended = run.status === "ended";
  return <div className="story-grain min-h-screen p-3 sm:p-6"><div className="mx-auto grid max-w-[1500px] gap-4 xl:grid-cols-[280px_minmax(0,1fr)_270px]">
    <aside className="story-panel hidden p-5 xl:block"><Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-mr-2 text-muted-foreground"><ArrowRight className="ml-1 size-4" />داستان‌ها</Button><div className="mt-8"><p className="text-[10px] tracking-[.22em] text-primary">نقش تو</p><h2 className="mt-2 text-xl font-semibold">{run.selectedRole}</h2><p className="mt-4 text-sm leading-7 text-muted-foreground">{run.stateSummary}</p></div><div className="mt-8 border-t border-white/10 pt-5"><p className="text-xs text-muted-foreground">شرط پایان</p><p className="mt-2 text-sm leading-6">{storyBot.endingConditions}</p></div></aside>
    <section className="story-panel flex min-h-[calc(100vh-3rem)] flex-col overflow-hidden"><header className="flex items-start justify-between gap-4 border-b border-white/10 p-5"><div className="flex min-w-0 items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/12 text-xl text-primary">{storyBot.avatarSymbol}</span><div className="min-w-0"><p className="text-[10px] tracking-[.22em] text-primary">{storyBot.visibility === "public" ? "جهان عمومی" : "جهان خصوصی"}</p><h1 className="mt-1 truncate text-lg font-semibold">{run.title}</h1><p className="mt-1 truncate text-xs text-muted-foreground">{storyBot.name}</p></div></div><Badge variant="outline" className={ended ? "border-primary/40 text-primary" : "border-sky-400/30 text-sky-300"}>{ended ? "پایان‌یافته" : "در حال روایت"}</Badge></header>
      {ended && <div className="m-4 rounded-xl border border-primary/30 bg-primary/10 p-4"><p className="font-semibold">{run.endingTitle || "پایان این مسیر"}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{run.endingText || "این داستان به پایان رسیده است؛ می‌توانی یک مسیر تازه آغاز کنی."}</p><Button onClick={() => restart.mutate({ storyRunId })} disabled={restart.isPending} className="mt-4 rounded-xl"><RotateCcw className="ml-2 size-4" />شروع یک مسیر تازه</Button></div>}
      <div className="min-h-0 flex-1"><AIChatBox messages={chatMessages} onSendMessage={send} isLoading={isSending} height="100%" className="h-full rounded-none border-0 bg-transparent shadow-none" placeholder={ended ? "این مسیر به پایان رسیده است" : "انتخاب بعدی‌ات چیست؟"} emptyStateMessage="اولین جمله، آغاز این جهان است." suggestedPrompts={ended ? undefined : ["از کجا باید شروع کنم؟", "اطرافم را بررسی می‌کنم."]} /></div>
    </section>
    <aside className="story-panel hidden p-5 xl:block"><div className="flex items-center gap-2 text-primary"><Bot className="size-4" /><span className="text-sm font-medium">پروندهٔ شخصیت</span></div><h2 className="mt-4 text-xl font-semibold">{storyBot.name}</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{storyBot.description}</p><div className="mt-6 flex flex-wrap gap-2">{storyBot.roleOptions.map(role => <span key={role} className="rounded-lg bg-secondary px-2.5 py-1 text-xs">{role}</span>)}</div><div className="mt-8 border-t border-white/10 pt-5"><p className="text-xs text-muted-foreground">ادامه در تلگرام</p><p className="mt-2 text-xs leading-6 text-muted-foreground">{integrationStatus.data?.isTelegramLinked ? "این اجرا را فعال کنید تا پیام‌های تلگرام وارد همین مسیر شوند." : "ابتدا ربات و حساب تلگرام را از تنظیمات متصل کنید."}</p>{integrationStatus.data?.isTelegramLinked ? <Button variant="outline" disabled={setTelegramActive.isPending} className="mt-3 w-full rounded-xl border-white/10" onClick={() => setTelegramActive.mutate({ storyRunId })}><SendToBack className="ml-2 size-3.5" />فعال‌کردن این داستان</Button> : <Button variant="outline" className="mt-3 w-full rounded-xl border-white/10" onClick={() => setLocation("/settings")}><SendToBack className="ml-2 size-3.5" />اتصال تلگرام</Button>}</div><div className="mt-6 border-t border-white/10 pt-5"><p className="text-xs text-muted-foreground">پیگیری داستانی</p><p className="mt-2 text-xs leading-6 text-muted-foreground">با رضایت شما، پس از بی‌فعالیتی یک پیام کوتاه در تلگرام می‌رسد.</p><Input type="number" min={24} max={720} value={followUpHours} onChange={event => setFollowUpHours(Math.max(24, Math.min(720, Number(event.target.value) || 24)))} className="mt-3 h-9 text-xs" aria-label="فاصلهٔ پیگیری به ساعت" /><p className="mt-1 text-[10px] text-muted-foreground">فاصله برحسب ساعت؛ از ۲۴ تا ۷۲۰ ساعت.</p><div className="mt-2 flex flex-wrap gap-2"><Button variant="ghost" disabled={!integrationStatus.data?.isTelegramLinked || updateFollowUp.isPending} className="h-auto px-0 text-xs text-primary hover:bg-transparent hover:text-primary" onClick={() => updateFollowUp.mutate({ storyRunId, isOptedIn: !followUpPreference.data?.isOptedIn, inactivityHours: followUpHours })}>{followUpPreference.data?.isOptedIn ? "خاموش‌کردن پیگیری" : "فعال‌کردن پیگیری"}</Button>{followUpPreference.data?.isOptedIn && <Button variant="ghost" disabled={updateFollowUp.isPending} className="h-auto px-0 text-xs text-primary hover:bg-transparent hover:text-primary" onClick={() => updateFollowUp.mutate({ storyRunId, isOptedIn: true, inactivityHours: followUpHours })}>ذخیرهٔ فاصله</Button>}</div></div><Button variant="ghost" className="mt-5 w-full text-muted-foreground hover:text-destructive" onClick={() => archive.mutate({ storyRunId })}>آرشیو این مسیر</Button></aside>
  </div></div>;
}
