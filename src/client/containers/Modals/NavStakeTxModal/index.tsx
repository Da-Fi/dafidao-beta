import { FC } from 'react';
import styled from 'styled-components';

import { ModalTx } from '@components/common';
import { NavStakeTx } from '@components/app';

const StyledNavStakeTxModal = styled(ModalTx)``;
export interface NavStakeTxModalProps {
  onClose: () => void;
}

export const NavStakeTxModal: FC<NavStakeTxModalProps> = ({ onClose, ...props }) => {
  return (
    <StyledNavStakeTxModal {...props}>
      <NavStakeTx onClose={onClose} />
    </StyledNavStakeTxModal>
  );
};
