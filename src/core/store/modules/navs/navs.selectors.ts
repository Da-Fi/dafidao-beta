import { createSelector } from '@reduxjs/toolkit';

import {
  AllowancesMap,
  Balance,
  Nav,
  NavsPositionsMap,
  RootState,
  Token,
  Status,
  GeneralNavView,
  NavActionsStatusMap,
  NavsPositionsTypes,
} from '@types';
import { getConstants } from '@config/constants';
import { toBN } from '@utils';

import { initialNavActionsStatusMap } from './navs.reducer';
import { createToken } from '../tokens/tokens.selectors';

const { YVECRV, CRV, YVBOOST, PSLPYVBOOSTETH } = getConstants().CONTRACT_ADDRESSES;

// general selectors
const selectCrvTokenData = (state: RootState) => state.tokens.tokensMap[CRV];
const selectUserCrvTokenData = (state: RootState) => state.tokens.user.userTokensMap[CRV];
const selectCrvTokenAllowancesMap = (state: RootState) => state.tokens.user.userTokensAllowancesMap[CRV];

const selectYveCrvTokenData = (state: RootState) => state.tokens.tokensMap[YVECRV];
const selectUserYveCrvTokenData = (state: RootState) => state.tokens.user.userTokensMap[YVECRV];
const selectYveCrvTokenAllowancesMap = (state: RootState) => state.tokens.user.userTokensAllowancesMap[YVECRV];

const selectYvBoostData = (state: RootState) => state.tokens.tokensMap[YVBOOST];
const selectUserYvBoostData = (state: RootState) => state.tokens.user.userTokensMap[YVBOOST];
const selectYvBoostAllowancesMap = (state: RootState) => state.tokens.user.userTokensAllowancesMap[YVBOOST];

const selectSelectedNavAddress = (state: RootState) => state.navs.selectedNavAddress;
const selectGetNavsStatus = (state: RootState) => state.navs.statusMap.getNavs;
const selectNavsActionsStatusMap = (state: RootState) => state.navs.statusMap.navsActionsStatusMap;
const selectGetUserNavsPositionsStatus = (state: RootState) => state.navs.statusMap.user.getUserNavsPositions;

// yveCrv selectors
const selectYveCrvNavData = (state: RootState) => state.navs.navsMap[YVECRV];
const selectUserYveCrvNavPositions = (state: RootState) => state.navs.user.userNavsPositionsMap[YVECRV];
const selectYveCrvNavAllowancesMap = (state: RootState) => state.tokens.user.userTokensAllowancesMap[YVECRV];

const selectYveCrvNav = createSelector(
  [
    selectYveCrvNavData,
    selectUserYveCrvNavPositions,
    selectYveCrvNavAllowancesMap,
    selectCrvTokenData,
    selectUserCrvTokenData,
    selectCrvTokenAllowancesMap,
  ],
  (navData, userPositions, navAllowances, tokenData, userTokenData, tokenAllowancesMap) => {
    if (!navData) return undefined;
    return createNav({
      navAllowances,
      navData,
      tokenAllowancesMap,
      tokenData,
      userPositions,
      userTokenData,
      mainPositionKey: 'DEPOSIT',
    });
  }
);

// yvBoost selectors
const selectYvBoostNavData = (state: RootState) => state.navs.navsMap[YVBOOST];
const selectUserYvBoostNavPositions = (state: RootState) => state.navs.user.userNavsPositionsMap[YVBOOST];
const selectYvBoostNavAllowancesMap = (state: RootState) => state.tokens.user.userTokensAllowancesMap[YVBOOST];

const selectYvBoostNav = createSelector(
  [
    selectYvBoostNavData,
    selectUserYvBoostNavPositions,
    selectYvBoostNavAllowancesMap,
    selectYveCrvTokenData,
    selectUserYveCrvTokenData,
    selectYveCrvTokenAllowancesMap,
  ],
  (navData, userPositions, navAllowances, tokenData, userTokenData, tokenAllowancesMap) => {
    if (!navData) return undefined;
    return createNav({
      navAllowances,
      navData,
      tokenAllowancesMap,
      tokenData,
      userPositions,
      userTokenData,
      mainPositionKey: 'DEPOSIT',
    });
  }
);

// yvBoost-eth selectors
const selectYvBoostEthNavData = (state: RootState) => state.navs.navsMap[PSLPYVBOOSTETH];
const selectUserYvBoostEthNavPositions = (state: RootState) => state.navs.user.userNavsPositionsMap[PSLPYVBOOSTETH];
const selectYvBoostEthNavAllowancesMap = (state: RootState) =>
  state.tokens.user.userTokensAllowancesMap[PSLPYVBOOSTETH];

const selectYvBoostEthNav = createSelector(
  [
    selectYvBoostEthNavData,
    selectUserYvBoostEthNavPositions,
    selectYvBoostEthNavAllowancesMap,
    selectYvBoostData,
    selectUserYvBoostData,
    selectYvBoostAllowancesMap,
  ],
  (navData, userPositions, navAllowances, tokenData, userTokenData, tokenAllowancesMap) => {
    if (!navData) return undefined;
    return createNav({
      navAllowances,
      navData,
      tokenAllowancesMap,
      tokenData,
      userPositions,
      userTokenData,
      mainPositionKey: 'STAKE',
    });
  }
);

