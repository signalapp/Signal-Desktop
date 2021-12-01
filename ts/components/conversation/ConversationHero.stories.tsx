// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { number as numberKnob, text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { ConversationHero } from './ConversationHero';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { StorybookThemeContext } from '../../../.storybook/StorybookThemeContext';

const i18n = setupI18n('en', enMessages);

const getAbout = () => text('about', '👍 Free to chat');
const getTitle = () => text('name', 'Cayce Bollard');
const getName = () => text('name', 'Cayce Bollard');
const getProfileName = () => text('profileName', 'Cayce Bollard (profile)');
const getAvatarPath = () =>
  text('avatarPath', '/fixtures/kitten-4-112-112.jpg');
const getPhoneNumber = () => text('phoneNumber', '+1 (646) 327-2700');

const updateSharedGroups = action('updateSharedGroups');

const Wrapper = (
  props: Omit<React.ComponentProps<typeof ConversationHero>, 'theme'>
) => {
  const theme = React.useContext(StorybookThemeContext);
  return <ConversationHero {...props} theme={theme} />;
};

storiesOf('Components/Conversation/ConversationHero', module)
  .add('Direct (Five Other Groups)', () => {
    return (
      <div style={{ width: '480px' }}>
        <Wrapper
          about={getAbout()}
          acceptedMessageRequest
          badge={undefined}
          i18n={i18n}
          isMe={false}
          title={getTitle()}
          avatarPath={getAvatarPath()}
          name={getName()}
          profileName={getProfileName()}
          phoneNumber={getPhoneNumber()}
          conversationType="direct"
          updateSharedGroups={updateSharedGroups}
          sharedGroupNames={[
            'NYC Rock Climbers',
            'Dinner Party',
            'Friends 🌿',
            'Fourth',
            'Fifth',
          ]}
          unblurAvatar={action('unblurAvatar')}
          onHeightChange={action('onHeightChange')}
        />
      </div>
    );
  })
  .add('Direct (Four Other Groups)', () => {
    return (
      <div style={{ width: '480px' }}>
        <Wrapper
          about={getAbout()}
          acceptedMessageRequest
          badge={undefined}
          i18n={i18n}
          isMe={false}
          title={getTitle()}
          avatarPath={getAvatarPath()}
          name={getName()}
          profileName={getProfileName()}
          phoneNumber={getPhoneNumber()}
          conversationType="direct"
          updateSharedGroups={updateSharedGroups}
          sharedGroupNames={[
            'NYC Rock Climbers',
            'Dinner Party',
            'Friends 🌿',
            'Fourth',
          ]}
          unblurAvatar={action('unblurAvatar')}
          onHeightChange={action('onHeightChange')}
        />
      </div>
    );
  })
  .add('Direct (Three Other Groups)', () => {
    return (
      <div style={{ width: '480px' }}>
        <Wrapper
          about={getAbout()}
          acceptedMessageRequest
          badge={undefined}
          i18n={i18n}
          isMe={false}
          title={getTitle()}
          avatarPath={getAvatarPath()}
          name={getName()}
          profileName={getProfileName()}
          phoneNumber={getPhoneNumber()}
          conversationType="direct"
          updateSharedGroups={updateSharedGroups}
          sharedGroupNames={['NYC Rock Climbers', 'Dinner Party', 'Friends 🌿']}
          unblurAvatar={action('unblurAvatar')}
          onHeightChange={action('onHeightChange')}
        />
      </div>
    );
  })
  .add('Direct (Two Other Groups)', () => {
    return (
      <div style={{ width: '480px' }}>
        <Wrapper
          about={getAbout()}
          acceptedMessageRequest
          badge={undefined}
          i18n={i18n}
          isMe={false}
          title={getTitle()}
          avatarPath={getAvatarPath()}
          name={getName()}
          profileName={getProfileName()}
          phoneNumber={getPhoneNumber()}
          conversationType="direct"
          updateSharedGroups={updateSharedGroups}
          sharedGroupNames={['NYC Rock Climbers', 'Dinner Party']}
          unblurAvatar={action('unblurAvatar')}
          onHeightChange={action('onHeightChange')}
        />
      </div>
    );
  })
  .add('Direct (One Other Group)', () => {
    return (
      <div style={{ width: '480px' }}>
        <Wrapper
          about={getAbout()}
          acceptedMessageRequest
          badge={undefined}
          i18n={i18n}
          isMe={false}
          title={getTitle()}
          avatarPath={getAvatarPath()}
          name={getName()}
          profileName={getProfileName()}
          phoneNumber={getPhoneNumber()}
          conversationType="direct"
          updateSharedGroups={updateSharedGroups}
          sharedGroupNames={['NYC Rock Climbers']}
          unblurAvatar={action('unblurAvatar')}
          onHeightChange={action('onHeightChange')}
        />
      </div>
    );
  })
  .add('Direct (No Groups, Name)', () => {
    return (
      <div style={{ width: '480px' }}>
        <Wrapper
          about={getAbout()}
          acceptedMessageRequest
          badge={undefined}
          i18n={i18n}
          isMe={false}
          title={getTitle()}
          avatarPath={getAvatarPath()}
          name={getName()}
          profileName={text('profileName', '')}
          phoneNumber={getPhoneNumber()}
          conversationType="direct"
          updateSharedGroups={updateSharedGroups}
          sharedGroupNames={[]}
          unblurAvatar={action('unblurAvatar')}
          onHeightChange={action('onHeightChange')}
        />
      </div>
    );
  })
  .add('Direct (No Groups, Just Profile)', () => {
    return (
      <div style={{ width: '480px' }}>
        <Wrapper
          about={getAbout()}
          acceptedMessageRequest
          badge={undefined}
          i18n={i18n}
          isMe={false}
          title={text('title', 'Cayce Bollard (profile)')}
          avatarPath={getAvatarPath()}
          name={text('name', '')}
          profileName={getProfileName()}
          phoneNumber={getPhoneNumber()}
          conversationType="direct"
          updateSharedGroups={updateSharedGroups}
          sharedGroupNames={[]}
          unblurAvatar={action('unblurAvatar')}
          onHeightChange={action('onHeightChange')}
        />
      </div>
    );
  })
  .add('Direct (No Groups, Just Phone Number)', () => {
    return (
      <div style={{ width: '480px' }}>
        <Wrapper
          about={getAbout()}
          acceptedMessageRequest
          badge={undefined}
          i18n={i18n}
          isMe={false}
          title={text('title', '+1 (646) 327-2700')}
          avatarPath={getAvatarPath()}
          name={text('name', '')}
          profileName={text('profileName', '')}
          phoneNumber={getPhoneNumber()}
          conversationType="direct"
          updateSharedGroups={updateSharedGroups}
          sharedGroupNames={[]}
          unblurAvatar={action('unblurAvatar')}
          onHeightChange={action('onHeightChange')}
        />
      </div>
    );
  })
  .add('Direct (No Groups, No Data)', () => {
    return (
      <div style={{ width: '480px' }}>
        <Wrapper
          i18n={i18n}
          isMe={false}
          title={text('title', 'Unknown contact')}
          acceptedMessageRequest
          badge={undefined}
          avatarPath={getAvatarPath()}
          name={text('name', '')}
          profileName={text('profileName', '')}
          phoneNumber={text('phoneNumber', '')}
          conversationType="direct"
          sharedGroupNames={[]}
          unblurAvatar={action('unblurAvatar')}
          updateSharedGroups={updateSharedGroups}
          onHeightChange={action('onHeightChange')}
        />
      </div>
    );
  })
  .add('Direct (No Groups, No Data, Not Accepted)', () => {
    return (
      <div style={{ width: '480px' }}>
        <Wrapper
          i18n={i18n}
          isMe={false}
          title={text('title', 'Unknown contact')}
          acceptedMessageRequest={false}
          badge={undefined}
          avatarPath={getAvatarPath()}
          name={text('name', '')}
          profileName={text('profileName', '')}
          phoneNumber={text('phoneNumber', '')}
          conversationType="direct"
          sharedGroupNames={[]}
          unblurAvatar={action('unblurAvatar')}
          updateSharedGroups={updateSharedGroups}
          onHeightChange={action('onHeightChange')}
        />
      </div>
    );
  })
  .add('Group (many members)', () => {
    return (
      <div style={{ width: '480px' }}>
        <Wrapper
          acceptedMessageRequest
          badge={undefined}
          i18n={i18n}
          isMe={false}
          title={text('title', 'NYC Rock Climbers')}
          name={text('groupName', 'NYC Rock Climbers')}
          conversationType="group"
          membersCount={numberKnob('membersCount', 22)}
          sharedGroupNames={[]}
          unblurAvatar={action('unblurAvatar')}
          updateSharedGroups={updateSharedGroups}
          onHeightChange={action('onHeightChange')}
        />
      </div>
    );
  })
  .add('Group (one member)', () => {
    return (
      <div style={{ width: '480px' }}>
        <Wrapper
          acceptedMessageRequest
          badge={undefined}
          i18n={i18n}
          isMe={false}
          title={text('title', 'NYC Rock Climbers')}
          name={text('groupName', 'NYC Rock Climbers')}
          conversationType="group"
          membersCount={1}
          sharedGroupNames={[]}
          unblurAvatar={action('unblurAvatar')}
          updateSharedGroups={updateSharedGroups}
          onHeightChange={action('onHeightChange')}
        />
      </div>
    );
  })
  .add('Group (zero members)', () => {
    return (
      <div style={{ width: '480px' }}>
        <Wrapper
          acceptedMessageRequest
          badge={undefined}
          i18n={i18n}
          isMe={false}
          title={text('title', 'NYC Rock Climbers')}
          name={text('groupName', 'NYC Rock Climbers')}
          conversationType="group"
          groupDescription="This is a group for all the rock climbers of NYC"
          membersCount={0}
          sharedGroupNames={[]}
          unblurAvatar={action('unblurAvatar')}
          updateSharedGroups={updateSharedGroups}
          onHeightChange={action('onHeightChange')}
        />
      </div>
    );
  })
  .add('Group (long group description)', () => {
    return (
      <div style={{ width: '480px' }}>
        <Wrapper
          acceptedMessageRequest
          badge={undefined}
          i18n={i18n}
          isMe={false}
          title={text('title', 'NYC Rock Climbers')}
          name={text('groupName', 'NYC Rock Climbers')}
          conversationType="group"
          groupDescription="This is a group for all the rock climbers of NYC. We really like to climb rocks and these NYC people climb any rock. No rock is too small or too big to be climbed. We will ascend upon all rocks, and not just in NYC, in the whole world. We are just getting started, NYC is just the beginning, watch out rocks in the galaxy. Kuiper belt I'm looking at you. We will put on a space suit and climb all your rocks. No rock is near nor far for the rock climbers of NYC."
          membersCount={0}
          sharedGroupNames={[]}
          unblurAvatar={action('unblurAvatar')}
          updateSharedGroups={updateSharedGroups}
          onHeightChange={action('onHeightChange')}
        />
      </div>
    );
  })
  .add('Group (No name)', () => {
    return (
      <div style={{ width: '480px' }}>
        <Wrapper
          acceptedMessageRequest
          badge={undefined}
          i18n={i18n}
          isMe={false}
          title={text('title', 'Unknown group')}
          name={text('groupName', '')}
          conversationType="group"
          membersCount={0}
          sharedGroupNames={[]}
          unblurAvatar={action('unblurAvatar')}
          updateSharedGroups={updateSharedGroups}
          onHeightChange={action('onHeightChange')}
        />
      </div>
    );
  })
  .add('Note to Self', () => {
    return (
      <div style={{ width: '480px' }}>
        <Wrapper
          acceptedMessageRequest
          badge={undefined}
          i18n={i18n}
          isMe
          title={getTitle()}
          conversationType="direct"
          phoneNumber={getPhoneNumber()}
          sharedGroupNames={[]}
          unblurAvatar={action('unblurAvatar')}
          updateSharedGroups={updateSharedGroups}
          onHeightChange={action('onHeightChange')}
        />
      </div>
    );
  });
