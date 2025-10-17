// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import type { Meta } from '@storybook/react';
import type { PropsType } from './ProgressDialog.dom.js';
import { ProgressDialog } from './ProgressDialog.dom.js';

export default {
  title: 'Components/ProgressDialog',
} satisfies Meta<PropsType>;

const { i18n } = window.SignalContext;

const createProps = (): PropsType => ({
  i18n,
});

export function Normal(): JSX.Element {
  const props = createProps();

  return <ProgressDialog {...props} />;
}
