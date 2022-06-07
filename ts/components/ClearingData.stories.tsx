// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

import { ClearingData } from './ClearingData';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/ClearingData',
};

export const _ClearingData = (): JSX.Element => (
  <ClearingData deleteAllData={action('deleteAllData')} i18n={i18n} />
);

_ClearingData.story = {
  name: 'Clearing data',
};
