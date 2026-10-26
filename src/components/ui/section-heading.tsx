type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className = "",
}: SectionHeadingProps) {
  return (
    <div
      className={`${align === "center" ? "mx-auto text-center" : ""} ${className}`}
    >
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-forest-700">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-3 font-display text-2xl font-bold leading-tight tracking-tight text-ink md:text-3xl">
        {title}
      </h2>
      {description && (
        <p
          className={`mt-3 max-w-2xl text-base leading-relaxed text-forest-800 ${
            align === "center" ? "mx-auto" : ""
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
}
