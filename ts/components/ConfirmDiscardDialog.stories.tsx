// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

import { ConfirmDiscardDialog, PropsType } from './ConfirmDiscardDialog';

const i18n = setupI18n('en', enMessages);

const createProps = (): PropsType => ({
  i18n,
  onClose: action('onClose'),
  onDiscard: action('onDiscard'),
});

const story = storiesOf('Components/ConfirmDiscardDialog', module);

story.add('Default', () => <ConfirmDiscardDialog {...createProps()} />);
