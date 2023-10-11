// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './ProgressModal';
import { ProgressModal } from './ProgressModal';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/ProgressModal',
} satisfies Meta<PropsType>;

export function Normal(): JSX.Element {
  return <ProgressModal i18n={i18n} />;
}
