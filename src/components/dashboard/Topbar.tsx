export function Topbar({
  title,
  pill,
  right,
}: {
  title: string;
  pill?: { label: string; tone?: "brand" | "orange" };
  right?: React.ReactNode;
}) {
  return (
    <div className="flex h-16 items-center justify-between border-b border-grid bg-surface px-7">
      <h1 className="flex items-center text-lg font-bold tracking-tight">
        {title}
        {pill && (
          <span
            className={
              "ml-2 rounded-full px-2.5 py-[3px] text-[11px] font-bold " +
              (pill.tone === "orange"
                ? "bg-accent-orange-bg text-[#a8461a]"
                : "bg-brand-light text-brand-dark")
            }
          >
            {pill.label}
          </span>
        )}
      </h1>
      {right && <div className="flex items-center gap-3.5">{right}</div>}
    </div>
  );
}
