"""
Generates supabase/migrations/0009_raw_material_catalog_seed.sql — the
starting Raw Material Marketplace catalogue (shapes, materials, grades,
shape availability) and an INDICATIVE rate card.

Run:  python3 supabase/scripts/gen_rm_catalog_seed.py

Data-quality rules applied here (these fix the errors seen on MetaleMart,
e.g. aluminium grades 2024/6061/7075 listed as "Stainless Steel"):
  * every grade is declared under exactly one material;
  * a grade can restrict itself to the shapes it is actually produced in
    (e.g. 5083 is plate/sheet, 2011 is free-machining bar);
  * duplicate/combined names are split ("CuZn30 / CuZn40" → two alloys;
    "EN8 (C45)" → EN8 and C45 are separate grades);
  * vague trade names without a spec ("Commercial MS", "Low grade copper
    92%") are not listed;
  * each grade carries its own density, so weights are right per alloy.

Rates are INDICATIVE placeholders (₹/kg excl. GST) so the flow works end to
end — replace them in Admin → Raw Materials → Rate card before go-live.
"""
import json
import pathlib

OUT = pathlib.Path(__file__).resolve().parents[1] / "migrations" / "0009_raw_material_catalog_seed.sql"

# ---------------------------------------------------------------------------
# Shapes
# ---------------------------------------------------------------------------
BAR_LENGTHS = [3000, 6000]
LONG_LENGTHS = [6000]


def dim(key, label, std=None, mn=None, mx=None, unit="mm"):
    d = {"key": key, "label": label, "unit": unit}
    if std:
        d["std"] = std
    if mn is not None:
        d["min"] = mn
    if mx is not None:
        d["max"] = mx
    return d


SHEET_SIZES = [[1000, 2000], [1250, 2500], [1500, 3000]]
PLATE_SIZES = [[1250, 2500], [1500, 3000], [2000, 6000]]

