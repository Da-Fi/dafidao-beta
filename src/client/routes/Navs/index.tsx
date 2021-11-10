import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useHistory } from 'react-router-dom';

import { useAppSelector, useAppDispatch, useIsMounting, useAppTranslation } from '@hooks';
import {
  NavsSelectors,
  WalletSelectors,
  ModalsActions,
  NavsActions,
  TokensSelectors,
  ModalSelectors,
  AppSelectors,
  NetworkSelectors,
} from '@store';
import {
  SummaryCard,
  DetailCard,
  RecommendationsCard,
  ActionButtons,
  TokenIcon,
  InfoCard,
  ViewContainer,
  NoWalletCard,
  Amount,
} from '@components/app';
import { SpinnerLoading, SearchInput, Text } from '@components/common';
import { formatPercent, halfWidthCss, humanize, normalizeAmount, toBN, USDC_DECIMALS } from '@utils';
import { getConstants } from '@config/constants';
import { device } from '@themes/default';
import { GeneralNavView } from '@types';

const SearchBarContainer = styled.div`
  margin: 1.2rem;
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  grid-gap: ${({ theme }) => theme.layoutPadding};
  flex-wrap: wrap;
`;

const StyledRecommendationsCard = styled(RecommendationsCard)`
  ${halfWidthCss}
`;

const StyledInfoCard = styled(InfoCard)`
  flex: 1;
  ${halfWidthCss}
`;

const OpportunitiesCard = styled(DetailCard)`
  @media ${device.tablet} {
    .col-name {
      width: 10rem;
    }
  }
  @media (max-width: 820px) {
    .col-assets {
      display: none;
    }
  }
  @media ${device.mobile} {
    .col-name {
      width: 7rem;
    }
    .col-available {
      width: 10rem;
    }
  }
  @media (max-width: 450px) {
    .col-available {
      display: none;
    }
  }
` as typeof DetailCard;

const HoldingsCard = styled(DetailCard)`
  @media ${device.tablet} {
    .col-name {
      width: 10rem;
    }
    .col-balance {
      width: 10rem;
    }
  }
  @media (max-width: 650px) {
    .col-value {
      display: none;
    }
  }
  @media ${device.mobile} {
    .col-name {
      width: 7rem;
    }
    .col-apy {
      display: none;
    }
  }
` as typeof DetailCard;

const StyledNoWalletCard = styled(NoWalletCard)`
  width: 100%;
  ${halfWidthCss}
`;

