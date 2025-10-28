// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { PropsType } from './CollidingAvatars.dom.js';
import { CollidingAvatars } from './CollidingAvatars.dom.js';
import { type ComponentMeta } from '../storybook/types.std.js';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.js';

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
