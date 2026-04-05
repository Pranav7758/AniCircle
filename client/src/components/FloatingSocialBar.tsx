import { useState } from "react";
import { Mail, Phone, Instagram, Linkedin, ChevronRight, ChevronLeft } from "lucide-react";

const links = [
  {
    icon: Instagram,
    label: "Instagram",
    sublabel: "@pranav99999_",
    href: "https://www.instagram.com/pranav99999_?igsh=OGgxeTVhemd2b21u",
    iconColor: "text-pink-400",
    hoverBg: "hover:bg-pink-500/10",
    hoverBorder: "hover:border-pink-400/50",
    external: true,
  },
  {
    icon: Linkedin,
    label: "LinkedIn",
    sublabel: "pranav-borse-dev",
    href: "https://www.linkedin.com/in/pranav-borse-dev",
    iconColor: "text-blue-400",
    hoverBg: "hover:bg-blue-500/10",
    hoverBorder: "hover:border-blue-400/50",
    external: true,
  },
  {
    icon: Mail,
    label: "Email",
    sublabel: "borsepranav700@gmail.com",
    href: "mailto:borsepranav700@gmail.com",
    iconColor: "text-violet-400",
    hoverBg: "hover:bg-violet-500/10",
    hoverBorder: "hover:border-violet-400/50",
    external: false,
  },
  {
    icon: Phone,
    label: "Phone",
    sublabel: "+91 7758040552",
    href: "tel:+917758040552",
    iconColor: "text-emerald-400",
    hoverBg: "hover:bg-emerald-500/10",
    hoverBorder: "hover:border-emerald-400/50",
    external: false,
  },
];

const FloatingSocialBar = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="fixed left-0 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1.5">
      {links.map(({ icon: Icon, label, sublabel, href, iconColor, hoverBg, hoverBorder, external }) => (
        <a
          key={label}
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          aria-label={label}
          data-testid={`floating-link-${label.toLowerCase()}`}
          title={label}
          className={`
            group flex items-center gap-2.5
            border border-l-0 border-border/40 rounded-r-xl
            bg-background/85 backdrop-blur-md shadow-lg
            py-2.5 pl-2.5 transition-all duration-300 ease-in-out
            text-muted-foreground no-underline
            ${hoverBg} ${hoverBorder}
          `}
          style={{
            transform: expanded ? "translateX(0)" : "translateX(calc(-100% + 40px))",
            paddingRight: expanded ? "14px" : "10px",
          }}
        >
          <Icon className={`w-4 h-4 shrink-0 transition-colors ${iconColor}`} />
          <div
            className="overflow-hidden transition-all duration-300"
            style={{ maxWidth: expanded ? 160 : 0, opacity: expanded ? 1 : 0 }}
          >
            <span className="text-xs font-semibold text-foreground block whitespace-nowrap">{label}</span>
            <span className="text-[10px] text-muted-foreground block whitespace-nowrap truncate" style={{ maxWidth: 150 }}>{sublabel}</span>
          </div>
        </a>
      ))}

      {/* Toggle button */}
      <button
        onClick={() => setExpanded(v => !v)}
        data-testid="button-toggle-social-bar"
        aria-label={expanded ? "Collapse" : "Expand social links"}
        className="
          flex items-center justify-center w-5 h-7 rounded-r-lg mt-0.5
          border border-l-0 border-border/40
          bg-background/85 backdrop-blur-md shadow-lg
          text-muted-foreground hover:text-foreground hover:bg-muted/60
          transition-all duration-200 self-start
        "
      >
        {expanded
          ? <ChevronLeft className="w-3 h-3" />
          : <ChevronRight className="w-3 h-3" />
        }
      </button>
    </div>
  );
};

export default FloatingSocialBar;
