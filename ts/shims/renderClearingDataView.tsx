// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { render } from 'react-dom';

import { ClearingData } from '../components/ClearingData';
import { deleteAllData } from './deleteAllData';

export function renderClearingDataView(): void {
  render(
    <ClearingData deleteAllData={deleteAllData} i18n={window.i18n} />,
    document.getElementById('app-container')
  );
}
