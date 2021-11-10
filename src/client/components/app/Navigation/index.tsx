import { ElementType, useEffect } from 'react';
import styled from 'styled-components';

import { useAppDispatch, useAppSelector, useWindowDimensions } from '@hooks';
import { SettingsActions, SettingsSelectors } from '@store';
import { HomeIcon, WalletIcon, VaultIcon, NavsIcon, IronBankIcon, SettingsIcon } from '@components/common';

import { NavSidebar } from './NavSidebar';
import { NavTabbar } from './NavTabbar';

export interface NavigationLink {
  to: string;
  text: string;
  icon: ElementType;
  hideMobile?: boolean;
}

const StyledNavigation = styled.div``;

const navLinks = [
  {
    to: '/home',
    text: 'navigation.home',
    icon: HomeIcon,
  },
  {
    to: '/wallet',
    text: 'navigation.wallet',
    icon: WalletIcon,
  },
  {
    to: '/vaults',
    text: 'navigation.vaults',
    icon: VaultIcon,
  },
  {
    to: '/navs',
    text: 'navigation.navs',
    icon: NavsIcon,
  },
  {
    to: '/ironbank',
    text: 'navigation.ironbank',
    icon: IronBankIcon,
  },
  {
    to: '/settings',
    text: 'navigation.settings',
    icon: SettingsIcon,
    // hideMobile: true,
  },
];

export const Navigation = () => {
  const { isMobile, isTablet, isDesktop } = useWindowDimensions();

  // NOTE Auto collapse sidenav on mobile
  const dispatch = useAppDispatch();
  const collapsedSidebar = useAppSelector(SettingsSelectors.selectSidebarCollapsed);

  useEffect(() => {
    if ((isTablet || isMobile) && !collapsedSidebar) {
      dispatch(SettingsActions.closeSidebar());
    }
    if (isDesktop && !isTablet && collapsedSidebar) {
      dispatch(SettingsActions.openSidebar());
    }
  }, [isMobile, isTablet, isDesktop]);

  return (
    <StyledNavigation>
      {!isMobile && <NavSidebar navLinks={navLinks} />}
      {isMobile && <NavTabbar navLinks={navLinks} />}
    </StyledNavigation>
  );
};
