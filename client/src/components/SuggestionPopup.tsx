import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb, Send, X } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "anicircle_suggestion_shown";

const SuggestionPopup = () => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const alreadyShown = localStorage.getItem(STORAGE_KEY);
    if (!alreadyShown) {
      const timer = setTimeout(() => {
        setOpen(true);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "suggestion",
          name: name || null,
          email: email || null,
          message,
        }),
      });
      if (res.ok) {
        toast.success("Thanks for your suggestion! It means a lot.");
        localStorage.setItem(STORAGE_KEY, "true");
        setOpen(false);
      } else {
        toast.error("Failed to send. Please try again.");
      }
    } catch {
      toast.error("Failed to send. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleDismiss(); }}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] mx-4 sm:mx-auto" data-testid="dialog-suggestion-popup">
        <button
          onClick={handleDismiss}
          data-testid="button-close-suggestion"
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-500/15 flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-violet-400" />
            </div>
            <DialogTitle className="text-lg">Got a suggestion?</DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed">
            AniCircle is built for you. If you have an idea that would make it better, we'd love to hear it — takes only a minute!
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <Input
            placeholder="Your name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="input-suggestion-name"
            className="bg-background/50 border-border/50"
          />
          <Input
            type="email"
            placeholder="Your email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="input-suggestion-email"
            className="bg-background/50 border-border/50"
          />
          <Textarea
            placeholder="What would you love to see in AniCircle?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            data-testid="textarea-suggestion-message"
            className="bg-background/50 border-border/50 resize-none min-h-[90px]"
            required
          />
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={handleDismiss}
              data-testid="button-maybe-later"
              className="flex-1 text-muted-foreground"
            >
              Maybe later
            </Button>
            <Button
              type="submit"
              disabled={submitting || !message.trim()}
              data-testid="button-submit-suggestion"
              className="flex-1 gap-2 bg-violet-600 hover:bg-violet-500 text-white"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? "Sending..." : "Send Idea"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SuggestionPopup;
