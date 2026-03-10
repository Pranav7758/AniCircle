import { Mail, Phone, User, Github, ExternalLink } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border/50 bg-background/80 backdrop-blur-lg mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold bg-gradient-primary bg-clip-text text-transparent">
              AnimeTracker
            </h3>
            <p className="text-sm text-muted-foreground">
              Track your anime watchlist, episodes watched, and ratings. Never forget which anime you've completed or what to watch next.
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ExternalLink className="w-4 h-4" />
              <a
                href="https://anime-watchlist-rust.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                Visit Website
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/" className="text-muted-foreground hover:text-primary transition-colors">
                  Home
                </a>
              </li>
              <li>
                <a href="https://anilist.co/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  AniList API
                </a>
              </li>
              <li>
                <a href="https://myanimelist.net/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  MyAnimeList
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Contact</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Pranav Amit Borse</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <a
                  href="tel:+917758040552"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  +91 7758040552
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <a
                  href="mailto:borsepranav700@gmail.com"
                  className="text-muted-foreground hover:text-primary transition-colors break-all"
                >
                  borsepranav700@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>
              © {new Date().getFullYear()} AnimeTracker. All rights reserved.
            </p>
            <p className="text-center md:text-right">
              Built with ❤️ by{" "}
              <span className="text-primary font-medium">Pranav Amit Borse</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

