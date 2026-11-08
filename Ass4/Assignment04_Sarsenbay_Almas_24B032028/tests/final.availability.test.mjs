// v2 regression tests for AC1-AC6 (original acceptance criteria) + time helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROOMS } from '../final/src/data/rooms.js';
import { parseTime, formatTime } from '../final/src/core/time.js';
import { checkAvailability, STATUS, intervalsOverlap } from '../final/src/core/availability.js';

const room = (id) => ROOMS.find((r) => r.id === id);
const R101 = room('R101'), R201 = room('R201'), R202 = room('R202');
const check = (r, start, end) => checkAvailability(r, { start, end });

test('time: parseTime accepts valid 24h times and rejects malformed ones', () => {
  assert.equal(parseTime('00:00'), 0);
  assert.equal(parseTime('09:05'), 545);
  assert.equal(parseTime('23:59'), 1439);
  for (const bad of ['9:00', '24:00', '12:60', '', 'ab:cd', '1000', null, undefined, 930]) {
    assert.equal(parseTime(bad), null, `should reject ${String(bad)}`);
  }
});

test('time: formatTime is the inverse of parseTime', () => {
  for (const t of ['00:00', '09:05', '12:30', '23:59']) assert.equal(formatTime(parseTime(t)), t);
});

test('AC1: malformed or missing times are INVALID', () => {
  for (const [s, e] of [['9am', '10:00'], ['10:00', ''], ['25:00', '26:00'], [undefined, undefined]]) {
    assert.equal(check(R201, s, e).status, STATUS.INVALID);
  }
});

test('AC1: end must be strictly after start', () => {
  assert.equal(check(R201, '12:00', '12:00').status, STATUS.INVALID);
  assert.equal(check(R201, '12:30', '12:00').status, STATUS.INVALID);
});

test('AC1 boundary: start 08:59 is in the past (INVALID), start 09:00 equals "now" (allowed)', () => {
  assert.equal(check(R201, '08:59', '09:30').status, STATUS.INVALID);
  assert.equal(check(R201, '09:00', '09:30').status, STATUS.AVAILABLE);
});

test('AC2 boundary: exactly 120 minutes is allowed, 121 minutes is TOO_LONG', () => {
  assert.equal(check(R201, '09:00', '11:00').status, STATUS.AVAILABLE);
  const r = check(R201, '09:00', '11:01');
  assert.equal(r.status, STATUS.TOO_LONG);
  assert.match(r.message, /121 minutes/);
});

test('AC3: a blocked room is BLOCKED even when the time is otherwise free', () => {
  assert.equal(R202.blocked, true);
  assert.equal(check(R202, '10:00', '10:30').status, STATUS.BLOCKED);
});

test('AC4: partial, inner, enclosing and identical overlaps all CONFLICT (R101 has 10:00-11:00)', () => {
  for (const [s, e] of [['09:30', '10:30'], ['10:30', '11:30'], ['10:15', '10:45'], ['09:30', '11:30'], ['10:00', '11:00'], ['09:30', '10:01'], ['10:59', '11:30']]) {
    assert.equal(check(R101, s, e).status, STATUS.CONFLICT, `${s}-${e}`);
  }
});

test('AC4 boundary: touching intervals do NOT overlap (ends at 10:00 / starts at 11:00)', () => {
  assert.equal(check(R101, '09:00', '10:00').status, STATUS.AVAILABLE);
  assert.equal(check(R101, '11:00', '12:00').status, STATUS.AVAILABLE);
  assert.equal(intervalsOverlap(540, 600, 600, 660), false);
  assert.equal(intervalsOverlap(540, 601, 600, 660), true);
});

test('AC4: back-to-back bookings in one room (R301 09-10, 10-11) leave 11:00 free but 10:00-10:30 busy', () => {
  assert.equal(check(room('R301'), '10:00', '10:30').status, STATUS.CONFLICT);
  assert.equal(check(room('R301'), '11:00', '11:30').status, STATUS.AVAILABLE);
});

test('AC5: catalog and bookings are deeply frozen; mutation attempts throw', () => {
  assert.ok(Object.isFrozen(ROOMS));
  for (const r of ROOMS) {
    assert.ok(Object.isFrozen(r) && Object.isFrozen(r.bookings) && Object.isFrozen(r.equipment));
    assert.ok(r.bookings.every(Object.isFrozen));
  }
  assert.throws(() => { R101.bookings[0].start = '00:00'; }, TypeError);
  assert.throws(() => R101.bookings.push({ start: '12:00', end: '12:30', title: 'x' }), TypeError);
  assert.throws(() => { R101.blocked = true; }, TypeError);
});

test('AC5: running many checks never changes booking data', () => {
  const before = JSON.stringify(ROOMS);
  for (let s = 540; s < 1200; s += 15) {
    for (const r of ROOMS) check(r, formatTime(s), formatTime(s + 45));
  }
  assert.equal(JSON.stringify(ROOMS), before);
});

test('AC6: messages are specific and actionable', () => {
  assert.match(check(R101, 'abc', '10:00').message, /HH:MM/);
  assert.match(check(R101, '09:30', '10:30').message, /Algorithms lecture.*10:00.*11:00/);
  assert.match(check(R101, '11:00', '12:00').message, /Aurora Lab is free from 11:00 to 12:00/);
  assert.match(check(R202, '10:00', '10:30').message, /Delta Studio is blocked/);
});

test('AC6: page is responsive and announces results (static checks of index.html / styles.css)', () => {
  const html = fs.readFileSync(new URL('../final/index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../final/styles.css', import.meta.url), 'utf8');
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
  assert.match(html, /id="result" aria-live="polite"/);
  assert.match(css, /@media \(min-width: 52rem\)/);
});
