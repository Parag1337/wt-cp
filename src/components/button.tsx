import type { ReactNode } from "react";

type ButtonProps = {
  href?: string;
  variant?: "gold" | "dark" | "outline" | "outline-light";
  size?: "md" | "lg";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600";

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  gold: "bg-gold-400 text-ink hover:bg-gold-500 shadow-sm hover:shadow-md",
  dark: "bg-forest-800 text-white hover:bg-forest-900",
  outline:
    "border border-forest-800/20 bg-white text-ink hover:border-forest-800/50 hover:bg-forest-50",
  "outline-light": "border border-white/40 text-white hover:bg-white/10",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  md: "px-6 py-3 text-sm md:text-base",
  lg: "px-7 py-3.5 text-base",
};

export function Button({
  href,
  variant = "gold",
  size = "md",
  className = "",
  type = "button",
  disabled = false,
  children,
  onClick,
}: ButtonProps) {
  const classes = `${base} ${variants[variant]} ${sizes[size]} ${className} ${
    disabled ? "pointer-events-none opacity-60" : ""
  }`;

  if (href) {
    const external = href.startsWith("http");
    return (
      <a
        href={href}
        className={classes}
        onClick={onClick}
        {...(external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      >
        {children}
      </a>
    );
  }

  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
