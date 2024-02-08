// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

export const localeMessages = ipcRenderer.sendSync('locale-data');
export const localeDisplayNames = ipcRenderer.sendSync('locale-display-names');
export const countryDisplayNames = ipcRenderer.sendSync(
  'country-display-names'
);