export const Navs = () => {
  const { t } = useAppTranslation(['common', 'navs']);

  const { CONTRACT_ADDRESSES, NETWORK_SETTINGS } = getConstants();
  const { YVECRV, YVBOOST, PSLPYVBOOSTETH, CRV, YVTHREECRV } = CONTRACT_ADDRESSES;
  const history = useHistory();
  const dispatch = useAppDispatch();
  const isMounting = useIsMounting();
  const walletIsConnected = useAppSelector(WalletSelectors.selectWalletIsConnected);
  const currentNetwork = useAppSelector(NetworkSelectors.selectCurrentNetwork);
  const currentNetworkSettings = NETWORK_SETTINGS[currentNetwork];
  const { totalDeposits, totalEarnings, estYearlyYeild } = useAppSelector(NavsSelectors.selectSummaryData);
  const recommendations = useAppSelector(NavsSelectors.selectRecommendations);
  const holdings = useAppSelector(NavsSelectors.selectDepositedNavs);
  const opportunities = useAppSelector(NavsSelectors.selectNavsOpportunities);
  const [filteredOpportunities, setFilteredOpportunities] = useState(opportunities);
  const activeModal = useAppSelector(ModalSelectors.selectActiveModal);

  const appStatus = useAppSelector(AppSelectors.selectAppStatus);
  const navsStatus = useAppSelector(NavsSelectors.selectNavsStatus);
  const tokensStatus = useAppSelector(TokensSelectors.selectWalletTokensStatus);
  const generalLoading =
    (appStatus.loading || navsStatus.loading || tokensStatus.loading || isMounting) && !activeModal;

  // const tokenSelectorFilter = useAppSelector(TokensSelectors.selectToken);
  // const crvToken = tokenSelectorFilter(CRV);
  // const vaultSelectorFilter = useAppSelector(VaultsSelectors.selectVault);
  // const yv3CrvVault = vaultSelectorFilter(YVTHREECRV);

  useEffect(() => {
    setFilteredOpportunities(opportunities);
  }, [opportunities]);

  const NavHoldingsActions = ({ navAddress, alert }: { navAddress: string; alert?: string }) => {
    switch (navAddress) {
      case YVECRV:
        return (
          <ActionButtons
            actions={[
              {
                name: t('components.transaction.lock'),
                handler: () => {
                  dispatch(NavsActions.setSelectedNavAddress({ navAddress }));
                  dispatch(ModalsActions.openModal({ modalName: 'backscratcherLockTx' }));
                },
                disabled: !walletIsConnected,
              },
              {
                name: t('components.transaction.claim'),
                handler: () => {
                  dispatch(NavsActions.setSelectedNavAddress({ navAddress }));
                  dispatch(ModalsActions.openModal({ modalName: 'backscratcherClaimTx' }));
                },
                disabled: !walletIsConnected,
              },
              {
                name: t('components.transaction.reinvest'),
                handler: () => {
                  dispatch(NavsActions.setSelectedNavAddress({ navAddress }));
                  dispatch(ModalsActions.openModal({ modalName: 'backscratcherReinvestTx' }));
                },
                disabled: !walletIsConnected,
              },
            ]}
          />
        );
      case YVBOOST:
        return (
          <ActionButtons
            actions={[
              {
                name: t('components.transaction.deposit'),
                handler: () => {
                  dispatch(NavsActions.setSelectedNavAddress({ navAddress }));
                  dispatch(ModalsActions.openModal({ modalName: 'navDepositTx' }));
                },
                disabled: !walletIsConnected,
              },
              {
                name: t('components.transaction.withdraw'),
                handler: () => {
                  dispatch(NavsActions.setSelectedNavAddress({ navAddress }));
                  dispatch(ModalsActions.openModal({ modalName: 'navWithdrawTx' }));
                },
                disabled: !walletIsConnected,
              },
            ]}
          />
        );
      case PSLPYVBOOSTETH:
        return (
          <ActionButtons
            alert={alert}
            actions={[
              {
                name: t('components.transaction.deposit'),
                handler: () => {
                  dispatch(NavsActions.setSelectedNavAddress({ navAddress }));
                  dispatch(ModalsActions.openModal({ modalName: 'navDepositTx' }));
                },
                disabled: !walletIsConnected,
              },
              {
                name: t('components.transaction.stake'),
                handler: () => {
                  dispatch(NavsActions.setSelectedNavAddress({ navAddress }));
                  dispatch(ModalsActions.openModal({ modalName: 'navStakeTx' }));
                },
                disabled: !walletIsConnected,
              },
            ]}
          />
        );
      default:
        return null;
    }
  };

  const NavOpportunitiesActions = ({ navAddress }: { navAddress: string }) => {
    switch (navAddress) {
      case YVECRV:
        return (
          <ActionButtons
            actions={[
              {
                name: t('components.transaction.lock'),
                handler: () => {
                  dispatch(NavsActions.setSelectedNavAddress({ navAddress }));
                  dispatch(ModalsActions.openModal({ modalName: 'backscratcherLockTx' }));
                },
                disabled: !walletIsConnected,
              },
            ]}
          />
        );
      case YVBOOST:
      case PSLPYVBOOSTETH:
        return (
          <ActionButtons
            actions={[
              {
                name: t('components.transaction.deposit'),
                handler: () => {
                  dispatch(NavsActions.setSelectedNavAddress({ navAddress }));
                  dispatch(ModalsActions.openModal({ modalName: 'navDepositTx' }));
                },
                disabled: !walletIsConnected,
              },
            ]}
          />
        );
      default:
        return null;
    }
  };

  const navsHoldingsAlerts = (nav: GeneralNavView): string | undefined => {
    switch (nav.address) {
      case PSLPYVBOOSTETH:
        if (toBN(nav.DEPOSIT.userBalance).gt(0)) {
          return t('components.list-card.available-stake');
        }
        break;

      default:
        break;
    }
  };

  return (
    <ViewContainer>
      <SummaryCard
        header="Dashboard"
        items={[
          { header: t('dashboard.holdings'), Component: <Amount value={totalDeposits} input="usdc" /> },
          // { header: 'Earnings', content: `${normalizeUsdc(totalEarnings)}` },
          // { header: 'Est. Yearly Yield', content: `${normalizeUsdc(estYearlyYeild)}` },
        ]}
        variant="secondary"
        cardSize="small"
      />

      {generalLoading && <SpinnerLoading flex="1" width="100%" />}

      {!generalLoading && (
        <>
          {currentNetworkSettings.navsEnabled ? (
            <Row>
              <StyledRecommendationsCard
                header={t('components.recommendations.header')}
                items={recommendations.map(({ address, displayName, apyData, displayIcon }) => ({
                  // header: 'Special Token',
                  icon: displayIcon,
                  name: displayName,
                  info: formatPercent(apyData, 2),
                  infoDetail: 'EYY',
                  // onAction: () => history.push(`/vault/${address}`),
                }))}
              />
              <StyledInfoCard
                header={t('navs:risks-card.header')}
                Component={
                  <Text>
                    <p>{t('navs:risks-card.desc-1')}</p>
                    <p>{t('navs:risks-card.desc-2')}</p>
                    <p>{t('navs:risks-card.desc-3')}</p>
                  </Text>
                }
              />
            </Row>
          ) : (
            <StyledInfoCard
              header={`No Navs yet on ${currentNetworkSettings.name}`}
              Component={
                <Text>
                  <p>{`Check back later for some new experiments.`}</p>
                </Text>
              }
            />
          )}

          {!walletIsConnected && <StyledNoWalletCard />}

          <HoldingsCard
            header="Holdings"
            metadata={[
              {
                key: 'displayIcon',
                transform: ({ displayIcon, displayName }) => <TokenIcon icon={displayIcon} symbol={displayName} />,
                width: '6rem',
                className: 'col-icon',
              },
              {
                key: 'displayName',
                header: t('components.list-card.name'),
                sortable: true,
                fontWeight: 600,
                width: '17rem',
                className: 'col-name',
              },
              {
                key: 'apyData',
                header: t('components.list-card.apy'),
                format: ({ apyData }) => formatPercent(apyData, 2),
                sortable: true,
                width: '8rem',
                className: 'col-apy',
              },
              {
                key: 'balance',
                header: t('components.list-card.balance'),
                format: (nav) => humanize('amount', nav[nav.mainPositionKey].userDeposited, nav.token.decimals, 4),
                sortable: true,
                width: '13rem',
                className: 'col-balance',
              },
              {
                key: 'value',
                header: t('components.list-card.value'),
                format: (nav) => humanize('usd', nav[nav.mainPositionKey].userDepositedUsdc),
                sortable: true,
                width: '11rem',
                className: 'col-value',
              },
              {
                key: 'actions',
                transform: ({ address, alert }) => <NavHoldingsActions navAddress={address} alert={alert} />,
                align: 'flex-end',
                width: 'auto',
                grow: '1',
              },
            ]}
            data={holdings.map((nav) => ({
              ...nav,
              balance: normalizeAmount(nav[nav.mainPositionKey].userDeposited, nav.token.decimals),
              value: nav[nav.mainPositionKey].userDepositedUsdc,
              alert: navsHoldingsAlerts(nav) ?? '',
              actions: null,
            }))}
            // TODO Redirect address is wrong
            // onAction={({ address }) => history.push(`/vault/${address}`)}
            initialSortBy="value"
            wrap
          />

          <OpportunitiesCard
            header={t('components.list-card.opportunities')}
            metadata={[
              {
                key: 'displayIcon',
                transform: ({ displayIcon, displayName }) => <TokenIcon icon={displayIcon} symbol={displayName} />,
                width: '6rem',
                className: 'col-icon',
              },
              {
                key: 'displayName',
                header: t('components.list-card.name'),
                sortable: true,
                fontWeight: 600,
                width: '17rem',
                className: 'col-name',
              },
              {
                key: 'apyData',
                header: t('components.list-card.apy'),
                format: ({ apyData }) => formatPercent(apyData, 2),
                sortable: true,
                width: '8rem',
                className: 'col-apy',
              },
              {
                key: 'navBalanceUsdc',
                header: t('components.list-card.total-assets'),
                format: ({ navBalanceUsdc }) => humanize('usd', navBalanceUsdc, USDC_DECIMALS, 0),
                sortable: true,
                width: '15rem',
                className: 'col-assets',
              },
              {
                key: 'userTokenBalance',
                header: t('components.list-card.available-deposit'),
                format: ({ token }) =>
                  token.balance === '0' ? '-' : humanize('amount', token.balance, token.decimals, 4),
                sortable: true,
                width: '15rem',
                className: 'col-available',
              },
              {
                key: 'actions',
                transform: ({ address }) => <NavOpportunitiesActions navAddress={address} />,
                align: 'flex-end',
                width: 'auto',
                grow: '1',
              },
            ]}
            data={filteredOpportunities.map((nav) => ({
              ...nav,
              userTokenBalance: normalizeAmount(nav.token.balance, nav.token.decimals),
              actions: null,
            }))}
            SearchBar={
              <SearchBarContainer>
                <SearchInput
                  searchableData={opportunities}
                  searchableKeys={['name', 'displayName', 'token.symbol', 'token.name']}
                  placeholder=""
                  onSearch={(data) => setFilteredOpportunities(data)}
                />
              </SearchBarContainer>
            }
            searching={opportunities.length > filteredOpportunities.length}
            // TODO Redirect address is wrong
            // onAction={({ address }) => history.push(`/vault/${address}`)}
            initialSortBy="apyData"
            wrap
          />
        </>
      )}
    </ViewContainer>
  );
};
