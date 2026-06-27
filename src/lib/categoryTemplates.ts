/**
 * Master classification taxonomy — the single shared hierarchy used across
 * Elements, Vendors, BOQ, RFQs, POs and reporting (see docs/shared-taxonomy-plan.md).
 *
 * Three levels: Category (L1) -> Sub-category (L2) -> Service Area (L3), each with a
 * path code (KIT / KIT-CAB / KIT-CAB-BASE). Seeded via the "Use a starter set" flow;
 * names are editable in-app afterwards. Transcribed from the Arch PRD taxonomy tab.
 */

export interface SeedNode {
  name: string;
  /** Path code stored in element_category.code_prefix (e.g. KIT-CAB-BASE). */
  codePrefix?: string;
  children?: SeedNode[];
}

export interface SeedCategory extends SeedNode {
  /** Top-level categories always carry a code (KIT, JOIN, FLR, …). */
  codePrefix: string;
  icon: string;
  color: string;
}

export const MASTER_TAXONOMY: ReadonlyArray<SeedCategory> = [
  {
    name: "Kitchen",
    codePrefix: "KIT",
    icon: "ChefHat",
    color: "#f59e0b",
    children: [
      {
        name: "Cabinets",
        codePrefix: "KIT-CAB",
        children: [
          { name: "Base Cabinets", codePrefix: "KIT-CAB-BASE" },
          { name: "Wall Cabinets", codePrefix: "KIT-CAB-WALL" },
          { name: "Tall Units", codePrefix: "KIT-CAB-TALL" },
          { name: "Kitchen Islands", codePrefix: "KIT-CAB-ISL" },
        ],
      },
      {
        name: "Countertops",
        codePrefix: "KIT-CTR",
        children: [
          { name: "Granite Countertops", codePrefix: "KIT-CTR-GRN" },
          { name: "Quartz Countertops", codePrefix: "KIT-CTR-QTZ" },
        ],
      },
      {
        name: "Accessories",
        codePrefix: "KIT-ACC",
        children: [{ name: "Kitchen Hardware", codePrefix: "KIT-ACC-HDW" }],
      },
      {
        name: "Appliances",
        codePrefix: "KIT-APP",
        children: [
          { name: "Hobs & Cooktops", codePrefix: "KIT-APP-HOB" },
          { name: "Chimneys/Hoods", codePrefix: "KIT-APP-HOD" },
          { name: "Built-in Ovens", codePrefix: "KIT-APP-OVN" },
        ],
      },
    ],
  },
  {
    name: "Joinery & Carpentry",
    codePrefix: "JOIN",
    icon: "Hammer",
    color: "#a3a3a3",
    children: [
      {
        name: "Wardrobes",
        codePrefix: "JOIN-WRD",
        children: [
          { name: "Sliding Wardrobes", codePrefix: "JOIN-WRD-SLD" },
          { name: "Hinged Wardrobes", codePrefix: "JOIN-WRD-HNG" },
        ],
      },
      {
        name: "Furniture",
        codePrefix: "JOIN-FUR",
        children: [
          { name: "TV Units", codePrefix: "JOIN-FUR-TV" },
          { name: "Study Tables", codePrefix: "JOIN-FUR-STY" },
          { name: "Reception Counters", codePrefix: "JOIN-FUR-RCP" },
        ],
      },
      {
        name: "Paneling",
        codePrefix: "JOIN-PNL",
        children: [{ name: "Wall Paneling", codePrefix: "JOIN-PNL-WAL" }],
      },
      {
        name: "Shelving",
        codePrefix: "JOIN-SHL",
        children: [{ name: "Decorative Shelving", codePrefix: "JOIN-SHL-DEC" }],
      },
      {
        name: "Doors",
        codePrefix: "JOIN-DRS",
        children: [{ name: "Wooden Doors", codePrefix: "JOIN-DRS-WOD" }],
      },
    ],
  },
  {
    name: "Flooring",
    codePrefix: "FLR",
    icon: "Layers",
    color: "#8b5cf6",
    children: [
      {
        name: "Tiles",
        codePrefix: "FLR-TIL",
        children: [
          { name: "Porcelain Tiles", codePrefix: "FLR-TIL-POR" },
          { name: "Ceramic Tiles", codePrefix: "FLR-TIL-CER" },
        ],
      },
      {
        name: "Stone",
        codePrefix: "FLR-STN",
        children: [
          { name: "Marble Flooring", codePrefix: "FLR-STN-MRB" },
          { name: "Granite Flooring", codePrefix: "FLR-STN-GRN" },
        ],
      },
      {
        name: "Wood",
        codePrefix: "FLR-WOD",
        children: [
          { name: "Engineered Wood Flooring", codePrefix: "FLR-WOD-ENG" },
          { name: "Laminate Flooring", codePrefix: "FLR-WOD-LAM" },
        ],
      },
      {
        name: "Vinyl",
        codePrefix: "FLR-VIN",
        children: [{ name: "SPC Flooring", codePrefix: "FLR-VIN-SPC" }],
      },
      {
        name: "Skirting",
        codePrefix: "FLR-SKR",
        children: [{ name: "PVC Skirting", codePrefix: "FLR-SKR-PVC" }],
      },
    ],
  },
  {
    name: "Ceilings",
    codePrefix: "CLG",
    icon: "PanelsTopLeft",
    color: "#0ea5e9",
    children: [
      {
        name: "Gypsum",
        codePrefix: "CLG-GYP",
        children: [
          { name: "Gypsum False Ceiling", codePrefix: "CLG-GYP-FLS" },
          { name: "Bulkheads", codePrefix: "CLG-GYP-BLK" },
        ],
      },
      {
        name: "Metal",
        codePrefix: "CLG-MTL",
        children: [{ name: "Metal Grid Ceiling", codePrefix: "CLG-MTL-GRD" }],
      },
      {
        name: "Wood",
        codePrefix: "CLG-WOD",
        children: [
          { name: "Wooden Ceiling Panels", codePrefix: "CLG-WOD-PNL" },
        ],
      },
    ],
  },
  {
    name: "Paint & Finishes",
    codePrefix: "FIN",
    icon: "PaintBucket",
    color: "#ec4899",
    children: [
      {
        name: "Paint",
        codePrefix: "FIN-PNT",
        children: [
          { name: "Interior Painting", codePrefix: "FIN-PNT-INT" },
          { name: "Exterior Painting", codePrefix: "FIN-PNT-EXT" },
        ],
      },
      {
        name: "Polish",
        codePrefix: "FIN-POL",
        children: [
          { name: "PU Polish", codePrefix: "FIN-POL-PU" },
          { name: "Duco Finish", codePrefix: "FIN-POL-DUC" },
        ],
      },
      {
        name: "Wall Coverings",
        codePrefix: "FIN-WAL",
        children: [{ name: "Wallpaper", codePrefix: "FIN-WAL-WPP" }],
      },
      {
        name: "Texture",
        codePrefix: "FIN-TXT",
        children: [
          { name: "Decorative Texture Finish", codePrefix: "FIN-TXT-DEC" },
        ],
      },
    ],
  },
  {
    name: "Doors, Windows & Glass",
    codePrefix: "DWG",
    icon: "DoorOpen",
    color: "#06b6d4",
    children: [
      {
        name: "Doors",
        codePrefix: "DWG-DRS",
        children: [
          { name: "Flush Doors", codePrefix: "DWG-DRS-FLS" },
          { name: "Fire Rated Doors", codePrefix: "DWG-DRS-FIR" },
        ],
      },
      {
        name: "Windows",
        codePrefix: "DWG-WIN",
        children: [
          { name: "UPVC Windows", codePrefix: "DWG-WIN-UPV" },
          { name: "Aluminium Windows", codePrefix: "DWG-WIN-ALU" },
        ],
      },
      {
        name: "Glass",
        codePrefix: "DWG-GLS",
        children: [{ name: "Toughened Glass", codePrefix: "DWG-GLS-TGH" }],
      },
      {
        name: "Partitions",
        codePrefix: "DWG-PAR",
        children: [
          { name: "Office Glass Partitions", codePrefix: "DWG-PAR-OFC" },
          { name: "Shower Partitions", codePrefix: "DWG-PAR-SHW" },
        ],
      },
    ],
  },
  {
    name: "Electrical",
    codePrefix: "ELC",
    icon: "Zap",
    color: "#eab308",
    children: [
      {
        name: "Wiring",
        codePrefix: "ELC-WIR",
        children: [
          { name: "Power Wiring", codePrefix: "ELC-WIR-PWR" },
          { name: "Lighting Wiring", codePrefix: "ELC-WIR-LGT" },
        ],
      },
      {
        name: "Panels",
        codePrefix: "ELC-PNL",
        children: [{ name: "Distribution Boards", codePrefix: "ELC-PNL-DB" }],
      },
      {
        name: "Switches",
        codePrefix: "ELC-SWT",
        children: [{ name: "Modular Switches", codePrefix: "ELC-SWT-MOD" }],
      },
      {
        name: "Low Voltage",
        codePrefix: "ELC-ELV",
        children: [
          { name: "Data Cabling", codePrefix: "ELC-ELV-DAT" },
          { name: "CCTV Systems", codePrefix: "ELC-ELV-CCTV" },
          { name: "Access Control Systems", codePrefix: "ELC-ELV-ACS" },
        ],
      },
    ],
  },
  {
    name: "Lighting",
    codePrefix: "LGT",
    icon: "Lightbulb",
    color: "#facc15",
    children: [
      {
        name: "Ambient",
        codePrefix: "LGT-AMB",
        children: [
          { name: "Downlights", codePrefix: "LGT-AMB-DWN" },
          { name: "LED Strip Lights", codePrefix: "LGT-AMB-STR" },
        ],
      },
      {
        name: "Decorative",
        codePrefix: "LGT-DEC",
        children: [
          { name: "Chandeliers", codePrefix: "LGT-DEC-CHD" },
          { name: "Pendant Lights", codePrefix: "LGT-DEC-PEN" },
        ],
      },
      {
        name: "Outdoor",
        codePrefix: "LGT-OUT",
        children: [
          { name: "Facade Lighting", codePrefix: "LGT-OUT-FCD" },
          { name: "Landscape Lighting", codePrefix: "LGT-OUT-LND" },
        ],
      },
    ],
  },
  {
    name: "Plumbing & Sanitary",
    codePrefix: "PLB",
    icon: "Droplet",
    color: "#10b981",
    children: [
      {
        name: "Piping",
        codePrefix: "PLB-PIP",
        children: [
          { name: "Water Supply Piping", codePrefix: "PLB-PIP-WTR" },
          { name: "Drainage Piping", codePrefix: "PLB-PIP-DRN" },
        ],
      },
      {
        name: "Fixtures",
        codePrefix: "PLB-FIX",
        children: [
          { name: "WC Installation", codePrefix: "PLB-FIX-WC" },
          { name: "Wash Basins", codePrefix: "PLB-FIX-BSN" },
          { name: "Shower Systems", codePrefix: "PLB-FIX-SHW" },
        ],
      },
      {
        name: "Pumps",
        codePrefix: "PLB-PMP",
        children: [{ name: "Booster Pumps", codePrefix: "PLB-PMP-BST" }],
      },
    ],
  },
  {
    name: "HVAC",
    codePrefix: "HVAC",
    icon: "Wind",
    color: "#14b8a6",
    children: [
      {
        name: "Air Conditioning",
        codePrefix: "HVAC-AC",
        children: [
          { name: "Split AC Systems", codePrefix: "HVAC-AC-SPL" },
          { name: "VRF Systems", codePrefix: "HVAC-AC-VRF" },
        ],
      },
      {
        name: "Ducting",
        codePrefix: "HVAC-DCT",
        children: [{ name: "GI Ducting", codePrefix: "HVAC-DCT-GAL" }],
      },
      {
        name: "Ventilation",
        codePrefix: "HVAC-VNT",
        children: [
          { name: "Exhaust Systems", codePrefix: "HVAC-VNT-EXH" },
          { name: "Fresh Air Systems", codePrefix: "HVAC-VNT-FRS" },
        ],
      },
    ],
  },
  {
    name: "Fire & Safety",
    codePrefix: "FIRE",
    icon: "Flame",
    color: "#ef4444",
    children: [
      {
        name: "Fire Fighting",
        codePrefix: "FIRE-FFT",
        children: [
          { name: "Sprinkler Systems", codePrefix: "FIRE-FFT-SPR" },
          { name: "Hose Reel Systems", codePrefix: "FIRE-FFT-HRE" },
        ],
      },
      {
        name: "Detection",
        codePrefix: "FIRE-DET",
        children: [
          { name: "Smoke Detectors", codePrefix: "FIRE-DET-SMK" },
          { name: "Fire Alarm Systems", codePrefix: "FIRE-DET-ALM" },
        ],
      },
      {
        name: "Emergency",
        codePrefix: "FIRE-EMG",
        children: [{ name: "Emergency Lighting", codePrefix: "FIRE-EMG-LGT" }],
      },
    ],
  },
  {
    name: "Civil & Masonry",
    codePrefix: "CIV",
    icon: "BrickWall",
    color: "#f97316",
    children: [
      {
        name: "Masonry",
        codePrefix: "CIV-MAS",
        children: [
          { name: "Brickwork", codePrefix: "CIV-MAS-BRK" },
          { name: "Blockwork", codePrefix: "CIV-MAS-BLK" },
        ],
      },
      {
        name: "Plastering",
        codePrefix: "CIV-PLS",
        children: [{ name: "Wall Plastering", codePrefix: "CIV-PLS-WAL" }],
      },
      {
        name: "Concrete",
        codePrefix: "CIV-CON",
        children: [{ name: "RCC Works", codePrefix: "CIV-CON-RCC" }],
      },
      {
        name: "Demolition",
        codePrefix: "CIV-DEM",
        children: [{ name: "Interior Demolition", codePrefix: "CIV-DEM-INT" }],
      },
    ],
  },
  {
    name: "Metal & Fabrication",
    codePrefix: "MET",
    icon: "Wrench",
    color: "#64748b",
    children: [
      {
        name: "Steel",
        codePrefix: "MET-STE",
        children: [{ name: "Structural Steel", codePrefix: "MET-STE-STR" }],
      },
      {
        name: "Railings",
        codePrefix: "MET-RAI",
        children: [
          { name: "Stainless Railings", codePrefix: "MET-RAI-SS" },
          { name: "Mild Steel Railings", codePrefix: "MET-RAI-MS" },
        ],
      },
      {
        name: "Fabrication",
        codePrefix: "MET-FAB",
        children: [
          { name: "Pergolas", codePrefix: "MET-FAB-PRG" },
          { name: "Custom Fabrication", codePrefix: "MET-FAB-CUS" },
        ],
      },
    ],
  },
  {
    name: "FF&E",
    codePrefix: "FFE",
    icon: "Armchair",
    color: "#d946ef",
    children: [
      {
        name: "Furniture",
        codePrefix: "FFE-FUR",
        children: [
          { name: "Sofas", codePrefix: "FFE-FUR-SOF" },
          { name: "Beds", codePrefix: "FFE-FUR-BED" },
          { name: "Dining Tables", codePrefix: "FFE-FUR-DIN" },
        ],
      },
      {
        name: "Office",
        codePrefix: "FFE-OFC",
        children: [
          { name: "Office Chairs", codePrefix: "FFE-OFC-CHR" },
          { name: "Office Desks", codePrefix: "FFE-OFC-DSK" },
        ],
      },
      {
        name: "Decor",
        codePrefix: "FFE-DEC",
        children: [
          { name: "Artwork", codePrefix: "FFE-DEC-ART" },
          { name: "Mirrors", codePrefix: "FFE-DEC-MRR" },
        ],
      },
    ],
  },
];
