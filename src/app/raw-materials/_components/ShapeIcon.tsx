import type { Formula } from "@/lib/rawMaterials/weight";

/** Simple cross-section glyph for each shape formula. */
export function ShapeIcon({ formula, className }: { formula: Formula; className?: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinejoin: "round" as const,
  };
  let body: React.ReactNode;
  switch (formula) {
    case "round_bar":
    case "wire":
      body = <circle cx="24" cy="24" r="14" {...common} fill="currentColor" fillOpacity={0.15} />;
      break;
    case "square_bar":
      body = <rect x="11" y="11" width="26" height="26" {...common} fill="currentColor" fillOpacity={0.15} />;
      break;
    case "hex_bar":
      body = <polygon points="24,9 37,16.5 37,31.5 24,39 11,31.5 11,16.5" {...common} fill="currentColor" fillOpacity={0.15} />;
      break;
    case "flat_bar":
      body = <rect x="8" y="19" width="32" height="10" {...common} fill="currentColor" fillOpacity={0.15} />;
      break;
    case "sheet":
      body = <polygon points="6,30 30,36 42,22 18,16" {...common} fill="currentColor" fillOpacity={0.15} />;
      break;
    case "perforated":
      body = (
        <>
          <polygon points="6,30 30,36 42,22 18,16" {...common} />
          {[
            [18, 22],
            [25, 24],
            [32, 26],
            [15, 28],
            [22, 30],
            [29, 32],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="currentColor" />
          ))}
        </>
      );
      break;
    case "coil":
      body = (
        <>
          <circle cx="24" cy="24" r="15" {...common} fill="currentColor" fillOpacity={0.15} />
          <circle cx="24" cy="24" r="6" {...common} />
        </>
      );
      break;
    case "round_tube":
      body = (
        <>
          <circle cx="24" cy="24" r="15" {...common} fill="currentColor" fillOpacity={0.15} />
          <circle cx="24" cy="24" r="10" {...common} fill="white" />
        </>
      );
      break;
    case "square_tube":
      body = (
        <>
          <rect x="10" y="10" width="28" height="28" {...common} fill="currentColor" fillOpacity={0.15} />
          <rect x="15" y="15" width="18" height="18" {...common} fill="white" />
        </>
      );
      break;
    case "rect_tube":
      body = (
        <>
          <rect x="7" y="14" width="34" height="20" {...common} fill="currentColor" fillOpacity={0.15} />
          <rect x="12" y="19" width="24" height="10" {...common} fill="white" />
        </>
      );
      break;
    case "equal_angle":
      body = <polygon points="12,10 18,10 18,32 38,32 38,38 12,38" {...common} fill="currentColor" fillOpacity={0.15} />;
      break;
    case "t_section":
      body = <polygon points="8,10 40,10 40,16 27,16 27,38 21,38 21,16 8,16" {...common} fill="currentColor" fillOpacity={0.15} />;
      break;
    case "ismc":
      body = <polygon points="14,8 34,8 34,14 20,14 20,34 34,34 34,40 14,40" {...common} fill="currentColor" fillOpacity={0.15} />;
      break;
  }
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      {body}
    </svg>
  );
}
