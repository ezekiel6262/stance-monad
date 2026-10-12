export const KURU_ENTRYPOINT = '0xb3e6778480b2E488385E8205eA05E20060B813cb';

export const KURU_TOKENS = Object.freeze({
  USDC: Object.freeze({ address: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603', decimals: 6 }),
  WMON: Object.freeze({ address: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A', decimals: 18 }),
  AUSD: Object.freeze({ address: '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a', decimals: 6 })
});

const addresses = new Set(Object.values(KURU_TOKENS).map(token => token.address.toLowerCase()));

export function isKuruToken(address) {
  return addresses.has(String(address).toLowerCase());
}

export function isKuruEntrypoint(address) {
  return String(address).toLowerCase() === KURU_ENTRYPOINT.toLowerCase();
}
