// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { ProfileChangeNotification } from './ProfileChangeNotification';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/ProfileChangeNotification',
};

export const FromContact = (): JSX.Element => {
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
};

FromContact.story = {
  name: 'From contact',
};

export const FromNonContact = (): JSX.Element => {
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
};

FromNonContact.story = {
  name: 'From non-contact',
};

export const FromContactWithLongNamesBeforeAndAfter = (): JSX.Element => {
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
        oldName: '💅🤷🏽‍♀️🏯'.repeat(50),
        newName: '☎️🎉🏝'.repeat(50),
      }}
    />
  );
};

FromContactWithLongNamesBeforeAndAfter.story = {
  name: 'From contact with long names before and after',
};
