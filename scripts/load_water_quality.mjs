/**
 * Loads water quality data into Neon DB.
 * - water_quality_state: UPSERT on state_name (34 rows)
 * - water_quality_hotspots: DELETE+INSERT per state (idempotent re-run)
 *
 * Run: NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/load_water_quality.mjs
 */
import { neon } from '@neondatabase/serverless';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const DB = 'postgresql://neondb_owner:npg_VBerOq8Q5wJi@ep-polished-cell-atic95d9-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DB);

function parseCsvLine(line) {
  const vals = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i+1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (c === ',' && !inQuote) {
      vals.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  vals.push(cur);
  return vals;
}

async function readCsv(path) {
  const rows = [];
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let headers = null;
  let pending = '';
  for await (const line of rl) {
    // Handle multiline quoted fields by accumulating
    const combined = pending ? pending + '\n' + line : line;
    // Count unescaped quotes to detect incomplete quoted field
    const quoteCount = (combined.match(/(?<![""])"(?![""])/g) || combined.split('"').length - 1);
    // Simple heuristic: if odd number of quotes, line is incomplete
    const parsed = parseCsvLine(combined);
    if (!headers) { headers = parsed.map(h => h.trim()); pending = ''; continue; }
    const obj = {};
    headers.forEach((h, i) => { obj[h] = parsed[i]?.trim() === '' ? null : parsed[i]?.trim() ?? null; });
    rows.push(obj);
    pending = '';
  }
  return rows;
}

function num(v) { return v === '' || v === 'None' || v == null ? null : Number(v); }
function str(v) { return v === '' || v === 'None' || v == null ? null : String(v); }

// ── water_quality_state ───────────────────────────────────────────────────────
console.log('Loading water_quality_state...');
const stateRows = await readCsv('data/output/water_quality_state.csv');
console.log(`  ${stateRows.length} rows read`);

let sOk = 0, sFail = 0;
for (const r of stateRows) {
  // Parse known_high_risk_districts — pipe-separated in CSV
  const districts = r.known_high_risk_districts
    ? r.known_high_risk_districts.split('|').filter(Boolean)
    : [];

  try {
    await sql`
      INSERT INTO water_quality_state (
        state_name,
        fluoride_pct_exceeding, fluoride_risk_level, fluoride_samples_analyzed, fluoride_samples_exceeding,
        nitrate_pct_exceeding,  nitrate_risk_level,  nitrate_samples_analyzed,  nitrate_samples_exceeding,
        arsenic_pct_exceeding,  arsenic_risk_level,  arsenic_samples_analyzed,  arsenic_samples_exceeding,
        overall_water_risk, total_samples_in_state, known_high_risk_districts,
        monitoring_season, data_source, data_as_of_year
      ) VALUES (
        ${str(r.state_name)},
        ${num(r.fluoride_pct_exceeding)}, ${str(r.fluoride_risk_level)}, ${num(r.fluoride_samples_analyzed)}, ${num(r.fluoride_samples_exceeding)},
        ${num(r.nitrate_pct_exceeding)},  ${str(r.nitrate_risk_level)},  ${num(r.nitrate_samples_analyzed)},  ${num(r.nitrate_samples_exceeding)},
        ${num(r.arsenic_pct_exceeding)},  ${str(r.arsenic_risk_level)},  ${num(r.arsenic_samples_analyzed)},  ${num(r.arsenic_samples_exceeding)},
        ${str(r.overall_water_risk)}, ${num(r.total_samples_in_state)}, ${districts},
        ${str(r.monitoring_season)}, ${str(r.data_source)}, ${num(r.data_as_of_year)}
      )
      ON CONFLICT (state_name) DO UPDATE SET
        fluoride_pct_exceeding      = EXCLUDED.fluoride_pct_exceeding,
        fluoride_risk_level         = EXCLUDED.fluoride_risk_level,
        fluoride_samples_analyzed   = EXCLUDED.fluoride_samples_analyzed,
        fluoride_samples_exceeding  = EXCLUDED.fluoride_samples_exceeding,
        nitrate_pct_exceeding       = EXCLUDED.nitrate_pct_exceeding,
        nitrate_risk_level          = EXCLUDED.nitrate_risk_level,
        nitrate_samples_analyzed    = EXCLUDED.nitrate_samples_analyzed,
        nitrate_samples_exceeding   = EXCLUDED.nitrate_samples_exceeding,
        arsenic_pct_exceeding       = EXCLUDED.arsenic_pct_exceeding,
        arsenic_risk_level          = EXCLUDED.arsenic_risk_level,
        arsenic_samples_analyzed    = EXCLUDED.arsenic_samples_analyzed,
        arsenic_samples_exceeding   = EXCLUDED.arsenic_samples_exceeding,
        overall_water_risk          = EXCLUDED.overall_water_risk,
        total_samples_in_state      = EXCLUDED.total_samples_in_state,
        known_high_risk_districts   = EXCLUDED.known_high_risk_districts,
        monitoring_season           = EXCLUDED.monitoring_season,
        data_as_of_year             = EXCLUDED.data_as_of_year,
        updated_at                  = NOW()
    `;
    sOk++;
  } catch(e) {
    sFail++;
    console.error(`  FAIL [${r.state_name}]: ${e.message}`);
  }
}
console.log(`  Done: ${sOk} upserted, ${sFail} failed`);

// ── water_quality_hotspots ────────────────────────────────────────────────────
console.log('\nLoading water_quality_hotspots...');
const hotspotRows = await readCsv('data/output/water_quality_hotspots.csv');
console.log(`  ${hotspotRows.length} rows read`);

// Delete existing and re-insert (idempotent)
await sql`DELETE FROM water_quality_hotspots`;
console.log('  Cleared existing hotspot rows');

let hOk = 0, hFail = 0;
const BATCH = 20;
for (let i = 0; i < hotspotRows.length; i += BATCH) {
  const batch = hotspotRows.slice(i, i + BATCH);
  await Promise.all(batch.map(async (r) => {
    try {
      await sql`
        INSERT INTO water_quality_hotspots (
          hotspot_no, state_name, district, block_taluka, village,
          lat, lng, source_type,
          contaminant, concentration, unit, bis_limit, exceedance_factor, severity,
          data_as_of_year, data_source
        ) VALUES (
          ${num(r.hotspot_no)}, ${str(r.state_name)}, ${str(r.district)},
          ${str(r.block_taluka)}, ${str(r.village)},
          ${num(r.lat)}, ${num(r.lng)}, ${str(r.source_type)},
          ${str(r.contaminant)}, ${num(r.concentration)}, ${str(r.unit)},
          ${num(r.bis_limit)}, ${num(r.exceedance_factor)}, ${str(r.severity)},
          ${num(r.data_as_of_year)}, ${str(r.data_source)}
        )
      `;
      hOk++;
    } catch(e) {
      hFail++;
      console.error(`  FAIL [${r.state_name}/${r.district}]: ${e.message}`);
    }
  }));
}
console.log(`  Done: ${hOk} inserted, ${hFail} failed`);

// ── Verify ────────────────────────────────────────────────────────────────────
const [sc] = await sql`SELECT COUNT(*) as cnt FROM water_quality_state`;
const [hc] = await sql`SELECT COUNT(*) as cnt FROM water_quality_hotspots`;
console.log(`\nVerification:`);
console.log(`  water_quality_state:    ${sc.cnt} rows`);
console.log(`  water_quality_hotspots: ${hc.cnt} rows`);
console.log('\nAll done.');
