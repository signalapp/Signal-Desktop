// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memo, useCallback, useEffect, useMemo, type JSX } from 'react';
import { useSelector } from 'react-redux';

import type { Props as ContactDetailProps } from '../../components/conversation/ContactDetail.dom.tsx';
import { ContactDetail } from '../../components/conversation/ContactDetail.dom.tsx';
import { useCallingActions } from '../ducks/calling.preload.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { getActiveCallState } from '../selectors/calling.std.ts';
import { getMessages } from '../selectors/conversations.dom.ts';
import { getResolveSharedContactSelector } from '../selectors/sharedContact.dom.ts';
import { getIntl, getRegionCode } from '../selectors/user.std.ts';
import { useNavActions } from '../ducks/nav.std.ts';
import { formatEmbeddedContactForUI } from '../../util/sharedContact.std.ts';
import { lookupOrCreateConversationIdForSharedContact } from '../../util/sharedContactCreateConversation.dom.ts';

export type OwnProps = Pick<ContactDetailProps, 'messageId'>;

export const SmartContactDetail = memo(function SmartContactDetail({
  messageId,
}: OwnProps): JSX.Element | null {
  const i18n = useSelector(getIntl);
  const messageLookup = useSelector(getMessages);
  const activeCall = useSelector(getActiveCallState);
  const resolveSharedContact = useSelector(getResolveSharedContactSelector);
  const ourRegionCode = useSelector(getRegionCode);
  const {
    cancelAttachmentDownload,
    kickOffAttachmentDownload,
    startConversationWithSharedContact,
  } = useConversationsActions();
  const {
    onOutgoingAudioCallInConversation,
    onOutgoingVideoCallInConversation,
  } = useCallingActions();
  const { toggleAddUserToAnotherGroupModal } = useGlobalModalActions();
  const { popPanelForConversation } = useNavActions();

  const rawContact = messageLookup[messageId]?.contact?.[0];
  const contact = useMemo(() => {
    return rawContact
      ? formatEmbeddedContactForUI(rawContact, resolveSharedContact(rawContact))
      : undefined;
  }, [rawContact, resolveSharedContact]);

  // We only create the conversation once the user takes an action
  const onSendMessage = useCallback(() => {
    if (contact) {
      startConversationWithSharedContact(contact);
    }
  }, [contact, startConversationWithSharedContact]);

  const onAddToGroup = useCallback(() => {
    const conversationId =
      contact && lookupOrCreateConversationIdForSharedContact(contact);
    if (conversationId) {
      toggleAddUserToAnotherGroupModal(conversationId);
    }
  }, [contact, toggleAddUserToAnotherGroupModal]);

  const onStartAudioCall = useCallback(() => {
    const conversationId =
      contact && lookupOrCreateConversationIdForSharedContact(contact);
    if (conversationId) {
      void onOutgoingAudioCallInConversation(conversationId);
    }
  }, [contact, onOutgoingAudioCallInConversation]);

  const onStartVideoCall = useCallback(() => {
    const conversationId =
      contact && lookupOrCreateConversationIdForSharedContact(contact);
    if (conversationId) {
      void onOutgoingVideoCallInConversation(conversationId);
    }
  }, [contact, onOutgoingVideoCallInConversation]);

  useEffect(() => {
    if (!contact) {
      void popPanelForConversation();
    }
  }, [contact, popPanelForConversation]);

  if (!contact) {
    return null;
  }

  const existingConversationId =
    contact.resolution.type === 'existing'
      ? contact.resolution.conversationId
      : undefined;

  const hasActiveCall =
    activeCall != null && activeCall.conversationId !== existingConversationId;

  return (
    <ContactDetail
      cancelAttachmentDownload={cancelAttachmentDownload}
      contact={contact}
      hasActiveCall={hasActiveCall}
      i18n={i18n}
      kickOffAttachmentDownload={kickOffAttachmentDownload}
      messageId={messageId}
      onAddToGroup={onAddToGroup}
      onSendMessage={onSendMessage}
      onStartAudioCall={onStartAudioCall}
      onStartVideoCall={onStartVideoCall}
      ourRegionCode={ourRegionCode}
    />
  );
});
