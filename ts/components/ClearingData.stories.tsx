// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

import { ClearingData } from './ClearingData';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/ClearingData', module);

story.add('Clearing data', () => (
  <ClearingData deleteAllData={action('deleteAllData')} i18n={i18n} />
));
