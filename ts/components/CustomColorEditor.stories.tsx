// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import enMessages from '../../_locales/en/messages.json';
import type { PropsType } from './CustomColorEditor';
import { CustomColorEditor } from './CustomColorEditor';
import { setupI18n } from '../util/setupI18n';

const story = storiesOf('Components/CustomColorEditor', module);

const i18n = setupI18n('en', enMessages);

const createProps = (): PropsType => ({
  i18n,
  onClose: action('onClose'),
  onSave: action('onSave'),
});

story.add('Default', () => <CustomColorEditor {...createProps()} />);
