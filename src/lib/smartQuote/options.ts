/** Option lists for the CNC quote configuration (shared client/server). */

export const SUBPROCESS_OPTIONS = [
  "No Preference",
  "CNC Milling",
  "CNC Turning (Lathe)",
  "CNC Mill and Turning Combo",
  "CNC Router",
  "Swiss-Type Turning",
  "Micro Machining",
  "Other",
];

export const FINISH_OPTIONS = [
  "Standard",
  "Black Anodize",
  "Black Hardcoat Anodize",
  "Blue Anodize",
  "Clear Anodize",
  "Clear Hardcoat Anodize",
  "Gold Anodize",
  "Gray Hardcoat Anodize",
  "Green Anodize",
  "Orange Anodize",
  "PTFE Impregnated Hard Anodize",
  "Purple Anodize",
  "Red Anodize",
  "Yellow Anodize",
  "Chem Film Clear",
  "Chem Film Gold",
  "Case Harden",
  "Temper",
  "Through Harden",
  "Bead Blast",
  "Tumbled",
  "Electroless Nickel Plating",
  "Gold Plating",
  "Silver Plating",
  "Zinc Plating",
  "Electropolish",
  "Cerakote",
  "Powder Coating",
  "Other",
];

export const TOLERANCE_OPTIONS = [
  '±0.010" (±0.25mm)',
  '±0.005" (±0.13mm)',
  'Tighter than ±0.005" (±0.13mm)',
];

export const ROUGHNESS_OPTIONS = [
  "125μin / 3.2μm Ra",
  "63μin / 1.6μm Ra",
  "32μin / 0.8μm Ra",
  "16μin / 0.4μm Ra",
];

export const PART_MARKING_OPTIONS = ["Silkscreen", "Ink Stamp", "Bag and Tag", "Engraving", "Laser Mark"];

export const INSPECTION_OPTIONS = [
  "Standard Inspection",
  "Formal Inspection with Dimensional Report",
  "CMM Inspection with Dimensional Report",
  "First Article Inspection Report (FAIR AS9102)",
  "Source Inspection",
  "Build and Hold First Article Inspection",
  "Custom Inspection",
];

export const CERTIFICATE_OPTIONS = [
  "ITAR/EAR Registration",
  "Cybersecurity Maturity Model Certification (CMMC)",
  "AS9100 Certified",
  "ISO 9001 Certified",
  "Hardware Certification",
  "Certificate of Conformance",
  "Material Traceability",
  "JCP/eJCP Certified",
  "Material Certification",
];

export const DEFAULT_PART_CONFIG = {
  quantity: 1,
  finish: "Standard",
  tolerance: TOLERANCE_OPTIONS[1],
  roughness: ROUGHNESS_OPTIONS[0],
  subprocess: "No Preference",
  threads_qty: 0,
  inserts_qty: 0,
  inspection: INSPECTION_OPTIONS[0],
  certificates: [] as string[],
  part_marking: [] as string[],
  colour_coating: "",
};

export const ACCEPTED_EXTENSIONS = ".step,.stp,.iges,.igs,.dwg,.dxf,.stl,.pdf,.png,.jpg,.jpeg";
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
