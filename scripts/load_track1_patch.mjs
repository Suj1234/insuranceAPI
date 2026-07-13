/**
 * Loads Track 1 new columns into Neon for district_risk_index and pincode_risk_index.
 * Uses UPDATE (not INSERT) so existing rows are preserved — only the new columns are set.
 */
import { neon } from '@neondatabase/serverless';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const DB = 'postgresql://neondb_owner:npg_VBerOq8Q5wJi@ep-polished-cell-atic95d9-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DB);

async function readCsv(path) {
  const rows = [];
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let headers = null;
  for await (const line of rl) {
    if (!headers) { headers = line.split(','); continue; }
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = vals[i]?.trim() ?? null; });
    rows.push(obj);
  }
  return rows;
}

function num(v) { return v === '' || v === 'None' || v == null ? null : Number(v); }
function str(v) { return v === '' || v === 'None' || v == null ? null : String(v); }

// ── District risk index ───────────────────────────────────────────────────────
console.log('Loading district_risk_index patch...');
const dri = await readCsv('data/output/district_risk_index_final.csv');
console.log(`  ${dri.length} rows read`);

let dOk = 0, dFail = 0;
const BATCH = 50;
for (let i = 0; i < dri.length; i += BATCH) {
  const batch = dri.slice(i, i + BATCH);
  await Promise.all(batch.map(async (r) => {
    try {
      await sql(
        `UPDATE district_risk_index SET
           pm25_mean_3yr             = $1,
           pm25_trend_5yr_pct        = $2,
           pm25_trend_direction      = $3,
           pm25_3yr_from_year        = $4,
           pm25_3yr_to_year          = $5,
           pm25_5yr_from_year        = $6,
           pm25_5yr_to_year          = $7,
           pm25_national_pctile      = $8,
           composite_national_pctile = $9
         WHERE district_name = $10 AND state_name = $11`,
        [
          num(r.pm25_mean_3yr),
          num(r.pm25_trend_5yr_pct),
          str(r.pm25_trend_direction),
          num(r.pm25_3yr_from_year),
          num(r.pm25_3yr_to_year),
          num(r.pm25_5yr_from_year),
          num(r.pm25_5yr_to_year),
          num(r.pm25_national_pctile),
          num(r.composite_national_pctile),
          r.district_name,
          r.state_name,
        ]
      );
      dOk++;
    } catch(e) { dFail++; }
  }));
  if ((i / BATCH) % 4 === 0) process.stdout.write(`\r  ${i + batch.length}/${dri.length} districts...`);
}
console.log(`\n  Done: ${dOk} updated, ${dFail} failed`);

// ── Pincode risk index ────────────────────────────────────────────────────────
console.log('\nLoading pincode_risk_index patch...');
const pri = await readCsv('data/output/pincode_risk_index.csv');
console.log(`  ${pri.length} rows read`);

let pOk = 0, pFail = 0;
for (let i = 0; i < pri.length; i += BATCH) {
  const batch = pri.slice(i, i + BATCH);
  await Promise.all(batch.map(async (r) => {
    try {
      await sql(
        `UPDATE pincode_risk_index SET
           pm25_blended_3yr_ug       = $1,
           pm25_trend_5yr_pct        = $2,
           pm25_trend_direction      = $3,
           pm25_3yr_from_year        = $4,
           pm25_3yr_to_year          = $5,
           pm25_5yr_from_year        = $6,
           pm25_5yr_to_year          = $7,
           pm25_national_pctile      = $8,
           composite_national_pctile = $9
         WHERE pincode = $10`,
        [
          num(r.pm25_blended_3yr_ug),
          num(r.pm25_trend_5yr_pct),
          str(r.pm25_trend_direction),
          num(r.pm25_3yr_from_year),
          num(r.pm25_3yr_to_year),
          num(r.pm25_5yr_from_year),
          num(r.pm25_5yr_to_year),
          num(r.pm25_national_pctile),
          num(r.composite_national_pctile),
          r.pincode,
        ]
      );
      pOk++;
    } catch(e) { pFail++; }
  }));
  if ((i / BATCH) % 20 === 0) process.stdout.write(`\r  ${i + batch.length}/${pri.length} pincodes...`);
}
console.log(`\n  Done: ${pOk} updated, ${pFail} failed`);

console.log('\nAll done.');
