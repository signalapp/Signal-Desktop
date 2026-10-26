// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memo, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ShareContactDialog } from '../../components/ShareContactDialog.dom.tsx';
import { strictAssert } from '../../util/assert.std.ts';
import { isSignalConnection } from '../../util/getSignalConnections.preload.ts';
import type {
  ShareContactDraftType,
  ShareContactType,
} from '../../util/shareContact.std.ts';
import {
  canShareContactFromConversation,
  getShareContactDraft,
} from '../../util/shareContact.std.ts';
import { useComposerActions } from '../ducks/composer.preload.ts';
import type { ConversationType } from '../ducks/conversations.preload.ts';
import {
  getAllConversations,
  getConversationSelector,
} from '../selectors/conversations.dom.ts';
import { getIntl, getRegionCode, getTheme } from '../selectors/user.std.ts';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.ts';
import { drop } from '../../util/drop.std.ts';
import { getE164 } from '../../util/getE164.std.ts';

function isShareableContact(conversation: ConversationType): boolean {
  // 1. Signal connections
  if (isSignalConnection(conversation)) {
    return canShareContactFromConversation(conversation);
  }

  // 2. Anybody else with an e164 we have not blocked or removed
  return (
    conversation.type === 'direct' &&
    !conversation.isMe &&
    getE164(conversation) != null &&
    !conversation.isBlocked &&
    conversation.removalStage == null
  );
}

export type SmartShareContactDialogProps = Readonly<{
  conversationId: string;
  onClose: () => void;
}>;

export const SmartShareContactDialog = memo(function SmartShareContactDialog({
  conversationId,
  onClose,
}: SmartShareContactDialogProps) {
  const i18n = useSelector(getIntl);
  const ourRegionCode = useSelector(getRegionCode);
  const theme = useSelector(getTheme);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const allConversations = useSelector(getAllConversations);
  const conversationSelector = useSelector(getConversationSelector);
  const { shareContact } = useComposerActions();

  const recipient = conversationSelector(conversationId);

  const contacts = useMemo(() => {
    return allConversations.filter(conversation => {
      return (
        conversation.id !== conversationId && isShareableContact(conversation)
      );
    });
  }, [allConversations, conversationId]);

  const getContactDraft = useCallback(
    (contactConversationId: string): ShareContactDraftType => {
      const contactConversation = window.ConversationController.get(
        contactConversationId
      );
      strictAssert(contactConversation, 'Missing contact conversation');
      return getShareContactDraft(contactConversation.attributes);
    },
    []
  );

  const handleShareContact = useCallback(
    (contact: ShareContactType) => {
      drop(shareContact(conversationId, contact));
      onClose();
    },
    [shareContact, conversationId, onClose]
  );

  return (
    <ShareContactDialog
      i18n={i18n}
      theme={theme}
      getPreferredBadge={getPreferredBadge}
      contacts={contacts}
      recipientTitle={recipient.title}
      ourRegionCode={ourRegionCode}
      getContactDraft={getContactDraft}
      onClose={onClose}
      onShareContact={handleShareContact}
    />
  );
});
