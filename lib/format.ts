// Shared formatting helpers.

/**
 * Format a monetary amount using the order/product's own currency.
 * Falls back to ZAR (the primary market) when currency is absent.
 */
export function formatMoney(amount: number, currency: string = 'ZAR'): string {
  try {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(amount)
  } catch {
    // Unknown/invalid currency code — degrade gracefully rather than throw.
    return `${currency} ${amount.toFixed(2)}`
  }
}
