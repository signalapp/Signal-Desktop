import React, { useContext } from 'react';
import {
  approveConversation,
  blockConvoById,
} from '../../../interactions/conversationInteractions';
import { forceSyncConfigurationNowIfNeeded } from '../../../session/utils/syncUtils';
import { SessionIconButton } from '../../icon';
import { ContextConversationId } from './ConversationListItem';

const RejectMessageRequestButton = () => {
  const conversationId = useContext(ContextConversationId);

  /**
   * Removes conversation from requests list,
   * adds ID to block list, syncs the block with linked devices.
   */
  const handleConversationBlock = async () => {
    await blockConvoById(conversationId);
    await forceSyncConfigurationNowIfNeeded();
  };
  return (
    <SessionIconButton
      iconType="exit"
      iconSize="large"
      onClick={handleConversationBlock}
      backgroundColor="var(--color-destructive)"
      iconColor="var(--color-foreground-primary)"
      iconPadding="var(--margins-xs)"
      borderRadius="2px"
      margin="0 5px 0 0"
    />
  );
};

const ApproveMessageRequestButton = () => {
  const conversationId = useContext(ContextConversationId);

  return (
    <SessionIconButton
      iconType="check"
      iconSize="large"
      onClick={async () => {
        await approveConversation(conversationId);
      }}
      backgroundColor="var(--color-accent)"
      iconColor="var(--color-foreground-primary)"
      iconPadding="var(--margins-xs)"
      borderRadius="2px"
    />
  );
};

export const MessageRequestButtons = ({ isMessageRequest }: { isMessageRequest: boolean }) => {
  if (!isMessageRequest) {
    return null;
  }

  return (
    <>
      <RejectMessageRequestButton />
      <ApproveMessageRequestButton />
    </>
  );
};
