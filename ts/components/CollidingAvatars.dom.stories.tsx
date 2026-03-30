// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { PropsType } from './CollidingAvatars.dom.tsx';
import { CollidingAvatars } from './CollidingAvatars.dom.tsx';
import { type ComponentMeta } from '../storybook/types.std.ts';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.ts';

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

export function Defaults(args: PropsType): React.JSX.Element {
  return <CollidingAvatars {...args} />;
}
