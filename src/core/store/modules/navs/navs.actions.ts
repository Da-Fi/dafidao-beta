import { createAction, createAsyncThunk, unwrapResult } from '@reduxjs/toolkit';
import BigNumber from 'bignumber.js';

import { ThunkAPI } from '@frameworks/redux';
import { Nav, NavDynamic, Position } from '@types';
import {
  calculateSharesAmount,
  handleTransaction,
  normalizeAmount,
  toBN,
  validateVaultAllowance,
  validateVaultDeposit,
  validateVaultWithdraw,
  validateVaultWithdrawAllowance,
  validateYvBoostEthActionsAllowance,
  getZapInContractAddress,
  validateYveCrvActionsAllowance,
} from '@utils';
import { getConfig } from '@config';

import { VaultsActions } from '../vaults/vaults.actions';
import { AlertsActions } from '../alerts/alerts.actions';
import { TokensActions } from '../tokens/tokens.actions';

const { THREECRV, YVECRV, PSLPYVBOOSTETH, PSLPYVBOOSTETH_GAUGE } = getConfig().CONTRACT_ADDRESSES;

const setSelectedNavAddress = createAction<{ navAddress?: string }>('navs/setSelectedNavAddress');
const clearNavsData = createAction<void>('navs/clearNavsData');
const clearSelectedNavAndStatus = createAction<void>('navs/clearSelectedNavAndStatus');
const clearNavStatus = createAction<{ navAddress: string }>('navs/clearNavStatus');
const clearUserData = createAction<void>('navs/clearUserData');

const initiateNavs = createAsyncThunk<void, string | undefined, ThunkAPI>(
  'navs/initiateNavs',
  async (_arg, { dispatch }) => {
    await dispatch(getNavs());
  }
);

const getNavs = createAsyncThunk<{ navsData: Nav[] }, void, ThunkAPI>(
  'navs/getNavs',
  async (_arg, { getState, extra, dispatch }) => {
    const { network } = getState();
    const { navService } = extra.services;
    const { NETWORK_SETTINGS } = extra.config;

    if (!NETWORK_SETTINGS[network.current].navsEnabled) return { navsData: [] };

    dispatch(getYveCrvExtraData({}));
    const { navsData, errors } = await navService.getSupportedNavs({ network: network.current });
    errors.forEach((error) => {
      dispatch(AlertsActions.openAlert({ message: error, type: 'error', persistent: true }));
    });
    return { navsData };
  }
);

const getNavsDynamic = createAsyncThunk<{ navsDynamicData: NavDynamic[] }, { addresses: string[] }, ThunkAPI>(
  'navs/getNavsDynamic',
  async ({ addresses }, { getState, extra, dispatch }) => {
    const { network } = getState();
    const { navService } = extra.services;
    const { NETWORK_SETTINGS } = extra.config;

    if (!NETWORK_SETTINGS[network.current].navsEnabled) return { navsDynamicData: [] };

    const [navsDynamicData] = await Promise.all([
      navService.getNavsDynamicData({ network: network.current }), // TODO pass addresses. waitint to xgaminto to merge his stuff to avoid conficts y nav service
      dispatch(getYveCrvExtraData({ fetchDynamicData: true })),
    ]);
    return { navsDynamicData };
  }
);

const getUserNavsPositions = createAsyncThunk<
  { userNavsPositions: Position[] },
  { navsAddresses?: string[] },
  ThunkAPI
>('navs/getUserNavsPositions', async ({ navsAddresses }, { extra, getState, dispatch }) => {
  const { network, wallet } = getState();
  const { navService } = extra.services;
  const { NETWORK_SETTINGS } = extra.config;
  const userAddress = wallet.selectedAddress;

  if (!userAddress) {
    throw new Error('WALLET NOT CONNECTED');
  }
  if (!NETWORK_SETTINGS[network.current].navsEnabled) return { userNavsPositions: [] };

  const [userNavsPositionsResponse] = await Promise.all([
    navService.getUserNavsPositions({ network: network.current, userAddress }), // TODO pass addresses. waitint to xgaminto to merge his stuff to avoid conficts y nav service
    dispatch(getUserYveCrvExtraData()),
  ]);
  const { positions, errors } = userNavsPositionsResponse;
  errors.forEach((error) => dispatch(AlertsActions.openAlert({ message: error, type: 'error', persistent: true })));
  return { userNavsPositions: positions };
});

