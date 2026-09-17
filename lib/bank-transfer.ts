/**
 * Buyer-facing reference code for a bank-transfer fee payment, derived
 * deterministically from the reservation id so it's always in sync with it —
 * never stored on the row, always recomputed from purchase_requests.id on
 * both the buyer and admin side.
 */
export function bankTransferReference(purchaseRequestId: string): string {
  return `MOVA-${purchaseRequestId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export interface BankTransferDetails {
  name: string;
  address: string;
  swift: string;
  accountNumber: string;
  routingNumber: string;
}

/**
 * Reads MOVA's wire-transfer details from env vars — never hardcoded, since
 * these change once the LLC / business bank account exists. Server-only.
 * Returns null if any are unset, so callers can hide the bank-transfer
 * option instead of rendering incomplete/blank details.
 */
export function bankTransferDetails(): BankTransferDetails | null {
  const name = process.env.BANK_TRANSFER_NAME;
  const address = process.env.BANK_TRANSFER_ADDRESS;
  const swift = process.env.BANK_TRANSFER_SWIFT;
  const accountNumber = process.env.BANK_TRANSFER_ACCOUNT_NUMBER;
  const routingNumber = process.env.BANK_TRANSFER_ROUTING_NUMBER;
  if (!name || !address || !swift || !accountNumber || !routingNumber) {
    return null;
  }
  return { name, address, swift, accountNumber, routingNumber };
}
