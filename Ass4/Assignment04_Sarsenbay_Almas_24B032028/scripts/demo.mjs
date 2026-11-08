// Console demonstration of the required scenarios (uses the same store the browser UI uses).
import { ROOMS } from '../final/src/data/rooms.js';
import { createStore } from '../final/src/ui/store.js';

const store = createStore(ROOMS);
const go = (...actions) => { actions.forEach((a) => store.dispatch(a)); return store.getViewModel(); };
const rooms = (vm) => vm.rooms.map((r) => r.id).join(', ') || '(none)';
const line = (t) => console.log(`\n== ${t}`);
const res = (vm) => vm.result ? `${vm.result.status}: ${vm.result.message}` : `(no result) ${vm.notice || vm.hint}`;

line('1. Catalog'); ROOMS.forEach((r) => console.log(`${r.id} ${r.name.padEnd(20)} ${String(r.capacity).padStart(3)} seats  blocked=${r.blocked}  [${r.equipment}]  bookings=${r.bookings.map((b) => b.start + '-' + b.end)}`));

line('2. SUCCESSFUL filtering: 10 attendees + projector');
let vm = go({ type: 'setAttendees', value: '10' }, { type: 'toggleEquipment', item: 'projector', on: true });
console.log('rooms shown:', rooms(vm));

line('3. SUCCESSFUL filtering: 25 attendees + video-conference + projector');
vm = go({ type: 'reset' }, { type: 'setAttendees', value: '25' }, { type: 'toggleEquipment', item: 'projector', on: true }, { type: 'toggleEquipment', item: 'video-conference', on: true });
console.log('rooms shown:', rooms(vm));

line('4. UNSUCCESSFUL filtering (F4 empty state): 500 attendees');
vm = go({ type: 'reset' }, { type: 'setAttendees', value: '500' });
console.log('rooms shown:', rooms(vm), '| empty =', vm.empty);

line('5. Room switching refreshes the result (same time 10:30-11:30)');
go({ type: 'reset' });
for (const id of ['R101', 'R102', 'R201', 'R202', 'R301']) {
  vm = go(...(id === 'R101' ? [{ type: 'setStart', value: '10:30' }, { type: 'setEnd', value: '11:30' }, { type: 'selectRoom', id }, { type: 'check' }] : [{ type: 'selectRoom', id }]));
  console.log(`${id}: ${res(vm)}`);
}

line('6. Availability checks on R101 (successful and unsuccessful)');
const cases = [['11:00', '12:00', 'free slot'], ['09:00', '10:00', 'touching start of 10:00 booking'], ['10:30', '11:30', 'overlap'], ['11:00', '13:00', 'exactly 120 min'], ['11:00', '13:01', '121 min'], ['08:30', '09:30', 'before current time'], ['9:30', '10:30', 'bad format']];
go({ type: 'selectRoom', id: 'R101' });
for (const [s, e, why] of cases) { vm = go({ type: 'setStart', value: s }, { type: 'setEnd', value: e }, { type: 'check' }); console.log(`${s}-${e} (${why}) -> ${res(vm)}`); }
