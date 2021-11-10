import { createReducer } from '@reduxjs/toolkit';
import { difference, groupBy, keyBy, union } from 'lodash';

import {
  initialStatus,
  NavsState,
  UserNavActionsStatusMap,
  NavActionsStatusMap,
  Position,
  NavsPositionsMap,
} from '@types';
import { getConfig } from '@config';

import { NavsActions } from './navs.actions';

export const initialNavActionsStatusMap: NavActionsStatusMap = {
  get: initialStatus,
  approveDeposit: initialStatus,
  deposit: initialStatus,
  approveWithdraw: initialStatus,
  withdraw: initialStatus,
  claimReward: initialStatus,
  approveReinvest: initialStatus,
  reinvest: initialStatus,
  approveInvest: initialStatus,
  invest: initialStatus,
  approveStake: initialStatus,
  stake: initialStatus,
};

export const initialUserNavsActionsStatusMap: UserNavActionsStatusMap = {
  get: initialStatus,
  getPositions: initialStatus,
};

export const navsInitialState: NavsState = {
  navsAddresses: [],
  navsMap: {},
  selectedNavAddress: undefined,
  user: {
    userNavsPositionsMap: {},
    navsAllowancesMap: {},
  },
  statusMap: {
    initiateNavs: { loading: false, error: null },
    getNavs: { loading: false, error: null },
    navsActionsStatusMap: {},
    user: {
      getUserNavsPositions: { loading: false, error: null },
      userNavsActionsStatusMap: {},
    },
  },
};

const {
  initiateNavs,
  getNavs,
  getNavsDynamic,
  getUserNavsPositions,
  setSelectedNavAddress,
  approveDeposit,
  deposit,
  approveWithdraw,
  withdraw,
  yvBoost,
  yveCrv,
  yvBoostEth,
  clearNavsData,
  clearSelectedNavAndStatus,
  clearNavStatus,
  clearUserData,
} = NavsActions;
const { yvBoostApproveDeposit, yvBoostDeposit, yvBoostApproveZapOut, yvBoostWithdraw } = yvBoost;
const { yveCrvApproveDeposit, yveCrvDeposit, yveCrvClaimReward, yveCrvApproveReinvest, yveCrvReinvest } = yveCrv;
const { yvBoostEthApproveInvest, yvBoostEthInvest, yvBoostEthApproveStake, yvBoostEthStake } = yvBoostEth;

const { YVECRV, PSLPYVBOOSTETH } = getConfig().CONTRACT_ADDRESSES;

