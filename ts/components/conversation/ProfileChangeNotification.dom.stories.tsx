// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { getDefaultConversation } from '../../test-helpers/getDefaultConversation.std.js';
import type { PropsType } from './ProfileChangeNotification.dom.js';
import { ProfileChangeNotification } from './ProfileChangeNotification.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ProfileChangeNotification',
} satisfies Meta<PropsType>;

export function FromContact(): JSX.Element {
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
      onOpenEditNicknameAndNoteModal={action('onOpenEditNicknameAndNoteModal')}
    />
  );
}

export function FromNonContact(): JSX.Element {
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
      onOpenEditNicknameAndNoteModal={action('onOpenEditNicknameAndNoteModal')}
    />
  );
}

export function FromContactWithLongNamesBeforeAndAfter(): JSX.Element {
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
      onOpenEditNicknameAndNoteModal={action('onOpenEditNicknameAndNoteModal')}
    />
  );
}

export function WithNickname(): JSX.Element {
  return (
    <ProfileChangeNotification
      i18n={i18n}
      changedContact={getDefaultConversation({
        id: 'some-guid',
        type: 'direct',
        title: 'Mr. Fire 🔥',
        nicknameFamilyName: 'test',
        nicknameGivenName: 'test',
      })}
      change={{
        type: 'name',
        oldName: 'Mr. Fire 🔥 Old',
        newName: 'Mr. Fire 🔥 New',
      }}
      onOpenEditNicknameAndNoteModal={action('onOpenEditNicknameAndNoteModal')}
    />
  );
}
