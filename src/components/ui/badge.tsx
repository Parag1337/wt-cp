type BadgeProps = {
  children: React.ReactNode;
  tone?: "available" | "unavailable" | "category" | "neutral";
  className?: string;
};

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  available: "bg-leaf-500 text-white",
  unavailable: "bg-cream-200 text-forest-800",
  category: "bg-leaf-100 text-forest-700",
  neutral: "bg-cream-100 text-forest-700",
};

export function Badge({ children, tone = "neutral", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