SHAPES = [
    # slug, name, family, formula, sell_by, hsn_key, premium %, std_lengths, sheet sizes, dims, description
    ("round-bar", "Round Bar", "bar", "round_bar", "piece", "bar", 0, BAR_LENGTHS, [],
     [dim("d", "Diameter", [6, 8, 10, 12, 16, 20, 25, 32, 40, 50, 63, 75, 100, 125, 150, 200], 3, 600)],
     "Solid bright or black round bars for turning, shafts, pins and general machining."),
    ("square-bar", "Square Bar", "bar", "square_bar", "piece", "bar", 3, BAR_LENGTHS, [],
     [dim("a", "Side", [10, 12, 16, 20, 25, 32, 40, 50, 63, 75, 100], 5, 300)],
     "Solid square bars for fixtures, keys, frames and milled parts."),
    ("hex-bar", "Hex Bar", "bar", "hex_bar", "piece", "bar", 6, BAR_LENGTHS, [],
     [dim("af", "Across flats", [8, 10, 12, 13, 17, 19, 22, 24, 27, 30, 36, 41, 46, 50], 5, 150)],
     "Hexagonal bars (sized across flats) for nuts, fittings and turned components."),
    ("flat-bar", "Flat Bar", "bar", "flat_bar", "piece", "bar", 2, BAR_LENGTHS, [],
     [dim("w", "Width", [12, 16, 20, 25, 32, 40, 50, 63, 75, 100, 125, 150], 5, 600),
      dim("t", "Thickness", [3, 5, 6, 8, 10, 12, 16, 20, 25, 32, 40, 50], 1, 200)],
     "Rectangular flat bars for brackets, base plates, wear strips and fabrication."),
    ("sheet", "Sheet (0.3–6 mm)", "flat", "sheet", "piece", "flat", 5, [], SHEET_SIZES,
     [dim("t", "Thickness", [0.5, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6], 0.3, 6),
      dim("w", "Width", [1000, 1250, 1500], 50, 2000),
      dim("l", "Length", [2000, 2500, 3000], 50, 6000)],
     "Cold- or hot-rolled sheets up to 6 mm, full size or cut to your width × length."),
    ("plate", "Plate (above 6 mm)", "flat", "sheet", "piece", "flat", 0, [], PLATE_SIZES,
     [dim("t", "Thickness", [8, 10, 12, 16, 20, 25, 32, 40, 50, 63, 80, 100], 6.01, 300),
      dim("w", "Width", [1250, 1500, 2000], 50, 2500),
      dim("l", "Length", [2500, 3000, 6000], 50, 12000)],
     "Hot-rolled plates over 6 mm for base frames, dies, flanges and structural work."),
    ("chequered-plate", "Chequered Plate", "flat", "sheet", "piece", "flat", 4, [], [[1250, 2500], [1500, 6000]],
     [dim("t", "Base thickness", [3, 4, 5, 6, 8, 10], 2, 12),
      dim("w", "Width", [1250, 1500], 50, 2000),
      dim("l", "Length", [2500, 6000], 50, 6300)],
     "Anti-slip raised-pattern plates for flooring, stairs and platforms. Weight is on base thickness; the raised pattern adds a little."),
    ("perforated-sheet", "Perforated Sheet", "flat", "perforated", "piece", "flat", 25, [], [[1000, 2000], [1250, 2500]],
     [dim("t", "Thickness", [0.8, 1, 1.2, 1.5, 2, 3], 0.5, 6),
      dim("w", "Width", [1000, 1250], 50, 1500),
      dim("l", "Length", [2000, 2500], 50, 3000),
      dim("open", "Open area", [23, 33, 40, 51], 5, 70, unit="%")],
     "Round-hole perforated sheets for guards, screens, filters and façades."),
    ("coil", "Coil / Strip", "flat", "coil", "kg", "flat", 0, [], [],
     [dim("t", "Thickness", [0.3, 0.5, 0.8, 1, 1.2, 1.5, 2, 3], 0.1, 6),
      dim("w", "Width", [50, 100, 150, 300, 600, 1000, 1250, 1500], 10, 2000)],
     "Coils and slit strip sold by weight — tell us thickness and width."),
    ("seamless-pipe", "Seamless Pipe / Tube", "pipe", "round_tube", "piece", "seamless", 20, LONG_LENGTHS, [],
     [dim("od", "Outer diameter", [6, 10, 12, 16, 21.3, 26.7, 33.4, 42.2, 48.3, 60.3, 88.9, 114.3, 168.3], 3, 610),
      dim("t", "Wall thickness", [1, 1.5, 2, 2.77, 3.38, 3.91, 5.54, 7.11], 0.5, 60)],
     "Seamless pipes and tubes for pressure, hydraulic and high-temperature service."),
    ("erw-pipe", "ERW / Welded Pipe", "pipe", "round_tube", "piece", "welded", 8, LONG_LENGTHS, [],
     [dim("od", "Outer diameter", [12.7, 15.9, 19.05, 21.3, 25.4, 26.9, 33.7, 38.1, 42.4, 48.3, 50.8, 60.3, 76.1, 88.9, 114.3], 6, 610),
      dim("t", "Wall thickness", [0.8, 1, 1.2, 1.6, 2, 2.6, 2.9, 3.2, 3.6, 4.5], 0.5, 12)],
     "Welded (ERW) round pipes for structures, railings, furniture and utility lines."),
    ("square-hollow", "Square Hollow Section", "pipe", "square_tube", "piece", "welded", 8, LONG_LENGTHS, [],
     [dim("a", "Side", [15, 20, 25, 32, 40, 50, 60, 72, 80, 100, 120, 150], 10, 400),
      dim("t", "Wall thickness", [1, 1.2, 1.6, 2, 2.6, 3.2, 4, 4.8, 6], 0.8, 16)],
     "Square hollow sections (SHS) for frames, gates, trusses and machine bases."),
    ("rect-hollow", "Rectangular Hollow Section", "pipe", "rect_tube", "piece", "welded", 8, LONG_LENGTHS, [],
     [dim("a", "Width", [40, 50, 60, 80, 100, 120, 150, 200], 10, 400),
      dim("b", "Height", [20, 25, 30, 40, 50, 60, 80, 100], 10, 400),
      dim("t", "Wall thickness", [1.2, 1.6, 2, 2.6, 3.2, 4, 4.8, 6], 0.8, 16)],
     "Rectangular hollow sections (RHS) for frames, purlins and conveyors."),
    ("equal-angle", "Equal Angle", "section", "equal_angle", "piece", "section", 0, LONG_LENGTHS, [],
     [dim("a", "Leg", [20, 25, 30, 35, 40, 45, 50, 65, 75, 90, 100, 150], 10, 250),
      dim("t", "Thickness", [3, 4, 5, 6, 8, 10, 12], 2, 30)],
     "Equal-leg L angles for bracing, supports, frames and edge protection."),
    ("t-section", "T Section", "section", "t_section", "piece", "section", 5, LONG_LENGTHS, [],
     [dim("b", "Flange width", [20, 25, 30, 40, 50, 60], 10, 200),
      dim("h", "Height", [20, 25, 30, 40, 50, 60], 10, 200),
      dim("t", "Thickness", [3, 4, 5, 6, 8], 2, 20)],
     "T sections for glazing bars, stiffeners and light structural members."),
    ("ismc-channel", "C Channel (ISMC)", "section", "ismc", "piece", "section", 0, LONG_LENGTHS, [],
     [dim("size", "ISMC size (depth)", [75, 100, 125, 150, 175, 200, 225, 250, 300, 350, 400], 75, 400)],
     "Indian Standard Medium-weight Channels to IS 808, priced on nominal kg/m."),
    ("wire-rod", "Wire / Wire Rod", "wire", "wire", "kg", "wire", 5, [], [],
     [dim("d", "Diameter", [1, 1.6, 2, 2.5, 3, 4, 5, 5.5, 6, 8, 10, 12], 0.2, 20)],
     "Wire and wire rod in coils, sold by weight, for springs, fasteners and forming."),
]

# ---------------------------------------------------------------------------
# Materials — density g/cm³ (grade overrides), HSN by shape group, GST %
# ---------------------------------------------------------------------------
STEEL_NONALLOY_HSN = {"bar": "7214", "flat": "7208", "section": "7216", "seamless": "7304", "welded": "7306", "wire": "7213"}
STEEL_ALLOY_HSN = {"bar": "7228", "flat": "7225", "section": "7228", "seamless": "7304", "welded": "7306", "wire": "7227"}
COPPER_HSN = {"bar": "7407", "flat": "7409", "section": "7407", "seamless": "7411", "welded": "7411", "wire": "7408"}

