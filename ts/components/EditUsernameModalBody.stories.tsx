// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta, StoryFn } from '@storybook/react';

import { action } from '@storybook/addon-actions';
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
    usernameCorrupted: {
      type: { name: 'boolean' },
    },
    currentUsername: {
      type: { name: 'string', required: false },
    },
    state: {
      control: { type: 'radio' },
      options: [State.Open, State.Closed, State.Reserving, State.Confirming],
    },
    error: {
      control: { type: 'radio' },
      options: [
        undefined,
        UsernameReservationError.NotEnoughCharacters,
        UsernameReservationError.TooManyCharacters,
        UsernameReservationError.CheckStartingCharacter,
        UsernameReservationError.CheckCharacters,
        UsernameReservationError.UsernameNotAvailable,
        UsernameReservationError.General,
        UsernameReservationError.TooManyAttempts,
      ],
    },
    reservation: {
      type: { name: 'string', required: false },
    },
  },
  args: {
    isRootModal: false,
    usernameCorrupted: false,
    currentUsername: undefined,
    state: State.Open,
    error: undefined,
    maxNickname: 20,
    minNickname: 3,
    reservation: undefined,
    i18n,
    onClose: action('onClose'),
    setUsernameReservationError: action('setUsernameReservationError'),
    clearUsernameReservation: action('clearUsernameReservation'),
    reserveUsername: action('reserveUsername'),
    confirmUsername: action('confirmUsername'),
  },
} satisfies Meta<PropsType>;

type ArgsType = PropsType & {
  discriminator?: string;
  reservation?: UsernameReservationType;
};

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<ArgsType> = args => {
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

export const WithUsername = Template.bind({});
WithUsername.args = {
  currentUsername: 'signaluser.12',
};

export const WithReservation = Template.bind({});
WithReservation.args = {
  currentUsername: 'reserved',
  reservation: DEFAULT_RESERVATION,
};

export const UsernameEditingConfirming = Template.bind({});
UsernameEditingConfirming.args = {
  state: State.Confirming,
  currentUsername: 'signaluser.12',
};

export const UsernameEditingUsernameTaken = Template.bind({});
UsernameEditingUsernameTaken.args = {
  state: State.Open,
  error: UsernameReservationError.UsernameNotAvailable,
  currentUsername: 'signaluser.12',
};

export const UsernameEditingUsernameWrongCharacters = Template.bind({});
UsernameEditingUsernameWrongCharacters.args = {
  state: State.Open,
  error: UsernameReservationError.CheckCharacters,
  currentUsername: 'signaluser.12',
};

export const UsernameEditingUsernameTooShort = Template.bind({});
UsernameEditingUsernameTooShort.args = {
  state: State.Open,
  error: UsernameReservationError.NotEnoughCharacters,
  currentUsername: 'sig',
};

export const UsernameEditingGeneralError = Template.bind({});
UsernameEditingGeneralError.args = {
  state: State.Open,
  error: UsernameReservationError.General,
  currentUsername: 'signaluser.12',
};
