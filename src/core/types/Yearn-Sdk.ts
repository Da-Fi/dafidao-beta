import { TransactionRequest, TransactionResponse, TransactionReceipt } from '@ethersproject/providers';
import { Overrides } from '@ethersproject/contracts';

import {
  Yearn,
  Position,
  Asset,
  Vault,
  Balance,
  VaultDynamic,
  Token,
  TokenAmount,
  Address,
  Integer,
  Usdc,
  Apy,
  VaultStatic,
  IronBankMarket,
  IronBankUserSummary,
  VaultsUserSummary,
  IronBankMarketDynamic,
  CyTokenUserMetadata,
  VaultUserMetadata,
  TransactionOutcome,
  EarningsDayData,
  StrategyMetadata,
} from '@yfi/sdk';

import { Network } from './Blockchain';

type SdkNetwork = 1 | 250;
interface YearnSdk {
  hasInstanceOf: (network: Network) => boolean;
  getInstanceOf: (network: Network) => Yearn<SdkNetwork>;
  register: (network: Network, instance: Yearn<SdkNetwork>) => void;
}

declare type Nav = NavStatic & NavDynamic;
interface NavStatic {
  address: Address;
  typeId: 'NAV';
  token: Address;
  name: string;
  version: string;
  symbol: string;
  decimals: string;
}

interface NavDynamic {
  address: Address;
  typeId: 'NAV';
  tokenId: Address;
  underlyingTokenBalance: TokenAmount;
  metadata: NavMetadata;
}

interface NavMetadata {
  pricePerShare: Integer;
  apy?: Apy;
  icon?: string;
  depositLimit: string;
  emergencyShutdown: boolean;
  displayName: string;
  displayIcon: string;
  defaultDisplayToken: Address;
}

interface NavUserMetadata {}

export type {
  SdkNetwork,
  YearnSdk,
  Position,
  Asset,
  Vault,
  Yearn,
  Balance,
  VaultDynamic,
  Token,
  Integer,
  Usdc,
  VaultStatic,
  IronBankMarket,
  IronBankUserSummary,
  VaultsUserSummary,
  IronBankMarketDynamic,
  CyTokenUserMetadata,
  Nav,
  NavStatic,
  NavDynamic,
  NavMetadata,
  NavUserMetadata,
  TransactionRequest,
  TransactionResponse,
  TransactionReceipt,
  TransactionOutcome,
  Overrides,
  VaultUserMetadata,
  EarningsDayData,
  StrategyMetadata,
};
