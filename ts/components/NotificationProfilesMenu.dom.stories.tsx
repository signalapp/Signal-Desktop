// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { shuffle } from 'lodash';
import type { Meta, StoryFn } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { NotificationProfilesMenu } from './NotificationProfilesMenu.dom.js';
import type { Props } from './NotificationProfilesMenu.dom.js';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../test-helpers/getDefaultConversation.std.js';
import { DayOfWeek } from '../types/NotificationProfile.std.js';
import type { NotificationProfileIdString } from '../types/NotificationProfile.std.js';
import { HOUR } from '../util/durations/index.std.js';
import { AxoDropdownMenu } from '../axo/AxoDropdownMenu.dom.js';
import { AxoButton } from '../axo/AxoButton.dom.js';

const { i18n } = window.SignalContext;

const conversations = shuffle([
  ...Array.from(Array(20), getDefaultGroup),
  ...Array.from(Array(20), getDefaultConversation),
]);

const threeProfiles = [
  {
    id: 'Weekday' as NotificationProfileIdString,
    name: 'Weekday',
    emoji: '😬',
    color: 0xffe3e3fe,

    createdAtMs: Date.now(),

    allowAllCalls: true,
    allowAllMentions: true,

    allowedMembers: new Set([conversations[0].id, conversations[1].id]),
    scheduleEnabled: true,

    scheduleStartTime: 1800,
    scheduleEndTime: 2300,

    scheduleDaysEnabled: {
      [DayOfWeek.SUNDAY]: false,
      [DayOfWeek.MONDAY]: true,
      [DayOfWeek.TUESDAY]: true,
      [DayOfWeek.WEDNESDAY]: true,
      [DayOfWeek.THURSDAY]: true,
      [DayOfWeek.FRIDAY]: true,
      [DayOfWeek.SATURDAY]: false,
    },
    deletedAtTimestampMs: undefined,
    storageNeedsSync: true,
  },
  {
    id: 'Weekend' as NotificationProfileIdString,
    name: 'Weekend',
    emoji: '❤️‍🔥',
    color: 0xffd7d7d9,

    createdAtMs: Date.now(),

    allowAllCalls: true,
    allowAllMentions: true,

    allowedMembers: new Set([conversations[0].id, conversations[1].id]),
    scheduleEnabled: true,

    scheduleStartTime: 1800,
    scheduleEndTime: 2300,

    scheduleDaysEnabled: {
      [DayOfWeek.SUNDAY]: true,
      [DayOfWeek.MONDAY]: false,
      [DayOfWeek.TUESDAY]: false,
      [DayOfWeek.WEDNESDAY]: false,
      [DayOfWeek.THURSDAY]: false,
      [DayOfWeek.FRIDAY]: false,
      [DayOfWeek.SATURDAY]: true,
    },
    deletedAtTimestampMs: undefined,
    storageNeedsSync: true,
  },
  {
    id: 'Random' as NotificationProfileIdString,
    name: 'Random',
    emoji: undefined,
    color: 0xfffef5d0,

    createdAtMs: Date.now(),

    allowAllCalls: true,
    allowAllMentions: true,

    allowedMembers: new Set([conversations[0].id, conversations[1].id]),
    scheduleEnabled: true,

    scheduleStartTime: 1800,
    scheduleEndTime: 2300,

    scheduleDaysEnabled: {
      [DayOfWeek.SUNDAY]: true,
      [DayOfWeek.MONDAY]: false,
      [DayOfWeek.TUESDAY]: true,
      [DayOfWeek.WEDNESDAY]: false,
      [DayOfWeek.THURSDAY]: true,
      [DayOfWeek.FRIDAY]: false,
      [DayOfWeek.SATURDAY]: true,
    },
    deletedAtTimestampMs: undefined,
    storageNeedsSync: true,
  },
];

export default {
  title: 'Components/NotificationProfilesMenu',
  component: NotificationProfilesMenu,
  args: {
    activeProfileId: undefined,
    allProfiles: threeProfiles,
    currentOverride: undefined,
    i18n,
    onGoToSettings: action('onGoToSettings'),
    setProfileOverride: action('setProfileOverride'),
  },
} satisfies Meta<Props>;

function createProps(args: Partial<Props>) {
  return {
    activeProfileId: undefined,
    allProfiles: threeProfiles,
    currentOverride: undefined,
    i18n,
    onGoToSettings: action('onGoToSettings'),
    setProfileOverride: action('setProfileOverride'),
    ...args,
  };
}

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<Props> = args => {
  return (
    <AxoDropdownMenu.Root>
      <AxoDropdownMenu.Trigger>
        <AxoButton.Root size="medium" variant="secondary">
          Open
        </AxoButton.Root>
      </AxoDropdownMenu.Trigger>
      <AxoDropdownMenu.Content>
        <NotificationProfilesMenu {...args} />
      </AxoDropdownMenu.Content>
    </AxoDropdownMenu.Root>
  );
};

export const Default = Template.bind({});

export const WithNoProfiles = Template.bind({});
WithNoProfiles.args = createProps({
  allProfiles: [],
});

export const WithProfileActive = Template.bind({});
WithProfileActive.args = createProps({
  activeProfileId: threeProfiles[0].id,
});

export const WithEmojiLessProfileActive = Template.bind({});
WithEmojiLessProfileActive.args = createProps({
  activeProfileId: threeProfiles[2].id,
});

export const WithEnabledOverride = Template.bind({});
WithEnabledOverride.args = createProps({
  activeProfileId: threeProfiles[0].id,
  currentOverride: {
    disabledAtMs: undefined,
    enabled: {
      profileId: threeProfiles[0].id,
    },
  },
});

export const WithEnabledOverrideAndEndsAtMs = Template.bind({});
WithEnabledOverrideAndEndsAtMs.args = createProps({
  activeProfileId: threeProfiles[0].id,
  currentOverride: {
    disabledAtMs: undefined,
    enabled: {
      profileId: threeProfiles[0].id,
      endsAtMs: Date.now() + HOUR,
    },
  },
});
