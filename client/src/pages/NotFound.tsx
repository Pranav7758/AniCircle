import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, Frown } from "lucide-react";

const NotFound = () => {
  const [location] = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location);
  }, [location]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="orb orb-purple absolute w-96 h-96 top-1/4 left-1/4 opacity-20 animate-float" />
        <div className="orb orb-blue absolute w-80 h-80 bottom-1/4 right-1/4 opacity-15 animate-float-delayed" />
      </div>

      <div className="text-center space-y-6 animate-fade-in relative z-10 px-4 deco-card deco-corners py-10">
        <div className="relative inline-block animate-float">
          <span className="text-9xl font-black text-gradient opacity-20 select-none absolute inset-0 blur-2xl">404</span>
          <span className="text-9xl font-black text-gradient select-none relative">404</span>
        </div>

        <div className="space-y-2 animate-slide-up" style={{ animationDelay: "0.1s", animationFillMode: "both" }}>
          <div className="flex items-center justify-center gap-2 deco-divider">
            <Frown className="w-6 h-6 text-muted-foreground" />
            <h2 className="text-2xl font-bold text-foreground">Lost in the anime multiverse</h2>
          </div>
          <p className="text-muted-foreground max-w-sm mx-auto">
            This page doesn't exist — but your next favourite anime might.
          </p>
        </div>

        <div className="animate-scale-in" style={{ animationDelay: "0.25s", animationFillMode: "both" }}>
          <a href="/">
            <Button className="gap-2 gradient-primary text-black shadow-neon rounded-none">
              <Home className="w-4 h-4" />
              Back to AniCircle
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
