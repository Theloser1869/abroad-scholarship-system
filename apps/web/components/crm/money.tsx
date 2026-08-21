/// Displays a backend Decimal (already serialized as a JSON string) using `Intl.NumberFormat`
/// purely for presentation — never parses to `number` for any calculation, only for the
/// formatter's display rounding (F04 instruction §38: "Do not use frontend floating-point
/// calculations. Display backend Decimal results."). `null` means field-redacted or genuinely
/// unset — rendered as an explicit dash, never a fabricated "0" (F04 instruction §6).
export function formatMoney(value: string | null, currency: string | null): string {
  if (value === null || currency === null) return "—";
  const amount = Number(value);
  if (Number.isNaN(amount)) return `${value} ${currency}`;
  try {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency, currencyDisplay: "code" }).format(amount);
  } catch {
    return `${value} ${currency}`;
  }
}

export function Money({ value, currency }: { value: string | null; currency: string | null }) {
  return <span>{formatMoney(value, currency)}</span>;
}
