import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Archive, Globe2, LockKeyhole, Pencil, Play, Plus, Sparkles, Trash2 } from "lucide-react";
import { useLocation } from "wouter";

function CharactersPageContent({ discover }: { discover: boolean }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const accessible = trpc.storyBots.listAccessible.useQuery(undefined, { enabled: !discover });
  const publicBots = trpc.storyBots.listPublic.useQuery(undefined, { enabled: discover });
  const archive = trpc.storyBots.archive.useMutation({ onSuccess: () => utils.storyBots.listAccessible.invalidate() });
  const deleteStoryBot = trpc.storyBots.delete.useMutation({ onSuccess: () => { utils.storyBots.listAccessible.invalidate(); utils.storyRuns.list.invalidate(); } });
  const bots = discover ? publicBots.data : accessible.data;
  const isLoading = discover ? publicBots.isLoading : accessible.isLoading;

  return <div className="story-grain min-h-screen p-5 sm:p-10"><div className="mx-auto max-w-6xl">
    <header className="flex flex-col gap-5 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium tracking-[.28em] text-primary">{discover ? "EXPLORE / کتابخانهٔ عمومی" : "CREATOR STUDIO / شخصیت‌ها"}</p><h1 className="mt-3 text-3xl font-semibold">{discover ? "جهان‌های آمادهٔ سفر" : "شخصیت‌ها و جهان‌های تو"}</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">{discover ? "هر جهان عمومی برای تو یک اجرای مستقل و یک پایان شخصی می‌سازد." : "شخصیت، نقش‌ها، قانون جهان و مسیر پایان را خودت طراحی کن."}</p></div>{!discover && <Button onClick={() => setLocation("/characters/new")} className="rounded-xl"><Plus className="ml-2 size-4" />شخصیت جدید</Button>}</header>
      {isLoading ? <div className="mt-8 story-panel p-8 text-muted-foreground">در حال باز کردن آرشیو…</div> : !bots?.length ? <div className="mt-8 story-panel px-6 py-16 text-center"><Sparkles className="mx-auto size-8 text-primary" /><h2 className="mt-4 text-xl font-semibold">{discover ? "فعلاً جهانی برای کشف نیست" : "آرشیو تو هنوز خالی است"}</h2><p className="mt-2 text-muted-foreground">{discover ? "بعداً دوباره برای دیدن جهان‌های عمومی سر بزن." : "با یک شخصیت و چند قانون ساده، داستانی پایان‌پذیر بساز."}</p>{!discover && <Button onClick={() => setLocation("/characters/new")} className="mt-6 rounded-xl">ساخت اولین جهان</Button>}</div> : <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{bots.map(bot => <article key={bot.id} className="story-panel flex min-h-72 flex-col p-6"><div className="flex items-start justify-between"><span className="grid size-12 place-items-center rounded-2xl bg-primary/12 text-xl text-primary">{bot.avatarSymbol}</span><Badge variant="outline" className={bot.visibility === "public" ? "border-sky-400/30 text-sky-300" : "border-white/15 text-muted-foreground"}>{bot.visibility === "public" ? <Globe2 className="ml-1 size-3" /> : <LockKeyhole className="ml-1 size-3" />}{bot.visibility === "public" ? "عمومی" : "خصوصی"}</Badge></div><h2 className="mt-6 text-xl font-semibold">{bot.name}</h2><p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{bot.description}</p><div className="mt-5 flex flex-wrap gap-2">{bot.roleOptions.slice(0, 3).map(role => <span key={role} className="rounded-lg bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">{role}</span>)}</div><div className="mt-auto flex flex-wrap items-center gap-2 pt-6">{discover ? <Button className="flex-1 rounded-xl" onClick={() => setLocation(`/characters/${bot.id}/start`)}>انتخاب نقش و شروع</Button> : <><Button className="flex-1 rounded-xl" onClick={() => setLocation(`/characters/${bot.id}/start`)}><Play className="ml-2 size-3.5" />گفتگوی تازه</Button><Button variant="outline" className="rounded-xl border-white/10" onClick={() => setLocation(`/characters/${bot.id}/edit`)}><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => archive.mutate({ storyBotId: bot.id })} aria-label="آرشیو شخصیت"><Archive className="size-4" /></Button><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => { if (window.confirm("حذف این شخصیت تمام اجراها و پیام‌های وابسته را پاک می‌کند. ادامه می‌دهید؟")) deleteStoryBot.mutate({ storyBotId: bot.id }); }} aria-label="حذف شخصیت"><Trash2 className="size-4" /></Button></>}</div></article>)}</div>}
  </div></div>;
}

export default function CharactersPage() { return <CharactersPageContent discover={false} />; }
export function PublicCharactersPage() { return <CharactersPageContent discover />; }
