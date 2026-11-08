// Characterization / regression: the SAME inputs must give the SAME status AND message
// in the original monolithic v1 and in the refactored v2 (behaviour preserved, AC1-AC4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ROOMS } from '../final/src/data/rooms.js';
import { checkAvailability } from '../final/src/core/availability.js';

const v1 = createRequire(import.meta.url)('../initial/app.js');
const R101 = ROOMS.find((r) => r.id === 'R101');

const cases = [
  ['9am', '10:00'], ['10:00', ''], ['12:00', '12:00'], ['12:30', '12:00'], ['08:30', '09:30'], ['09:00', '09:30'],
  ['11:00', '13:00'], ['11:00', '13:01'], ['09:00', '12:00'],
  ['09:30', '10:30'], ['10:30', '11:30'], ['10:15', '10:45'], ['09:30', '11:30'], ['10:00', '11:00'],
  ['09:00', '10:00'], ['11:00', '12:00'], ['12:00', '13:00'], ['14:30', '15:00'], ['14:00', '15:30'], ['23:00', '23:59']
];

test('v1 vs v2: identical status and message for 20 time scenarios on room R101', () => {
  for (const [s, e] of cases) {
    const old = v1.checkAvailability(s, e);
    const now = checkAvailability(R101, { start: s, end: e });
    assert.equal(now.status, old.status, `${s}-${e} status`);
    assert.equal(now.message, old.message, `${s}-${e} message`);
  }
});

test('v1 vs v2: blocked-room behaviour is identical', () => {
  v1.ROOM.blocked = true;
  try {
    for (const [s, e] of [['10:00', '10:30'], ['11:00', '12:00'], ['11:00', '13:01'], ['08:00', '09:30']]) {
      const old = v1.checkAvailability(s, e);
      const now = checkAvailability({ ...R101, blocked: true }, { start: s, end: e });
      assert.equal(now.status, old.status, `${s}-${e}`);
      assert.equal(now.message, old.message, `${s}-${e}`);
    }
  } finally { v1.ROOM.blocked = false; }
});