const getYveCrvExtraData = createAsyncThunk<void, { fetchDynamicData?: boolean }, ThunkAPI>(
  'navs/getYveCrvExtraData',
  async ({ fetchDynamicData }, { dispatch }) => {
    const YVTHREECRV = getConfig().CONTRACT_ADDRESSES.YVTHREECRV;
    if (fetchDynamicData) {
      await dispatch(VaultsActions.getVaultsDynamic({ addresses: [YVTHREECRV] }));
      return;
    }
    await dispatch(VaultsActions.getVaults({ addresses: [YVTHREECRV] }));
  }
);

const getUserYveCrvExtraData = createAsyncThunk<void, void, ThunkAPI>(
  'navs/getUserYveCrvExtraData',
  async (_args, { dispatch }) => {
    const YVTHREECRV = getConfig().CONTRACT_ADDRESSES.YVTHREECRV;
    await dispatch(VaultsActions.getUserVaultsPositions({ vaultAddresses: [YVTHREECRV] }));
  }
);

// -------------------- GENERAL ACTIONS --------------------

interface ApproveDepositProps {
  navAddress: string;
  tokenAddress: string;
}

interface DepositProps {
  navAddress: string;
  tokenAddress: string;
  amount: BigNumber;
  slippageTolerance?: number;
}

interface ApproveWithdrawProps {
  navAddress: string;
}

interface WithdrawProps {
  navAddress: string;
  tokenAddress: string;
  amount: BigNumber;
  slippageTolerance?: number;
}

const approveDeposit = createAsyncThunk<void, ApproveDepositProps, ThunkAPI>(
  'navs/approveDeposit',
  async ({ navAddress, tokenAddress }, { dispatch, getState, extra }) => {
    const { navs } = getState();
    const navData = navs.navsMap[navAddress];
    const isZapin = tokenAddress !== navData.token || navAddress === PSLPYVBOOSTETH;
    const spenderAddress = isZapin ? getZapInContractAddress(navAddress) : navAddress;
    const result = await dispatch(TokensActions.approve({ tokenAddress, spenderAddress }));
    unwrapResult(result);
  }
);

const deposit = createAsyncThunk<void, DepositProps, ThunkAPI>(
  'navs/deposit',
  async ({ navAddress, tokenAddress, amount, slippageTolerance }, { dispatch, getState, extra }) => {
    const { services } = extra;
    const { navService } = services;
    const { wallet, navs, tokens, network } = getState();

    const userAddress = wallet.selectedAddress;
    if (!userAddress) throw new Error('WALLET NOT CONNECTED');

    const navData = navs.navsMap[navAddress];
    const tokenData = tokens.tokensMap[tokenAddress];
    const userTokenData = tokens.user.userTokensMap[tokenAddress];
    const tokenAllowancesMap = tokens.user.userTokensAllowancesMap[tokenAddress] ?? {};
    const decimals = toBN(tokenData.decimals);
    const ONE_UNIT = toBN('10').pow(decimals);
    const amountInWei = amount.multipliedBy(ONE_UNIT);

    const { error: allowanceError } = validateVaultAllowance({
      amount,
      vaultAddress: navAddress,
      vaultUnderlyingTokenAddress: navData.tokenId,
      sellTokenAddress: tokenAddress,
      sellTokenDecimals: tokenData.decimals,
      sellTokenAllowancesMap: tokenAllowancesMap,
    });

    const { error: depositError } = validateVaultDeposit({
      sellTokenAmount: amount,
      depositLimit: navData?.metadata.depositLimit ?? '0',
      emergencyShutdown: navData?.metadata.emergencyShutdown || false,
      sellTokenDecimals: tokenData?.decimals ?? '0',
      userTokenBalance: userTokenData?.balance ?? '0',
      vaultUnderlyingBalance: navData?.underlyingTokenBalance.amount ?? '0',
    });

    const error = allowanceError || depositError;
    if (error) throw new Error(error);

    const tx = await navService.deposit({
      network: network.current,
      accountAddress: userAddress,
      tokenAddress: tokenData.address,
      vaultAddress: navAddress,
      amount: amountInWei.toString(),
      slippageTolerance,
    });
    await handleTransaction(tx, network.current);

    dispatch(getNavsDynamic({ addresses: [navAddress] }));
    dispatch(getUserNavsPositions({ navsAddresses: [navAddress] }));
    dispatch(TokensActions.getUserTokens({ addresses: [tokenAddress, navAddress] }));
  }
);

