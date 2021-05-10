// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';

import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { ProfileChangeNotification } from './ProfileChangeNotification';

const i18n = setupI18n('en', enMessages);

storiesOf('Components/Conversation/ProfileChangeNotification', module)
  .add('From contact', () => {
    return (
      <ProfileChangeNotification
        i18n={i18n}
        changedContact={getDefaultConversation({
          id: 'some-guid',
          type: 'direct',
          title: 'Mr. Fire 🔥',
          name: 'Mr. Fire 🔥',
        })}
        change={{
          type: 'name',
          oldName: 'Mr. Fire 🔥 Old',
          newName: 'Mr. Fire 🔥 New',
        }}
      />
    );
  })
  .add('From non-contact', () => {
    return (
      <ProfileChangeNotification
        i18n={i18n}
        changedContact={getDefaultConversation({
          id: 'some-guid',
          type: 'direct',
          title: 'Mr. Fire 🔥',
        })}
        change={{
          type: 'name',
          oldName: 'Mr. Fire 🔥 Old',
          newName: 'Mr. Fire 🔥 New',
        }}
      />
    );
  });
