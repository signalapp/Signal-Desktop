// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import type { PropsType } from './ContextMenu';
import { ContextMenu } from './ContextMenu';
import enMessages from '../../_locales/en/messages.json';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/ContextMenu', module);

const getDefaultProps = (): PropsType<number> => ({
  i18n,
  menuOptions: [
    {
      label: '1',
      value: 1,
    },
    {
      label: '2',
      value: 2,
    },
    {
      label: '3',
      value: 3,
    },
  ],
  onChange: action('onChange'),
  value: 1,
});

story.add('Default', () => {
  return <ContextMenu {...getDefaultProps()} />;
});
