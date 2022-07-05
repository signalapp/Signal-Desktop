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

const { localeMessages, SignalContext } = window;

const ColdRoot = () => (
  <ReduxProvider store={store}>
    <Router history={history}>
      <I18n messages={localeMessages} locale={SignalContext.config.locale}>
        <App
          executeMenuRole={SignalContext.executeMenuRole}
          hasCustomTitleBar={SignalContext.OS.hasCustomTitleBar()}
        />
      </I18n>
    </Router>
  </ReduxProvider>
);

export const Root = hot(ColdRoot);
