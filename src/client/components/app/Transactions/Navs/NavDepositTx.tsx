import { FC, useState, useEffect } from 'react';
import { keyBy } from 'lodash';

import { useAppSelector, useAppDispatch, useAppDispatchAndUnwrap, useDebounce, useAppTranslation } from '@hooks';
import {
  TokensSelectors,
  NavsSelectors,
  NavsActions,
  TokensActions,
  VaultsActions,
  VaultsSelectors,
  SettingsSelectors,
  NetworkSelectors,
} from '@store';
import {
  toBN,
  normalizeAmount,
  toWei,
  USDC_DECIMALS,
  validateVaultDeposit,
  validateVaultAllowance,
  getZapInContractAddress,
  validateYvBoostEthActionsAllowance,
  validateSlippage,
  formatPercent,
} from '@utils';
import { getConfig } from '@config';

import { Transaction } from '../Transaction';

export interface NavDepositTxProps {
  onClose?: () => void;
}

export const NavDepositTx: FC<NavDepositTxProps> = ({ onClose }) => {
  const { t } = useAppTranslation('common');

  const dispatch = useAppDispatch();
  const dispatchAndUnwrap = useAppDispatchAndUnwrap();
  const { CONTRACT_ADDRESSES, NETWORK_SETTINGS } = getConfig();
  const { YVBOOST, PSLPYVBOOSTETH } = CONTRACT_ADDRESSES;
  const [amount, setAmount] = useState('');
  const [debouncedAmount, isDebouncePending] = useDebounce(amount, 500);
  const [txCompleted, setTxCompleted] = useState(false);
  const currentNetwork = useAppSelector(NetworkSelectors.selectCurrentNetwork);
  const currentNetworkSettings = NETWORK_SETTINGS[currentNetwork];
  const selectedNav = useAppSelector(NavsSelectors.selectSelectedNav);
  const selectedSellTokenAddress = useAppSelector(TokensSelectors.selectSelectedTokenAddress);
  let userTokens = useAppSelector(TokensSelectors.selectZapInTokens);
  userTokens = selectedNav?.allowZapIn ? userTokens : [];
  const selectedSlippage = useAppSelector(SettingsSelectors.selectDefaultSlippage);

  // TODO: ADD EXPECTED OUTCOME TO NAVS
  const expectedTxOutcome = useAppSelector(VaultsSelectors.selectExpectedTxOutcome);
  const expectedTxOutcomeStatus = useAppSelector(VaultsSelectors.selectExpectedTxOutcomeStatus);
  const actionsStatus = useAppSelector(NavsSelectors.selectSelectedNavActionsStatusMap);

  const sellTokensOptions = selectedNav
    ? [selectedNav.token, ...userTokens.filter(({ address }) => address !== selectedNav.token.address)]
    : userTokens;
  const sellTokensOptionsMap = keyBy(sellTokensOptions, 'address');
  const selectedSellToken = sellTokensOptionsMap[selectedSellTokenAddress ?? ''];

  const onExit = () => {
    dispatch(NavsActions.clearSelectedNavAndStatus());
    dispatch(VaultsActions.clearTransactionData());
    dispatch(TokensActions.setSelectedTokenAddress({ tokenAddress: undefined }));
  };

  useEffect(() => {
    if (!selectedSellTokenAddress && selectedNav) {
      dispatch(TokensActions.setSelectedTokenAddress({ tokenAddress: selectedNav.defaultDisplayToken }));
    }

    return () => {
      onExit();
    };
  }, []);

  useEffect(() => {
    if (!selectedNav || !selectedSellTokenAddress) return;

    const isZap = selectedSellTokenAddress !== selectedNav.token.address || selectedNav.address === PSLPYVBOOSTETH;
    const spenderAddress = isZap ? getZapInContractAddress(selectedNav.address) : selectedNav.address;

    dispatch(
      TokensActions.getTokenAllowance({
        tokenAddress: selectedSellTokenAddress,
        spenderAddress,
      })
    );
  }, [selectedSellTokenAddress, selectedNav?.address]);

  useEffect(() => {
    if (!selectedNav) return;
    dispatch(NavsActions.clearNavStatus({ navAddress: selectedNav.address }));
  }, [debouncedAmount, selectedSellTokenAddress, selectedNav]);

  // TODO: SET NAVS SIMULATION
  useEffect(() => {
    if (!selectedNav || !selectedSellTokenAddress) return;
    if (toBN(debouncedAmount).gt(0) && !inputError) {
      dispatch(
        VaultsActions.getExpectedTransactionOutcome({
          transactionType: 'DEPOSIT',
          sourceTokenAddress: selectedSellTokenAddress,
          sourceTokenAmount: toWei(debouncedAmount, selectedSellToken.decimals),
          targetTokenAddress: selectedNav.address,
        })
      );
    }
  }, [debouncedAmount]);

  if (!selectedNav || !selectedSellTokenAddress || !selectedSellToken || !sellTokensOptions) {
    return null;
  }

  let isApproved: boolean | undefined;
  let allowanceError: string | undefined;

  if (selectedNav.address === YVBOOST) {
    const { approved, error } = validateVaultAllowance({
      amount: toBN(debouncedAmount),
      vaultAddress: selectedNav.address,
      vaultUnderlyingTokenAddress: selectedNav.token.address,
      sellTokenAddress: selectedSellTokenAddress,
      sellTokenDecimals: selectedSellToken.decimals.toString(),
      sellTokenAllowancesMap: selectedSellToken.allowancesMap,
    });
    isApproved = approved;
    allowanceError = error;
  }

  if (selectedNav.address === PSLPYVBOOSTETH) {
    const { approved, error } = validateYvBoostEthActionsAllowance({
      action: 'INVEST',
      sellTokenAmount: toBN(debouncedAmount),
      sellTokenAddress: selectedSellTokenAddress,
      sellTokenDecimals: selectedSellToken.decimals.toString(),
      sellTokenAllowancesMap: selectedSellToken.allowancesMap,
    });
    isApproved = approved;
    allowanceError = error;
  }

  const { approved: isValidAmount, error: inputError } = validateVaultDeposit({
    sellTokenAmount: toBN(debouncedAmount),
    depositLimit: '0',
    emergencyShutdown: false,
    sellTokenDecimals: selectedSellToken.decimals.toString(),
    userTokenBalance: selectedSellToken.balance,
    vaultUnderlyingBalance: selectedNav.navBalance,
  });

  const { error: slippageError } = validateSlippage({
    slippageTolerance: selectedSlippage,
    expectedSlippage: expectedTxOutcome?.slippage,
  });

  const sourceError = allowanceError || inputError;

  const targetStatus = {
    error:
      expectedTxOutcomeStatus.error ||
      actionsStatus.approveDeposit.error ||
      actionsStatus.deposit.error ||
      slippageError,
    loading: expectedTxOutcomeStatus.loading || isDebouncePending,
  };

  const selectedNavOption = {
    address: selectedNav.address,
    symbol: selectedNav.displayName,
    icon: selectedNav.displayIcon,
    balance: selectedNav.DEPOSIT.userBalance,
    balanceUsdc: selectedNav.DEPOSIT.userDepositedUsdc,
    decimals: toBN(selectedNav.decimals).toNumber(),
    yield: formatPercent(selectedNav.apyData, 2),
  };

  const amountValue = toBN(amount).times(normalizeAmount(selectedSellToken.priceUsdc, USDC_DECIMALS)).toString();
  const expectedAmount = toBN(debouncedAmount).gt(0)
    ? normalizeAmount(expectedTxOutcome?.targetUnderlyingTokenAmount, selectedNav?.token.decimals)
    : '';
  const expectedAmountValue = toBN(debouncedAmount).gt(0)
    ? normalizeAmount(expectedTxOutcome?.targetTokenAmountUsdc, USDC_DECIMALS)
    : '0';

  const loadingText = currentNetworkSettings.simulationsEnabled
    ? t('components.transaction.status.simulating')
    : t('components.transaction.status.calculating');

  const onSelectedSellTokenChange = (tokenAddress: string) => {
    setAmount('');
    dispatch(TokensActions.setSelectedTokenAddress({ tokenAddress }));
  };

  const onSelectedNavChange = (navAddress: string) => {
    setAmount('');
    dispatch(NavsActions.setSelectedNavAddress({ navAddress }));
  };

  const onTransactionCompletedDismissed = () => {
    if (onClose) onClose();
  };

  const approve = async () => {
    await dispatch(
      NavsActions.approveDeposit({
        navAddress: selectedNav.address,
        tokenAddress: selectedSellToken.address,
      })
    );
  };

  const deposit = async () => {
    try {
      await dispatchAndUnwrap(
        NavsActions.deposit({
          navAddress: selectedNav.address,
          tokenAddress: selectedSellToken.address,
          amount: toBN(amount),
          slippageTolerance: selectedSlippage,
        })
      );
      setTxCompleted(true);
    } catch (error) {}
  };

  const txActions = [
    {
      label: t('components.transaction.approve'),
      onAction: approve,
      status: actionsStatus.approveDeposit,
      disabled: isApproved,
    },
    {
      label: t('components.transaction.deposit'),
      onAction: deposit,
      status: actionsStatus.deposit,
      disabled: !isApproved || !isValidAmount || expectedTxOutcomeStatus.loading,
      contrast: true,
    },
  ];

  return (
    // TODO Check transactionCompletedLabel (I think it's not used)
    <Transaction
      transactionLabel={t('components.transaction.deposit')}
      transactionCompleted={txCompleted}
      transactionCompletedLabel={t('components.transaction.status.exit')}
      onTransactionCompletedDismissed={onTransactionCompletedDismissed}
      sourceHeader={t('components.transaction.from-wallet')}
      sourceAssetOptions={sellTokensOptions}
      selectedSourceAsset={selectedSellToken}
      onSelectedSourceAssetChange={onSelectedSellTokenChange}
      sourceAmount={amount}
      sourceAmountValue={amountValue}
      onSourceAmountChange={setAmount}
      targetHeader={t('components.transaction.to-vault')}
      targetAssetOptions={[selectedNavOption]}
      selectedTargetAsset={selectedNavOption}
      onSelectedTargetAssetChange={onSelectedNavChange}
      targetAmount={expectedAmount}
      targetAmountValue={expectedAmountValue}
      targetStatus={targetStatus}
      actions={txActions}
      sourceStatus={{ error: sourceError }}
      loadingText={loadingText}
      onClose={onClose}
    />
  );
};
