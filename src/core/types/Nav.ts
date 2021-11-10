import { AllowancesMap, NavsPositionsTypes } from './State';
import { TokenView } from './Token';

// This General naming means it has the positions inside as keys
export interface GeneralNavView {
  address: string;
  name: string;
  displayName: string;
  displayIcon: string;
  defaultDisplayToken: string;
  decimals: string;
  navBalance: string;
  navBalanceUsdc: string;
  apyData: string;
  allowancesMap: AllowancesMap;
  pricePerShare: string;
  allowZapIn: boolean;
  allowZapOut: boolean;
  mainPositionKey: NavsPositionsTypes;
  DEPOSIT: {
    userBalance: string;
    userDeposited: string;
    userDepositedUsdc: string;
  };
  YIELD: {
    userBalance: string;
    userDeposited: string;
    userDepositedUsdc: string;
  };
  STAKE: {
    userBalance: string;
    userDeposited: string;
    userDepositedUsdc: string;
  };
  token: TokenView;
}
