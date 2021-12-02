// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import type { PropsType } from './WhatsNewModal';
import { WhatsNewModal } from './WhatsNewModal';
import enMessages from '../../_locales/en/messages.json';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/WhatsNewModal', module);

const getDefaultProps = (): PropsType => ({
  hideWhatsNewModal: action('hideWhatsNewModal'),
  i18n,
});

story.add('Modal', () => <WhatsNewModal {...getDefaultProps()} />);
