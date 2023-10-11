// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import enMessages from '../../_locales/en/messages.json';
import type { PropsType } from './CustomColorEditor';
import { CustomColorEditor } from './CustomColorEditor';
import { setupI18n } from '../util/setupI18n';

export default {
  title: 'Components/CustomColorEditor',
} satisfies Meta<PropsType>;

const i18n = setupI18n('en', enMessages);

const createProps = (): PropsType => ({
  i18n,
  onClose: action('onClose'),
  onSave: action('onSave'),
});

export function Default(): JSX.Element {
  return <CustomColorEditor {...createProps()} />;
}
