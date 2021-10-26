// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import type { PropsType } from './ProgressDialog';
import { ProgressDialog } from './ProgressDialog';
import { setupI18n } from '../util/setupI18n';

import enMessages from '../../_locales/en/messages.json';

const story = storiesOf('Components/ProgressDialog', module);

const i18n = setupI18n('en', enMessages);

const createProps = (): PropsType => ({
  i18n,
});

story.add('Normal', () => {
  const props = createProps();

  return <ProgressDialog {...props} />;
});
