// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './LastSeenIndicator';
import { LastSeenIndicator } from './LastSeenIndicator';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/LastSeenIndicator',
  argTypes: {
    count: { control: { type: 'number' } },
  },
  args: {
    i18n,
    count: 1,
  },
} satisfies Meta<Props>;

export function One(args: Props): JSX.Element {
  return <LastSeenIndicator {...args} />;
}

export function MoreThanOne(args: Props): JSX.Element {
  return <LastSeenIndicator {...args} count={5} />;
}
