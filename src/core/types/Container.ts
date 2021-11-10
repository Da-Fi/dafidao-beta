import {
  Wallet,
  Config,
  Web3Provider,
  UserService,
  VaultService,
  TokenService,
  IronBankService,
  NavService,
  GasService,
  TransactionService,
  SubscriptionService,
  YearnSdk,
} from '@types';

export interface DIContainer {
  context: ContextContainer;
  services: ServiceContainer;
  config: ConfigContainer;
}

export interface ContextContainer {
  wallet: Wallet;
  web3Provider: Web3Provider;
  yearnSdk: YearnSdk;
}
export interface ServiceContainer {
  userService: UserService;
  vaultService: VaultService;
  tokenService: TokenService;
  ironBankService: IronBankService;
  navService: NavService;
  gasService: GasService;
  transactionService: TransactionService;
  subscriptionService: SubscriptionService;
}

export interface ConfigContainer extends Config {}
