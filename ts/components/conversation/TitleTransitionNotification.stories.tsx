// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './TitleTransitionNotification';
import { TitleTransitionNotification } from './TitleTransitionNotification';

export default {
  title: 'Components/Conversation/TitleTransitionNotification',
} satisfies Meta<Props>;

const i18n = setupI18n('en', enMessages);

export function Default(): JSX.Element {
  return <TitleTransitionNotification oldTitle="alice.01" i18n={i18n} />;
}
