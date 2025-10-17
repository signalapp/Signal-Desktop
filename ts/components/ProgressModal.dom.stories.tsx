// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './ProgressModal.dom.js';
import { ProgressModal } from './ProgressModal.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/ProgressModal',
} satisfies Meta<PropsType>;

export function Normal(): JSX.Element {
  return <ProgressModal i18n={i18n} />;
}
