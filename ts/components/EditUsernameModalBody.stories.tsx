// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta, Story } from '@storybook/react';

import enMessages from '../../_locales/en/messages.json';
import { setupI18n } from '../util/setupI18n';
import type { UsernameReservationType } from '../types/Username';

import type { PropsType } from './EditUsernameModalBody';
import { EditUsernameModalBody } from './EditUsernameModalBody';
import {
  UsernameReservationState as State,
  UsernameReservationError,
} from '../state/ducks/usernameEnums';

const i18n = setupI18n('en', enMessages);

const DEFAULT_RESERVATION: UsernameReservationType = {
  username: 'reserved.56',
  previousUsername: undefined,
  hash: new Uint8Array(),
};

export default {
  component: EditUsernameModalBody,
  title: 'Components/EditUsernameModalBody',
  argTypes: {
    currentUsername: {
      type: { name: 'string', required: false },
      defaultValue: undefined,
    },
    state: {
      control: { type: 'radio' },
      defaultValue: State.Open,
      options: {
        Open: State.Open,
        Closed: State.Closed,
        Reserving: State.Reserving,
        Confirming: State.Confirming,
      },
    },
    error: {
      control: { type: 'radio' },
      defaultValue: undefined,
      options: {
        None: undefined,
        NotEnoughCharacters: UsernameReservationError.NotEnoughCharacters,
        TooManyCharacters: UsernameReservationError.TooManyCharacters,
        CheckStartingCharacter: UsernameReservationError.CheckStartingCharacter,
        CheckCharacters: UsernameReservationError.CheckCharacters,
        UsernameNotAvailable: UsernameReservationError.UsernameNotAvailable,
        General: UsernameReservationError.General,
      },
    },
    maxUsername: {
      defaultValue: 20,
    },
    minUsername: {
      defaultValue: 3,
    },
    discriminator: {
      type: { name: 'string', required: false },
      defaultValue: undefined,
    },
    i18n: {
      defaultValue: i18n,
    },
    onClose: { action: true },
    onError: { action: true },
    setUsernameReservationError: { action: true },
    reserveUsername: { action: true },
    confirmUsername: { action: true },
  },
} as Meta;

type ArgsType = PropsType & {
  discriminator?: string;
  reservation?: UsernameReservationType;
};

// eslint-disable-next-line react/function-component-definition
const Template: Story<ArgsType> = args => {
  let { reservation } = args;
  if (!reservation && args.discriminator) {
    reservation = {
      username: `reserved.${args.discriminator}`,
      previousUsername: undefined,
      hash: new Uint8Array(),
    };
  }
  return <EditUsernameModalBody {...args} reservation={reservation} />;
};

export const WithoutUsername = Template.bind({});
WithoutUsername.args = {};
WithoutUsername.story = {
  name: 'without current username',
};

export const WithUsername = Template.bind({});
WithUsername.args = {};
WithUsername.story = {
  name: 'with current username',
  args: {
    currentUsername: 'signaluser.12',
  },
};

export const WithReservation = Template.bind({});
WithReservation.args = {};
WithReservation.story = {
  name: 'with reservation',
  args: {
    currentUsername: 'reserved',
    reservation: DEFAULT_RESERVATION,
  },
};

export const UsernameEditingConfirming = Template.bind({});
UsernameEditingConfirming.args = {
  state: State.Confirming,
  currentUsername: 'signaluser.12',
};
UsernameEditingConfirming.story = {
  name: 'Username editing, Confirming',
};

export const UsernameEditingUsernameTaken = Template.bind({});
UsernameEditingUsernameTaken.args = {
  state: State.Open,
  error: UsernameReservationError.UsernameNotAvailable,
  currentUsername: 'signaluser.12',
};
UsernameEditingUsernameTaken.story = {
  name: 'Username editing, username taken',
};

export const UsernameEditingUsernameWrongCharacters = Template.bind({});
UsernameEditingUsernameWrongCharacters.args = {
  state: State.Open,
  error: UsernameReservationError.CheckCharacters,
  currentUsername: 'signaluser.12',
};
UsernameEditingUsernameWrongCharacters.story = {
  name: 'Username editing, Wrong Characters',
};

export const UsernameEditingUsernameTooShort = Template.bind({});
UsernameEditingUsernameTooShort.args = {
  state: State.Open,
  error: UsernameReservationError.NotEnoughCharacters,
  currentUsername: 'sig',
};
UsernameEditingUsernameTooShort.story = {
  name: 'Username editing, username too short',
};

export const UsernameEditingGeneralError = Template.bind({});
UsernameEditingGeneralError.args = {
  state: State.Open,
  error: UsernameReservationError.General,
  currentUsername: 'signaluser.12',
};
UsernameEditingGeneralError.story = {
  name: 'Username editing, general error',
};
