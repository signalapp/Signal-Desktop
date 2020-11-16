// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { number as numberKnob, text } from '@storybook/addon-knobs';

import { ConversationHero } from './ConversationHero';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const getTitle = () => text('name', 'Cayce Bollard');
const getName = () => text('name', 'Cayce Bollard');
const getProfileName = () => text('profileName', 'Cayce Bollard (profile)');
const getAvatarPath = () =>
  text('avatarPath', '/fixtures/kitten-4-112-112.jpg');
const getPhoneNumber = () => text('phoneNumber', '+1 (646) 327-2700');

storiesOf('Components/Conversation/ConversationHero', module)
  .add('Direct (Three Other Groups)', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          title={getTitle()}
          avatarPath={getAvatarPath()}
          name={getName()}
          profileName={getProfileName()}
          phoneNumber={getPhoneNumber()}
          conversationType="direct"
          sharedGroupNames={['NYC Rock Climbers', 'Dinner Party', 'Friends 🌿']}
        />
      </div>
    );
  })
  .add('Direct (Two Other Groups)', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          title={getTitle()}
          avatarPath={getAvatarPath()}
          name={getName()}
          profileName={getProfileName()}
          phoneNumber={getPhoneNumber()}
          conversationType="direct"
          sharedGroupNames={['NYC Rock Climbers', 'Dinner Party']}
        />
      </div>
    );
  })
  .add('Direct (One Other Group)', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          title={getTitle()}
          avatarPath={getAvatarPath()}
          name={getName()}
          profileName={getProfileName()}
          phoneNumber={getPhoneNumber()}
          conversationType="direct"
          sharedGroupNames={['NYC Rock Climbers']}
        />
      </div>
    );
  })
  .add('Direct (No Groups, Name)', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          title={getTitle()}
          avatarPath={getAvatarPath()}
          name={getName()}
          profileName={text('profileName', '')}
          phoneNumber={getPhoneNumber()}
          conversationType="direct"
          sharedGroupNames={[]}
        />
      </div>
    );
  })
  .add('Direct (No Groups, Just Profile)', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          title={text('title', 'Cayce Bollard (profile)')}
          avatarPath={getAvatarPath()}
          name={text('name', '')}
          profileName={getProfileName()}
          phoneNumber={getPhoneNumber()}
          conversationType="direct"
          sharedGroupNames={[]}
        />
      </div>
    );
  })
  .add('Direct (No Groups, Just Phone Number)', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          title={text('title', '+1 (646) 327-2700')}
          avatarPath={getAvatarPath()}
          name={text('name', '')}
          profileName={text('profileName', '')}
          phoneNumber={getPhoneNumber()}
          conversationType="direct"
          sharedGroupNames={[]}
        />
      </div>
    );
  })
  .add('Direct (No Groups, No Data)', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          title={text('title', 'Unknown contact')}
          avatarPath={getAvatarPath()}
          name={text('name', '')}
          profileName={text('profileName', '')}
          phoneNumber={text('phoneNumber', '')}
          conversationType="direct"
          sharedGroupNames={[]}
        />
      </div>
    );
  })
  .add('Group (many members)', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          title={text('title', 'NYC Rock Climbers')}
          name={text('groupName', 'NYC Rock Climbers')}
          conversationType="group"
          membersCount={numberKnob('membersCount', 22)}
        />
      </div>
    );
  })
  .add('Group (one member)', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          title={text('title', 'NYC Rock Climbers')}
          name={text('groupName', 'NYC Rock Climbers')}
          conversationType="group"
          membersCount={1}
        />
      </div>
    );
  })
  .add('Group (zero members)', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          title={text('title', 'NYC Rock Climbers')}
          name={text('groupName', 'NYC Rock Climbers')}
          conversationType="group"
          membersCount={0}
        />
      </div>
    );
  })
  .add('Group (No name)', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          title={text('title', 'Unknown group')}
          name={text('groupName', '')}
          conversationType="group"
          membersCount={0}
        />
      </div>
    );
  })
  .add('Note to Self', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          isMe
          title={getTitle()}
          conversationType="direct"
          phoneNumber={getPhoneNumber()}
        />
      </div>
    );
  });
