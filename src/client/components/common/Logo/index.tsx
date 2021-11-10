import { FC } from 'react';
import styled from 'styled-components';

import { ReactComponent as LogoSimple } from '@assets/images/dafidao-icon-only-tprntfull.svg';
import { ReactComponent as LogoFull } from '@assets/images/dafidao-text-95x25.svg';

export interface LogoProps {
  className?: string;
  full?: boolean;
  onClick?: () => void;
}

const StyledLogo = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${(props) => (props.onClick ? 'pointer' : 'default')};
  height: 2.4rem;
  fill: ${({ theme, color }) => color ?? theme.colors.secondaryVariantA};
`;

const StyledLogoSimple = styled(LogoSimple)`
  height: 100%;
  width: auto;
  fill: inherit;
`;
const StyledLogoFull = styled(LogoFull)`
  height: 100%;
  width: 50%;
  fill: inherit;
`;

export const Logo: FC<LogoProps> = ({ className, full, onClick, ...props }) => {
  const logoSvg = full ? <StyledLogoSimple /> : <StyledLogoFull />;

  return (
    <StyledLogo className={className} onClick={onClick} {...props}>
      {logoSvg}
    </StyledLogo>
  );
};
