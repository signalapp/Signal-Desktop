// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import React from 'react';

import type { PropsType } from './SendStoryModal';
import enMessages from '../../_locales/en/messages.json';
import { SendStoryModal } from './SendStoryModal';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';
import {
  getMyStories,
  getFakeDistributionLists,
} from '../test-both/helpers/getFakeDistributionLists';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/SendStoryModal',
  component: SendStoryModal,
  argTypes: {
    distributionLists: {
      defaultValue: [getMyStories()],
    },
    i18n: {
      defaultValue: i18n,
    },
    me: {
      defaultValue: getDefaultConversation(),
    },
    onClose: { action: true },
    onSend: { action: true },
    signalConnections: {
      defaultValue: Array.from(Array(42), getDefaultConversation),
    },
  },
} as Meta;

const Template: Story<PropsType> = args => <SendStoryModal {...args} />;

export const Modal = Template.bind({});
Modal.args = {
  distributionLists: getFakeDistributionLists(),
};
