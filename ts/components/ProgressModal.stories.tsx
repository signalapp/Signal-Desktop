// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { ProgressModal } from './ProgressModal';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/ProgressModal',
};

export const Normal = (): JSX.Element => {
  return <ProgressModal i18n={i18n} />;
};
