"""
scripts/extract_cgwb_water_quality.py

Extracts REAL data from CGWB Annual Ground Water Quality Report 2025 PDF.

State-level source pages (actual PDF tables):
  Fluoride : Page 44, Table 7  (14,978 total samples, 32 states listed)
  Nitrate  : Page 55, Table 10 (14,978 total samples, 31 states listed)
  Arsenic  : Page 65, Table 13 (3,415 total samples, 32 states listed, ppb units)

Hotspot source pages (real point measurements):
  Nitrate  : Pages 98-99 (73 rows, mg/L)
  Arsenic  : Pages 99-100 (43 rows, ppb -> converted to mg/L)
  Fluoride : Pages 100-102 (99 rows, mg/L)

States missing from a contaminant table are stored with NULL samples/pct.

Run: python scripts/extract_cgwb_water_quality.py
"""
import sys, os, re, csv
import pdfplumber
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

PDF = "data/cgwb_full.pdf"
BIS = {"fluoride": 1.5, "arsenic": 0.01, "nitrate": 45.0}

def risk_level(pct):
    if pct is None: return None
    if pct < 5:  return "low"
    if pct < 20: return "moderate"
    if pct < 40: return "high"
    return "very_high"

def severity_ef(ef):
    if ef is None: return None
    if ef < 2:  return "moderate"
    if ef < 5:  return "high"
    return "very_high"

def norm_state(s):
    if not s: return ""
    s = s.strip()
    MAP = {
        "NCT of Delhi": "Delhi",
        "UT of Puducherry": "Puducherry",
        "Chandigarh UT": "Chandigarh",
        "Dadra Nagar Haveli & Daman - Diu": "Dadra & Nagar Haveli and Daman & Diu",
        "Dadra and Nagar Haveli and Daman and Diu": "Dadra & Nagar Haveli and Daman & Diu",
        "A&N Islands": "Andaman & Nicobar Islands",
        "Andaman & Nicobar Islands": "Andaman & Nicobar Islands",
        "Andaman and Nicobar": "Andaman & Nicobar Islands",
        "Jammu & Kashmir": "Jammu & Kashmir",
        "Jammu and Kashmir": "Jammu & Kashmir",
        "Jammu & Kashmir\n": "Jammu & Kashmir",
    }
    return MAP.get(s, s)

# ── Extract state-level tables from PDF ───────────────────────────────────────

print("Extracting state-level tables from PDF...")
fluoride_data = {}  # state -> (analyzed, exceeding, pct)
nitrate_data  = {}
arsenic_data  = {}

with pdfplumber.open(PDF) as pdf:

    # ── Fluoride: Page 44 (index 43) ─────────────────────────────────────────
    fl_table = pdf.pages[43].extract_tables()[0]
    for row in fl_table:
        if not row[1] or not str(row[1]).strip().isdigit(): continue
        state = norm_state(row[3])
        try:
            analyzed   = int(row[4])
            exceeding  = int(row[5])
            pct        = float(row[6])
            fluoride_data[state] = (analyzed, exceeding, pct)
        except (ValueError, TypeError):
            pass
    print(f"  Fluoride: {len(fluoride_data)} states")

    # ── Nitrate: Page 55 (index 54) ──────────────────────────────────────────
    ni_table = pdf.pages[54].extract_tables()[0]
    for row in ni_table:
        if not row[1] or not str(row[1]).strip().isdigit(): continue
        state = norm_state(row[3])
        try:
            analyzed  = int(row[4])
            exceeding = int(row[5])
            pct       = round(exceeding / analyzed * 100, 2) if analyzed else 0.0
            nitrate_data[state] = (analyzed, exceeding, pct)
        except (ValueError, TypeError):
            pass
    print(f"  Nitrate:  {len(nitrate_data)} states")

    # ── Arsenic: Page 65 (index 64) ──────────────────────────────────────────
    # Columns: Sl, District, No.Samples (pre+post), No.>10ppb Pre-M, No.>10ppb Post-M
    as_table = pdf.pages[64].extract_tables()[0]
    for row in as_table:
        if not row[1] or not str(row[1]).strip().isdigit(): continue
        state = norm_state(row[3])
        try:
            analyzed  = int(row[4]) if row[4] and row[4].strip() else 0
            # Use pre-monsoon exceedance (col 7)
            exceed_pre  = int(row[7])  if row[7]  and row[7].strip()  else 0
            pct = round(exceed_pre / analyzed * 100, 2) if analyzed else 0.0
            arsenic_data[state] = (analyzed, exceed_pre, pct)
        except (ValueError, TypeError):
            pass
    print(f"  Arsenic:  {len(arsenic_data)} states")

# ── Full list of 36 states/UTs ────────────────────────────────────────────────
ALL_STATES = [
    "Andaman & Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh",
    "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
    "Dadra & Nagar Haveli and Daman & Diu", "Delhi", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jammu & Kashmir", "Jharkhand",
    "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
    "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
    "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
    "Uttarakhand", "West Bengal",
]

