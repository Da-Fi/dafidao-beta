import { FC, useState, useEffect } from 'react';

import { useAppSelector, useAppDispatch, useAppDispatchAndUnwrap, useAppTranslation } from '@hooks';
import { VaultsSelectors, NavsSelectors, NavsActions, VaultsActions, TokensActions } from '@store';
import { formatPercent, normalizeAmount, toBN, USDC_DECIMALS, validateYveCrvActionsAllowance } from '@utils';
import { getConfig } from '@config';

import { Transaction } from '../Transaction';

export interface BackscratcherReinvestTxProps {
  onClose?: () => void;
}

export const BackscratcherReinvestTx: FC<BackscratcherReinvestTxProps> = ({ onClose, children, ...props }) => {
  const { t } = useAppTranslation('common');

  const { CONTRACT_ADDRESSES } = getConfig();
  const { YVTHREECRV, y3CrvBackZapper } = CONTRACT_ADDRESSES;
  const dispatch = useAppDispatch();
  const dispatchAndUnwrap = useAppDispatchAndUnwrap();
  const [txCompleted, setTxCompleted] = useState(false);
  const selectedNav = useAppSelector(NavsSelectors.selectYveCrvNav);
  const vaultSelectorFilter = useAppSelector(VaultsSelectors.selectVault);
  const selectedTargetVault = vaultSelectorFilter(YVTHREECRV);
  const selectedTargetToken = selectedTargetVault?.token;
  const actionsStatus = useAppSelector(NavsSelectors.selectSelectedNavActionsStatusMap);

  const onExit = () => {
    dispatch(NavsActions.clearSelectedNavAndStatus());
    dispatch(VaultsActions.clearTransactionData());
    dispatch(TokensActions.setSelectedTokenAddress({ tokenAddress: undefined }));
  };

  useEffect(() => {
    if (!selectedTargetToken) return;

    dispatch(
      TokensActions.getTokenAllowance({
        tokenAddress: selectedTargetToken.address,
        spenderAddress: y3CrvBackZapper,
      })
    );

    return () => {
      onExit();
    };
  }, [selectedTargetToken?.address]);

  if (!selectedNav || !selectedTargetVault || !selectedTargetToken) {
    return null;
  }

  const selectedNavOption = {
    address: selectedNav.address,
    symbol: selectedTargetToken.name,
    icon: selectedTargetToken.icon,
    balance: selectedTargetVault.DEPOSIT.userDeposited,
    balanceUsdc: selectedTargetVault.DEPOSIT.userDepositedUsdc,
    decimals: selectedTargetToken.decimals,
  };

  const selectedVaultOption = {
    address: selectedTargetToken.address,
    symbol: selectedTargetToken.name,
    icon: selectedTargetToken.icon,
    balance: selectedTargetToken.balance,
    balanceUsdc: selectedTargetToken.balanceUsdc,
    decimals: selectedTargetToken.decimals,
    yield: formatPercent(selectedTargetVault.apyData, 2),
  };

  const amount = normalizeAmount(selectedNav.YIELD.userDeposited, selectedTargetToken.decimals);
  const amountValue = normalizeAmount(selectedNav.YIELD.userDepositedUsdc, USDC_DECIMALS);
  const expectedAmount = amount;
  const expectedAmountValue = amountValue;

  // TODO: generic nav allowance validation
  const { approved: isApproved, error: allowanceError } = validateYveCrvActionsAllowance({
    action: 'REINVEST',
    navAddress: selectedNav.address,
    sellTokenAmount: toBN(amount),
    sellTokenAddress: selectedTargetToken.address,
    sellTokenDecimals: selectedTargetToken.decimals.toString(),
    sellTokenAllowancesMap: selectedTargetToken.allowancesMap,
  });

  const sourceError = allowanceError;
  const targetError = actionsStatus.approveReinvest.error || actionsStatus.reinvest.error;

  const onTransactionCompletedDismissed = () => {
    if (onClose) onClose();
  };

  const approve = async () => {
    await dispatch(
      NavsActions.yveCrv.yveCrvApproveReinvest({
        navAddress: selectedNav.address,
        tokenAddress: selectedTargetToken.address,
      })
    );
  };

  const reinvest = async () => {
    try {
      await dispatchAndUnwrap(NavsActions.yveCrv.yveCrvReinvest());
      setTxCompleted(true);
    } catch (error) {}
  };

  const txActions = [
    {
      label: t('components.transaction.approve'),
      onAction: approve,
      status: actionsStatus.approveReinvest,
      disabled: isApproved,
    },
    {
      label: t('components.transaction.reinvest'),
      onAction: reinvest,
      status: actionsStatus.reinvest,
      disabled: !isApproved,
    },
  ];

  return (
    <Transaction
      transactionLabel={t('components.transaction.reinvest')}
      transactionCompleted={txCompleted}
      transactionCompletedLabel={t('components.transaction.status.exit')}
      onTransactionCompletedDismissed={onTransactionCompletedDismissed}
      sourceHeader={t('components.transaction.reward')}
      sourceAssetOptions={[selectedNavOption]}
      selectedSourceAsset={selectedNavOption}
      sourceAmount={amount}
      sourceAmountValue={amountValue}
      targetHeader={t('components.transaction.to-vault')}
      targetAssetOptions={[selectedVaultOption]}
      selectedTargetAsset={selectedVaultOption}
      targetAmount={expectedAmount}
      targetAmountValue={expectedAmountValue}
      targetStatus={{ error: targetError }}
      actions={txActions}
      sourceStatus={{ error: sourceError }}
      onClose={onClose}
    />
  );
};
