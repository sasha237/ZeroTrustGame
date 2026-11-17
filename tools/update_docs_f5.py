import pathlib

# --- GAPS.md: rewrite F-5 section ---
p = pathlib.Path('GAPS.md')
src = p.read_text(encoding='utf-8')
old = """## Pending confirmation

- **F-5 🔶 Turn-1 danger-threshold grace period (PROVISIONAL).** Contradiction discovered
  while testing: initial Mobilization is 0, critical threshold is ≤10, and policies activate
  the *next* turn — so evaluating thresholds on turn 1 would end every game immediately
  (terrorist auto-loses). Implemented provisional rule: **danger thresholds are evaluated
  from turn 2 onward** (turn 1 = setup/income only, which pairs naturally with G-09).
  Alternative resolutions if you prefer: initial Mobilization > 10; thresholds skip
  indicators still at their initial value; or thresholds only after first blood."""
new = """## F-5 ✅ resolved (ANSWERS3)

Owner answer: **per-indicator grace counter.** The turn a threshold band is first hit, its
counter is 0 (grace — no loss); each following turn the value stays in the band the counter
increments (1, 2, 3...); loss when the counter reaches the band's turn count. Recovering
above the band resets the counter; a later re-hit starts at 0 again (owner example 3).
Implemented for both bands per indicator (critical + sustained), engine-tested including
the owner's three examples. This also reproduces the emergent "idle terrorist loses on
turn 2" gate from the starting Mobilization of 0.

Two fine-print readings implemented (confirm or correct):
- **Q-1**: loss at counter >= band turns — so the 1-turn critical band loses on the
  **2nd consecutive** hit turn, and the 3-turn sustained band loses on the **4th
  consecutive** hit turn (hit + counters 0,1,2,3).
- **Q-2**: when a value is ≤10 it counts toward **both** bands independently (the ≤30
  sustained counter keeps incrementing too)."""
assert src.count(old) == 1
src = src.replace(old, new)
old2 = """## Next steps

1. F-5 confirmation → one-line engine/ruleset change if different.
2. M1 client (SVG policy graph, events feed, finances, EN/RU) per WORKING_PLAN.md.
3. Later rule changes ship as new `RulesetVersion` config with changelog."""
new2 = """## Next steps

1. Q-1/Q-2 confirmations (above) → small engine tweaks if different.
2. M1 client (SVG policy graph, events feed, finances, EN/RU) per WORKING_PLAN.md.
3. Later rule changes ship as new `RulesetVersion` config with changelog."""
assert src.count(old2) == 1
src = src.replace(old2, new2)
src = src.replace("**Status legend:** ✅ resolved and implemented · 🔶 provisional, owner confirmation pending (F-5)",
                  "**Status legend:** ✅ resolved and implemented · 🔶 fine-print reading to confirm (Q-1/Q-2)")
p.write_text(src, encoding='utf-8')
print('GAPS.md updated')

# --- WORKING_PLAN.md ---
p = pathlib.Path('WORKING_PLAN.md')
src = p.read_text(encoding='utf-8')
subs = [
    ("**Version:** 0.4 — `ANSWERS.md` + `ANSWERS2.md` applied and owner-confirmed; ruleset **v1.2.0\nimplemented and verified** (typecheck clean, 33/33 tests, build passes). One provisional rule\npending (F-5 turn-1 grace period, `GAPS.md`).",
     "**Version:** 0.5 — `ANSWERS.md` + `ANSWERS2.md` + `ANSWERS3.md` (F-5 grace counters) applied;\nruleset **v1.2.0 implemented and verified** (typecheck clean, 32/32 tests, build passes)."),
    ("danger thresholds (≤10 end-of-turn, ≤30 for 3 consecutive turns) or goes bankrupt; the game is a draw on\nmutual agreement or when the **turn limit (setting, default 50)** is reached.",
     "danger thresholds (≤10 / ≤30 bands with per-indicator grace counters per ANSWERS3) or\ngoes bankrupt; the game is a draw on mutual agreement or when the **turn limit (setting,\ndefault 50)** is reached."),
    ("7. **Danger thresholds** on end-of-turn values: ≤10 → immediate loss; ≤30 for 3 consecutive\n   turns → loss (Terrorist side: Security + Mobilization/Group Size). **Provisional (F-5):\n   thresholds are evaluated from turn 2 onward** — with Mobilization starting at 0 and\n   next-turn activation, turn-1 evaluation would end every game immediately.",
     "7. **Danger thresholds** on end-of-turn values with **grace counters** (ANSWERS3 F-5): the\n   turn a band (≤10 critical / ≤30 sustained) is first hit, its counter is 0 = grace, no\n   loss; each further turn the value stays in the band the counter increments; loss when it\n   reaches the band's count — critical loses on the 2nd consecutive hit turn, sustained on\n   the 4th. Recovery above the band resets the counter; re-hit starts at 0 again. (Terrorist\n   side: Security + Mobilization/Group Size; fine-print readings Q-1/Q-2 in `GAPS.md`.)"),
    ("| A-14 | Danger thresholds apply from turn 2 (turn-1 grace period) | provisional F-5 — contradiction found in testing |",
     "| A-14 | Danger grace counters per band: hit=0, persists → 1,2,3, loss at count; recovery resets | ANSWERS3 F-5 |"),
    ("## 16. Open questions\n\n**F-5 only** — turn-1 danger-threshold grace period (provisional; see `GAPS.md`).",
     "## 16. Open questions\n\n**Q-1/Q-2 only** — grace-counter fine print (loss timing per band; dual-band counting at ≤10). See `GAPS.md`."),
]
for old, new in subs:
    assert src.count(old) == 1, f'anchor not found: {old[:60]!r} count={src.count(old)}'
    src = src.replace(old, new)
p.write_text(src, encoding='utf-8')
print('WORKING_PLAN.md updated')

# --- AGENTS.md ---
p = pathlib.Path('AGENTS.md')
src = p.read_text(encoding='utf-8')
subs = [
    ("TypeScript monorepo, ruleset v1.2.0 — owner answers applied, typecheck clean, 33/33 tests\ngreen, build passes; one provisional rule F-5 turn-1 threshold grace period pending).",
     "TypeScript monorepo, ruleset v1.2.0 — owner answers applied incl. ANSWERS3 F-5 grace\ncounters, typecheck clean, 32/32 tests green, build passes)."),
    ("≤10 (1 turn) / ≤30 (3 turns) from turn 2 (provisional F-5 grace period); draw on mutual\nagreement or turn limit (default 50); starting budget/bank 100/100.",
     "≤10/≤30 bands with per-indicator grace counters (ANSWERS3 F-5: hit=0, persists→1,2,3,\nloss at count); draw on mutual agreement or turn limit (default 50); starting\nbudget/bank 100/100."),
]
for old, new in subs:
    assert src.count(old) == 1, f'anchor not found: {old[:60]!r} count={src.count(old)}'
    src = src.replace(old, new)
p.write_text(src, encoding='utf-8')
print('AGENTS.md updated')
