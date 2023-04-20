// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import {
  createMemoryRouter,
  createRoutesFromElements,
  Navigate,
  Route,
  RouterProvider,
} from 'react-router-dom';

import './index.scss';
import { store } from './store';
import { Root } from './routes/Root';
// import { Index } from './routes/Index';
import { createArtRoutes } from './routes/art';
import { loadLocale } from './util/i18n';

const router = createMemoryRouter(
  createRoutesFromElements(
    <Route path="/" loader={() => loadLocale()} element={<Root />}>
      <Route index element={<Navigate to="/art/?artType=sticker" replace />} />
      {createArtRoutes()}
    </Route>
  )
);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <Provider store={store}>
    <RouterProvider router={router} />
  </Provider>
);
