// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { InContactsIcon } from './InContactsIcon';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/InContactsIcon',
};

export const Default = (): JSX.Element => {
  return <InContactsIcon i18n={i18n} />;
};
