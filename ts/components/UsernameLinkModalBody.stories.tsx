// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState } from 'react';
import type { Meta, Story } from '@storybook/react';

import enMessages from '../../_locales/en/messages.json';
import { UsernameLinkState } from '../state/ducks/usernameEnums';
import { setupI18n } from '../util/setupI18n';
import { SignalService as Proto } from '../protobuf';

import type { PropsType } from './UsernameLinkModalBody';
import { UsernameLinkModalBody } from './UsernameLinkModalBody';
import { Modal } from './Modal';

const ColorEnum = Proto.AccountRecord.UsernameLink.Color;

const i18n = setupI18n('en', enMessages);

export default {
  component: UsernameLinkModalBody,
  title: 'Components/UsernameLinkModalBody',
  argTypes: {
    i18n: {
      defaultValue: i18n,
    },
    link: {
      control: { type: 'text' },
      defaultValue:
        'https://signal.me#eu/n-AJkmmykrFB7j6UODGndSycxcMdp_v6ppRp9rFu5Ad39q_9Ngi_k9-TARWfT43t',
    },
    username: {
      control: { type: 'text' },
      defaultValue: 'alice.12',
    },
    usernameLinkState: {
      control: { type: 'select' },
      defaultValue: UsernameLinkState.Ready,
      options: [UsernameLinkState.Ready, UsernameLinkState.Updating],
    },
    colorId: {
      control: { type: 'select' },
      defaultValue: ColorEnum.BLUE,
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
    showToast: { action: true },
    resetUsernameLink: { action: true },
    setUsernameLinkColor: { action: true },
  },
} as Meta;

type ArgsType = PropsType;

// eslint-disable-next-line react/function-component-definition
const Template: Story<ArgsType> = args => {
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
        <UsernameLinkModalBody {...args} saveAttachment={saveAttachment} />
      </Modal>
      {attachment && <img src={attachment} alt="printable qr code" />}
    </>
  );
};

export const Normal = Template.bind({});
Normal.args = {};
Normal.story = {
  name: 'normal',
};

export const NoLink = Template.bind({});
NoLink.args = { link: '' };
NoLink.story = {
  name: 'normal',
};
