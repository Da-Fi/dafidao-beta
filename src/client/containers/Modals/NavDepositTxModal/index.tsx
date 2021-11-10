import { FC } from 'react';
import styled from 'styled-components';

import { ModalTx } from '@components/common';
import { NavDepositTx } from '@components/app';

const StyledNavDepositTxModal = styled(ModalTx)``;
export interface NavDepositTxModalProps {
  onClose: () => void;
}

export const NavDepositTxModal: FC<NavDepositTxModalProps> = ({ onClose, ...props }) => {
  return (
    <StyledNavDepositTxModal {...props}>
      <NavDepositTx onClose={onClose} />
    </StyledNavDepositTxModal>
  );
};
