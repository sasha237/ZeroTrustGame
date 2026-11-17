import { rulesetV1_3, type Orders, type Side } from '@bot/engine';
import type { ResolvedTurn } from './types.js';

/** RFC-4180 field escaping: quote when the field contains , " or any newline; "" escapes ". */
export function csvEscape(field: string): string {
  if (/[",\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function policyTitle(id: string): string {
  for (const side of ['state', 'terrorist'] as Side[]) {
    const policy = rulesetV1_3.policies[side].find((p) => p.id === id);
    if (policy) return policy.title;
  }
  return id;
}

/** Human one-liner for a side's orders: `Intelligence+1;Taxes-1` (empty = no changes). */
export function ordersLabel(orders: Orders): string {
  return orders.changes.map((c) => `${policyTitle(c.policy)}${c.delta > 0 ? '+' : ''}${c.delta}`).join(';');
}

const HEADER = 'turn,side,orders,stability,legitimacy,security,mobilization,budget_after,bank_after,spend,income,events';

/**
 * Debrief export (A-20): one row per resolved turn per side (state first),
 * CRLF line endings, end-of-turn indicator values from state_after.
 */
export function toCsv(turns: ResolvedTurn[]): string {
  const lines = [HEADER];
  for (const resolved of turns) {
    const economy = resolved.summary.economy;
    const events = resolved.summary.events.join(' | ');
    for (const side of ['state', 'terrorist'] as Side[]) {
      const line = economy.find((e) => e.side === side);
      const fields = [
        String(resolved.turn),
        side,
        ordersLabel(resolved.orders[side]),
        String(resolved.stateAfter.indicators.stability),
        String(resolved.stateAfter.indicators.legitimacy),
        String(resolved.stateAfter.indicators.security),
        String(resolved.stateAfter.indicators.mobilization),
        String(resolved.stateAfter.budget[side]),
        String(resolved.stateAfter.bank[side]),
        line ? String(line.spend) : '',
        line ? String(line.income) : '',
        events,
      ];
      lines.push(fields.map(csvEscape).join(','));
    }
  }
  return lines.join('\r\n') + '\r\n';
}
