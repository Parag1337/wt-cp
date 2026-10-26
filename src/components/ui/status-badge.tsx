const STATUS_TONES: Record<string, string> = {
  pending: "bg-gold-100 text-gold-600",
  confirmed: "bg-leaf-100 text-forest-700",
  processing: "bg-leaf-100 text-forest-700",
  shipped: "bg-leaf-200 text-forest-800",
  delivered: "bg-forest-800 text-white",
  completed: "bg-forest-800 text-white",
  cancelled: "bg-cream-200 text-forest-800",
};

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone = STATUS_TONES[normalized] ?? "bg-cream-100 text-forest-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize ${tone}`}
    >
      {normalized}
    </span>
  );
}
