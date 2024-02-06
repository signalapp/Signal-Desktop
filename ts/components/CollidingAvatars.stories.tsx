// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { PropsType } from './CollidingAvatars';
import { CollidingAvatars } from './CollidingAvatars';
import { type ComponentMeta } from '../storybook/types';
import { setupI18n } from '../util/setupI18n';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const alice = getDefaultConversation();
const bob = getDefaultConversation();

export default {
  title: 'Components/CollidingAvatars',
  component: CollidingAvatars,
  argTypes: {},
  args: {
    i18n,
    conversations: [alice, bob],
  },
} satisfies ComponentMeta<PropsType>;

export function Defaults(args: PropsType): JSX.Element {
  return <CollidingAvatars {...args} />;
}