MATERIALS = [
    ("stainless-steel", "Stainless Steel", "SS", 7.93,
     {"bar": "7222", "flat": "7219", "section": "7222", "seamless": "7304", "welded": "7306", "wire": "7221"},
     "Corrosion-resistant iron–chromium(–nickel) steels. Austenitic grades (304, 316) are non-magnetic and weldable; martensitic grades (410, 420, 440C) harden; duplex grades combine strength with chloride resistance."),
    ("mild-steel", "Mild Steel", "MS", 7.85, STEEL_NONALLOY_HSN,
     "Low-carbon structural steel — weldable, easy to fabricate and the most economical choice for frames, sections and plates."),
    ("carbon-steel", "Carbon Steel", "CS", 7.85, STEEL_NONALLOY_HSN,
     "Medium-carbon engineering steels for shafts, gears and machined parts; can be hardened and tempered."),
    ("alloy-steel", "Alloy Steel", "AS", 7.85, STEEL_ALLOY_HSN,
     "Chromium, nickel and molybdenum alloyed steels (EN series) for high-strength, tough or case-hardened components."),
    ("tool-steel", "Tool Steel", "TS", 7.75, STEEL_ALLOY_HSN,
     "High-carbon alloy steels for dies, punches, moulds and cutting tools; supplied annealed for machining."),
    ("spring-steel", "Spring Steel", "SPR", 7.85, STEEL_ALLOY_HSN,
     "High-carbon and chrome-vanadium steels that return to shape after load — springs, clips, blades."),
    ("aluminium", "Aluminium", "Al", 2.70,
     {"bar": "7604", "flat": "7606", "section": "7604", "seamless": "7608", "welded": "7608", "wire": "7605"},
     "Light (about one-third the weight of steel), corrosion-resistant and highly machinable. Series 5xxx for marine/sheet work, 6xxx for extrusions and general machining, 2xxx/7xxx for high strength."),
    ("copper", "Copper", "Cu", 8.94, COPPER_HSN,
     "Best-in-class electrical and thermal conductivity — busbars, earthing, heat exchangers and plumbing."),
    ("brass", "Brass", "Brass", 8.50, COPPER_HSN,
     "Copper–zinc alloys: free-machining for turned parts and fittings, ductile grades for deep drawing and tubes."),
    ("bronze", "Bronze", "Bronze", 8.80, COPPER_HSN,
     "Copper–tin and copper–aluminium alloys for bushes, bearings, gears and marine hardware."),
    ("nickel-alloys", "Nickel Alloys", "Ni", 8.40,
     {"bar": "7505", "flat": "7506", "section": "7505", "seamless": "7507", "welded": "7507", "wire": "7505"},
     "Nickel-based superalloys for extreme corrosion and temperature — chemical plant, oil & gas, aerospace."),
    ("titanium", "Titanium", "Ti", 4.51,
     {"bar": "8108", "flat": "8108", "section": "8108", "seamless": "8108", "welded": "8108", "wire": "8108"},
     "Very high strength-to-weight and outstanding corrosion resistance — aerospace, medical and chemical service."),
]

ALL_BARS = ["round-bar", "square-bar", "hex-bar", "flat-bar"]
SHAPE_MATERIALS = {
    "stainless-steel": ALL_BARS + ["sheet", "plate", "chequered-plate", "perforated-sheet", "coil",
                                   "seamless-pipe", "erw-pipe", "square-hollow", "rect-hollow", "equal-angle", "wire-rod"],
    "mild-steel": ["round-bar", "square-bar", "flat-bar", "sheet", "plate", "chequered-plate", "perforated-sheet",
                   "coil", "erw-pipe", "square-hollow", "rect-hollow", "equal-angle", "t-section", "ismc-channel", "wire-rod"],
    "carbon-steel": ALL_BARS + ["plate", "seamless-pipe"],
    "alloy-steel": ["round-bar", "square-bar", "hex-bar", "flat-bar", "plate"],
    "tool-steel": ["round-bar", "square-bar", "flat-bar", "plate"],
    "spring-steel": ["round-bar", "flat-bar", "coil", "wire-rod"],
    "aluminium": ALL_BARS + ["sheet", "plate", "chequered-plate", "perforated-sheet", "coil", "seamless-pipe",
                             "square-hollow", "rect-hollow", "equal-angle", "t-section"],
    "copper": ["round-bar", "square-bar", "flat-bar", "sheet", "plate", "coil", "seamless-pipe", "wire-rod"],
    "brass": ALL_BARS + ["sheet", "plate", "seamless-pipe"],
    "bronze": ["round-bar"],
    "nickel-alloys": ["round-bar", "sheet", "plate", "seamless-pipe"],
    "titanium": ["round-bar", "sheet", "plate", "seamless-pipe"],
}

