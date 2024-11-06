export const fromDecimals = (
  amount: string | bigint | number,
  decimals: number = 9
): number => {
  return (parseInt(amount.toString()) * 1.0) / 10 ** decimals;
};

export const toDecimals = (amount: number, decimals: number = 9): string => {
  return (amount * 10 ** decimals).toString();
};

export const validateTransactionSignature = (signature: string) => {
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/; // Base58 regex for Solana transaction signatures
  return base58Regex.test(signature);
};