// General selectors
const selectNavs = createSelector(
  [selectYveCrvNav, selectYvBoostNav, selectYvBoostEthNav],
  (yveCrvNav, yvBoostNav, yvBoostEthNav) => {
    const navs: GeneralNavView[] = [];
    [yveCrvNav, yvBoostNav, yvBoostEthNav].forEach((nav) => {
      if (nav) navs.push(nav);
    });

    navs.sort((a, b) => {
      return toBN(b.token.balance).minus(a.token.balance).toNumber();
    });
    return navs;
  }
);

const selectDepositedNavs = createSelector([selectNavs], (navs) => {
  return navs.filter((nav) => toBN(nav?.DEPOSIT.userBalance).plus(nav?.STAKE.userBalance).gt(0));
});

const selectNavsOpportunities = createSelector([selectNavs], (navs) => {
  return navs.filter((nav) => toBN(nav?.DEPOSIT.userBalance).plus(nav?.STAKE.userBalance).lte(0));
});

const selectRecommendations = createSelector([selectNavs], (navs) => {
  // TODO criteria
  return navs.slice(0, 3);
});

const selectSelectedNav = createSelector([selectNavs, selectSelectedNavAddress], (navs, selectedNavAddress) => {
  if (!selectedNavAddress) {
    return undefined;
  }
  return navs.find((nav) => nav.address === selectedNavAddress);
});

const selectSummaryData = createSelector([selectDepositedNavs], (depositedNavs) => {
  let totalDeposited = toBN('0');
  depositedNavs.forEach((nav) => (totalDeposited = totalDeposited.plus(nav[nav.mainPositionKey].userDepositedUsdc)));

  return {
    totalDeposits: totalDeposited.toString(),
    totalEarnings: '0',
    estYearlyYeild: '0',
  };
});

const selectNavsStatus = createSelector(
  [selectGetNavsStatus, selectGetUserNavsPositionsStatus],
  (getNavsStatus, getUserNavsPositionsStatus): Status => {
    return {
      loading: getNavsStatus.loading || getUserNavsPositionsStatus.loading,
      error: getNavsStatus.error || getUserNavsPositionsStatus.error,
    };
  }
);

const selectSelectedNavActionsStatusMap = createSelector(
  [selectNavsActionsStatusMap, selectSelectedNavAddress],
  (navsActionsStatusMap, selectedNavAddress): NavActionsStatusMap => {
    return selectedNavAddress ? navsActionsStatusMap[selectedNavAddress] : initialNavActionsStatusMap;
  }
);

interface CreateNavProps {
  navData: Nav;
  userPositions: NavsPositionsMap;
  navAllowances: AllowancesMap;
  tokenData: Token;
  userTokenData: Balance;
  tokenAllowancesMap: AllowancesMap;
  mainPositionKey: NavsPositionsTypes;
}

function createNav(props: CreateNavProps): GeneralNavView {
  const { navAllowances, navData, tokenAllowancesMap, tokenData, userPositions, userTokenData, mainPositionKey } =
    props;
  return {
    address: navData.address,
    name: navData.name,
    displayName: navData.metadata.displayName,
    displayIcon: navData.metadata.displayIcon,
    defaultDisplayToken: navData.metadata.defaultDisplayToken,
    decimals: navData.decimals,
    navBalance: navData.underlyingTokenBalance.amount,
    navBalanceUsdc: navData.underlyingTokenBalance.amountUsdc,
    apyData: navData.metadata.apy?.net_apy.toString() ?? '0',
    allowancesMap: navAllowances ?? {},
    pricePerShare: navData.metadata.pricePerShare,
    allowZapIn: true,
    allowZapOut: true,
    mainPositionKey,
    DEPOSIT: {
      userBalance: userPositions?.DEPOSIT?.balance ?? '0',
      userDeposited: userPositions?.DEPOSIT?.underlyingTokenBalance.amount ?? '0',
      userDepositedUsdc: userPositions?.DEPOSIT?.underlyingTokenBalance.amountUsdc ?? '0',
    },
    YIELD: {
      userBalance: userPositions?.YIELD?.balance ?? '0',
      userDeposited: userPositions?.YIELD?.underlyingTokenBalance.amount ?? '0',
      userDepositedUsdc: userPositions?.YIELD?.underlyingTokenBalance.amountUsdc ?? '0',
    },
    STAKE: {
      userBalance: userPositions?.STAKE?.balance ?? '0',
      userDeposited: userPositions?.STAKE?.underlyingTokenBalance.amount ?? '0',
      userDepositedUsdc: userPositions?.STAKE?.underlyingTokenBalance.amountUsdc ?? '0',
    },
    token: createToken({ tokenData, userTokenData, allowancesMap: tokenAllowancesMap }),
  };
}

export const NavsSelectors = {
  selectYveCrvNav,
  selectYvBoostNav,
  selectYvBoostEthNav,
  selectNavs,
  selectDepositedNavs,
  selectNavsOpportunities,
  selectRecommendations,
  selectSelectedNav,
  selectSummaryData,
  selectNavsStatus,
  selectSelectedNavActionsStatusMap,
};
