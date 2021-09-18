// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

import { LinkNotification } from './LinkNotification';

const story = storiesOf('Components/Conversation/LinkNotification', module);

const i18n = setupI18n('en', enMessages);

story.add('Default', () => <LinkNotification i18n={i18n} />);
