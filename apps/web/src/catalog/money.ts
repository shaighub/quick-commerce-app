/** Shoppers type rupees. The API stores paise (ADR-005, ADR-014). */
export function formatInr(paise: number): string {
  const sign = paise < 0 ? -1 : 1;
  const absolute = Math.abs(paise);
  const rupees = Math.trunc(absolute / 100) * sign;
  const fraction = absolute % 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees + (sign * fraction) / 100);
}

export function paiseToRupeeInput(paise: number): string {
  const whole = Math.trunc(paise / 100);
  const fraction = Math.abs(paise % 100);
  if (fraction === 0) {
    return String(whole);
  }
  return `${whole}.${String(fraction).padStart(2, '0')}`;
}

/** Blank is unset. Invalid text returns null. */
export function rupeesToPaise(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const [whole, fraction = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