# Known high-risk districts (from CGWB narrative and hotspot tables — only where documented)
KNOWN_HIGH_RISK = {
    "Rajasthan":       ["Karauli", "Bharatpur", "Jaipur", "Tonk", "Bundi"],
    "Gujarat":         ["Porbandar", "Devbhumi Dwarka", "Jamnagar", "Surendranagar", "Kachchh", "Patan", "Ahmedabad", "Sabarkantha"],
    "Haryana":         ["Rohtak", "Jhajjar"],
    "Delhi":           ["North", "North West"],
    "Karnataka":       ["Kolar", "Tumkur"],
    "Telangana":       ["Nalgonda", "Suryapet", "Mahabubnagar"],
    "Punjab":          ["Amritsar", "Raebareli"],
    "Andhra Pradesh":  ["Bapatla", "Guntur", "Nellore", "Palnadu", "Prakasam", "Annamayya", "Kurnool", "Tirupati"],
    "Uttar Pradesh":   ["Jhansi", "Kannauj", "Raebareli", "Pratapgarh", "Sonbhadra", "Lakhimpur Kheri", "Bijnor", "Pilibhit"],
    "Madhya Pradesh":  ["Betul", "Alirajpur", "Singrauli", "Gwalior", "Seoni"],
    "West Bengal":     ["Nadia"],
    "Bihar":           ["East Champaran", "Muzaffarpur"],
    "Chhattisgarh":    ["Gariyaband"],
}

# ── Build state rows ──────────────────────────────────────────────────────────
rows = []
for state in ALL_STATES:
    fl = fluoride_data.get(state)
    ni = nitrate_data.get(state)
    as_ = arsenic_data.get(state)

    fl_pct = fl[2] if fl else None
    ni_pct = ni[2] if ni else None
    as_pct = as_[2] if as_ else None

    fl_risk = risk_level(fl_pct)
    ni_risk = risk_level(ni_pct)
    as_risk = risk_level(as_pct)

    risk_order = {"very_high": 4, "high": 3, "moderate": 2, "low": 1, None: 0}
    overall = max([fl_risk, ni_risk, as_risk], key=lambda r: risk_order.get(r, 0))

    rows.append({
        "state_name":                state,
        "fluoride_pct_exceeding":    fl_pct,
        "fluoride_risk_level":       fl_risk,
        "fluoride_samples_analyzed": fl[0] if fl else None,
        "fluoride_samples_exceeding":fl[1] if fl else None,
        "nitrate_pct_exceeding":     ni_pct,
        "nitrate_risk_level":        ni_risk,
        "nitrate_samples_analyzed":  ni[0] if ni else None,
        "nitrate_samples_exceeding": ni[1] if ni else None,
        "arsenic_pct_exceeding":     as_pct,
        "arsenic_risk_level":        as_risk,
        "arsenic_samples_analyzed":  as_[0] if as_ else None,
        "arsenic_samples_exceeding": as_[1] if as_ else None,
        "overall_water_risk":        overall,
        "total_samples_in_state":    fl[0] if fl else (ni[0] if ni else None),
        "known_high_risk_districts": "|".join(KNOWN_HIGH_RISK.get(state, [])),
        "monitoring_season":         "Pre-Monsoon 2024",
        "data_source":               "cgwb_annual_report",
        "data_as_of_year":           2024,
    })

df_state = pd.DataFrame(rows)
os.makedirs("data/output", exist_ok=True)
df_state.to_csv("data/output/water_quality_state.csv", index=False)
print(f"\nSaved {len(df_state)} state rows -> data/output/water_quality_state.csv")
print("\nSample (top 10 by fluoride %):")
print(df_state.dropna(subset=["fluoride_pct_exceeding"])
      .nlargest(10, "fluoride_pct_exceeding")
      [["state_name","fluoride_pct_exceeding","nitrate_pct_exceeding","arsenic_pct_exceeding","overall_water_risk"]]
      .to_string(index=False))

# ── Extract hotspot data from PDF ─────────────────────────────────────────────
print("\n\nExtracting hotspot data from PDF...")

hotspot_rows = []

