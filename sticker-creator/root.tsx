// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { hot } from 'react-hot-loader/root';
import * as React from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { Router } from 'react-router-dom';
import { App } from './app';
import { history } from './util/history';
import { store } from './store';
import { I18n } from './util/i18n';

declare global {
  // We want to extend `window` here.
  // eslint-disable-next-line no-restricted-syntax
  interface Window {
    localeMessages: { [key: string]: { message: string } };
  }
}

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
