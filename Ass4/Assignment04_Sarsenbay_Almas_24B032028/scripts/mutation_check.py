#!/usr/bin/env python3
"""Mutation check: inject one deliberate bug at a time into a COPY of the project and
confirm the test-suite fails ("mutant killed"). Original files are never modified.
Usage: python3 scripts/mutation_check.py"""
import os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MUTANTS = [
  ("M01 touching treated as overlap (AC4)", "final/src/core/availability.js", "return aStart < bEnd && bStart < aEnd;", "return aStart <= bEnd && bStart <= aEnd;"),
  ("M02 max duration 121 instead of 120 (AC2)", "final/src/config.js", "MAX_DURATION_MINUTES = 120", "MAX_DURATION_MINUTES = 121"),
  ("M03 end == start allowed (AC1)", "final/src/core/availability.js", "if (end <= start) {", "if (end < start) {"),
  ("M04 start == now rejected (AC1)", "final/src/core/availability.js", "if (start < parseTime(nowHHMM)) {", "if (start <= parseTime(nowHHMM)) {"),
  ("M05 blocked check removed (AC3/F3)", "final/src/core/availability.js", "if (room.blocked) {", "if (false) {"),
  ("M06 capacity '>' instead of '>=' (F1)", "final/src/core/filter.js", "room.capacity >= attendees", "room.capacity > attendees"),
  ("M07 equipment ANY instead of ALL (F2)", "final/src/core/filter.js", "equipment.every(", "equipment.some("),
  ("M08 empty attendees treated as invalid (F1)", "final/src/core/filter.js", "if (text === '') return", "if (false) return"),
  ("M09 room switch clears result (F5)", "final/src/ui/store.js", "{ ...state, selectedRoomId: action.id, notice: null }", "{ ...state, selectedRoomId: action.id, checked: false, notice: null }"),
  ("M10 stale selection kept after filter change (F5)", "final/src/ui/store.js", "if (matching(state, rooms).some((r) => r.id === state.selectedRoomId)) return { ...state, notice: null };", "return { ...state, notice: null };"),
  ("M11 HTML escaping disabled (security)", "final/src/ui/render.js", "String(v).replace(/[&<>\"']/g,", "String(v).replace(/[]/g,"),
  ("M12 catalog no longer frozen (AC5)", "final/src/data/rooms.js", "    Object.freeze(value);\n", ""),
]
SKIP = shutil.ignore_patterns(".git", "node_modules", "evidence", "report")
def run_tests(cwd):
    p = subprocess.run(["node", "--test", "tests/*.test.*js"], cwd=cwd, capture_output=True, text=True)
    out = p.stdout
    g = lambda k: int(re.search(rf"^# {k} (\d+)", out, re.M).group(1))
    return g("tests"), g("pass"), g("fail")
killed = 0
print(f"{'mutant':58} {'tests':>5} {'pass':>5} {'fail':>5}  result")
for name, rel, old, new in MUTANTS:
    tmp = tempfile.mkdtemp()
    work = os.path.join(tmp, "p"); shutil.copytree(ROOT, work, ignore=SKIP)
    path = os.path.join(work, rel); src = open(path, encoding="utf8").read()
    assert old in src, f"pattern not found for {name}"
    open(path, "w", encoding="utf8").write(src.replace(old, new, 1))
    t, p, f = run_tests(work)
    status = "KILLED" if f > 0 else "SURVIVED"
    killed += f > 0
    print(f"{name:58} {t:5d} {p:5d} {f:5d}  {status}")
    shutil.rmtree(tmp)
print(f"\nMutation score: {killed}/{len(MUTANTS)} mutants killed")
sys.exit(0 if killed == len(MUTANTS) else 1)
