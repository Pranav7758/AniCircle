import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import PublicProfile from "./pages/PublicProfile";
import FeedbackAdmin from "./pages/FeedbackAdmin";
import { Loader2 } from "lucide-react";
import RemEffects from "@/components/RemEffects";
import remFloatImg from "@assets/re-zero-cute-blue-hair-rem-sticker_1776671235770.webp";
import remStickerImg from "@assets/re-zero-sad-kawaii-rem-sticker_1776671137105.webp";
import remMainFullbodyImg from "@assets/rem-main-fullbody.png";
import remEyesImg from "@assets/rem-eyes-default.png";
import remGifImg from "@assets/rem-rezero.gif";

function ThemeInitializer() {
  useTheme();

  useEffect(() => {
    const preload = [remFloatImg, remStickerImg, remMainFullbodyImg, remEyesImg, remGifImg].map((src) => {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      return img;
    });

    return () => {
      preload.length = 0;
    };
  }, []);

  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 deco-card deco-corners px-8 py-7">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground text-sm uppercase tracking-[0.14em]">Loading AniCircle</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Redirect to="/auth" />;
  }
  
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 deco-card deco-corners px-8 py-7">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground text-sm uppercase tracking-[0.14em]">Loading AniCircle</p>
        </div>
      </div>
    );
  }
  
  if (user) {
    return <Redirect to="/" />;
  }
  
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <ProtectedRoute><Index /></ProtectedRoute>
      </Route>
      <Route path="/auth">
        <PublicRoute><Auth /></PublicRoute>
      </Route>
      <Route path="/u/:shortId">
        {() => <PublicProfile />}
      </Route>
      <Route path="/admin/feedback">
        <ProtectedRoute><FeedbackAdmin /></ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <ThemeInitializer />
        <RemEffects />
        <Toaster />
        <Sonner />
        <Router />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
