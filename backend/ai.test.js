#!/usr/bin/env node
const { parseExtracted } = require('./ai');

const cases = [
  {
    name: 'clean JSON',
    input: '{"title":"Test Project","county":"Orange","startTime":"2026-10-01T08:00:00Z","endTime":"2026-12-15T17:00:00Z","description":"Test"}',
    expect: { title: 'Test Project', county: 'Orange', startTime: '2026-10-01T08:00:00Z', endTime: '2026-12-15T17:00:00Z', company: null, description: 'Test' }
  },
  {
    name: 'with markdown fences',
    input: '```json\n{"county":"Volusia","startTime":"2026-11-01T08:00:00Z","endTime":"2027-02-28T17:00:00Z"}\n```',
    expect: { title: null, county: 'Volusia', startTime: '2026-11-01T08:00:00Z', endTime: '2027-02-28T17:00:00Z', company: null, description: null }
  },
  {
    name: 'partial fields',
    input: '{"county":"Leon"}',
    expect: { title: null, county: 'Leon', startTime: null, endTime: null, company: null, description: null }
  },
  {
    name: 'invalid JSON',
    input: 'not json at all',
    expect: { title: null, county: null, startTime: null, endTime: null, company: null, description: null }
  }
];

let passed = 0, failed = 0;
for (const tc of cases) {
  const out = parseExtracted(tc.input);
  const ok = JSON.stringify(out) === JSON.stringify(tc.expect);
  if (ok) {
    console.log('✓', tc.name);
    passed++;
  } else {
    console.log('✗', tc.name);
    console.log('  expected:', JSON.stringify(tc.expect));
    console.log('  got:', JSON.stringify(out));
    failed++;
  }
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);