// Simple demo: encode some data to TOON and log it
// Run with: node scripts/toon-demo.mjs

import { encode } from '@toon-format/toon';

const data = {
  users: [
    { id: 1, name: 'Alice', role: 'admin', lastLogin: '2025-01-15T10:30:00Z' },
    { id: 2, name: 'Bob', role: 'user', lastLogin: '2025-01-14T15:22:00Z' },
    { id: 3, name: 'Charlie', role: 'user', lastLogin: '2025-01-13T09:45:00Z' },
  ],
};

// Use tab as delimiter; it's compact and avoids quoting in many cases
const toon = encode(data, { delimiter: '\t' });

console.log('--- TOON ---');
console.log(toon);

// Debug: show header with visible tab markers and char codes
const header = toon.split('\n')[0];
const bracket = header.slice(header.indexOf('[') + 1, header.indexOf(']'));
const after3 = (() => {
  const i = bracket.indexOf('3');
  return i >= 0 && i + 1 < bracket.length ? bracket[i + 1] : '';
})();

console.log('--- DEBUG ---');
console.log('Header (visible tabs):', header.replace(/\t/g, '\\t'));
console.log('Between brackets raw:', JSON.stringify(bracket));
console.log('Between brackets codes:', Array.from(bracket).map((c) => c.charCodeAt(0)));
console.log('Char after "3":', JSON.stringify(after3), 'code:', after3 ? after3.charCodeAt(0) : '(none)');
