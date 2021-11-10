import { DefaultTheme } from 'styled-components';

import ClassicBackground from './background.jpg';
import { sharedTheme } from '../default';

const classicTheme: DefaultTheme = {
  ...sharedTheme,
  background: {
    image: ClassicBackground,
  },
  colors: {
    logo: '#3FBFBF',

    primary: '#2c3b57',
    background: '#363640',
    surface: '#2c3b57',

    primaryVariant: '#2dd',

    secondary: '#363640',
    secondaryVariantA: '#3FBFBF',
    secondaryVariantB: '#3FBFBF',

    surfaceVariantA: '#363640',
    surfaceVariantB: '#363640',

    selectionBar: '#3FBFBF',

    onPrimaryVariant: '#E5E5E5',
    onBackground: '#E5E5E5',

    onSurfaceH1: '#fff',
    onSurfaceH1Contrast: '#fff',
    onSurfaceH2: '#fff',
    onSurfaceH2Hover: '#fff',
    onSurfaceSH1: '#fff',
    onSurfaceSH1Hover: '#fff',

    upTrend: '#01E2A0',
    downTrend: '#EF1E02',

    vaultActionButton: {
      background: 'transparent',
      borderColor: '#fff',
      color: '#fff',
      disabledContrast: '0.1',

      selected: {
        background: 'transparent',
        borderColor: '#E5E5E5',
        color: '#E5E5E5',
      },
    },

    walletButton: {
      background: '#E5E5E5',
      color: '#3FBFBF',
    },

    txModalColors: {
      background: '#2c3b57',
      backgroundVariant: '#363640',
      onBackgroundVariant: '#2c3b57',
      onBackgroundVariantB: '#363640',
      onBackgroundVariantColor: '#fff',
      primary: '#3FBFBF',
      loading: '#FFA800',
      error: '#EF1E02',
      success: '#01E2A0',
      text: '#fff',
      textContrast: '#fff',
    },
  },
};

export { classicTheme };
