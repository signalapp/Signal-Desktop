// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
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

export default {
  title: 'Components/Conversation/ConversationHero',
};

export const DirectFiveOtherGroups = (): JSX.Element => {
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
      />
    </div>
  );
};

DirectFiveOtherGroups.story = {
  name: 'Direct (Five Other Groups)',
};

export const DirectFourOtherGroups = (): JSX.Element => {
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
      />
    </div>
  );
};

DirectFourOtherGroups.story = {
  name: 'Direct (Four Other Groups)',
};

export const DirectThreeOtherGroups = (): JSX.Element => {
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
      />
    </div>
  );
};

DirectThreeOtherGroups.story = {
  name: 'Direct (Three Other Groups)',
};

export const DirectTwoOtherGroups = (): JSX.Element => {
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
      />
    </div>
  );
};

DirectTwoOtherGroups.story = {
  name: 'Direct (Two Other Groups)',
};

export const DirectOneOtherGroup = (): JSX.Element => {
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
      />
    </div>
  );
};

DirectOneOtherGroup.story = {
  name: 'Direct (One Other Group)',
};

export const DirectNoGroupsName = (): JSX.Element => {
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
      />
    </div>
  );
};

DirectNoGroupsName.story = {
  name: 'Direct (No Groups, Name)',
};

export const DirectNoGroupsJustProfile = (): JSX.Element => {
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
      />
    </div>
  );
};

DirectNoGroupsJustProfile.story = {
  name: 'Direct (No Groups, Just Profile)',
};

export const DirectNoGroupsJustPhoneNumber = (): JSX.Element => {
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
      />
    </div>
  );
};

DirectNoGroupsJustPhoneNumber.story = {
  name: 'Direct (No Groups, Just Phone Number)',
};

export const DirectNoGroupsNoData = (): JSX.Element => {
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
      />
    </div>
  );
};

DirectNoGroupsNoData.story = {
  name: 'Direct (No Groups, No Data)',
};

export const DirectNoGroupsNoDataNotAccepted = (): JSX.Element => {
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
      />
    </div>
  );
};

DirectNoGroupsNoDataNotAccepted.story = {
  name: 'Direct (No Groups, No Data, Not Accepted)',
};

export const GroupManyMembers = (): JSX.Element => {
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
      />
    </div>
  );
};

GroupManyMembers.story = {
  name: 'Group (many members)',
};

export const GroupOneMember = (): JSX.Element => {
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
      />
    </div>
  );
};

GroupOneMember.story = {
  name: 'Group (one member)',
};

export const GroupZeroMembers = (): JSX.Element => {
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
      />
    </div>
  );
};

GroupZeroMembers.story = {
  name: 'Group (zero members)',
};

export const GroupLongGroupDescription = (): JSX.Element => {
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
      />
    </div>
  );
};

GroupLongGroupDescription.story = {
  name: 'Group (long group description)',
};

export const GroupNoName = (): JSX.Element => {
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
      />
    </div>
  );
};

GroupNoName.story = {
  name: 'Group (No name)',
};

export const NoteToSelf = (): JSX.Element => {
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
      />
    </div>
  );
};

NoteToSelf.story = {
  name: 'Note to Self',
};
