// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './GroupMemberLabelEditor.dom.js';
import { GroupMemberLabelEditor } from './GroupMemberLabelEditor.dom.js';
import type { ConversationType } from '../../../state/ducks/conversations.preload.js';
import { getDefaultConversation } from '../../../test-helpers/getDefaultConversation.std.js';
import { ThemeType } from '../../../types/Util.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ConversationDetails/GroupMemberLabelEditor',
} satisfies Meta<PropsType>;

const createProps = (conversation?: ConversationType): PropsType => ({
  conversation: conversation || getDefaultConversation({ type: 'group' }),
  existingLabelEmoji: '🐘',
  existingLabelString: 'Good Memory',
  i18n,
  popPanelForConversation: action('popPanelForConversation'),
  theme: ThemeType.light,
  updateGroupMemberLabel: action('changeHasGroupLink'),
});

export function NoExistingLabel(): React.JSX.Element {
  const props = {
    ...createProps(),
    existingLabelEmoji: undefined,
    existingLabelString: undefined,
  };

  return <GroupMemberLabelEditor {...props} />;
}

export function ExistingLabel(): React.JSX.Element {
  const props = createProps();

  return <GroupMemberLabelEditor {...props} />;
}

export function StringButNoEmoji(): React.JSX.Element {
  const props = {
    ...createProps(),
    existingLabelEmoji: undefined,
  };

  return <GroupMemberLabelEditor {...props} />;
}
