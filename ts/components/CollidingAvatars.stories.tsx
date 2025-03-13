// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { PropsType } from './CollidingAvatars';
import { CollidingAvatars } from './CollidingAvatars';
import { type ComponentMeta } from '../storybook/types';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';

const { i18n } = window.SignalContext;

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
