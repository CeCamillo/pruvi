const FULL_FORMATTER = new Intl.NumberFormat("pt-BR");

export function formatXpFull(n: number): string {
  return FULL_FORMATTER.format(n);
}

export function formatXpCompact(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  const formatted = k.toFixed(1).replace(/\.0$/, "");
  return `${formatted}k`;
}
