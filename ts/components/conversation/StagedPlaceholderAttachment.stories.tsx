// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './StagedPlaceholderAttachment';
import { StagedPlaceholderAttachment } from './StagedPlaceholderAttachment';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/StagedPlaceholderAttachment',
} satisfies Meta<Props>;

export function Default(): JSX.Element {
  return (
    <StagedPlaceholderAttachment i18n={i18n} onClick={action('onClick')} />
  );
}
