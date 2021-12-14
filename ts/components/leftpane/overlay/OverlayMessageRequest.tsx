import React from 'react';
// tslint:disable: no-submodule-imports use-simple-attributes

import { SpacerLG } from '../../basic/Text';
import { useDispatch, useSelector } from 'react-redux';
import { getConversationRequests } from '../../../state/selectors/conversations';
import { MemoConversationListItemWithDetails } from '../ConversationListItem';
import styled from 'styled-components';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../../basic/SessionButton';
import { OverlayHeader } from './OverlayHeader';
import { setOverlayMode } from '../../../state/ducks/section';
import { getConversationController } from '../../../session/conversations';
import { forceSyncConfigurationNowIfNeeded } from '../../../session/utils/syncUtils';
import { BlockedNumberController } from '../../../util';
import { getIsMessageRequestsEnabled } from '../../../state/selectors/userConfig';
import useKey from 'react-use/lib/useKey';

/**
 * Blocks all message request conversations and synchronizes across linked devices
 * @returns void
 */
async function handleBlockAllRequestsClick(messageRequestSetting: boolean) {
  const messageRequestsEnabled =
    messageRequestSetting && window?.lokiFeatureFlags?.useMessageRequests;

  if (!messageRequestsEnabled) {
    return;
  }

  // block all convo requests. Force sync if there were changes.
  window?.log?.info('Blocking all conversations');
  const conversations = getConversationController().getConversations();

  if (!conversations) {
    window?.log?.info('No message requests to block.');
    return;
  }

  const conversationRequests = conversations.filter(
    c => c.isPrivate() && c.get('active_at') && c.get('isApproved')
  );

  let syncRequired = false;

  if (!conversationRequests) {
    window?.log?.info('No conversation requests to block.');
    return;
  }

  await Promise.all(
    conversationRequests.map(async convo => {
      await BlockedNumberController.block(convo.id);
      syncRequired = true;
    })
  );

  if (syncRequired) {
    await forceSyncConfigurationNowIfNeeded();
  }
}

export const OverlayMessageRequest = () => {
  useKey('Escape', closeOverlay);
  const dispatch = useDispatch();
  function closeOverlay() {
    dispatch(setOverlayMode(undefined));
  }

  const messageRequestSetting = useSelector(getIsMessageRequestsEnabled);

  const title = window.i18n('messageRequests');
  const subtitle = window.i18n('requestsSubtitle');
  const buttonText = window.i18n('blockAll');

  return (
    <div className="module-left-pane-overlay">
      <OverlayHeader title={title} subtitle={subtitle} />

      <SpacerLG />
      <MessageRequestList />
      <SpacerLG />

      <SessionButton
        buttonColor={SessionButtonColor.Green}
        buttonType={SessionButtonType.BrandOutline}
        text={buttonText}
        onClick={() => {
          void handleBlockAllRequestsClick(messageRequestSetting);
        }}
      />
    </div>
  );
};

const MessageRequestListContainer = styled.div`
  width: 100%;
  overflow-y: auto;
  border: var(--border-session);
`;

/**
 * A request needs to be be unapproved and not blocked to be valid.
 * @returns List of message request items
 */
const MessageRequestList = () => {
  const conversationRequests = useSelector(getConversationRequests);
  return (
    <MessageRequestListContainer>
      {conversationRequests.map(conversation => {
        return (
          <MemoConversationListItemWithDetails
            key={conversation.id}
            isMessageRequest={true}
            {...conversation}
          />
        );
      })}
    </MessageRequestListContainer>
  );
};
