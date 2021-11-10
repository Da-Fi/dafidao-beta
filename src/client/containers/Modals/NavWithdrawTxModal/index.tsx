import { FC } from 'react';
import styled from 'styled-components';

import { ModalTx } from '@components/common';
import { NavWithdrawTx } from '@components/app';

const StyledNavWithdrawTxModal = styled(ModalTx)``;
export interface NavWithdrawTxModalProps {
  onClose: () => void;
}

export const NavWithdrawTxModal: FC<NavWithdrawTxModalProps> = ({ onClose, ...props }) => {
  return (
    <StyledNavWithdrawTxModal {...props}>
      <NavWithdrawTx onClose={onClose} />
    </StyledNavWithdrawTxModal>
  );
};
