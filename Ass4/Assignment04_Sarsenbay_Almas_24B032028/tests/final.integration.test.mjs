// v2 integration / UI-behaviour tests: store (state machine) + view model + HTML rendering.
// These exercise the same path the browser uses (main.js only wires DOM events to dispatch()).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS } from '../final/src/data/rooms.js';
import { createStore } from '../final/src/ui/store.js';
import { renderRoomList, renderResult, renderTimeline, renderBookings } from '../final/src/ui/render.js';

const fresh = () => createStore(ROOMS);
const run = (store, ...actions) => { actions.forEach((a) => store.dispatch(a)); return store.getViewModel(); };
const times = (start, end) => [{ type: 'setStart', value: start }, { type: 'setEnd', value: end }];

test('F4: empty state is shown with a clear message when no room matches', () => {
  const s = fresh();
  const vm = run(s, { type: 'setAttendees', value: '500' });
  assert.equal(vm.empty, true);
  const html = renderRoomList(vm);
  assert.match(html, /No rooms match/);
  assert.match(html, /seat 500 people/);
  assert.doesNotMatch(html, /<input type="radio"/);
});

test('F4: empty state names the combined requirement and recovers when relaxed', () => {
  const s = fresh();
  run(s, { type: 'setAttendees', value: '100' }, { type: 'toggleEquipment', item: 'computers', on: true });
  assert.match(renderRoomList(s.getViewModel()), /seat 100 people and have computers/);
  const vm = run(s, { type: 'toggleEquipment', item: 'computers', on: false });
  assert.equal(vm.empty, false);
  assert.deepEqual(vm.rooms.map((r) => r.id), ['R201']);
});

test('F5: switching the selected room refreshes the availability result (same times, different room)', () => {
  const s = fresh();
  let vm = run(s, ...times('10:30', '11:30'), { type: 'selectRoom', id: 'R101' }, { type: 'check' });
  assert.equal(vm.result.status, 'CONFLICT');            // R101 busy 10:00-11:00
  vm = run(s, { type: 'selectRoom', id: 'R102' });
  assert.equal(vm.result.status, 'AVAILABLE');           // R102 free 10:30-12:00, no new "Check" needed
  assert.match(vm.result.message, /Birch Seminar Room/);
  vm = run(s, { type: 'selectRoom', id: 'R201' });
  assert.equal(vm.result.status, 'CONFLICT');            // R201 busy 11:00-12:30
  vm = run(s, { type: 'selectRoom', id: 'R202' });
  assert.equal(vm.result.status, 'BLOCKED');
});

test('F5: availability uses ONLY the chosen room bookings (no cross-room leakage)', () => {
  const s = fresh();
  let vm = run(s, ...times('11:00', '12:00'), { type: 'selectRoom', id: 'R101' }, { type: 'check' });
  assert.equal(vm.result.status, 'AVAILABLE');           // R201 is busy then, R101 is not
  vm = run(s, { type: 'selectRoom', id: 'R201' });
  assert.equal(vm.result.status, 'CONFLICT');
  vm = run(s, ...times('10:00', '11:00'), { type: 'selectRoom', id: 'R201' }, { type: 'check' });
  assert.equal(vm.result.status, 'AVAILABLE');           // R101 is busy then, R201 is not
});

test('F5: before the first check, switching rooms shows a prompt, not a stale result', () => {
  const s = fresh();
  const vm = run(s, { type: 'selectRoom', id: 'R101' }, { type: 'selectRoom', id: 'R102' });
  assert.equal(vm.result, null);
  assert.match(renderResult(vm), /Enter a start and end time/);
});

test('editing a time after a check hides the old result (no stale answer)', () => {
  const s = fresh();
  run(s, ...times('11:00', '12:00'), { type: 'selectRoom', id: 'R101' }, { type: 'check' });
  assert.equal(s.getViewModel().result.status, 'AVAILABLE');
  const vm = run(s, { type: 'setEnd', value: '12:30' });
  assert.equal(vm.result, null);
});

