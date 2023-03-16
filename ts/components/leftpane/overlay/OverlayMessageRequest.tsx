import React from 'react';
// tslint:disable: no-submodule-imports use-simple-attributes

import { SpacerLG } from '../../basic/Text';
import { useDispatch, useSelector } from 'react-redux';
import {
  getConversationRequests,
  getSelectedConversation,
} from '../../../state/selectors/conversations';
import { MemoConversationListItemWithDetails } from '../conversation-list-item/ConversationListItem';
import styled from 'styled-components';
import { SessionButton, SessionButtonColor } from '../../basic/SessionButton';
import { resetOverlayMode, SectionType, showLeftPaneSection } from '../../../state/ducks/section';
import { getConversationController } from '../../../session/conversations';
import { forceSyncConfigurationNowIfNeeded } from '../../../session/utils/sync/syncUtils';
import { BlockedNumberController } from '../../../util';
import useKey from 'react-use/lib/useKey';
import {
  ReduxConversationType,
  resetConversationExternal,
} from '../../../state/ducks/conversations';
import { updateConfirmModal } from '../../../state/ducks/modalDialog';

const MessageRequestListPlaceholder = styled.div`
  color: var(--conversation-tab-text-color);
  margin-bottom: auto;
`;

const MessageRequestListContainer = styled.div`
  width: 100%;
  overflow-y: auto;
  margin-bottom: auto;
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
        return <MemoConversationListItemWithDetails key={conversation.id} {...conversation} />;
      })}
    </MessageRequestListContainer>
  );
};

export const OverlayMessageRequest = () => {
  useKey('Escape', closeOverlay);
  const dispatch = useDispatch();
  function closeOverlay() {
    dispatch(resetOverlayMode());
  }
  const convoRequestCount = useSelector(getConversationRequests).length;
  const messageRequests = useSelector(getConversationRequests);
  const selectedConversation = useSelector(getSelectedConversation);

  const buttonText = window.i18n('clearAll');

  /**
   * Blocks all message request conversations and synchronizes across linked devices
   * @returns void
   */
  function handleClearAllRequestsClick(convoRequests: Array<ReduxConversationType>) {
    const { i18n } = window;
    const title = i18n('clearAllConfirmationTitle');
    const message = i18n('clearAllConfirmationBody');
    const onClose = dispatch(updateConfirmModal(null));

    dispatch(
      updateConfirmModal({
        title,
        message,
        onClose,
        onClickOk: async () => {
          window?.log?.info('Blocking all conversations');
          if (!convoRequests) {
            window?.log?.info('No conversation requests to block.');
            return;
          }

          let newConvosBlocked = [];
          const convoController = getConversationController();
          await Promise.all(
            (newConvosBlocked = convoRequests.filter(async convo => {
              const { id } = convo;
              const convoModel = convoController.get(id);
              if (!convoModel.isBlocked()) {
                await BlockedNumberController.block(id);
                await convoModel.commit();
              }
              await convoModel.setIsApproved(false);

              // if we're looking at the convo to decline, close the convo
              if (selectedConversation?.id === id) {
                dispatch(resetConversationExternal());
              }
              return true;
            }))
          );

          if (newConvosBlocked) {
            await forceSyncConfigurationNowIfNeeded();
          }

          // if no more requests, return to placeholder screen
          if (convoRequestCount === newConvosBlocked.length) {
            dispatch(resetOverlayMode());
            dispatch(showLeftPaneSection(SectionType.Message));
            dispatch(resetConversationExternal());
          }
        },
      })
    );
  }

  return (
    <div className="module-left-pane-overlay">
      {convoRequestCount ? (
        <>
          <MessageRequestList />
          <SpacerLG />
          <SessionButton
            buttonColor={SessionButtonColor.Danger}
            text={buttonText}
            onClick={() => {
              handleClearAllRequestsClick(messageRequests);
            }}
          />
        </>
      ) : (
        <>
          <SpacerLG />
          <MessageRequestListPlaceholder>
            {window.i18n('noMessageRequestsPending')}
          </MessageRequestListPlaceholder>
        </>
      )}
    </div>
  );
};
