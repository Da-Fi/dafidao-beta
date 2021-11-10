import { FC, useState, useEffect } from 'react';

import { useAppSelector, useAppDispatch, useAppDispatchAndUnwrap, useDebounce, useAppTranslation } from '@hooks';
import { TokensSelectors, NavsSelectors, NavsActions, TokensActions, VaultsActions } from '@store';
import {
  toBN,
  normalizeAmount,
  USDC_DECIMALS,
  validateVaultDeposit,
  validateYvBoostEthActionsAllowance,
  getStakingContractAddress,
  formatPercent,
} from '@utils';

import { Transaction } from '../Transaction';

export interface NavStakeTxProps {
  onClose?: () => void;
}

export const NavStakeTx: FC<NavStakeTxProps> = ({ onClose, children, ...props }) => {
  const { t } = useAppTranslation('common');

  const dispatch = useAppDispatch();
  const dispatchAndUnwrap = useAppDispatchAndUnwrap();
  const [amount, setAmount] = useState('');
  const [txCompleted, setTxCompleted] = useState(false);
  const [debouncedAmount] = useDebounce(amount, 500);
  const selectedNav = useAppSelector(NavsSelectors.selectSelectedNav);
  const tokenSelectorFilter = useAppSelector(TokensSelectors.selectToken);
  const selectedSellToken = tokenSelectorFilter(selectedNav?.address ?? '');
  selectedSellToken.balance = selectedNav?.DEPOSIT.userBalance ?? '0';
  selectedSellToken.balanceUsdc = selectedNav?.DEPOSIT.userDepositedUsdc ?? '0';
  const selectedSellTokenAddress = selectedSellToken.address;
  const sellTokensOptions = [selectedSellToken];
  const actionsStatus = useAppSelector(NavsSelectors.selectSelectedNavActionsStatusMap);

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
    if (!selectedNav || !selectedSellTokenAddress) return;

    const spenderAddress = getStakingContractAddress(selectedNav.address);
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
  }, [debouncedAmount]);

  if (!selectedNav || !selectedSellTokenAddress || !selectedSellToken) {
    return null;
  }

  // TODO: USE NAV GENERAL VALIDATIONS
  const { approved: isApproved, error: allowanceError } = validateYvBoostEthActionsAllowance({
    sellTokenAmount: toBN(amount),
    sellTokenAddress: selectedSellTokenAddress,
    sellTokenDecimals: selectedSellToken.decimals.toString(),
    sellTokenAllowancesMap: selectedSellToken.allowancesMap,
    action: 'STAKE',
  });

  const { approved: isValidAmount, error: inputError } = validateVaultDeposit({
    sellTokenAmount: toBN(amount),
    depositLimit: '0',
    emergencyShutdown: false,
    sellTokenDecimals: selectedSellToken.decimals.toString(),
    userTokenBalance: selectedSellToken.balance,
    vaultUnderlyingBalance: selectedNav.navBalance,
  });

  const sourceError = allowanceError || inputError;
  const targetError = actionsStatus.approveDeposit.error || actionsStatus.deposit.error;

  const selectedNavOption = {
    address: selectedNav.address,
    symbol: selectedNav.displayName,
    icon: selectedNav.displayIcon,
    balance: selectedNav.STAKE.userDeposited,
    balanceUsdc: selectedNav.STAKE.userDepositedUsdc,
    decimals: toBN(selectedNav.decimals).toNumber(),
    yield: formatPercent(selectedNav.apyData, 2),
  };

  const amountValue = toBN(amount).times(normalizeAmount(selectedSellToken.priceUsdc, USDC_DECIMALS)).toString();
  const expectedAmount = amount;
  const expectedAmountValue = amountValue;

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
      NavsActions.yvBoostEth.yvBoostEthApproveStake({
        navAddress: selectedNav.address,
      })
    );
  };

  const deposit = async () => {
    try {
      await dispatchAndUnwrap(
        NavsActions.yvBoostEth.yvBoostEthStake({
          navAddress: selectedNav.address,
          tokenAddress: selectedSellToken.address,
          amount: toBN(amount),
        })
      );
      setTxCompleted(true);
    } catch (error) {}
  };

  const txActions = [
    {
      label: t('components.transaction.approve'),
      onAction: approve,
      status: actionsStatus.approveStake,
      disabled: isApproved,
    },
    {
      label: t('components.transaction.deposit'),
      onAction: deposit,
      status: actionsStatus.stake,
      disabled: !isApproved || !isValidAmount,
      contrast: true,
    },
  ];

  return (
    <Transaction
      transactionLabel={t('components.transaction.stake')}
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
      targetHeader={t('components.transaction.to-gauge')}
      targetAssetOptions={[selectedNavOption]}
      selectedTargetAsset={selectedNavOption}
      onSelectedTargetAssetChange={onSelectedNavChange}
      targetAmount={expectedAmount}
      targetAmountValue={expectedAmountValue}
      targetStatus={{ error: targetError }}
      actions={txActions}
      sourceStatus={{ error: sourceError }}
      onClose={onClose}
    />
  );
};
