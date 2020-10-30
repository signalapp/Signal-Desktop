// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';

import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';
import { InContactsIcon } from './InContactsIcon';

const i18n = setupI18n('en', enMessages);

storiesOf('Components/InContactsIcon', module).add('Default', () => {
  return <InContactsIcon i18n={i18n} />;
});
