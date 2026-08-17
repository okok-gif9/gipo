import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import { useEffect } from "react";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import CharacterEditorPage from "./pages/CharacterEditorPage";
import CharactersPage, { PublicCharactersPage } from "./pages/CharactersPage";
import NotFound from "./pages/NotFound";
import Overview from "./pages/Overview";
import SettingsPage from "./pages/SettingsPage";
import StoryChatPage from "./pages/StoryChatPage";
import { productIdentity } from "./lib/productIdentity";
import SupabasePagesApp from "./pages/SupabasePagesApp";

function Router() {
  return <DashboardLayout><Switch>
    <Route path="/" component={Overview} />
    <Route path="/characters" component={CharactersPage} />
    <Route path="/discover" component={PublicCharactersPage} />
    <Route path="/characters/new" component={CharacterEditorPage} />
    <Route path="/characters/:id/edit" component={CharacterEditorPage} />
    <Route path="/characters/:id/start" component={CharacterEditorPage} />
    <Route path="/chat/:id" component={StoryChatPage} />
    <Route path="/settings" component={SettingsPage} />
    <Route component={NotFound} />
  </Switch></DashboardLayout>;
}

export default function App() {
  useEffect(() => { document.title = `${productIdentity.name} — ${productIdentity.descriptor}`; }, []);
  if (import.meta.env.VITE_DEPLOY_TARGET === "github-pages") return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><TooltipProvider><Toaster richColors /><SupabasePagesApp /></TooltipProvider></ThemeProvider></ErrorBoundary>;
  return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><TooltipProvider><Toaster richColors /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
