// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';

import { ChangeNumberNotification } from './ChangeNumberNotification';

export default {
  title: 'Components/Conversation/ChangeNumberNotification',
};

const i18n = setupI18n('en', enMessages);

export const Default = (): JSX.Element => (
  <ChangeNumberNotification
    sender={getDefaultConversation()}
    timestamp={1618894800000}
    i18n={i18n}
  />
);

export const LongName = (): JSX.Element => (
  <ChangeNumberNotification
    sender={getDefaultConversation({
      firstName: '💅😇🖋'.repeat(50),
    })}
    timestamp={1618894800000}
    i18n={i18n}
  />
);

LongName.story = {
  name: 'Long name',
};
