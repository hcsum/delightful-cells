// Generate a CSV with N rows for compare-two-columns testing.
// Only 3 rows will be marked as 'duplicates' based on the app's logic:
// duplicates = Column A value exists anywhere in Column B.
// Usage:
//   node scripts/generate-compare-csv.mjs [rows=3000] [outpath=test-data/compare_3000.csv]
// Example:
//   node scripts/generate-compare-csv.mjs
//   node scripts/generate-compare-csv.mjs 1500 test-data/compare_1500.csv

import fs from 'node:fs';
import path from 'node:path';

const rows = Number(process.argv[2] || 3000) | 0;
const outPath = process.argv[3] || path.join('test-data', `compare_${rows}.csv`);

if (!Number.isFinite(rows) || rows <= 0) {
  console.error('Rows must be a positive integer.');
  process.exit(1);
}

const header = 'order_id,sku_entered,sku_master';
const lines = [header];

// Step 1: Build Column B values (sku_master)
// Use SKU-100..SKU-999 cycling; occasionally insert blanks that are ignored by the app for duplicates.
const masters = [];
for (let i = 0; i < rows; i++) {
  if (i % 17 === 0) {
    masters.push(''); // blank (ignored)
  } else {
    const n = (i % 900) + 100; // 100..999
    masters.push(`SKU-${String(n).padStart(3, '0')}`);
  }
}

// Step 2: Choose exactly three non-blank master values to be used as duplicates
const duplicateIdxs = [];
for (let i = 0; i < rows && duplicateIdxs.length < 3; i++) {
  if (masters[i] !== '') duplicateIdxs.push(i);
}
// If rows < 3 or early blanks, we might have <3; try later rows
for (let i = rows - 1; i >= 0 && duplicateIdxs.length < 3; i--) {
  if (masters[i] !== '' && !duplicateIdxs.includes(i)) duplicateIdxs.push(i);
}

const duplicateValues = duplicateIdxs.map((i) => masters[i]).filter(Boolean);

// Step 3: Build Column A values (sku_entered)
// Default to a value guaranteed NOT to appear in masters (use a different prefix)
const entered = Array.from({ length: rows }, (_, i) => `SKUX-${String(1000 + i).padStart(4, '0')}`);

// For exactly three rows, set A to one of the chosen B values (ensuring duplicates = 3)
if (duplicateValues.length > 0) entered[duplicateIdxs[0]] = duplicateValues[0];
if (duplicateValues.length > 1) entered[duplicateIdxs[1]] = duplicateValues[1];
if (duplicateValues.length > 2) entered[duplicateIdxs[2]] = duplicateValues[2];

// Emit CSV
for (let i = 0; i < rows; i++) {
  const orderId = 1001 + i;
  lines.push(`${orderId},${entered[i]},${masters[i]}`);
}

const dir = path.dirname(outPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`CSV file with ${rows} rows written to ${outPath}`);
console.log(`Info: Exactly ${Math.min(3, duplicateValues.length)} rows will be marked as duplicates by the app.`);
