const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, 'companies_1000.csv');

// 20 predefined (company, address) pairs
const PREDEFINED_ROWS = [
  ['Acme Corp', '123 Main St, Springfield, IL 62701'],
  ['Globex Inc', '456 Oak Ave, Shelbyville, IN 46176'],
  ['Initech LLC', '789 Pine Rd, Columbus, OH 43085'],
  ['Umbrella Co', '101 Elm St, Raccoon City, CO 80014'],
  ['Stark Industries', '200 Park Ave, New York, NY 10166'],
  ['Wayne Enterprises', '1007 Mountain Dr, Gotham, NJ 07030'],
  ['Hooli', '1 Silicon Way, Palo Alto, CA 94301'],
  ['Massive Dynamic', '77 Water St, New York, NY 10005'],
  ['Wonka Industries', '5 Candy Ln, Scranton, PA 18503'],
  ['Prestige Worldwide', '42 Yacht Club Rd, Miami, FL 33101'],
  ['Duff Brewing', '321 Beer Blvd, Springfield, OR 97477'],
  ['Pied Piper', '88 Compression Dr, San Francisco, CA 94105'],
  ['Cyberdyne Systems', '909 Skynet Blvd, San Diego, CA 92101'],
  ['Tyrell Corporation', '22 Nexus Pl, Los Angeles, CA 90012'],
  ['Blue Sun Corp', '19 Serenity Way, Houston, TX 77002'],
  ['Black Mesa', '3 Research Pkwy, Mesa, AZ 85201'],
  ['Aperture Science', '12 Test Lab Rd, Portland, OR 97201'],
  ['Gringotts Bank', '17 Diagon Alley, Boston, MA 02108'],
  ['Dunder Mifflin', '1725 Slough Ave, Scranton, PA 18503'],
  ['Monsters Inc', '29 Door St, Monstropolis, MI 48201'],
];

function toCsvField(value) {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCsv(numRows = 1000, outputFile = OUTPUT_FILE) {
  const header = ['company name', 'address'];
  const lines = [header.map(toCsvField).join(',')];

  for (let i = 0; i < numRows; i++) {
    const [company, address] = PREDEFINED_ROWS[Math.floor(Math.random() * PREDEFINED_ROWS.length)];
    lines.push([company, address].map(toCsvField).join(','));
  }

  fs.writeFileSync(outputFile, lines.join('\n'), 'utf8');
  console.log(`CSV file with ${numRows} rows written to ${outputFile}`);
}

if (require.main === module) {
  generateCsv();
}

module.exports = { generateCsv, PREDEFINED_ROWS };