# ---------------------------------------------------------------------------
# Grades: (slug, name, equivalents, density or None, shapes or None,
#          indicative ₹/kg, description, applications)
# ---------------------------------------------------------------------------
FLAT = ["sheet", "plate", "coil"]
GRADES = {
    "stainless-steel": [
        ("ss-201", "SS 201", "UNS S20100 · EN 1.4372", 7.80, ALL_BARS + FLAT + ["erw-pipe", "square-hollow", "rect-hollow"], 150,
         "Low-nickel austenitic (Cr-Mn-Ni) grade; economical for indoor, low-corrosion use.", "Kitchenware, furniture, decorative tube"),
        ("ss-202", "SS 202", "UNS S20200", 7.80, ALL_BARS + FLAT + ["erw-pipe", "square-hollow", "rect-hollow", "equal-angle"], 160,
         "Manganese-bearing austenitic grade, a lower-cost alternative to 304 for mild environments.", "Railings, utensils, architectural trim"),
        ("ss-303", "SS 303", "UNS S30300 · EN 1.4305", 8.00, ALL_BARS, 260,
         "Free-machining austenitic grade (added sulphur); best for high-volume turning, not for welding.", "Nuts, bolts, shafts, fittings"),
        ("ss-304", "SS 304", "UNS S30400 · EN 1.4301 · AISI 304", 7.93, None, 230,
         "The standard 18/8 austenitic stainless — good corrosion resistance, food-grade, weldable and formable.", "Food & dairy equipment, tanks, architecture"),
        ("ss-304l", "SS 304L", "UNS S30403 · EN 1.4307", 7.93, None, 240,
         "Low-carbon 304 that avoids weld-zone sensitisation; preferred for heavy welded fabrication.", "Welded tanks, pipework, pressure parts"),
        ("ss-310s", "SS 310S", "UNS S31008 · EN 1.4845", 7.90, ALL_BARS + ["sheet", "plate", "seamless-pipe"], 420,
         "High Cr-Ni heat-resisting grade, oxidation resistant to about 1,100 °C.", "Furnace parts, burners, heat exchangers"),
        ("ss-316", "SS 316", "UNS S31600 · EN 1.4401 · AISI 316", 8.00, None, 330,
         "Molybdenum-bearing austenitic grade with better pitting and chloride resistance than 304.", "Marine, pharma, chemical process equipment"),
        ("ss-316l", "SS 316L", "UNS S31603 · EN 1.4404", 8.00, None, 340,
         "Low-carbon 316 for welded assemblies in corrosive service.", "Pharma piping, marine fittings, valves"),
        ("ss-316ti", "SS 316Ti", "UNS S31635 · EN 1.4571", 8.00, ["round-bar", "sheet", "plate", "seamless-pipe"], 380,
         "Titanium-stabilised 316 for sustained elevated-temperature service.", "Exhaust systems, heat exchangers"),
        ("ss-317l", "SS 317L", "UNS S31703 · EN 1.4438", 8.00, ["round-bar", "sheet", "plate", "seamless-pipe"], 420,
         "Higher-molybdenum austenitic grade for aggressive chemical environments.", "Pulp & paper, flue-gas desulphurisation"),
        ("ss-321", "SS 321", "UNS S32100 · EN 1.4541", 7.90, ["round-bar", "sheet", "plate", "seamless-pipe", "erw-pipe"], 300,
         "Titanium-stabilised 18/8 for 425–900 °C service without intergranular corrosion.", "Exhaust manifolds, expansion joints"),
        ("ss-347", "SS 347", "UNS S34700 · EN 1.4550", 7.96, ["round-bar", "sheet", "plate", "seamless-pipe"], 360,
         "Niobium-stabilised austenitic grade for high-temperature welded service.", "Aircraft exhausts, boiler shells"),
        ("ss-409", "SS 409", "UNS S40900 · EN 1.4512", 7.70, ["sheet", "coil", "erw-pipe"], 140,
         "Ferritic 11% Cr grade; economical, moderate corrosion resistance.", "Automotive exhausts, mufflers"),
        ("ss-410", "SS 410", "UNS S41000 · EN 1.4006", 7.75, ALL_BARS + ["sheet", "plate"], 190,
         "Hardenable martensitic grade with moderate corrosion resistance.", "Pump shafts, valve parts, cutlery"),
        ("ss-420", "SS 420", "UNS S42000 · EN 1.4021 / 1.4028", 7.75, ["round-bar", "flat-bar", "sheet", "plate"], 210,
         "Higher-carbon martensitic grade that reaches greater hardness than 410. (420J2 is the Japanese sheet variant.)", "Surgical instruments, blades, moulds"),
        ("ss-430", "SS 430", "UNS S43000 · EN 1.4016", 7.70, ["round-bar", "sheet", "coil"], 150,
         "Ferritic, magnetic 17% Cr grade with good formability for indoor use.", "Appliance panels, trim, sinks"),
        ("ss-440c", "SS 440C", "UNS S44004 · EN 1.4125", 7.65, ["round-bar"], 450,
         "High-carbon martensitic grade with the highest hardness of the stainless family.", "Bearings, valve seats, knives"),
        ("ss-17-4ph", "17-4 PH (SS 630)", "UNS S17400 · EN 1.4542", 7.80, ["round-bar", "flat-bar", "plate"], 600,
         "Precipitation-hardening grade combining high strength with 304-level corrosion resistance.", "Aerospace fittings, pump shafts, gears"),
        ("duplex-2205", "Duplex 2205", "UNS S32205 / S31803 · EN 1.4462", 7.80, ["round-bar", "sheet", "plate", "seamless-pipe"], 550,
         "Austenitic-ferritic duplex with about twice the strength of 316 and excellent chloride stress-corrosion resistance.", "Oil & gas, desalination, chemical tanks"),
        ("super-duplex-2507", "Super Duplex 2507", "UNS S32750 · EN 1.4410", 7.80, ["round-bar", "plate", "seamless-pipe"], 850,
         "Higher-alloy duplex for seawater and severe chloride service.", "Offshore, sea-water systems"),
        ("ss-904l", "SS 904L", "UNS N08904 · EN 1.4539", 7.95, ["round-bar", "sheet", "plate", "seamless-pipe"], 1300,
         "Super-austenitic grade with high Ni-Mo-Cu for sulphuric acid and chloride environments.", "Acid plants, heat exchangers"),
        ("smo-254", "254 SMO", "UNS S31254 · EN 1.4547", 8.00, ["round-bar", "sheet", "plate", "seamless-pipe"], 1400,
         "6-Mo super-austenitic stainless for sea water and bleach plants.", "Sea-water piping, pulp bleaching"),
    ],
    "mild-steel": [
        ("is-2062-e250", "IS 2062 E250", "Fe 410 · ≈ ASTM A36 / S235", None,
         ["round-bar", "square-bar", "flat-bar", "sheet", "plate", "chequered-plate", "coil", "equal-angle", "t-section", "ismc-channel"], 62,
         "Standard Indian structural steel (yield 250 MPa); weldable and the default for fabrication.", "Structures, frames, base plates"),
        ("is-2062-e350", "IS 2062 E350", "Fe 490 · ≈ S355", None,
         ["round-bar", "flat-bar", "plate", "equal-angle", "ismc-channel"], 68,
         "Higher-strength structural steel (yield 350 MPa) for lighter, stronger members.", "Heavy structures, cranes, bridges"),
        ("is-513", "IS 513 (CR sheet)", "CR1–CR4 · ≈ DC01–DC04", None, ["sheet", "coil", "perforated-sheet"], 70,
         "Cold-rolled low-carbon sheet with good surface and formability.", "Panels, enclosures, pressed parts"),
        ("is-1079", "IS 1079 (HR sheet)", "HR1–HR4 · ≈ DD11–DD13", None, ["sheet", "coil"], 64,
         "Hot-rolled low-carbon sheet and coil for general forming.", "Brackets, tanks, general fabrication"),
        ("is-1239", "IS 1239 (ERW pipe)", "Light / Medium / Heavy class", None, ["erw-pipe"], 72,
         "Welded mild steel tubes for water, gas and structural use.", "Plumbing, scaffolding, railings"),
        ("is-4923", "IS 4923 YSt 310", "Hollow structural sections", None, ["square-hollow", "rect-hollow"], 70,
         "Cold-formed hollow sections (yield 310 MPa) for tubular structures.", "Gates, trusses, frames"),
        ("sae-1008", "SAE 1008 wire rod", "≈ C10 · EN 1.0204", None, ["wire-rod"], 66,
         "Low-carbon wire rod for drawing and cold heading.", "Nails, wire mesh, fasteners"),
    ],
    "carbon-steel": [
        ("en8", "EN8 (080M40)", "≈ C40 · AISI 1040", None, ALL_BARS + ["plate"], 75,
         "Unalloyed medium-carbon steel with good tensile strength; supplied normalised or bright.", "Shafts, studs, bolts, gears"),
        ("en9", "EN9 (070M55)", "≈ C55 · AISI 1055", None, ["round-bar", "flat-bar", "plate"], 80,
         "Higher-carbon steel for wear resistance; can be flame or induction hardened.", "Sprockets, cams, cutting tools"),
        ("c45", "C45", "EN 1.0503 · ≈ AISI 1045", None, ALL_BARS + ["plate"], 78,
         "European medium-carbon grade widely used for machined parts.", "Axles, spindles, pins"),
        ("aisi-1018", "AISI 1018", "≈ C15 · EN 1.0401", None, ["round-bar", "square-bar", "hex-bar", "flat-bar"], 72,
         "Low-carbon bright bar with excellent machinability and weldability; case-hardenable.", "Pins, spacers, machined parts"),
        ("astm-a105", "ASTM A105", "Carbon steel forging grade", None, ["round-bar"], 85,
         "Forged carbon steel for pressure-containing parts at ambient and higher temperatures.", "Flanges, fittings, valve bodies"),
        ("astm-a106-b", "ASTM A106 Gr. B", "≈ API 5L Gr. B", None, ["seamless-pipe"], 95,
         "Seamless carbon steel pipe for high-temperature service.", "Steam lines, refinery piping"),
    ],
    "alloy-steel": [
        ("en19", "EN19 (709M40)", "≈ 42CrMo4 · AISI 4140", None, None, 110,
         "Chromium-molybdenum steel with high tensile strength and toughness; hardenable.", "Shafts, gears, high-tensile bolts"),
        ("en24", "EN24 (817M40)", "≈ 34CrNiMo6 · AISI 4340", None, None, 125,
         "Nickel-chromium-molybdenum steel for heavily stressed components.", "Crankshafts, axles, heavy-duty gears"),
        ("en31", "EN31 (535A99)", "≈ 100Cr6 · AISI 52100", None, ["round-bar", "flat-bar", "plate"], 115,
         "High-carbon chromium bearing steel; very hard and wear resistant after hardening.", "Bearings, rollers, press tools"),
        ("en353", "EN353", "≈ 15NiCr13 (case-hardening)", None, ["round-bar", "flat-bar"], 110,
         "Nickel-chromium case-hardening steel with a tough core.", "Gears, pinions, cam shafts"),
        ("en36", "EN36 (655M13)", "≈ 14NiCr14", None, ["round-bar", "flat-bar"], 130,
         "High-nickel case-hardening steel for highly stressed carburised parts.", "Aircraft gears, heavy-duty shafts"),
        ("16mncr5", "16MnCr5", "EN 1.7131 · ≈ AISI 5115", None, ["round-bar", "square-bar", "flat-bar"], 100,
         "Manganese-chromium case-hardening steel.", "Gears, shafts, piston pins"),
        ("20mncr5", "20MnCr5", "EN 1.7147 · ≈ AISI 5120", None, ["round-bar", "square-bar", "flat-bar"], 105,
         "Case-hardening steel with a slightly stronger core than 16MnCr5.", "Transmission gears, spindles"),
    ],
    "tool-steel": [
        ("d2", "D2", "EN 1.2379 · X153CrMoV12", 7.70, None, 450,
         "High-carbon high-chromium cold-work steel with excellent wear resistance.", "Blanking dies, punches, shear blades"),
        ("d3", "D3", "EN 1.2080 · X210Cr12", 7.70, None, 380,
         "High-carbon chromium cold-work steel for long production runs.", "Drawing dies, forming tools"),
        ("o1-ohns", "O1 / OHNS", "EN 1.2510 · 100MnCrW4", 7.80, None, 300,
         "Oil-hardening non-shrinking tool steel; easy to heat-treat with low distortion.", "Gauges, punches, small dies"),
        ("h13", "H13", "EN 1.2344 · X40CrMoV5-1", 7.80, None, 450,
         "Chromium hot-work steel with high toughness and thermal-fatigue resistance.", "Die-casting dies, extrusion tooling"),
        ("m2", "M2 (HSS)", "EN 1.3343 · HS6-5-2", 8.16, ["round-bar", "flat-bar"], 1200,
         "Molybdenum-tungsten high-speed steel that keeps hardness at cutting temperatures.", "Drills, taps, tool bits"),
    ],
    "spring-steel": [
        ("en42j", "EN42J (080A78)", "≈ C75 / C80", None, ["flat-bar", "coil"], 110,
         "High-carbon spring steel in strip and flat form.", "Flat springs, clips, washers"),
        ("en47", "EN47 (735A51)", "≈ 50CrV4 · AISI 6150", None, ["round-bar", "flat-bar"], 120,
         "Chromium-vanadium spring steel with good fatigue strength.", "Leaf springs, torsion bars"),
        ("is-4454-sw", "IS 4454 spring wire", "Grade SW / DH", None, ["wire-rod"], 130,
         "Patented cold-drawn spring wire.", "Coil springs, wire forms"),
    ],
    "aluminium": [
        ("al-1050", "1050", "Al 99.5 · IS 19000", 2.71, ["sheet", "plate", "coil"], 290,
         "Commercially pure aluminium; very formable and conductive, low strength.", "Reflectors, chemical tanks, name plates"),
        ("al-1100", "1100", "Al 99.0 · IS 19500", 2.71, ["sheet", "coil", "perforated-sheet"], 295,
         "Commercially pure aluminium with slightly higher strength than 1050.", "Cookware, fins, spun parts"),
        ("al-2011", "2011", "AlCu6BiPb · EN AW-2011", 2.83, ["round-bar", "hex-bar"], 450,
         "Free-machining copper alloy for automatic lathe work; not weldable.", "Screw-machine parts, fittings"),
        ("al-2014", "2014 (HE15)", "AlCu4SiMg · EN AW-2014", 2.80, ["round-bar", "flat-bar", "plate"], 520,
         "High-strength heat-treatable copper alloy.", "Aircraft fittings, truck frames"),
        ("al-2024", "2024", "AlCu4Mg1 · EN AW-2024", 2.78, ["round-bar", "flat-bar", "sheet", "plate"], 700,
         "High-strength aerospace alloy with good fatigue resistance.", "Aircraft structures, rivets"),
        ("al-3003", "3003", "AlMn1Cu · EN AW-3003", 2.73, ["sheet", "coil", "chequered-plate", "perforated-sheet"], 300,
         "Manganese alloy, stronger than pure aluminium and very workable.", "Roofing, tanks, heat exchangers"),
        ("al-4032", "4032", "AlSi12.5MgCuNi", 2.68, ["round-bar"], 500,
         "Silicon alloy with low thermal expansion and good wear resistance.", "Pistons, compressor parts"),
        ("al-5052", "5052", "AlMg2.5 · EN AW-5052", 2.68, ["sheet", "plate", "coil", "chequered-plate", "perforated-sheet"], 340,
         "Magnesium alloy with good fatigue strength and sea-water resistance.", "Marine panels, fuel tanks, enclosures"),
        ("al-5083", "5083", "AlMg4.5Mn0.7 · EN AW-5083", 2.66, ["sheet", "plate"], 380,
         "Highest-strength non-heat-treatable alloy; excellent in sea water and weldable.", "Ship hulls, cryogenic tanks"),
        ("al-5754", "5754", "AlMg3 · EN AW-5754", 2.67, ["sheet", "plate", "chequered-plate"], 350,
         "Magnesium alloy with high corrosion resistance and good formability.", "Treadplate, vehicle bodies"),
        ("al-6061", "6061 (HE20)", "AlMg1SiCu · EN AW-6061", 2.70,
         ["round-bar", "square-bar", "hex-bar", "flat-bar", "sheet", "plate", "seamless-pipe"], 330,
         "Versatile heat-treatable alloy — good strength, machinability and weldability (T6).", "Machined parts, fixtures, frames"),
        ("al-6063", "6063 (HE9)", "AlMg0.7Si · EN AW-6063", 2.69,
         ["round-bar", "flat-bar", "seamless-pipe", "square-hollow", "rect-hollow", "equal-angle", "t-section"], 300,
         "The extrusion alloy — excellent surface finish and anodising response.", "Window frames, profiles, tubes"),
        ("al-6082", "6082 (HE30)", "AlSi1MgMn · EN AW-6082", 2.70,
         ["round-bar", "square-bar", "hex-bar", "flat-bar", "plate", "equal-angle"], 340,
         "Structural heat-treatable alloy, the highest-strength 6xxx.", "Structural members, cranes, bridges"),
        ("al-7075", "7075", "AlZn5.5MgCu · EN AW-7075", 2.81, ["round-bar", "square-bar", "flat-bar", "sheet", "plate"], 650,
         "Zinc alloy with the strength of many steels; aerospace and tooling grade.", "Aircraft parts, moulds, high-stress fittings"),
    ],
    "copper": [
        ("cu-etp", "ETP Copper", "Cu-ETP · C11000 · EN CW004A", 8.94,
         ["round-bar", "square-bar", "flat-bar", "sheet", "plate", "coil", "wire-rod"], 950,
         "Electrolytic tough-pitch copper, ≥ 99.90% Cu, for electrical conductors.", "Busbars, earthing, transformer windings"),
        ("cu-dhp", "DHP Copper", "Cu-DHP · C12200 · EN CW024A", 8.94, ["sheet", "coil", "seamless-pipe"], 930,
         "Phosphorus-deoxidised copper that brazes and welds well.", "Plumbing, refrigeration tubes, heat exchangers"),
    ],
    "brass": [
        ("brass-is-319", "Free-cutting Brass (IS 319)", "CuZn39Pb3 · C38500 · CW614N", 8.47, ["round-bar", "square-bar", "hex-bar"], 620,
         "Leaded brass with the best machinability of all copper alloys.", "Turned parts, valves, fittings"),
        ("brass-cuzn30", "CuZn30 (70/30 brass)", "C26000 · CW505L", 8.53, ["sheet", "flat-bar", "seamless-pipe"], 650,
         "Cartridge brass — excellent cold ductility for deep drawing.", "Cartridge cases, radiator cores"),
        ("brass-cuzn37", "CuZn37 (63/37 brass)", "C27200 · CW508L", 8.44, ["sheet", "plate", "flat-bar", "seamless-pipe"], 630,
         "General-purpose brass for pressing and tube work.", "Tubes, pressed parts, decorative"),
        ("brass-cuzn40", "CuZn40 (Muntz metal)", "C28000 · CW509L", 8.39, ["round-bar", "flat-bar", "plate"], 600,
         "60/40 brass, strong and hot-workable.", "Condenser plates, fasteners, architectural"),
    ],
    "bronze": [
        ("pb1", "Phosphor Bronze PB1", "BS 1400 PB1 · ≈ C90700", 8.80, None, 1100,
         "Cast/continuous-cast tin bronze with high wear resistance.", "Bearings, worm wheels, gears"),
        ("pb2", "Phosphor Bronze PB2", "BS 1400 PB2 · ≈ C90800", 8.70, None, 1150,
         "Higher-tin cast bronze for heavily loaded bearings and gears.", "Heavy-duty bushes, gears"),
        ("lg2", "Gunmetal LG2", "BS 1400 LG2 · ≈ C83600", 8.80, None, 900,
         "Leaded tin bronze with good castability and pressure tightness.", "Pump bodies, valves, bushes"),
        ("ab2", "Aluminium Bronze AB2", "BS 1400 AB2 · ≈ C95800", 7.64, None, 1000,
         "Nickel-aluminium bronze with high strength and sea-water resistance.", "Marine propellers, pump parts"),
    ],
    "nickel-alloys": [
        ("alloy-20", "Alloy 20", "UNS N08020 · EN 2.4660", 8.08, None, 2600,
         "Ni-Fe-Cr alloy designed for sulphuric acid service.", "Acid pickling, chemical process"),
        ("hastelloy-c22", "Hastelloy C-22", "UNS N06022 · EN 2.4602", 8.69, None, 5200,
         "Ni-Cr-Mo-W alloy resisting oxidising and reducing media.", "Pharma reactors, scrubbers"),
        ("hastelloy-c276", "Hastelloy C-276", "UNS N10276 · EN 2.4819", 8.89, None, 5500,
         "Ni-Mo-Cr alloy with outstanding resistance to severe corrosion.", "Flue-gas systems, chemical reactors"),
        ("incoloy-800", "Incoloy 800", "UNS N08800 · EN 1.4876", 7.94, None, 2200,
         "Fe-Ni-Cr alloy for high-temperature strength and oxidation resistance.", "Furnace components, heat exchangers"),
        ("incoloy-825", "Incoloy 825", "UNS N08825 · EN 2.4858", 8.14, None, 3000,
         "Ni-Fe-Cr alloy with Mo and Cu for acid and chloride environments.", "Oil & gas tubing, acid production"),
        ("inconel-600", "Inconel 600", "UNS N06600 · EN 2.4816", 8.47, None, 3500,
         "Ni-Cr alloy for high-temperature and corrosive service.", "Furnace parts, heat-treat fixtures"),
        ("inconel-601", "Inconel 601", "UNS N06601 · EN 2.4851", 8.11, None, 3600,
         "Ni-Cr-Al alloy with exceptional oxidation resistance.", "Radiant tubes, combustion chambers"),
        ("inconel-625", "Inconel 625", "UNS N06625 · EN 2.4856", 8.44, None, 4500,
         "Ni-Cr-Mo-Nb alloy with high strength and superb corrosion resistance.", "Aerospace ducting, sea-water parts"),
        ("inconel-718", "Inconel 718", "UNS N07718 · EN 2.4668", 8.19, None, 5000,
         "Precipitation-hardening superalloy for high strength to 700 °C.", "Jet-engine parts, fasteners"),
        ("monel-400", "Monel 400", "UNS N04400 · EN 2.4360", 8.80, None, 3000,
         "Ni-Cu alloy with excellent resistance to sea water and hydrofluoric acid.", "Marine fittings, pump shafts"),
        ("nickel-200", "Nickel 200", "UNS N02200 · EN 2.4066", 8.89, None, 2800,
         "Commercially pure wrought nickel for caustic environments.", "Caustic handling, electronics"),
    ],
    "titanium": [
        ("ti-grade-2", "Titanium Grade 2", "UNS R50400 · CP titanium", 4.51, None, 2800,
         "Commercially pure titanium — the most widely used grade for corrosion service.", "Heat exchangers, chemical plant, marine"),
        ("ti-grade-5", "Titanium Grade 5 (Ti-6Al-4V)", "UNS R56400 · EN 3.7165", 4.43, None, 4200,
         "Alpha-beta alloy with high strength-to-weight; the workhorse aerospace and implant grade.", "Aerospace, medical implants, motorsport"),
    ],
}


