import { ChainName } from "../contants/chains";

export enum Environments {
  LOCAL = 'local',
  TESTNET = 'testnet',
  MAINNET = 'mainnet'
}

export interface ITokenData {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  crosschain: boolean;
  commonKey: string;
  logoURI: string;
}

export interface IConfig {
  apiKey?: string;
  environment: Environments;
}

export interface IGetTx {
  recipientAddress: string;
  srcChain: ChainName;
  srcTokenIn: string;
  srcInAmount: string;
  dstChain: ChainName;
  dstTokenOut: string;
  slippage: number; // validate usage
}

// this interface should be imported from ethers?
export interface ITransaction {
  to?: string,
  data?: ArrayLike<number>,
  value?: bigint,
}