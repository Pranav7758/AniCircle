import { useState } from "react";
import { Mail, Phone, Instagram, Linkedin, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const Footer = () => {
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "";
  const feedbackEndpoint = `${apiBase}/api/feedback`;

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(feedbackEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "feedback",
          name: feedbackName || null,
          email: feedbackEmail || null,
          message: feedbackMessage,
        }),
      });
      if (res.ok) {
        toast.success("Thanks for your feedback! We appreciate it.");
        setFeedbackName("");
        setFeedbackEmail("");
        setFeedbackMessage("");
      } else {
        if (res.status === 404) {
          toast.error("Feedback API is unavailable. Start full backend (`npm run dev`) or set `VITE_API_BASE_URL`.");
        } else {
          toast.error("Failed to send feedback. Please try again.");
        }
      }
    } catch {
      toast.error("Failed to send feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="border-t border-primary/30 bg-background/80 backdrop-blur-lg mt-auto">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10 premium-section p-4 sm:p-6 lg:p-7">

          {/* About + Social */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gradient">
              AniCircle
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your anime universe, organized. Track every episode, never miss a new season, and rate your all-time favourites.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <a
                href="https://www.instagram.com/pranav99999_?igsh=OGgxeTVhemd2b21u"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                data-testid="link-instagram"
                className="w-9 h-9 flex items-center justify-center rounded-none border border-primary/40 bg-background/60 text-muted-foreground hover:text-primary hover:border-primary/70 transition-all duration-200 interactive-lift"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://www.linkedin.com/in/pranav-borse-dev"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                data-testid="link-linkedin"
                className="w-9 h-9 flex items-center justify-center rounded-none border border-primary/40 bg-background/60 text-muted-foreground hover:text-primary hover:border-primary/70 transition-all duration-200 interactive-lift"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a
                href="mailto:borsepranav700@gmail.com"
                aria-label="Email"
                data-testid="link-email"
                className="w-9 h-9 flex items-center justify-center rounded-none border border-primary/40 bg-background/60 text-muted-foreground hover:text-primary hover:border-primary/70 transition-all duration-200 interactive-lift"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Get in Touch</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-none bg-primary/15 text-primary shrink-0 border border-primary/40">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <a
                  href="mailto:borsepranav700@gmail.com"
                  data-testid="contact-email"
                  className="text-muted-foreground hover:text-primary transition-colors break-all"
                >
                  borsepranav700@gmail.com
                </a>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-none bg-primary/15 text-primary shrink-0 border border-primary/40">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <a
                  href="tel:+917758040552"
                  data-testid="contact-phone"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  +91 7758040552
                </a>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-none bg-primary/15 text-primary shrink-0 border border-primary/40">
                  <Instagram className="w-3.5 h-3.5" />
                </div>
                <a
                  href="https://www.instagram.com/pranav99999_?igsh=OGgxeTVhemd2b21u"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="contact-instagram"
                  className="text-muted-foreground hover:text-pink-400 transition-colors"
                >
                  @pranav99999_
                </a>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-none bg-primary/15 text-primary shrink-0 border border-primary/40">
                  <Linkedin className="w-3.5 h-3.5" />
                </div>
                <a
                  href="https://www.linkedin.com/in/pranav-borse-dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="contact-linkedin"
                  className="text-muted-foreground hover:text-blue-400 transition-colors"
                >
                  pranav-borse-dev
                </a>
              </div>
            </div>
          </div>

          {/* Feedback */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Send Feedback
            </h3>
            <form onSubmit={handleFeedbackSubmit} className="space-y-2.5">
              <Input
                placeholder="Your name (optional)"
                value={feedbackName}
                onChange={(e) => setFeedbackName(e.target.value)}
                data-testid="input-feedback-name"
                className="bg-background/50 border-primary/35 text-sm h-8 rounded-none"
              />
              <Input
                type="email"
                placeholder="Your email (optional)"
                value={feedbackEmail}
                onChange={(e) => setFeedbackEmail(e.target.value)}
                data-testid="input-feedback-email"
                className="bg-background/50 border-primary/35 text-sm h-8 rounded-none"
              />
              <Textarea
                placeholder="Share your thoughts, bugs, or ideas..."
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                data-testid="textarea-feedback-message"
                className="bg-background/50 border-primary/35 text-sm resize-none min-h-[72px] rounded-none"
                required
              />
              <Button
                type="submit"
                disabled={submitting || !feedbackMessage.trim()}
                data-testid="button-submit-feedback"
                size="sm"
                className="w-full gap-2 gradient-primary hover:opacity-90 text-black rounded-none border border-primary/60"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? "Sending..." : "Send Feedback"}
              </Button>
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-5 border-t border-primary/25">
          <div className="flex items-center justify-center text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} AniCircle. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
