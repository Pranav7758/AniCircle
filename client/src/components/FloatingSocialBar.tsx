import { useState } from "react";
import { Mail, Phone, Instagram, Linkedin, ChevronLeft, ChevronRight } from "lucide-react";

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
    /* Hidden on mobile, shown on md (768px) and above */
    <div className="hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-40 flex-col gap-1.5">
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
            flex items-center gap-2.5
            border border-r-0 border-border/40 rounded-l-xl
            bg-background/85 backdrop-blur-md shadow-lg
            py-2.5 pr-2.5 transition-all duration-300 ease-in-out
            text-muted-foreground no-underline
            ${hoverBg} ${hoverBorder}
          `}
          style={{
            transform: expanded ? "translateX(0)" : "translateX(calc(100% - 38px))",
            paddingLeft: expanded ? "14px" : "10px",
          }}
        >
          <div
            className="overflow-hidden transition-all duration-300 text-right"
            style={{ maxWidth: expanded ? 160 : 0, opacity: expanded ? 1 : 0 }}
          >
            <span className="text-xs font-semibold text-foreground block whitespace-nowrap">{label}</span>
            <span
              className="text-[10px] text-muted-foreground block whitespace-nowrap"
              style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {sublabel}
            </span>
          </div>
          <Icon className={`w-4 h-4 shrink-0 transition-colors ${iconColor}`} />
        </a>
      ))}

      {/* Toggle button */}
      <button
        onClick={() => setExpanded(v => !v)}
        data-testid="button-toggle-social-bar"
        aria-label={expanded ? "Collapse social links" : "Expand social links"}
        className="
          flex items-center justify-center w-5 h-7 rounded-l-lg mt-0.5 ml-auto
          border border-r-0 border-border/40
          bg-background/85 backdrop-blur-md shadow-lg
          text-muted-foreground hover:text-foreground hover:bg-muted/60
          transition-all duration-200
        "
      >
        {expanded
          ? <ChevronRight className="w-3 h-3" />
          : <ChevronLeft className="w-3 h-3" />
        }
      </button>
    </div>
  );
};

export default FloatingSocialBar;
