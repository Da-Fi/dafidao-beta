import { FC, useState, useEffect } from 'react';

import { useAppSelector, useAppDispatch, useAppDispatchAndUnwrap, useAppTranslation } from '@hooks';
import { TokensSelectors, NavsSelectors, NavsActions, VaultsActions, TokensActions } from '@store';
import { normalizeAmount, USDC_DECIMALS } from '@utils';
import { getConfig } from '@config';

import { Transaction } from '../Transaction';

export interface BackscratcherClaimTxProps {
  onClose?: () => void;
}

export const BackscratcherClaimTx: FC<BackscratcherClaimTxProps> = ({ onClose, children, ...props }) => {
  const { t } = useAppTranslation('common');

  const { CONTRACT_ADDRESSES } = getConfig();
  const { THREECRV } = CONTRACT_ADDRESSES;
  const dispatch = useAppDispatch();
  const dispatchAndUnwrap = useAppDispatchAndUnwrap();
  const [txCompleted, setTxCompleted] = useState(false);
  const selectedNav = useAppSelector(NavsSelectors.selectYveCrvNav);
  const tokenSelectorFilter = useAppSelector(TokensSelectors.selectToken);
  const selectedTargetToken = tokenSelectorFilter(THREECRV);
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

  if (!selectedNav) {
    return null;
  }

  const targetError = actionsStatus.claimReward.error;

  const selectedNavOption = {
    address: selectedNav.address,
    symbol: selectedTargetToken.name,
    icon: selectedTargetToken.icon,
    balance: selectedNav.YIELD.userDeposited,
    balanceUsdc: selectedNav.YIELD.userDepositedUsdc,
    decimals: selectedTargetToken.decimals,
  };

  const amount = normalizeAmount(selectedNav.YIELD.userDeposited, selectedTargetToken.decimals);
  const amountValue = normalizeAmount(selectedNav.YIELD.userDepositedUsdc, USDC_DECIMALS);
  const expectedAmount = amount;
  const expectedAmountValue = amountValue;

  const onTransactionCompletedDismissed = () => {
    if (onClose) onClose();
  };

  const claim = async () => {
    try {
      await dispatchAndUnwrap(NavsActions.yveCrv.yveCrvClaimReward());
      setTxCompleted(true);
    } catch (error) {}
  };

  const txActions = [
    {
      label: t('components.transaction.claim'),
      onAction: claim,
      status: actionsStatus.claimReward,
      disabled: false,
    },
  ];

  return (
    <Transaction
      transactionLabel={t('components.transaction.claim')}
      transactionCompleted={txCompleted}
      transactionCompletedLabel={t('components.transaction.status.exit')}
      onTransactionCompletedDismissed={onTransactionCompletedDismissed}
      sourceHeader={t('components.transaction.reward')}
      sourceAssetOptions={[selectedNavOption]}
      selectedSourceAsset={selectedNavOption}
      sourceAmount={amount}
      sourceAmountValue={amountValue}
      targetHeader={t('components.transaction.to-wallet')}
      targetAssetOptions={[selectedTargetToken]}
      selectedTargetAsset={selectedTargetToken}
      targetAmount={expectedAmount}
      targetAmountValue={expectedAmountValue}
      targetStatus={{ error: targetError }}
      actions={txActions}
      sourceStatus={{}}
      onClose={onClose}
    />
  );
};
