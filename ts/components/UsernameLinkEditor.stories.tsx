// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState } from 'react';
import type { Meta, StoryFn } from '@storybook/react';

import { action } from '@storybook/addon-actions';
import { UsernameLinkState } from '../state/ducks/usernameEnums.std.js';
import { SignalService as Proto } from '../protobuf/index.std.js';

import type { PropsType } from './UsernameLinkEditor.dom.js';
import {
  UsernameLinkEditor,
  PRINT_WIDTH,
  PRINT_HEIGHT,
} from './UsernameLinkEditor.dom.js';
import { Modal } from './Modal.dom.js';

const ColorEnum = Proto.AccountRecord.UsernameLink.Color;

const { i18n } = window.SignalContext;

export default {
  component: UsernameLinkEditor,
  title: 'Components/UsernameLinkEditor',
  argTypes: {
    link: {
      control: { type: 'text' },
    },
    username: {
      control: { type: 'text' },
    },
    usernameLinkCorrupted: {
      control: 'boolean',
    },
    usernameLinkState: {
      control: { type: 'select' },
      options: [
        UsernameLinkState.Ready,
        UsernameLinkState.Updating,
        UsernameLinkState.Error,
      ],
    },
    colorId: {
      control: { type: 'select' },
      mapping: {
        blue: ColorEnum.BLUE,
        white: ColorEnum.WHITE,
        grey: ColorEnum.GREY,
        olive: ColorEnum.OLIVE,
        green: ColorEnum.GREEN,
        orange: ColorEnum.ORANGE,
        pink: ColorEnum.PINK,
        purple: ColorEnum.PURPLE,
      },
    },
  },
  args: {
    i18n,
    link: 'https://signal.me/#eu/n-AJkmmykrFB7j6UODGndSycxcMdp_v6ppRp9rFu5Ad39q_9Ngi_k9-TARWfT43t',
    username: 'alice.12',
    usernameLinkState: UsernameLinkState.Ready,
    colorId: ColorEnum.BLUE,
    showToast: action('showToast'),
    resetUsernameLink: action('resetUsernameLink'),
    setUsernameLinkColor: action('setUsernameLinkColor'),
    onBack: action('onBack'),
  },
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => {
  const [attachment, setAttachment] = useState<string | undefined>();
  const saveAttachment = useCallback(({ data }: { data?: Uint8Array }) => {
    if (!data) {
      setAttachment(undefined);
      return;
    }

    const blob = new Blob([data], {
      type: 'image/png',
    });

    setAttachment(oldURL => {
      if (oldURL) {
        URL.revokeObjectURL(oldURL);
      }
      return URL.createObjectURL(blob);
    });
  }, []);

  return (
    <>
      <Modal modalName="story" i18n={i18n} hasXButton>
        <UsernameLinkEditor {...args} saveAttachment={saveAttachment} />
      </Modal>
      {attachment && (
        <img
          src={attachment}
          width={PRINT_WIDTH}
          height={PRINT_HEIGHT}
          alt="printable qr code"
        />
      )}
    </>
  );
};

export const Normal = Template.bind({});

export const NoLink = Template.bind({});
NoLink.args = { link: '' };
