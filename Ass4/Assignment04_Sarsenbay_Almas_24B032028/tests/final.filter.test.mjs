// v2 tests for the new room catalog and filtering features F1-F4.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS } from '../final/src/data/rooms.js';
import { parseRequirements, filterRooms, listEquipment } from '../final/src/core/filter.js';
import { checkAvailability, STATUS } from '../final/src/core/availability.js';
import { formatTime } from '../final/src/core/time.js';

const ids = (attendees, equipment = []) =>
  filterRooms(ROOMS, parseRequirements({ attendees, equipment })).map((r) => r.id);

test('catalog: at least 4 rooms, each with id, name, capacity, equipment, blocked flag, bookings', () => {
  assert.ok(ROOMS.length >= 4);
  for (const r of ROOMS) {
    assert.equal(typeof r.id, 'string');
    assert.equal(typeof r.name, 'string');
    assert.ok(Number.isInteger(r.capacity) && r.capacity > 0);
    assert.ok(Array.isArray(r.equipment) && r.equipment.length > 0);
    assert.equal(typeof r.blocked, 'boolean');
    assert.ok(Array.isArray(r.bookings));
  }
  assert.equal(new Set(ROOMS.map((r) => r.id)).size, ROOMS.length, 'ids are unique');
});

test('F1 boundary: capacity exactly equal to attendees matches, one more attendee does not', () => {
  assert.ok(ids('30').includes('R101'));   // R101 capacity 30
  assert.ok(!ids('31').includes('R101'));
  assert.deepEqual(ids('121'), []);        // largest room seats 120
  assert.ok(ids('120').includes('R201'));
});

test('F1: empty attendees means no capacity constraint and is NOT an error', () => {
  assert.equal(ids('').length, ROOMS.length);
  assert.equal(ids(undefined).length, ROOMS.length);
  for (const empty of ['', '   ', null, undefined]) {
    const req = parseRequirements({ attendees: empty });
    assert.equal(req.error, null);
    assert.equal(req.attendees, null);
  }
});

test('F1: invalid attendee values produce an error and no capacity filtering', () => {
  for (const bad of ['0', '-3', 'abc', '2.5', '1e3']) {
    const req = parseRequirements({ attendees: bad });
    assert.match(req.error, /whole number/, bad);
    assert.equal(req.attendees, null);
  }
});

test('F2: room must contain ALL selected equipment items', () => {
  assert.deepEqual(ids('', ['projector', 'video-conference']), ['R201']);
  assert.deepEqual(ids('', ['computers', 'projector']), ['R101', 'R202']);
  assert.deepEqual(ids('', ['microphone']), ['R201']);
  assert.equal(ids('', ['whiteboard']).length, ROOMS.length);
});

test('F2: unknown equipment matches nothing; no selection matches everything', () => {
  assert.deepEqual(ids('', ['hologram']), []);
  assert.equal(ids('', []).length, ROOMS.length);
});

test('F1+F2 combined: both rules apply together', () => {
  assert.deepEqual(ids('25', ['whiteboard']), ['R101', 'R201']);
  assert.deepEqual(ids('100', ['computers']), []);
});

test('F2: equipment options are derived from the catalog (sorted, unique)', () => {
  assert.deepEqual(listEquipment(ROOMS), ['computers', 'microphone', 'projector', 'video-conference', 'whiteboard']);
});

test('F3: a blocked room is never AVAILABLE for any valid interval', () => {
  const blocked = ROOMS.filter((r) => r.blocked);
  assert.ok(blocked.length >= 1);
  for (const r of blocked) {
    for (let s = 540; s <= 1300; s += 15) {
      for (const len of [15, 60, 120]) {
        const res = checkAvailability(r, { start: formatTime(s), end: formatTime(s + len) });
        assert.notEqual(res.status, STATUS.AVAILABLE);
      }
    }
  }
});

test('F3: filter keeps matching blocked rooms visible but flagged (so they can be explained)', () => {
  const found = filterRooms(ROOMS, parseRequirements({ attendees: '15', equipment: ['computers'] }));
  assert.deepEqual(found.map((r) => [r.id, r.blocked]), [['R101', false], ['R202', true]]);
});

test('filtering is pure: it does not modify the catalog or the input', () => {
  const before = JSON.stringify(ROOMS);
  const req = { attendees: 5, equipment: ['projector'], error: null };
  const reqBefore = JSON.stringify(req);
  filterRooms(ROOMS, req);
  assert.equal(JSON.stringify(ROOMS), before);
  assert.equal(JSON.stringify(req), reqBefore);
});
