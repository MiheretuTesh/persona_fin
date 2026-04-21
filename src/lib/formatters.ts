import { format, isToday, isYesterday, differenceInDays } from 'date-fns';

/** Currency — always show 2 decimals, grouped, with currency symbol. */
export function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for currencies Intl doesn't know; still show 2dp.
    return `$${amount.toFixed(2)}`;
  }
}

/** Split currency into ["$", "142,580", "42"] so the hero pattern can style each. */
export function splitCurrency(amount: number, currency = 'USD') {
  const formatted = formatCurrency(Math.abs(amount), currency);
  const match = formatted.match(/^([^\d.-]+)?([\d,]+)(?:\.(\d{2}))?(.*)?$/);
  if (!match) return { symbol: '$', whole: amount.toFixed(0), cents: '00', sign: amount < 0 ? '-' : '' };
  const [, symbol = '$', whole = '0', cents = '00'] = match;
  return { symbol: symbol.trim(), whole, cents, sign: amount < 0 ? '-' : '' };
}

/** Signed amount for transaction rows: +$1,299.00 / -$64.50 */
export function formatSignedAmount(amount: number, currency = 'USD') {
  const abs = formatCurrency(Math.abs(amount), currency);
  return amount >= 0 ? `+${abs}` : `-${abs}`;
}

/** Short human date: "Today", "Yesterday", "24 Oct", or "24 Oct 2024". */
export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  const now = new Date();
  if (differenceInDays(now, date) < 330) return format(date, 'd MMM');
  return format(date, "d MMM yyyy");
}

/** Percent with + / - prefix, 1dp. */
export function formatPercent(p: number): string {
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(1)}%`;
}
