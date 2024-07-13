// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './ContextMenu';
import { ContextMenu } from './ContextMenu';
import enMessages from '../../_locales/en/messages.json';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/ContextMenu',
} satisfies Meta<PropsType<unknown>>;

const getDefaultProps = (): PropsType<number> => ({
  i18n,
  menuOptions: [
    {
      label: '1',
      onClick: action('1'),
    },
    {
      label: '2',
      onClick: action('2'),
    },
    {
      label: '3',
      onClick: action('3'),
    },
  ],
});

export function Default(): JSX.Element {
  return <ContextMenu {...getDefaultProps()}>Menu</ContextMenu>;
}
