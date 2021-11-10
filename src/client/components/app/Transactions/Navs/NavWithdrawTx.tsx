import { FC, useState, useEffect } from 'react';
import { keyBy } from 'lodash';

import { useAppSelector, useAppDispatch, useAppDispatchAndUnwrap, useDebounce, useAppTranslation } from '@hooks';
import {
  TokensSelectors,
  NavsSelectors,
  NavsActions,
  VaultsSelectors,
  VaultsActions,
  TokensActions,
  SettingsSelectors,
  NetworkSelectors,
} from '@store';
import {
  toBN,
  normalizeAmount,
  USDC_DECIMALS,
  validateVaultWithdraw,
  validateVaultWithdrawAllowance,
  validateSlippage,
  calculateSharesAmount,
} from '@utils';
import { getConfig } from '@config';

import { Transaction } from '../Transaction';

export interface NavWithdrawTxProps {
  onClose?: () => void;
}

export const NavWithdrawTx: FC<NavWithdrawTxProps> = ({ onClose, children, ...props }) => {
  const { t } = useAppTranslation('common');

  const dispatch = useAppDispatch();
  const dispatchAndUnwrap = useAppDispatchAndUnwrap();
  const { CONTRACT_ADDRESSES, NETWORK_SETTINGS } = getConfig();
  const [amount, setAmount] = useState('');
  const [debouncedAmount, isDebouncePending] = useDebounce(amount, 500);
  const [txCompleted, setTxCompleted] = useState(false);
  const currentNetwork = useAppSelector(NetworkSelectors.selectCurrentNetwork);
  const currentNetworkSettings = NETWORK_SETTINGS[currentNetwork];
  const selectedNav = useAppSelector(NavsSelectors.selectSelectedNav);
  const tokenSelectorFilter = useAppSelector(TokensSelectors.selectToken);
  const selectedNavToken = tokenSelectorFilter(selectedNav?.address ?? '');
  let zapOutTokens = useAppSelector(TokensSelectors.selectZapOutTokens);
  zapOutTokens = selectedNav?.allowZapOut ? zapOutTokens : [];
  const [selectedTargetTokenAddress, setSelectedTargetTokenAddress] = useState(selectedNav?.defaultDisplayToken ?? '');
  const selectedSlippage = useAppSelector(SettingsSelectors.selectDefaultSlippage);

  const targetTokensOptions = selectedNav
    ? [selectedNav.token, ...zapOutTokens.filter(({ address }) => address !== selectedNav.token.address)]
    : zapOutTokens;
  const targetTokensOptionsMap = keyBy(targetTokensOptions, 'address');
  const selectedTargetToken = targetTokensOptionsMap[selectedTargetTokenAddress];
  const expectedTxOutcome = useAppSelector(VaultsSelectors.selectExpectedTxOutcome);
  const expectedTxOutcomeStatus = useAppSelector(VaultsSelectors.selectExpectedTxOutcomeStatus);
  const actionsStatus = useAppSelector(NavsSelectors.selectSelectedNavActionsStatusMap);

  const yvTokenAmount = calculateSharesAmount({
    amount: toBN(debouncedAmount),
    decimals: selectedNav!.decimals,
    pricePerShare: selectedNav!.pricePerShare,
  });
  const yvTokenAmountNormalized = normalizeAmount(yvTokenAmount, toBN(selectedNav?.decimals).toNumber());

  const onExit = () => {
    dispatch(NavsActions.clearSelectedNavAndStatus());
    dispatch(VaultsActions.clearTransactionData());
    dispatch(TokensActions.setSelectedTokenAddress({ tokenAddress: undefined }));
  };

  useEffect(() => {
    return () => {
      onExit();
    };
  }, []);

  useEffect(() => {
    if (!selectedNav) return;

    dispatch(
      TokensActions.getTokenAllowance({
        tokenAddress: selectedNav.address,
        spenderAddress: CONTRACT_ADDRESSES.zapOut,
      })
    );
  }, [selectedTargetTokenAddress, selectedNav?.address]);

  useEffect(() => {
    if (!selectedNav) return;
    dispatch(NavsActions.clearNavStatus({ navAddress: selectedNav.address }));
  }, [debouncedAmount, selectedTargetTokenAddress, selectedNav]);

  useEffect(() => {
    if (!selectedNav || !selectedTargetTokenAddress) return;
    if (toBN(debouncedAmount).gt(0) && !inputError) {
      dispatch(
        VaultsActions.getExpectedTransactionOutcome({
          transactionType: 'WITHDRAW',
          sourceTokenAddress: selectedNav.address,
          sourceTokenAmount: yvTokenAmount,
          targetTokenAddress: selectedTargetTokenAddress,
        })
      );
    }
  }, [debouncedAmount]);

  if (!selectedNav || !selectedTargetToken || !targetTokensOptions) {
    return null;
  }

  // TODO: FIX WITH CORRECT NAV VALIDATIONS
  const { approved: isApproved, error: allowanceError } = validateVaultWithdrawAllowance({
    yvTokenAddress: selectedNav.address,
    yvTokenAmount: toBN(yvTokenAmountNormalized),
    yvTokenDecimals: selectedNav.decimals,
    underlyingTokenAddress: selectedNav.token.address,
    targetTokenAddress: selectedTargetTokenAddress,
    yvTokenAllowancesMap: selectedNav.allowancesMap,
  });

  const { approved: isValidAmount, error: inputError } = validateVaultWithdraw({
    yvTokenAmount: toBN(yvTokenAmountNormalized),
    yvTokenDecimals: selectedNav.decimals,
    userYvTokenBalance: selectedNav.DEPOSIT.userBalance,
  });

  const { error: slippageError } = validateSlippage({
    slippageTolerance: selectedSlippage,
    expectedSlippage: expectedTxOutcome?.slippage,
  });

  const selectedNavOption = {
    address: selectedNav.address,
    symbol: selectedNav.displayName,
    icon: selectedNav.displayIcon,
    balance: selectedNav.DEPOSIT.userBalance,
    balanceUsdc: selectedNav.DEPOSIT.userDepositedUsdc,
    decimals: toBN(selectedNav.decimals).toNumber(),
  };

  const amountValue = toBN(amount).times(normalizeAmount(selectedNavToken.priceUsdc, USDC_DECIMALS)).toString();
  const expectedAmount = toBN(debouncedAmount).gt(0)
    ? normalizeAmount(expectedTxOutcome?.targetUnderlyingTokenAmount, selectedNav?.token.decimals)
    : '';
  const expectedAmountValue = toBN(debouncedAmount).gt(0)
    ? normalizeAmount(expectedTxOutcome?.targetTokenAmountUsdc, USDC_DECIMALS)
    : '0';

  const sourceError = allowanceError || inputError;
  const targetStatus = {
    error:
      expectedTxOutcomeStatus.error ||
      actionsStatus.approveWithdraw.error ||
      actionsStatus.withdraw.error ||
      slippageError,
    loading: expectedTxOutcomeStatus.loading || isDebouncePending,
  };

  const loadingText = currentNetworkSettings.simulationsEnabled
    ? t('components.transaction.status.simulating')
    : t('components.transaction.status.calculating');

  const onSelectedTargetTokenChange = (tokenAddress: string) => {
    setAmount('');
    setSelectedTargetTokenAddress(tokenAddress);
  };

  const onTransactionCompletedDismissed = () => {
    if (onClose) onClose();
  };

  const approve = async () => {
    await dispatch(NavsActions.approveWithdraw({ navAddress: selectedNav.address }));
  };

  const withdraw = async () => {
    try {
      await dispatchAndUnwrap(
        NavsActions.withdraw({
          navAddress: selectedNav.address,
          amount: toBN(amount),
          tokenAddress: selectedTargetTokenAddress,
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
      status: actionsStatus.approveWithdraw,
      disabled: isApproved,
    },
    {
      label: t('components.transaction.withdraw'),
      onAction: withdraw,
      status: actionsStatus.withdraw,
      disabled: !isApproved || !isValidAmount || expectedTxOutcomeStatus.loading,
      contrast: true,
    },
  ];

  return (
    <Transaction
      transactionLabel={t('components.transaction.withdraw')}
      transactionCompleted={txCompleted}
      transactionCompletedLabel={t('components.transaction.status.exit')}
      onTransactionCompletedDismissed={onTransactionCompletedDismissed}
      sourceHeader={t('components.transaction.from-vault')}
      sourceAssetOptions={[selectedNavOption]}
      selectedSourceAsset={selectedNavOption}
      sourceAmount={amount}
      sourceAmountValue={amountValue}
      onSourceAmountChange={setAmount}
      targetHeader={t('components.transaction.to-wallet')}
      targetAssetOptions={targetTokensOptions}
      selectedTargetAsset={selectedTargetToken}
      onSelectedTargetAssetChange={onSelectedTargetTokenChange}
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
