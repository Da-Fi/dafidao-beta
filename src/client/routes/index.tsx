import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import { Layout } from '@containers';

import { Home } from './Home';
import { VaultDetail } from './VaultDetail';
import { Wallet } from './Wallet';
import { Vaults } from './Vaults';
import { Navs } from './Navs';
import { IronBank } from './IronBank';
import { Settings } from './Settings';
import { Disclaimer } from './Disclaimer';

const routesMap = [
  {
    path: '/home',
    component: Home,
  },
  {
    path: '/wallet',
    component: Wallet,
  },
  {
    path: '/vaults',
    component: Vaults,
  },
  {
    path: '/navs',
    component: Navs,
  },
  {
    path: '/ironBank',
    component: IronBank,
  },
  {
    path: '/settings',
    component: Settings,
  },
  {
    path: '/disclaimer',
    component: Disclaimer,
  },

  {
    path: '/vault/:vaultAddress',
    component: VaultDetail,
  },
];

export const Routes = () => {
  return (
    <Router basename="/#">
      <Layout>
        <Switch>
          {routesMap.map((route, index) => (
            <Route key={index} exact path={route.path} component={route.component} />
          ))}
          <Route path="*">
            <Redirect to="/home" />
          </Route>
        </Switch>
      </Layout>
    </Router>
  );
};
