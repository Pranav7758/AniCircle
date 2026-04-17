import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import PublicProfile from "./pages/PublicProfile";
import FeedbackAdmin from "./pages/FeedbackAdmin";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
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
      <Route path="/anime/:id">
        <ProtectedRoute><AnimeDetail /></ProtectedRoute>
      </Route>
      <Route path="/watch/:id/:epId">
        <ProtectedRoute><AnimeWatch /></ProtectedRoute>
      </Route>
      <Route path="/auth">
        <PublicRoute><Auth /></PublicRoute>
      </Route>
      <Route path="/u/:shortId">
        {(params) => <PublicProfile />}
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
        <Toaster />
        <Sonner />
        <Router />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
