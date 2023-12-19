// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import type { Meta } from '@storybook/react';
import type { PropsType } from './ProgressDialog';
import { ProgressDialog } from './ProgressDialog';
import { setupI18n } from '../util/setupI18n';

import enMessages from '../../_locales/en/messages.json';

export default {
  title: 'Components/ProgressDialog',
} satisfies Meta<PropsType>;

const i18n = setupI18n('en', enMessages);

const createProps = (): PropsType => ({
  i18n,
});

export function Normal(): JSX.Element {
  const props = createProps();

  return <ProgressDialog {...props} />;
}
