export const ETHTRANSFER_REPOSITORY = 'ETHTRANSFER_REPOSITORY';
export const PENDINGSWAP_REPOSITORY = 'PENDINGSWAP_REPOSITORY';

export const BLOCK_ASSEMBLER_CODE =
  '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8';
export const DAO_TYPE_ID =
  '0xcc77c4deac05d68ab5b26828f0bf4565a8d73113d7bb7e92b8362b8a74e58e58';
export const EMPTY_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

export const MILLISECONDS_IN_YEAR = 365 * 24 * 3600000;
export const GENESIS_BLOCK_TIMESTAMP = 1573963200 * 1000;

export enum SWAP_STATUS {
  CONFIRMING = 1,
  CONFIRMED,
  DELIVERING,
  DELIVERED,
  IGNORED,
}

export interface CKBConvertInfo {
  tokenSymbol: string;
  tokenPrice: number;
  tokenAmount: number;
  ckbPrice: number;
  ckbAmount: number;
  swapFeeAmount: number;
  exchangeFee: number;
}
