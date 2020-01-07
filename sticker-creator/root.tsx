// tslint:disable-next-line no-submodule-imports
import { hot } from 'react-hot-loader/root';
import * as React from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { Router } from 'react-router-dom';
import { App } from './app';
import { history } from './util/history';
import { store } from './store';
import { I18n } from './util/i18n';

// @ts-ignore
const { localeMessages } = window;

const ColdRoot = () => (
  <ReduxProvider store={store}>
    <Router history={history}>
      <I18n messages={localeMessages}>
        <App />
      </I18n>
    </Router>
  </ReduxProvider>
);

export const Root = hot(ColdRoot);
