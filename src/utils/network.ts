import { getConfig } from '@config';
import { Network, ProviderType } from '@types';

export const getNetworkId = (network: Network): number => {
  switch (network) {
    case 'mainnet':
      return 1;
    case 'morden':
      return 2;
    case 'ropsten':
      return 3;
    case 'rinkeby':
      return 4;
    case 'kovan':
      return 42;
    case 'fantom':
      return 250;
    case 'moonbeam':
      return 1284;
  }
};

export const getNetwork = (networkId: number): Network => {
  switch (networkId) {
    case 1:
      return 'mainnet';
    case 2:
      return 'morden';
    case 3:
      return 'ropsten';
    case 4:
      return 'rinkeby';
    case 42:
      return 'kovan';
    case 250:
      return 'fantom';
    case 1284:
      return 'moonbeam';
    default:
      throw Error('Unknown Network');
  }
};

export const getNetworkRpc = (network: Network): string => {
  const { WEB3_PROVIDER_HTTPS, FANTOM_PROVIDER_HTTPS, MOONBEAM_PROVIDER_HTTPS } = getConfig();
  switch (network) {
    case 'mainnet':
      return WEB3_PROVIDER_HTTPS;
    case 'fantom':
      return FANTOM_PROVIDER_HTTPS;
    case 'moonbeam':
      return MOONBEAM_PROVIDER_HTTPS;
    default:
      throw Error('Unknown Network');
  }
};

export const getProviderType = (network: Network): ProviderType => {
  switch (network) {
    case 'mainnet':
      return 'ethereum';
    case 'fantom':
      return 'fantom';
    case 'moonbeam':
      return 'moonbeam'; // prettier-ignore
    default:
      throw Error('Unknown Network');
  }
};
