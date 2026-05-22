// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { EditHistoryMessagesModal } from './EditHistoryMessagesModal.dom.tsx';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.ts';
import { TextDirection } from './conversation/Message.dom.tsx';
import type { MessagePropsType } from '../state/selectors/message.preload.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/EditHistoryMessagesModal',
} satisfies Meta;

function getMockMessageProps(): MessagePropsType {
  return {
    id: '',
    author: getDefaultConversation(),
    canCopy: false,
    canDeleteForEveryone: false,
    canDownload: false,
    canEditMessage: false,
    canEndPoll: false,
    canForward: false,
    canPinMessage: false,
    canReact: false,
    canReply: false,
    canRetry: false,
    canRetryDeleteForEveryone: false,
    canSendPollVote: false,
    conversationColor: 'ultramarine',
    conversationId: '',
    conversationTitle: '',
    conversationType: 'direct',
    textDirection: TextDirection.Default,
    isSelected: false,
    isSelectMode: false,
    direction: 'outgoing',
    isBlocked: false,
    isMessageRequestAccepted: false,
    isPinned: false,
    isSignalConversation: false,
    isSMS: false,
    isVoiceMessagePlayed: false,
    previews: [],
    timestamp: 0,
    text: 'hello world',
  };
}

export function Default(): ReactNode {
  return (
    <EditHistoryMessagesModal
      i18n={i18n}
      getPreferredBadge={() => undefined}
      editHistoryMessages={[
        getMockMessageProps(),
        getMockMessageProps(),
        getMockMessageProps(),
        getMockMessageProps(),
      ]}
      cancelAttachmentDownload={action('cancelAttachmentDownload')}
      closeEditHistoryModal={action('closeEditHistoryModal')}
      kickOffAttachmentDownload={action('kickOffAttachmentDownload')}
      platform="darwin"
      showLightbox={action('showLightbox')}
    />
  );
}
