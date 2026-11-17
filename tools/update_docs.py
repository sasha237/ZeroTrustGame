import pathlib

# --- WORKING_PLAN.md updates ---
p = pathlib.Path('WORKING_PLAN.md')
src = p.read_text(encoding='utf-8')
subs = [
    ("**Version:** 0.3 — `ANSWERS.md` + `ANSWERS2.md` applied (follow-ups confirmed; money model\nprecise). Target ruleset **v1.2**. One confirmation pending (starting bank, C-1 in `GAPS.md`).",
     "**Version:** 0.4 — `ANSWERS.md` + `ANSWERS2.md` applied and owner-confirmed; ruleset **v1.2.0\nimplemented and verified** (typecheck clean, 33/33 tests, build passes). One provisional rule\npending (F-5 turn-1 grace period, `GAPS.md`)."),
    ("- Base income 100/turn both sides; **starting bank = 100 both sides** (owner answer C-1;\n  archived turn-1 screenshot shows 0 — owner answer wins unless revised).",
     "- Base income 100/turn both sides; **starting budget = 100 and starting bank = 100** (owner\n  answers C-1, confirmed; archived turn-1 screenshot showed BANK 0 — owner answer wins)."),
    ("7. **Danger thresholds** on end-of-turn values: ≤10 → immediate loss; ≤30 for 3 consecutive\n   turns → loss (Terrorist side: Security + Mobilization/Group Size).",
     "7. **Danger thresholds** on end-of-turn values: ≤10 → immediate loss; ≤30 for 3 consecutive\n   turns → loss (Terrorist side: Security + Mobilization/Group Size). **Provisional (F-5):\n   thresholds are evaluated from turn 2 onward** — with Mobilization starting at 0 and\n   next-turn activation, turn-1 evaluation would end every game immediately."),
    ("| A-13 | **Starting bank = 100 both sides** | ANSWERS2 (C-1 pending) |",
     "| A-13 | **Starting budget = 100, starting bank = 100 (both sides)** | ANSWERS2 + C-1 confirmation |\n| A-14 | Danger thresholds apply from turn 2 (turn-1 grace period) | provisional F-5 — contradiction found in testing |"),
    ("## 16. Open questions\n\n**C-1 only** — starting bank 100 (owner) vs 0 (screenshot). Default implemented: 100.",
     "## 16. Open questions\n\n**F-5 only** — turn-1 danger-threshold grace period (provisional; see `GAPS.md`)."),
]
for old, new in subs:
    assert src.count(old) == 1, f'anchor not found: {old[:60]!r} count={src.count(old)}'
    src = src.replace(old, new)
p.write_text(src, encoding='utf-8')
print('WORKING_PLAN.md updated')

# --- AGENTS.md updates ---
p = pathlib.Path('AGENTS.md')
src = p.read_text(encoding='utf-8')
subs = [
    ("(3) the **implemented rules engine** (`packages/engine`,\nTypeScript monorepo, ruleset v1.1; v1.2 pending — starting bank 100 per owner answer).",
     "(3) the **implemented rules engine** (`packages/engine`,\nTypeScript monorepo, ruleset v1.2.0 — owner answers applied, typecheck clean, 33/33 tests\ngreen, build passes; one provisional rule F-5 turn-1 threshold grace period pending)."),
    ("simultaneous hidden submission;\neffects and upkeep activate the **next turn**; turn economy is spend upkeep → solvency\ncheck (budget+bank < 0 = bankruptcy) → earn income for the next turn; danger thresholds\n≤10 (1 turn) / ≤30 (3 turns); draw on mutual agreement or turn limit (default 50).",
     "simultaneous hidden submission;\neffects and upkeep activate the **next turn**; turn economy is spend → solvency check\n(budget+bank < 0 = bankruptcy) → earn income for the next turn; danger thresholds ≤10\n(1 turn) / ≤30 (3 turns) from turn 2 (provisional F-5 grace period); draw on mutual\nagreement or turn limit (default 50); starting budget/bank 100/100."),
    ("`package.json`, `tsconfig.base.json`, `.gitignore` | npm workspace root (TS monorepo). |",
     "`package.json`, `tsconfig.base.json`, `.gitignore`, `package-lock.json` | npm workspace root (TS monorepo). |\n| `ANSWERS.md` / `ANSWERS2.md` | Owner rules answers + confirmations (source of truth for mechanics). |"),
    ("`src/rulesets/v1.ts` (data), `src/engine.ts` (resolve/validate/preview/replay), `test/` (vitest golden tests — being updated to v1.1/v1.2 semantics).",
     "`src/rulesets/v1.ts` (data, v1.2.0), `src/engine.ts` (resolve/validate/preview/replay), `test/` (vitest golden tests, 33 green). |"),
    ("Known environment note: on this Windows box npm lifecycle scripts run via `cmd.exe`,\nwhere `node` is not on PATH (node.exe lives in `C:\\Program Files\\nodejs`; the shell here\nis Git Bash). If `npm install` fails in a postinstall script, run\n`npm config set script-shell \"D:\\\\msys64\\\\usr\\\\bin\\\\bash.exe\"` first. This fix is pending\napplication.",
     "Environment note: npm lifecycle scripts run via `cmd.exe` on this box, where `node` is\nnot on PATH — `npm config set script-shell \"D:\\\\msys64\\\\usr\\\\bin\\\\bash.exe\"` has been\napplied to the project and is required for `npm install` to succeed."),
]
for old, new in subs:
    assert src.count(old) == 1, f'anchor not found: {old[:60]!r} count={src.count(old)}'
    src = src.replace(old, new)
p.write_text(src, encoding='utf-8')
print('AGENTS.md updated')