def q(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def arr_text(items):
    if items is None:
        return "null"
    return "array[" + ", ".join(q(i) for i in items) + "]::text[]"


def arr_num(items):
    return "array[" + ", ".join(repr(i) for i in items) + "]::numeric[]" if items else "'{}'::numeric[]"


def main():
    shape_slugs = {s[0] for s in SHAPES}
    out = [
        "-- =====================================================================",
        "-- MECHmetrIQ — Raw Material Marketplace starter catalogue (GENERATED)",
        "-- Source: supabase/scripts/gen_rm_catalog_seed.py — edit there, re-run.",
        "-- Rates are INDICATIVE placeholders (₹/kg excl. GST); update them in",
        "-- Admin → Raw Material Marketplace → Rate card before go-live.",
        "-- Idempotent: re-running updates catalogue text but never overwrites",
        "-- rates that already exist.",
        "-- =====================================================================",
        "",
        "insert into public.rm_shapes (slug, name, family, formula, sell_by, hsn_key, rate_premium_pct,",
        "  std_lengths, std_sheet_sizes, dims, description, sort_order) values",
    ]
    rows = []
    for i, (slug, name, fam, formula, sell_by, hsn_key, prem, lengths, sizes, dims, desc) in enumerate(SHAPES):
        rows.append(
            f"({q(slug)}, {q(name)}, {q(fam)}, {q(formula)}, {q(sell_by)}, {q(hsn_key)}, {prem}, "
            f"{arr_num(lengths)}, {q(json.dumps(sizes, separators=(',', ':')))}::jsonb, "
            f"{q(json.dumps(dims, separators=(',', ':'), ensure_ascii=False))}::jsonb, {q(desc)}, {i + 1})"
        )
    out.append(",\n".join(rows))
    out.append(
        "on conflict (slug) do update set name = excluded.name, family = excluded.family, formula = excluded.formula,\n"
        "  sell_by = excluded.sell_by, hsn_key = excluded.hsn_key, std_lengths = excluded.std_lengths,\n"
        "  std_sheet_sizes = excluded.std_sheet_sizes, dims = excluded.dims, description = excluded.description,\n"
        "  sort_order = excluded.sort_order;\n"
    )
    out.append("insert into public.rm_materials (slug, name, short_name, density, hsn_codes, gst_rate, description, sort_order) values")
    rows = []
    for i, (slug, name, short, dens, hsn, desc) in enumerate(MATERIALS):
        rows.append(f"({q(slug)}, {q(name)}, {q(short)}, {dens}, {q(json.dumps(hsn, separators=(',', ':')))}::jsonb, 18, {q(desc)}, {i + 1})")
    out.append(",\n".join(rows))
    out.append(
        "on conflict (slug) do update set name = excluded.name, short_name = excluded.short_name, density = excluded.density,\n"
        "  hsn_codes = excluded.hsn_codes, description = excluded.description, sort_order = excluded.sort_order;\n"
    )
    out.append("insert into public.rm_shape_materials (shape_id, material_id)")
    out.append("select s.id, m.id from (values")
    rows = []
    for mslug, shapes in SHAPE_MATERIALS.items():
        for sslug in shapes:
            assert sslug in shape_slugs, sslug
            rows.append(f"({q(mslug)}, {q(sslug)})")
    out.append(",\n".join(rows))
    out.append(") v(material, shape)\njoin public.rm_materials m on m.slug = v.material\njoin public.rm_shapes s on s.slug = v.shape\non conflict do nothing;\n")

    seen = set()
    grows = []
    for mslug, grades in GRADES.items():
        offered = set(SHAPE_MATERIALS[mslug])
        for i, (gslug, name, eq, dens, shapes, rate, desc, apps) in enumerate(grades):
            assert gslug not in seen, gslug
            seen.add(gslug)
            if shapes is not None:
                bad = set(shapes) - offered
                assert not bad, f"{gslug}: {bad} not offered for {mslug}"
            grows.append(
                f"({q(mslug)}, {q(gslug)}, {q(name)}, {q(eq)}, {q(desc)}, {q(apps)}, {q(dens)}::numeric, "
                f"{arr_text(shapes)}, {i + 1}, {rate}::numeric)"
            )
    out.append("create temporary table _rm_seed_grades (material text, slug text, name text, equivalents text,")
    out.append("  description text, applications text, density numeric, shape_slugs text[], sort_order int, rate numeric) on commit drop;")
    out.append("insert into _rm_seed_grades values")
    out.append(",\n".join(grows) + ";\n")
    out.append(
        "insert into public.rm_grades (material_id, slug, name, equivalents, description, applications, density, shape_slugs, sort_order)\n"
        "select m.id, g.slug, g.name, g.equivalents, g.description, g.applications, g.density, g.shape_slugs, g.sort_order\n"
        "from _rm_seed_grades g join public.rm_materials m on m.slug = g.material\n"
        "on conflict (material_id, slug) do update set name = excluded.name, equivalents = excluded.equivalents,\n"
        "  description = excluded.description, applications = excluded.applications, density = excluded.density,\n"
        "  shape_slugs = excluded.shape_slugs, sort_order = excluded.sort_order;\n"
    )
    out.append(
        "insert into public.rm_rates (grade_id, shape_id, rate_per_kg)\n"
        "select rg.id, null, g.rate\n"
        "from _rm_seed_grades g\n"
        "join public.rm_materials m on m.slug = g.material\n"
        "join public.rm_grades rg on rg.material_id = m.id and rg.slug = g.slug\n"
        "where not exists (select 1 from public.rm_rates r where r.grade_id = rg.id and r.shape_id is null);\n"
    )
    out.append("drop table if exists _rm_seed_grades;")
    OUT.write_text("\n".join(out) + "\n", encoding="utf-8")
    n_grades = sum(len(v) for v in GRADES.values())
    print(f"wrote {OUT.name}: {len(SHAPES)} shapes, {len(MATERIALS)} materials, {n_grades} grades")


if __name__ == "__main__":
    main()