const navsReducer = createReducer(navsInitialState, (builder) => {
  builder
    .addCase(initiateNavs.pending, (state) => {
      state.statusMap.initiateNavs = { loading: true };
    })
    .addCase(initiateNavs.fulfilled, (state) => {
      state.statusMap.initiateNavs = {};
    })
    .addCase(initiateNavs.rejected, (state, { error }) => {
      state.statusMap.initiateNavs = { error: error.message };
    })
    .addCase(getNavs.pending, (state) => {
      state.statusMap.getNavs = { loading: true };
    })
    .addCase(getNavs.fulfilled, (state, { payload: { navsData } }) => {
      const navsAddresses: string[] = [];
      navsData.forEach((nav) => {
        navsAddresses.push(nav.address);
        state.navsMap[nav.address] = nav;
        state.statusMap.navsActionsStatusMap[nav.address] = initialNavActionsStatusMap;
        state.statusMap.user.userNavsActionsStatusMap[nav.address] = initialUserNavsActionsStatusMap;
      });
      state.navsAddresses = union(state.navsAddresses, navsAddresses);
      state.statusMap.getNavs = {};
    })
    .addCase(getNavs.rejected, (state, { error }) => {
      state.statusMap.getNavs = { error: error.message };
    })
    .addCase(getNavsDynamic.pending, (state, { meta }) => {
      const navsAddresses = meta.arg.addresses;
      navsAddresses.forEach((address) => {
        state.statusMap.navsActionsStatusMap[address].get = { loading: true };
      });
    })
    .addCase(getNavsDynamic.fulfilled, (state, { meta, payload: { navsDynamicData } }) => {
      const navsAddresses = meta.arg.addresses;
      navsAddresses.forEach((address) => (state.statusMap.navsActionsStatusMap[address].get = {}));

      navsDynamicData.forEach((navDynamicData) => {
        const navAddress = navDynamicData.address;
        state.navsMap[navAddress] = {
          ...state.navsMap[navAddress],
          ...navDynamicData,
        };
      });
    })
    .addCase(getNavsDynamic.rejected, (state, { error, meta }) => {
      const navsAddresses = meta.arg.addresses;
      navsAddresses.forEach((address) => {
        state.statusMap.navsActionsStatusMap[address].get = { error: error.message };
      });
    })
    .addCase(getUserNavsPositions.pending, (state, { meta }) => {
      const navsAddresses = meta.arg.navsAddresses || [];
      navsAddresses.forEach((address) => {
        checkAndInitUserNavStatus(state, address);
        state.statusMap.user.userNavsActionsStatusMap[address].getPositions = { loading: true };
      });
      state.statusMap.user.getUserNavsPositions = { loading: true };
    })
    .addCase(getUserNavsPositions.fulfilled, (state, { meta, payload: { userNavsPositions } }) => {
      const navsPositionsMap = parsePositionsIntoMap(userNavsPositions);
      const navsAddresses = meta.arg.navsAddresses;
      navsAddresses?.forEach((address) => {
        state.statusMap.user.userNavsActionsStatusMap[address].getPositions = {};
      });

      const positionsAddresses: string[] = [];

      userNavsPositions.forEach((position) => {
        const address = position.assetAddress;
        positionsAddresses.push(address);
        const allowancesMap: any = {};
        position.assetAllowances.forEach((allowance) => (allowancesMap[allowance.spender] = allowance.amount));

        state.user.navsAllowancesMap[address] = allowancesMap;
      });

      const notIncludedAddresses = difference(navsAddresses ?? [], positionsAddresses);
      if (!positionsAddresses.length || notIncludedAddresses.length) {
        const addresses = union(positionsAddresses, notIncludedAddresses);
        addresses.forEach((address) => {
          const userNavsPositionsMapClone = { ...state.user.userNavsPositionsMap };
          delete userNavsPositionsMapClone[address];
          state.user.userNavsPositionsMap = { ...userNavsPositionsMapClone };
        });
      } else {
        state.user.userNavsPositionsMap = { ...state.user.userNavsPositionsMap, ...navsPositionsMap };
      }

      state.statusMap.user.getUserNavsPositions = {};
    })
    .addCase(getUserNavsPositions.rejected, (state, { meta, error }) => {
      const navsAddresses = meta.arg.navsAddresses || [];
      navsAddresses.forEach((address) => {
        state.statusMap.user.userNavsActionsStatusMap[address].getPositions = {};
      });
      state.statusMap.user.getUserNavsPositions = { error: error.message };
    })
    .addCase(setSelectedNavAddress, (state, { payload: { navAddress } }) => {
      state.selectedNavAddress = navAddress;
    })
    ////// GENERAL //////
    .addCase(approveDeposit.pending, (state, { meta }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].approveDeposit = { loading: true };
    })
    .addCase(approveDeposit.fulfilled, (state, { meta }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].approveDeposit = {};
    })
    .addCase(approveDeposit.rejected, (state, { meta, error }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].approveDeposit = { error: error.message };
    })
    .addCase(deposit.pending, (state, { meta }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].deposit = { loading: true };
    })
    .addCase(deposit.fulfilled, (state, { meta }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].deposit = {};
    })
    .addCase(deposit.rejected, (state, { meta, error }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].deposit = { error: error.message };
    })
    .addCase(approveWithdraw.pending, (state, { meta }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].approveWithdraw = { loading: true };
    })
    .addCase(approveWithdraw.fulfilled, (state, { meta }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].approveWithdraw = {};
    })
    .addCase(approveWithdraw.rejected, (state, { meta, error }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].approveWithdraw = { error: error.message };
    })
    .addCase(withdraw.pending, (state, { meta }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].withdraw = { loading: true };
    })
    .addCase(withdraw.fulfilled, (state, { meta }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].withdraw = {};
    })
    .addCase(withdraw.rejected, (state, { meta, error }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].withdraw = { error: error.message };
    })

    ////// yvBoost //////
    .addCase(yvBoostApproveDeposit.pending, (state, { meta }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].approveDeposit = { loading: true };
    })
    .addCase(yvBoostApproveDeposit.fulfilled, (state, { meta }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].approveDeposit = {};
    })
    .addCase(yvBoostApproveDeposit.rejected, (state, { meta, error }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].approveDeposit = { error: error.message };
    })
    .addCase(yvBoostDeposit.pending, (state, { meta }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].deposit = { loading: true };
    })
    .addCase(yvBoostDeposit.fulfilled, (state, { meta }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].deposit = {};
    })
    .addCase(yvBoostDeposit.rejected, (state, { meta, error }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].deposit = { error: error.message };
    })
    .addCase(yvBoostApproveZapOut.pending, (state, { meta }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].approveWithdraw = { loading: true };
    })
    .addCase(yvBoostApproveZapOut.fulfilled, (state, { meta }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].approveWithdraw = {};
    })
    .addCase(yvBoostApproveZapOut.rejected, (state, { meta, error }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].approveWithdraw = { error: error.message };
    })
    .addCase(yvBoostWithdraw.pending, (state, { meta }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].withdraw = { loading: true };
    })
    .addCase(yvBoostWithdraw.fulfilled, (state, { meta }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].withdraw = {};
    })
    .addCase(yvBoostWithdraw.rejected, (state, { meta, error }) => {
      const navAddress = meta.arg.navAddress;
      state.statusMap.navsActionsStatusMap[navAddress].withdraw = { error: error.message };
    })

    ////// yveCrv //////
    .addCase(yveCrvApproveDeposit.pending, (state, { meta }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[YVECRV].approveDeposit = { loading: true };
    })
    .addCase(yveCrvApproveDeposit.fulfilled, (state, { meta }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[YVECRV].approveDeposit = {};
    })
    .addCase(yveCrvApproveDeposit.rejected, (state, { meta, error }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[YVECRV].approveDeposit = { error: error.message };
    })
    .addCase(yveCrvDeposit.pending, (state, { meta }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[YVECRV].deposit = { loading: true };
    })
    .addCase(yveCrvDeposit.fulfilled, (state, { meta }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[YVECRV].deposit = {};
    })
    .addCase(yveCrvDeposit.rejected, (state, { meta, error }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[YVECRV].deposit = { error: error.message };
    })
    .addCase(yveCrvClaimReward.pending, (state) => {
      state.statusMap.navsActionsStatusMap[YVECRV].claimReward = { loading: true };
    })
    .addCase(yveCrvClaimReward.fulfilled, (state) => {
      state.statusMap.navsActionsStatusMap[YVECRV].claimReward = {};
    })
    .addCase(yveCrvClaimReward.rejected, (state, { error }) => {
      state.statusMap.navsActionsStatusMap[YVECRV].claimReward = { error: error.message };
    })
    .addCase(yveCrvApproveReinvest.pending, (state, { meta }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[YVECRV].approveReinvest = { loading: true };
    })
    .addCase(yveCrvApproveReinvest.fulfilled, (state, { meta }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[YVECRV].approveReinvest = {};
    })
    .addCase(yveCrvApproveReinvest.rejected, (state, { meta, error }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[YVECRV].approveReinvest = { error: error.message };
    })
    .addCase(yveCrvReinvest.pending, (state) => {
      state.statusMap.navsActionsStatusMap[YVECRV].reinvest = { loading: true };
    })
    .addCase(yveCrvReinvest.fulfilled, (state) => {
      state.statusMap.navsActionsStatusMap[YVECRV].reinvest = {};
    })
    .addCase(yveCrvReinvest.rejected, (state, { error }) => {
      state.statusMap.navsActionsStatusMap[YVECRV].reinvest = { error: error.message };
    })

    ////// yveCrv //////
    .addCase(yvBoostEthApproveInvest.pending, (state, { meta }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[PSLPYVBOOSTETH].approveInvest = { loading: true };
    })
    .addCase(yvBoostEthApproveInvest.fulfilled, (state, { meta }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[PSLPYVBOOSTETH].approveInvest = {};
    })
    .addCase(yvBoostEthApproveInvest.rejected, (state, { meta, error }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[PSLPYVBOOSTETH].approveInvest = { error: error.message };
    })
    .addCase(yvBoostEthInvest.pending, (state, { meta }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[PSLPYVBOOSTETH].invest = { loading: true };
    })
    .addCase(yvBoostEthInvest.fulfilled, (state, { meta }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[PSLPYVBOOSTETH].invest = {};
    })
    .addCase(yvBoostEthInvest.rejected, (state, { meta, error }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[PSLPYVBOOSTETH].invest = { error: error.message };
    })
    .addCase(yvBoostEthApproveStake.pending, (state, { meta }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[PSLPYVBOOSTETH].approveStake = { loading: true };
    })
    .addCase(yvBoostEthApproveStake.fulfilled, (state, { meta }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[PSLPYVBOOSTETH].approveStake = {};
    })
    .addCase(yvBoostEthApproveStake.rejected, (state, { meta, error }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[PSLPYVBOOSTETH].approveStake = { error: error.message };
    })
    .addCase(yvBoostEthStake.pending, (state, { meta }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[PSLPYVBOOSTETH].stake = { loading: true };
    })
    .addCase(yvBoostEthStake.fulfilled, (state, { meta }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[PSLPYVBOOSTETH].stake = {};
    })
    .addCase(yvBoostEthStake.rejected, (state, { meta, error }) => {
      // const { navAddress } = meta.arg;
      state.statusMap.navsActionsStatusMap[PSLPYVBOOSTETH].stake = { error: error.message };
    })
    .addCase(clearNavsData, (state) => {
      state.navsMap = {};
      state.navsAddresses = [];
    })
    .addCase(clearSelectedNavAndStatus, (state) => {
      if (!state.selectedNavAddress) return;
      const currentAddress = state.selectedNavAddress;
      state.statusMap.navsActionsStatusMap[currentAddress] = initialNavActionsStatusMap;
      state.selectedNavAddress = undefined;
    })
    .addCase(clearUserData, (state) => {
      state.user.navsAllowancesMap = {};
      state.user.userNavsPositionsMap = {};
    })
    .addCase(clearNavStatus, (state, { payload: { navAddress } }) => {
      state.statusMap.navsActionsStatusMap[navAddress] = initialNavActionsStatusMap;
    });
});

function checkAndInitUserNavStatus(state: NavsState, navAddress: string) {
  const actionsMap = state.statusMap.user.userNavsActionsStatusMap[navAddress];
  if (actionsMap) return;
  state.statusMap.user.userNavsActionsStatusMap[navAddress] = { ...initialUserNavsActionsStatusMap };
}

function parsePositionsIntoMap(positions: Position[]): { [navAddress: string]: NavsPositionsMap } {
  const grouped = groupBy(positions, 'assetAddress');
  const navsMap: { [navAddress: string]: any } = {};
  Object.entries(grouped).forEach(([key, value]) => {
    navsMap[key] = keyBy(value, 'typeId');
  });
  return navsMap;
}

export default navsReducer;
