import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2, MessageSquare, Lightbulb, User, Mail, Calendar, ArrowLeft, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Feedback } from "@shared/schema";

const OWNER_EMAIL = "borsepranav700@gmail.com";

const FeedbackAdmin = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const { data: feedbackList, isLoading } = useQuery<Feedback[]>({
    queryKey: ["/api/admin/feedback"],
    enabled: !!user && user.email === OWNER_EMAIL,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!user || user.email !== OWNER_EMAIL) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="w-16 h-16 rounded-none border border-destructive/50 bg-red-500/10 flex items-center justify-center">
          <span className="text-2xl">🚫</span>
        </div>
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground text-sm">This page is only accessible to the site owner.</p>
        <Button variant="ghost" onClick={() => navigate("/")} className="gap-2 rounded-none">
          <ArrowLeft className="w-4 h-4" /> Go Home
        </Button>
      </div>
    );
  }

  const suggestions = feedbackList?.filter(f => f.type === "suggestion") ?? [];
  const feedbacks = feedbackList?.filter(f => f.type === "feedback") ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="header-accent-strip" />
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-8 w-8 rounded-none" data-testid="button-back-home">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-violet-400" />
            <h1 className="text-lg font-bold">Feedback Inbox</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {feedbackList && (
              <Badge variant="secondary" className="text-xs rounded-none border border-primary/40">
                {feedbackList.length} total
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-10">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          </div>
        ) : feedbackList?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-violet-400/60" />
            </div>
            <p className="text-muted-foreground">No feedback yet. Check back later!</p>
          </div>
        ) : (
          <>
            {suggestions.length > 0 && (
              <section className="space-y-4 deco-card deco-corners p-4">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                    Suggestions ({suggestions.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {suggestions.map(item => (
                    <FeedbackCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}

            {feedbacks.length > 0 && (
              <section className="space-y-4 deco-card deco-corners p-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-violet-400" />
                  <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                    Feedback ({feedbacks.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {feedbacks.map(item => (
                    <FeedbackCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const FeedbackCard = ({ item }: { item: Feedback }) => {
  const date = item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }) : "";

  return (
    <div
      className="rounded-none border border-primary/35 bg-card p-4 space-y-3"
      data-testid={`feedback-card-${item.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {item.name && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              {item.name}
            </span>
          )}
          {item.email && (
            <a
              href={`mailto:${item.email}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-violet-400 transition-colors"
            >
              <Mail className="w-3 h-3" />
              {item.email}
            </a>
          )}
          {!item.name && !item.email && (
            <span className="text-xs text-muted-foreground italic">Anonymous</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <Calendar className="w-3 h-3" />
          {date}
        </div>
      </div>
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
        {item.message}
      </p>
    </div>
  );
};

export default FeedbackAdmin;
