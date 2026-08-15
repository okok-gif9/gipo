import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { BookOpenText, Compass, LogOut, MessageCircleMore, PanelRight, Settings2, Sparkles } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: MessageCircleMore, label: "داستان‌های من", path: "/" },
  { icon: BookOpenText, label: "شخصیت‌ها", path: "/characters" },
  { icon: Compass, label: "کشف جهان‌ها", path: "/discover" },
  { icon: Settings2, label: "تنظیمات", path: "/settings" },
];

const SIDEBAR_WIDTH_KEY = "story-sidebar-width";
const DEFAULT_WIDTH = 276;
const MIN_WIDTH = 220;
const MAX_WIDTH = 380;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString()), [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return (
      <main className="min-h-screen bg-background story-grain flex items-center justify-center p-6" dir="rtl">
        <section className="max-w-md text-center rounded-[2rem] border border-white/10 bg-card/80 p-10 shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_0_40px_rgba(244,193,94,.28)]">
            <Sparkles className="size-6" />
          </div>
          <p className="text-xs tracking-[.28em] text-primary">STORYVERSE</p>
          <h1 className="mt-3 text-3xl font-semibold">داستانت منتظر توست</h1>
          <p className="mt-4 leading-7 text-muted-foreground">برای ساخت شخصیت، شروع یک جهان تازه و ادامه‌دادن روایت از تلگرام وارد شوید.</p>
          <Button onClick={() => startLogin()} size="lg" className="mt-8 w-full rounded-xl">ورود به قصه‌گو</Button>
        </section>
      </main>
    );
  }
  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isCollapsed = state === "collapsed";
  const activeLabel = menuItems.find(item => item.path === location)?.label ?? "قصه‌گو";

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const nextWidth = event.clientX - sidebarLeft;
      if (nextWidth >= MIN_WIDTH && nextWidth <= MAX_WIDTH) setSidebarWidth(nextWidth);
    };
    const up = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground" dir="rtl">
      <div className="relative" ref={sidebarRef}>
        <Sidebar side="right" collapsible="icon" className="border-l border-white/8 bg-sidebar/95 backdrop-blur-xl" disableTransition={isResizing}>
          <SidebarHeader className="h-20 px-3 justify-center">
            <div className="flex items-center gap-3">
              <button onClick={toggleSidebar} aria-label="باز و بسته کردن ناوبری" className="grid size-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground">
                <PanelRight className="size-4" />
              </button>
              {!isCollapsed && <div className="flex min-w-0 items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="size-4" /></span><span className="truncate font-semibold tracking-tight">قصه‌گو</span></div>}
            </div>
          </SidebarHeader>
          <SidebarContent className="px-2">
            {!isCollapsed && <p className="px-3 pb-3 text-[10px] font-medium tracking-[.2em] text-muted-foreground">روایت و جهان‌ها</p>}
            <SidebarMenu>
              {menuItems.map(item => <SidebarMenuItem key={item.path}>
                <SidebarMenuButton isActive={location === item.path} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-11 rounded-xl">
                  <item.icon className="size-4" /><span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-right transition hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center">
                  <Avatar className="size-9 border border-white/10"><AvatarFallback className="bg-primary/15 text-xs text-primary">{user?.name?.slice(0, 1).toUpperCase() ?? "؟"}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-medium">{user?.name || "مسافر داستان"}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">حساب شخصی</p></div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48"><DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="ml-2 size-4" />خروج از حساب</DropdownMenuItem></DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div className={`absolute left-0 top-0 z-50 h-full w-1 cursor-col-resize transition hover:bg-primary/25 ${isCollapsed ? "hidden" : ""}`} onMouseDown={() => setIsResizing(true)} />
      </div>
      <SidebarInset className="bg-background">
        {isMobile && <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-white/8 bg-background/85 px-4 backdrop-blur-xl"><SidebarTrigger className="rounded-xl" /><span className="font-medium">{activeLabel}</span></header>}
        <main className="min-h-screen">{children}</main>
      </SidebarInset>
    </div>
  );
}
