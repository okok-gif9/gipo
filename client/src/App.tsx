import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import CharacterEditorPage from "./pages/CharacterEditorPage";
import CharactersPage, { PublicCharactersPage } from "./pages/CharactersPage";
import NotFound from "./pages/NotFound";
import Overview from "./pages/Overview";
import SettingsPage from "./pages/SettingsPage";
import StoryChatPage from "./pages/StoryChatPage";

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
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster richColors /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