const approveWithdraw = createAsyncThunk<void, ApproveWithdrawProps, ThunkAPI>(
  'navs/approveWithdraw',
  async ({ navAddress }, { dispatch }) => {
    try {
      const ZAP_OUT_CONTRACT_ADDRESS = getConfig().CONTRACT_ADDRESSES.zapOut;
      const result = await dispatch(
        TokensActions.approve({ tokenAddress: navAddress, spenderAddress: ZAP_OUT_CONTRACT_ADDRESS })
      );
      unwrapResult(result);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
);

const withdraw = createAsyncThunk<void, WithdrawProps, ThunkAPI>(
  'navs/withdraw',
  async ({ navAddress, amount, tokenAddress, slippageTolerance }, { dispatch, extra, getState }) => {
    const { services } = extra;
    const { navService } = services;
    const { wallet, navs, tokens, network } = getState();

    const userAddress = wallet.selectedAddress;
    if (!userAddress) throw new Error('WALLET NOT CONNECTED');

    const navData = navs.navsMap[navAddress];
    const tokenData = tokens.tokensMap[navData.tokenId];
    const navAllowancesMap = tokens.user.userTokensAllowancesMap[navAddress];
    const userNavData = navs.user.userNavsPositionsMap[navAddress]?.DEPOSIT;

    const amountOfShares = calculateSharesAmount({
      amount,
      decimals: tokenData.decimals,
      pricePerShare: navData.metadata.pricePerShare,
    });

    const { error: allowanceError } = validateVaultWithdrawAllowance({
      yvTokenAddress: navAddress,
      yvTokenAmount: toBN(normalizeAmount(amountOfShares, parseInt(tokenData.decimals))),
      targetTokenAddress: tokenAddress,
      underlyingTokenAddress: tokenData.address ?? '',
      yvTokenDecimals: tokenData.decimals.toString() ?? '0',
      yvTokenAllowancesMap: navAllowancesMap ?? {},
    });

    const { error: withdrawError } = validateVaultWithdraw({
      yvTokenAmount: toBN(normalizeAmount(amountOfShares, parseInt(tokenData.decimals))),
      userYvTokenBalance: userNavData.balance ?? '0',
      yvTokenDecimals: tokenData.decimals.toString() ?? '0', // check if its ok to use underlyingToken decimals as vault decimals
    });

    const error = withdrawError || allowanceError;
    if (error) throw new Error(error);

    const tx = await navService.withdraw({
      network: network.current,
      accountAddress: userAddress,
      tokenAddress: navData.tokenId,
      vaultAddress: navAddress,
      amountOfShares,
      slippageTolerance,
    });
    await handleTransaction(tx, network.current);

    dispatch(getNavsDynamic({ addresses: [navAddress] }));
    dispatch(getUserNavsPositions({ navsAddresses: [navAddress] }));
    dispatch(TokensActions.getUserTokens({ addresses: [tokenAddress, navAddress] }));
  }
);

// -------------------- YVBOOST --------------------

const yvBoostApproveDeposit = createAsyncThunk<void, ApproveDepositProps, ThunkAPI>(
  'navs/yvBoost/yvBoostApproveDeposit',
  async ({ navAddress, tokenAddress }, { dispatch, getState }) => {
    try {
      const navData = getState().navs.navsMap[navAddress];
      const isZapin = navData.tokenId !== tokenAddress;
      const spenderAddress = isZapin ? getConfig().CONTRACT_ADDRESSES.zapIn : navAddress;
      const result = await dispatch(TokensActions.approve({ tokenAddress: tokenAddress, spenderAddress }));
      unwrapResult(result);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
);

const yvBoostDeposit = createAsyncThunk<void, DepositProps, ThunkAPI>(
  'navs/yvBoost/yvBoostDeposit',
  async ({ navAddress, tokenAddress, amount }, { dispatch, getState, extra }) => {
    const { wallet } = getState();
    const { services } = extra;
    const userAddress = wallet.selectedAddress;
    if (!userAddress) {
      throw new Error('WALLET NOT CONNECTED');
    }
    const navData = getState().navs.navsMap[navAddress];
    const tokenData = getState().tokens.tokensMap[tokenAddress];
    const userTokenData = getState().tokens.user.userTokensMap[tokenAddress];
    const tokenAllowancesMap = getState().tokens.user.userTokensAllowancesMap[tokenAddress] ?? {};
    const decimals = toBN(tokenData.decimals);
    const ONE_UNIT = toBN('10').pow(decimals);

    const { error: allowanceError } = validateVaultAllowance({
      amount,
      vaultAddress: navAddress,
      vaultUnderlyingTokenAddress: navData.tokenId,
      sellTokenAddress: tokenAddress,
      sellTokenDecimals: tokenData.decimals,
      sellTokenAllowancesMap: tokenAllowancesMap,
    });

    const { error: depositError } = validateVaultDeposit({
      sellTokenAmount: amount,
      depositLimit: navData?.metadata.depositLimit ?? '0',
      emergencyShutdown: navData?.metadata.emergencyShutdown || false,
      sellTokenDecimals: tokenData?.decimals ?? '0',
      userTokenBalance: userTokenData?.balance ?? '0',
      vaultUnderlyingBalance: navData?.underlyingTokenBalance.amount ?? '0',
    });
    const error = allowanceError || depositError;
    if (error) throw new Error(error);

    const amountInWei = amount.multipliedBy(ONE_UNIT);
    const { navService } = services;
    // const tx = await navService.yvBoostDeposit({
    //   accountAddress: userAddress,
    //   tokenAddress: tokenData.address,
    //   navAddress,
    //   amount: amountInWei.toString(),
    // });
    // await handleTransaction(tx, network.current);
    dispatch(getNavsDynamic({ addresses: [navAddress] }));
    dispatch(getUserNavsPositions({ navsAddresses: [navAddress] }));
    dispatch(TokensActions.getUserTokens({ addresses: [tokenAddress, navAddress] }));
  }
);

const yvBoostApproveZapOut = createAsyncThunk<void, { navAddress: string }, ThunkAPI>(
  'navs/yvBoost/yvBoostApproveZapOut',
  async ({ navAddress }, { dispatch }) => {
    try {
      const ZAP_OUT_CONTRACT_ADDRESS = getConfig().CONTRACT_ADDRESSES.zapOut;
      const result = await dispatch(
        TokensActions.approve({ tokenAddress: navAddress, spenderAddress: ZAP_OUT_CONTRACT_ADDRESS })
      );
      unwrapResult(result);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
);

const yvBoostWithdraw = createAsyncThunk<
  void,
  { navAddress: string; amount: BigNumber; targetTokenAddress: string },
  ThunkAPI
>('navs/yvBoost/yvBoostWithdraw', async ({ navAddress, amount, targetTokenAddress }, { dispatch, extra, getState }) => {
  const { wallet } = getState();
  const { services } = extra;
  const userAddress = wallet.selectedAddress;
  if (!userAddress) {
    throw new Error('WALLET NOT CONNECTED');
  }
  const navData = getState().navs.navsMap[navAddress];
  const tokenData = getState().tokens.tokensMap[navData.tokenId];
  const navAllowancesMap = getState().tokens.user.userTokensAllowancesMap[navAddress];
  const userNavData = getState().navs.user.userNavsPositionsMap[navAddress]?.DEPOSIT;

  const amountOfShares = calculateSharesAmount({
    amount,
    decimals: tokenData.decimals,
    pricePerShare: navData.metadata.pricePerShare,
  });

  const { error: allowanceError } = validateVaultWithdrawAllowance({
    yvTokenAddress: navAddress,
    yvTokenAmount: toBN(normalizeAmount(amountOfShares, parseInt(tokenData.decimals))),
    targetTokenAddress: targetTokenAddress,
    underlyingTokenAddress: tokenData.address ?? '',
    yvTokenDecimals: tokenData.decimals.toString() ?? '0',
    yvTokenAllowancesMap: navAllowancesMap ?? {},
  });

  const { error: withdrawError } = validateVaultWithdraw({
    yvTokenAmount: toBN(normalizeAmount(amountOfShares, parseInt(tokenData.decimals))),
    userYvTokenBalance: userNavData.balance ?? '0',
    yvTokenDecimals: tokenData.decimals.toString() ?? '0', // check if its ok to use underlyingToken decimals as vault decimals
  });

  const error = withdrawError || allowanceError;
  if (error) throw new Error(error);

  const { navService } = services;
  // const tx = await navService.withdraw({
  //   accountAddress: userAddress,
  //   tokenAddress: navData.tokenId,
  //   navAddress,
  //   amountOfShares,
  // });
  // await handleTransaction(tx, network.current);

  dispatch(getNavsDynamic({ addresses: [navAddress] }));
  dispatch(getUserNavsPositions({ navsAddresses: [navAddress] }));
  dispatch(TokensActions.getUserTokens({ addresses: [targetTokenAddress, navAddress] }));
});

// -------------------- BACKSCRATCHER --------------------

const yveCrvApproveDeposit = createAsyncThunk<void, ApproveDepositProps, ThunkAPI>(
  'navs/yveCrv/yveCrvApproveDeposit',
  async ({ navAddress, tokenAddress }, { dispatch }) => {
    try {
      const result = await dispatch(TokensActions.approve({ tokenAddress, spenderAddress: navAddress }));
      unwrapResult(result);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
);

const yveCrvDeposit = createAsyncThunk<void, DepositProps, ThunkAPI>(
  'navs/yveCrv/yveCrvDeposit',
  async ({ navAddress, tokenAddress, amount }, { dispatch, getState, extra }) => {
    const { network, wallet } = getState();
    const { services } = extra;
    const userAddress = wallet.selectedAddress;
    if (!userAddress) {
      throw new Error('WALLET NOT CONNECTED');
    }
    const navData = getState().navs.navsMap[navAddress];
    const tokenData = getState().tokens.tokensMap[tokenAddress];
    const userTokenData = getState().tokens.user.userTokensMap[tokenAddress];
    const tokenAllowancesMap = getState().tokens.user.userTokensAllowancesMap[tokenAddress] ?? {};
    const decimals = toBN(tokenData.decimals);
    const ONE_UNIT = toBN('10').pow(decimals);
    const amountInWei = amount.multipliedBy(ONE_UNIT);

    // TODO: validations

    const { navService } = services;
    const tx = await navService.lock({
      network: network.current,
      accountAddress: userAddress,
      tokenAddress: tokenData.address,
      vaultAddress: navAddress,
      amount: amountInWei.toString(),
    });
    await handleTransaction(tx, network.current);

    dispatch(getNavsDynamic({ addresses: [navAddress] }));
    dispatch(getUserNavsPositions({ navsAddresses: [navAddress] }));
    dispatch(TokensActions.getUserTokens({ addresses: [tokenAddress, navAddress] }));
  }
);

const yveCrvClaimReward = createAsyncThunk<void, void, ThunkAPI>(
  'navs/yveCrv/yveCrvClaimReward',
  async (_args, { dispatch, extra, getState }) => {
    const { network, wallet } = getState();
    const { services } = extra;
    const userAddress = wallet.selectedAddress;
    if (!userAddress) throw new Error('WALLET NOT CONNECTED');

    // TODO validations.

    const { navService } = services;
    const tx = await navService.claim({
      network: network.current,
      accountAddress: userAddress,
    });
    await handleTransaction(tx, network.current);

    dispatch(getNavsDynamic({ addresses: [YVECRV] }));
    dispatch(getUserNavsPositions({ navsAddresses: [YVECRV] }));
    dispatch(TokensActions.getUserTokens({ addresses: [THREECRV, YVECRV] }));
  }
);

const yveCrvApproveReinvest = createAsyncThunk<void, { navAddress: string; tokenAddress: string }, ThunkAPI>(
  'navs/yveCrv/yveCrvApproveReinvest',
  async ({ navAddress, tokenAddress }, { dispatch }) => {
    const { CONTRACT_ADDRESSES } = getConfig();
    const { THREECRV, y3CrvBackZapper } = CONTRACT_ADDRESSES;
    const result = await dispatch(TokensActions.approve({ tokenAddress: THREECRV, spenderAddress: y3CrvBackZapper }));
    unwrapResult(result);
  }
);

const yveCrvReinvest = createAsyncThunk<void, void, ThunkAPI>(
  'navs/yveCrv/yveCrvReinvest',
  async (_args, { dispatch, extra, getState }) => {
    const { network, wallet } = getState();
    const { services } = extra;
    const userAddress = wallet.selectedAddress;
    if (!userAddress) throw new Error('WALLET NOT CONNECTED');

    const tokenData = getState().tokens.tokensMap[THREECRV];
    const tokenAllowancesMap = getState().tokens.user.userTokensAllowancesMap[THREECRV];
    const amount = getState().navs.user.userNavsPositionsMap[YVECRV].YIELD.underlyingTokenBalance.amount;

    const { error: allowanceError } = validateYveCrvActionsAllowance({
      action: 'REINVEST',
      navAddress: YVECRV,
      sellTokenAmount: toBN(amount),
      sellTokenAddress: tokenData.address,
      sellTokenDecimals: tokenData.decimals.toString(),
      sellTokenAllowancesMap: tokenAllowancesMap,
    });

    // TODO validations for action.

    const error = allowanceError;
    if (error) throw new Error(error);

    const { navService } = services;
    const tx = await navService.reinvest({
      network: network.current,
      accountAddress: userAddress,
    });
    await handleTransaction(tx, network.current);

    dispatch(getNavsDynamic({ addresses: [YVECRV] }));
    dispatch(getUserNavsPositions({ navsAddresses: [YVECRV] }));
    dispatch(TokensActions.getUserTokens({ addresses: [THREECRV] }));
    dispatch(getYveCrvExtraData({ fetchDynamicData: true }));
    dispatch(getUserYveCrvExtraData());
  }
);

// -------------------- YVBOOST-ETH --------------------

const yvBoostEthApproveInvest = createAsyncThunk<void, ApproveDepositProps, ThunkAPI>(
  'navs/yvBoostEth/yvBoostEthApproveInvest',
  async ({ tokenAddress }, { dispatch }) => {
    // tokenAddress is anyToken.
    try {
      const result = await dispatch(
        TokensActions.approve({ tokenAddress, spenderAddress: getZapInContractAddress(PSLPYVBOOSTETH) })
      );
      unwrapResult(result);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
);

const yvBoostEthInvest = createAsyncThunk<void, DepositProps, ThunkAPI>(
  'navs/yvBoostEth/yvBoostEthInvest',
  async ({ navAddress, tokenAddress, amount }, { dispatch, extra, getState }) => {
    // navAddress is PSLPYVBOOSTETH
    const { wallet } = getState();
    const { services } = extra;
    const userAddress = wallet.selectedAddress;
    if (!userAddress) {
      throw new Error('WALLET NOT CONNECTED');
    }

    const navData = getState().navs.navsMap[navAddress];
    const tokenData = getState().tokens.tokensMap[tokenAddress];
    const userTokenData = getState().tokens.user.userTokensMap[tokenAddress];
    const tokenAllowancesMap = getState().tokens.user.userTokensAllowancesMap[tokenAddress] ?? {};
    const decimals = toBN(tokenData.decimals);
    const ONE_UNIT = toBN('10').pow(decimals);

    const { error: allowanceError } = validateYvBoostEthActionsAllowance({
      action: 'INVEST',
      sellTokenAddress: tokenAddress,
      sellTokenAmount: amount,
      sellTokenDecimals: tokenData.decimals,
      sellTokenAllowancesMap: tokenAllowancesMap,
    });

    const { error: depositError } = validateVaultDeposit({
      sellTokenAmount: amount,
      sellTokenDecimals: tokenData?.decimals ?? '0',
      userTokenBalance: userTokenData?.balance ?? '0',
      vaultUnderlyingBalance: navData?.underlyingTokenBalance.amount ?? '0',
      depositLimit: navData?.metadata.depositLimit ?? '0',
      emergencyShutdown: navData?.metadata.emergencyShutdown || false,
    });

    const error = allowanceError || depositError;
    if (error) throw new Error(error);

    const { navService } = services;
    // const tx = await navService.yvBoostEthInvest({
    //   accountAddress: userAddress,
    //   tokenAddress: tokenData.address,
    //   amount: amountInWei.toString(),
    // });
    // await handleTransaction(tx, network.current);

    dispatch(getNavsDynamic({ addresses: [PSLPYVBOOSTETH] }));
    dispatch(getUserNavsPositions({ navsAddresses: [PSLPYVBOOSTETH] }));
    dispatch(TokensActions.getUserTokens({ addresses: [tokenAddress, PSLPYVBOOSTETH] }));
  }
);

const yvBoostEthApproveStake = createAsyncThunk<void, { navAddress: string }, ThunkAPI>(
  'navs/yveCrv/yvBoostEthApproveStake',
  async (args, { dispatch }) => {
    try {
      const result = await dispatch(
        TokensActions.approve({ tokenAddress: PSLPYVBOOSTETH, spenderAddress: PSLPYVBOOSTETH_GAUGE })
      );
      unwrapResult(result);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
);

const yvBoostEthStake = createAsyncThunk<void, DepositProps, ThunkAPI>(
  'navs/yvBoostEth/yvBoostEthStake',
  async ({ navAddress, amount }, { dispatch, extra, getState }) => {
    const { network, wallet } = getState();
    const { services } = extra;
    const userAddress = wallet.selectedAddress;
    if (!userAddress) {
      throw new Error('WALLET NOT CONNECTED');
    }
    const tokenAddress = PSLPYVBOOSTETH;
    const navData = getState().navs.navsMap[navAddress];
    const tokenData = getState().tokens.tokensMap[tokenAddress];
    const userTokenData = getState().tokens.user.userTokensMap[tokenAddress];
    const tokenAllowancesMap = getState().tokens.user.userTokensAllowancesMap[tokenAddress] ?? {};
    const decimals = toBN(tokenData.decimals);
    const ONE_UNIT = toBN('10').pow(decimals);
    const amountInWei = amount.multipliedBy(ONE_UNIT);

    const { error: allowanceError } = validateYvBoostEthActionsAllowance({
      action: 'STAKE',
      sellTokenAddress: tokenAddress,
      sellTokenAmount: amount,
      sellTokenDecimals: tokenData.decimals,
      sellTokenAllowancesMap: tokenAllowancesMap,
    });

    const { error: depositError } = validateVaultDeposit({
      sellTokenAmount: amount,
      sellTokenDecimals: tokenData?.decimals ?? '0',
      userTokenBalance: userTokenData?.balance ?? '0',
      vaultUnderlyingBalance: navData?.underlyingTokenBalance.amount ?? '0',
      depositLimit: navData?.metadata.depositLimit ?? '0',
      emergencyShutdown: navData?.metadata.emergencyShutdown || false,
    });

    const error = allowanceError || depositError;
    if (error) throw new Error(error);

    const { navService } = services;
    const tx = await navService.stake({
      network: network.current,
      accountAddress: userAddress,
      tokenAddress: tokenData.address,
      vaultAddress: navAddress,
      amount: amountInWei.toString(),
    });
    await handleTransaction(tx, network.current);

    dispatch(getNavsDynamic({ addresses: [PSLPYVBOOSTETH] }));
    dispatch(getUserNavsPositions({ navsAddresses: [PSLPYVBOOSTETH] }));
    dispatch(TokensActions.getUserTokens({ addresses: [PSLPYVBOOSTETH] }));
  }
);

// ----------------------------------------

export const NavsActions = {
  initiateNavs,
  getNavs,
  getNavsDynamic,
  getUserNavsPositions,
  getYveCrvExtraData,
  getUserYveCrvExtraData,
  setSelectedNavAddress,
  approveDeposit,
  deposit,
  approveWithdraw,
  withdraw,
  clearNavsData,
  clearSelectedNavAndStatus,
  clearNavStatus,
  clearUserData,
  yvBoost: {
    yvBoostApproveDeposit,
    yvBoostDeposit,
    yvBoostApproveZapOut,
    yvBoostWithdraw,
  },
  yveCrv: {
    yveCrvApproveDeposit,
    yveCrvDeposit,
    yveCrvClaimReward,
    yveCrvApproveReinvest,
    yveCrvReinvest,
  },
  yvBoostEth: {
    yvBoostEthApproveInvest,
    yvBoostEthInvest,
    yvBoostEthApproveStake,
    yvBoostEthStake,
  },
};