def parse_hotspot_table(table, contaminant, conc_col_idx, skip_header_rows=3):
    """Parse a hotspot table. conc_col_idx = last column index for concentration."""
    rows = []
    for row in table[skip_header_rows:]:
        # Find hotspot number (first non-None numeric value)
        hs_no = None
        for cell in row[:3]:
            if cell and str(cell).strip().isdigit():
                hs_no = int(cell)
                break
        if hs_no is None: continue

        state    = norm_state(row[3]) if row[3] else None
        district = row[4].replace('\n', ' ').strip() if row[4] else None
        block    = row[5].replace('\n', ' ').strip() if row[5] else None

        # Village/location: different tables have it at different col indices
        village = None
        lng = None
        lat = None
        source = None
        conc = None

        try:
            if contaminant == "nitrate":
                # Cols: [idx,hs,idx,state,district,block,village,lng,lat,source,conc]
                village = row[6].replace('\n',' ').strip() if row[6] else None
                lng     = float(row[7]) if row[7] else None
                lat     = float(row[8]) if row[8] else None
                source  = row[9].replace('\n',' ').strip() if row[9] else None
                conc    = float(row[10]) if row[10] else None
            elif contaminant == "arsenic":
                # Cols: [idx,hs,idx,state,district,block,idx,village,idx,lng,lat,source,conc(ppb)]
                village = row[7].replace('\n',' ').strip() if row[7] else None
                lng     = float(row[9])  if row[9]  else None
                lat     = float(row[10]) if row[10] else None
                source  = row[11].replace('\n',' ').strip() if row[11] else None
                conc_ppb = float(row[12]) if row[12] else None
                conc    = round(conc_ppb / 1000, 6) if conc_ppb else None  # ppb -> mg/L
            elif contaminant == "fluoride":
                # Cols: [idx,hs,idx,state,district,block,village,lng,lat,source,conc]
                village = row[6].replace('\n',' ').strip() if row[6] else None
                lng     = float(row[7]) if row[7] else None
                lat     = float(row[8]) if row[8] else None
                source  = row[9].replace('\n',' ').strip() if row[9] else None
                conc    = float(row[10]) if row[10] else None
        except (ValueError, TypeError, IndexError):
            return rows  # stop on parse error for this table

        if conc is None or state is None: continue

        bis = BIS[contaminant]
        ef  = round(conc / bis, 3) if conc else None
        rows.append({
            "hotspot_no":       hs_no,
            "state_name":       state,
            "district":         district,
            "block_taluka":     block,
            "village":          village,
            "lat":              lat,
            "lng":              lng,
            "source_type":      source,
            "contaminant":      contaminant,
            "concentration":    conc,
            "unit":             "mg/L",
            "bis_limit":        bis,
            "exceedance_factor": ef,
            "severity":         severity_ef(ef),
            "data_as_of_year":  2024,
            "data_source":      "cgwb_annual_report",
        })
    return rows

with pdfplumber.open(PDF) as pdf:

    # ── Nitrate hotspots: pages 98-99 (indices 97-98) ─────────────────────────
    print("  Parsing nitrate hotspots (pages 98-99)...")
    for page_idx in [97, 98]:
        tables = pdf.pages[page_idx].extract_tables()
        for t in tables:
            if len(t) < 4: continue
            # Identify nitrate table by header
            header_str = str(t[0])
            if 'Nitrate' in header_str and 'mg/L' in header_str:
                r = parse_hotspot_table(t, "nitrate", 10)
                hotspot_rows.extend(r)
                print(f"    Page {page_idx+1}: {len(r)} rows")

    # ── Arsenic hotspots: pages 99-100 (indices 98-99) ────────────────────────
    print("  Parsing arsenic hotspots (pages 99-100)...")
    for page_idx in [98, 99]:
        tables = pdf.pages[page_idx].extract_tables()
        for t in tables:
            if len(t) < 4: continue
            header_str = str(t[0])
            if 'As' in header_str and 'ppb' in header_str.lower():
                r = parse_hotspot_table(t, "arsenic", 12)
                hotspot_rows.extend(r)
                print(f"    Page {page_idx+1}: {len(r)} rows")

    # ── Fluoride hotspots: pages 100-102 (indices 99-101) ─────────────────────
    print("  Parsing fluoride hotspots (pages 100-102)...")
    for page_idx in [99, 100, 101]:
        tables = pdf.pages[page_idx].extract_tables()
        for t in tables:
            if len(t) < 4: continue
            header_str = str(t[0])
            if ('F\n(mg/L)' in header_str or "F\n(mg/L" in header_str
                    or "'F'" in header_str or 'mg/L' in header_str) and 'As' not in header_str and 'Nitrate' not in header_str and 'EC' not in header_str:
                r = parse_hotspot_table(t, "fluoride", 10)
                hotspot_rows.extend(r)
                print(f"    Page {page_idx+1}: {len(r)} rows")

# Deduplicate by hotspot_no + contaminant
df_hs = pd.DataFrame(hotspot_rows)
if not df_hs.empty:
    df_hs = df_hs.drop_duplicates(subset=["hotspot_no","contaminant"], keep="first")
    df_hs = df_hs.sort_values(["contaminant","hotspot_no"])

print(f"\nTotal hotspot rows: {len(df_hs)}")
if not df_hs.empty:
    print(df_hs.groupby("contaminant")[["hotspot_no"]].count().rename(columns={"hotspot_no":"count"}))

    # Clean all string fields to remove embedded newlines
    for col in ["village","block_taluka","district","source_type","state_name"]:
        if col in df_hs.columns:
            df_hs[col] = df_hs[col].astype(str).str.replace('\n', ' ', regex=False).str.strip()
            df_hs[col] = df_hs[col].replace('nan', None)
    df_hs.to_csv("data/output/water_quality_hotspots.csv", index=False, quoting=csv.QUOTE_ALL)
    print(f"Saved -> data/output/water_quality_hotspots.csv")

    print("\nTop 5 by exceedance factor:")
    print(df_hs.nlargest(5,"exceedance_factor")[
        ["contaminant","state_name","district","concentration","bis_limit","exceedance_factor"]
    ].to_string(index=False))
else:
    print("WARNING: No hotspot rows extracted — check PDF parsing")

print("\nDone. Run: node scripts/load_water_quality.mjs")
