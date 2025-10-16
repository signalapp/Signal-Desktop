// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './StagedPlaceholderAttachment.dom.js';
import { StagedPlaceholderAttachment } from './StagedPlaceholderAttachment.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/StagedPlaceholderAttachment',
} satisfies Meta<Props>;

export function Default(): JSX.Element {
  return (
    <StagedPlaceholderAttachment i18n={i18n} onClick={action('onClick')} />
  );
}
