import { FC, useState, useEffect } from 'react';

import { useAppSelector, useAppDispatch, useAppDispatchAndUnwrap, useDebounce, useAppTranslation } from '@hooks';
import { TokensActions, NavsSelectors, NavsActions, VaultsActions } from '@store';
import {
  toBN,
  normalizeAmount,
  USDC_DECIMALS,
  validateVaultDeposit,
  formatPercent,
  validateYveCrvActionsAllowance,
} from '@utils';

import { Transaction } from '../Transaction';

export interface BackscratcherLockTxProps {
  onClose?: () => void;
}

export const BackscratcherLockTx: FC<BackscratcherLockTxProps> = ({ onClose, children, ...props }) => {
  const { t } = useAppTranslation('common');

  const dispatch = useAppDispatch();
  const dispatchAndUnwrap = useAppDispatchAndUnwrap();
  const [amount, setAmount] = useState('');
  const [debouncedAmount] = useDebounce(amount, 500);
  const [txCompleted, setTxCompleted] = useState(false);
  const selectedNav = useAppSelector(NavsSelectors.selectYveCrvNav);
  const actionsStatus = useAppSelector(NavsSelectors.selectSelectedNavActionsStatusMap);
  const selectedSellTokenAddress = selectedNav?.token.address;
  const selectedSellToken = selectedNav?.token;

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

    dispatch(
      TokensActions.getTokenAllowance({
        tokenAddress: selectedSellTokenAddress,
        spenderAddress: selectedNav.address,
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

  // TODO: generic nav allowance validation
  const { approved: isApproved, error: allowanceError } = validateYveCrvActionsAllowance({
    action: 'LOCK',
    navAddress: selectedNav.address,
    sellTokenAmount: toBN(amount),
    sellTokenAddress: selectedSellTokenAddress,
    sellTokenDecimals: selectedSellToken.decimals.toString(),
    sellTokenAllowancesMap: selectedSellToken.allowancesMap,
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
    balance: selectedNav.DEPOSIT.userDeposited,
    balanceUsdc: selectedNav.DEPOSIT.userDepositedUsdc,
    decimals: selectedNav.token.decimals,
    yield: formatPercent(selectedNav.apyData, 2),
  };
  const amountValue = toBN(amount).times(normalizeAmount(selectedSellToken.priceUsdc, USDC_DECIMALS)).toString();
  const expectedAmount = amount;
  const expectedAmountValue = amountValue;

  const onTransactionCompletedDismissed = () => {
    if (onClose) onClose();
  };

  const approve = async () => {
    await dispatch(
      NavsActions.yveCrv.yveCrvApproveDeposit({
        navAddress: selectedNav.address,
        tokenAddress: selectedSellToken.address,
      })
    );
  };

  const lock = async () => {
    try {
      await dispatchAndUnwrap(
        NavsActions.yveCrv.yveCrvDeposit({
          navAddress: selectedNav.address,
          tokenAddress: selectedSellToken.address,
          amount: toBN(amount),
        })
      );
      setTxCompleted(true);
    } catch (error) {
      console.log(error);
    }
  };

  const txActions = [
    {
      label: t('components.transaction.approve'),
      onAction: approve,
      status: actionsStatus.approveDeposit,
      disabled: isApproved,
    },
    {
      label: t('components.transaction.lock'),
      onAction: lock,
      status: actionsStatus.deposit,
      disabled: !isApproved || !isValidAmount,
      contrast: true,
    },
  ];

  return (
    <Transaction
      transactionLabel={t('components.transaction.lock')}
      transactionCompleted={txCompleted}
      transactionCompletedLabel={t('components.transaction.status.exit')}
      onTransactionCompletedDismissed={onTransactionCompletedDismissed}
      sourceHeader={t('components.transaction.from-wallet')}
      sourceAssetOptions={[selectedSellToken]}
      selectedSourceAsset={selectedSellToken}
      sourceAmount={amount}
      sourceAmountValue={amountValue}
      onSourceAmountChange={setAmount}
      targetHeader={t('components.transaction.to-vault')}
      targetAssetOptions={[selectedNavOption]}
      selectedTargetAsset={selectedNavOption}
      targetAmount={expectedAmount}
      targetAmountValue={expectedAmountValue}
      targetStatus={{ error: targetError }}
      actions={txActions}
      sourceStatus={{ error: sourceError }}
    />
  );
};