test('check without a selected room tells the user what to do', () => {
  const vm = run(fresh(), ...times('11:00', '12:00'), { type: 'check' });
  assert.equal(vm.result, null);
  assert.match(renderResult(vm), /Select a room first/);
});

test('changing requirements drops a selection that no longer matches, with an explanation', () => {
  const s = fresh();
  run(s, { type: 'selectRoom', id: 'R301' }, ...times('11:00', '11:30'), { type: 'check' });
  const vm = run(s, { type: 'setAttendees', value: '10' });  // R301 seats only 6
  assert.equal(vm.selectedRoom, null);
  assert.equal(vm.result, null);
  assert.match(renderResult(vm), /no longer matches/);
});

test('a room hidden by the filters cannot be selected', () => {
  const s = fresh();
  const vm = run(s, { type: 'setAttendees', value: '100' }, { type: 'selectRoom', id: 'R101' });
  assert.equal(vm.selectedRoom, null);
});

test('full user flow: requirements -> room -> time -> result HTML (success)', () => {
  const s = fresh();
  let vm = run(s, { type: 'setAttendees', value: '10' }, { type: 'toggleEquipment', item: 'projector', on: true });
  assert.deepEqual(vm.rooms.map((r) => r.id), ['R101', 'R201', 'R202']);
  vm = run(s, { type: 'selectRoom', id: 'R201' }, ...times('09:00', '11:00'), { type: 'check' });
  const html = renderResult(vm);
  assert.match(html, /result--success/);
  assert.match(html, /Cedar Lecture Hall is free from 09:00 to 11:00/);
});

test('full user flow: unsuccessful outcomes render error / warning styles', () => {
  const s = fresh();
  run(s, { type: 'selectRoom', id: 'R101' });
  assert.match(renderResult(run(s, ...times('10:15', '10:45'), { type: 'check' })), /result--error/);
  assert.match(renderResult(run(s, ...times('09:00', '12:00'), { type: 'check' })), /result--warning.*Booking too long/s);
  assert.match(renderResult(run(s, ...times('8:30', '09:30'), { type: 'check' })), /result--warning.*HH:MM/s);
});

test('rendering escapes dynamic text (no HTML injection through catalog data)', () => {
  const evil = [{ id: 'X1', name: '<img src=x onerror=alert(1)>', capacity: 5, equipment: ['a&b'], blocked: false, bookings: [] }];
  const vm = createStore(evil).getViewModel();
  const html = renderRoomList(vm);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  assert.match(html, /a&amp;b/);
});

test('timeline: bookings and the request are positioned (and clipped) on the 08:00-20:00 strip', () => {
  const s = fresh();
  const vm = run(s, { type: 'selectRoom', id: 'R101' }, ...times('19:30', '20:30'), { type: 'check' });
  const first = vm.timeline.booked[0];
  assert.equal(first.start, '10:00');
  assert.ok(Math.abs(first.pos.left - (120 / 720) * 100) < 1e-9);   // 2 h after 08:00
  assert.ok(Math.abs(first.pos.width - (60 / 720) * 100) < 1e-9);
  assert.ok(Math.abs(vm.timeline.request.width - (30 / 720) * 100) < 1e-9); // clipped at 20:00
  assert.match(renderTimeline(vm), /tl-request--success/);
  assert.match(renderBookings(vm), /Algorithms lecture/);
});

test('store never mutates the shared catalog (AC5 through the UI layer)', () => {
  const before = JSON.stringify(ROOMS);
  const s = fresh();
  for (const r of ROOMS) run(s, { type: 'selectRoom', id: r.id }, ...times('10:00', '11:00'), { type: 'check' });
  run(s, { type: 'reset' });
  assert.equal(JSON.stringify(ROOMS), before);
});
