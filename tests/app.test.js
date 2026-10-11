const test = require('node:test');
const assert = require('node:assert/strict');

const { validDate, slotTimes } = require('../server.js');

test('validDate accepts valid ISO dates and rejects invalid ones', () => {
  assert.equal(validDate('2025-02-28'), true);
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2025-02-30'), false);
  assert.equal(validDate('2025/02/28'), false);
  assert.equal(validDate('2025-13-01'), false);
  assert.equal(validDate('not-a-date'), false);
});

test('slotTimes blocks past dates and invalid dates', () => {
  assert.deepEqual(slotTimes('2020-01-01', 60), []);
  assert.deepEqual(slotTimes('2025-02-30', 60), []);
});

test('slotTimes only returns open business hours and avoids busy appointment slots', () => {
  const available = slotTimes('2099-12-15', 60, [
    { start: 9 * 60, end: 11 * 60 },
    { start: 13 * 60, end: 13 * 60 + 30 },
  ]);

  assert.equal(available.includes('09:00'), false);
  assert.equal(available.includes('10:00'), false);
  assert.equal(available.includes('11:00'), true);
  assert.equal(available.includes('12:00'), true);
  assert.equal(available.includes('13:00'), false);
  assert.equal(available.includes('13:30'), true);
  assert.equal(available.includes('16:00'), true);
  assert.ok(Array.isArray(available));
});
