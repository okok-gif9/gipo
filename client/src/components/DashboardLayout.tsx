import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { startLogin } from "@/const";
import { productIdentity } from "@/lib/productIdentity";
import { BookMarked, BookOpenText, Compass, LogOut, Menu, MessageCircleMore, Moon, Settings2, Sparkles, Sun, X } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const menuItems = [
  { icon: MessageCircleMore, label: "داستان‌های من", path: "/" },
  { icon: BookOpenText, label: "شخصیت‌ها", path: "/characters" },
  { icon: Compass, label: "کشف جهان‌ها", path: "/discover" },
  { icon: Settings2, label: "تنظیمات", path: "/settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) return <main className="archive-page" dir="rtl"><div className="container py-20"><div className="h-10 w-48 animate-pulse rounded-full bg-muted" /><div className="mt-10 h-72 animate-pulse rounded-2xl bg-muted" /></div></main>;
  if (!user) return <main className="archive-page flex min-h-screen items-center justify-center p-6" dir="rtl"><section className="w-full max-w-lg border-y archive-rule py-12 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-primary text-primary-foreground"><BookMarked className="size-5" /></span><p className="archive-kicker mt-6">{productIdentity.romanName} · {productIdentity.descriptor}</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">هر روایت، جای خودش را دارد.</h1><p className="mx-auto mt-4 max-w-md leading-8 text-muted-foreground">شخصیت بسازید، مسیر داستان را با انتخاب‌ها تغییر دهید و گفتگو را میان وب و تلگرام ادامه دهید.</p><span className="archive-stamp mt-6"><Sparkles className="size-3" />پرونده‌های زنده، پایان‌های ماندگار</span><Button onClick={startLogin} className="mt-8 rounded-full px-7">ورود به آرشیو شخصی</Button></section></main>;

  return <div className="min-h-screen bg-background text-foreground" dir="rtl">
    <header className="sticky top-0 z-40 border-b archive-rule bg-background/90 backdrop-blur-xl">
      <div className="container flex h-[76px] items-center justify-between gap-4">
        <button onClick={() => setLocation("/")} className="flex items-center gap-3 text-right"><span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground"><BookMarked className="size-4" /></span><span><strong className="block text-sm font-semibold">{productIdentity.name}</strong><small className="block text-[10px] text-muted-foreground">آرشیو شخصی</small></span></button>
        <nav className="hidden items-center gap-1 lg:flex">{menuItems.map(item => <button key={item.path} data-active={location === item.path} onClick={() => setLocation(item.path)} className="archive-link">{item.label}</button>)}</nav>
        <div className="flex items-center gap-2"><button className="theme-icon-button" onClick={toggleTheme} aria-label="تغییر تم">{theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</button><DropdownMenu><DropdownMenuTrigger asChild><button className="grid size-9 place-items-center rounded-full bg-secondary text-secondary-foreground"><Avatar className="size-9"><AvatarFallback className="bg-transparent text-xs">{user.name?.slice(0, 1).toUpperCase() ?? "؟"}</AvatarFallback></Avatar></button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive"><LogOut className="ml-2 size-4" />خروج از حساب</DropdownMenuItem></DropdownMenuContent></DropdownMenu><button className="theme-icon-button lg:hidden" onClick={() => setMobileMenuOpen(value => !value)} aria-label="بازکردن ناوبری">{mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}</button></div>
      </div>
      {mobileMenuOpen && <nav className="container flex flex-col gap-1 border-t archive-rule py-3 lg:hidden">{menuItems.map(item => <button key={item.path} data-active={location === item.path} onClick={() => { setLocation(item.path); setMobileMenuOpen(false); }} className="archive-link text-right">{item.label}</button>)}</nav>}
    </header>
    <main>{children}</main>
  </div>;
}
