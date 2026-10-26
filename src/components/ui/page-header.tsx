type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
};

export function PageHeader({
  eyebrow,
  title,
  description,
  align = "left",
}: PageHeaderProps) {
  return (
    <section className="bg-white py-8 lg:py-9">
      <div
        className={`container-site ${align === "center" ? "text-center" : ""}`}
      >
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-forest-700">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight text-ink md:text-4xl">
          {title}
        </h1>
        {description && (
          <p
            className={`mt-2 max-w-2xl text-base leading-relaxed text-forest-800 ${
              align === "center" ? "mx-auto" : ""
            }`}
          >
            {description}
          </p>
        )}
      </div>
    </section>
  );
}
