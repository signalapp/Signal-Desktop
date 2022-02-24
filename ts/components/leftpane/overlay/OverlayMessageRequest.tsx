import React from 'react';
// tslint:disable: no-submodule-imports use-simple-attributes

import { SpacerLG } from '../../basic/Text';
import { useDispatch, useSelector } from 'react-redux';
import { getConversationRequests } from '../../../state/selectors/conversations';
import { MemoConversationListItemWithDetails } from '../conversation-list-item/ConversationListItem';
import styled from 'styled-components';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../../basic/SessionButton';
import { setOverlayMode } from '../../../state/ducks/section';
import { getConversationController } from '../../../session/conversations';
import { forceSyncConfigurationNowIfNeeded } from '../../../session/utils/syncUtils';
import { BlockedNumberController } from '../../../util';
import useKey from 'react-use/lib/useKey';
import { ReduxConversationType } from '../../../state/ducks/conversations';
import { updateConfirmModal } from '../../../state/ducks/modalDialog';

export const OverlayMessageRequest = () => {
  useKey('Escape', closeOverlay);
  const dispatch = useDispatch();
  function closeOverlay() {
    dispatch(setOverlayMode(undefined));
  }
  const hasRequests = useSelector(getConversationRequests).length > 0;
  const messageRequests = useSelector(getConversationRequests);

  const buttonText = window.i18n('clearAll');

  /**
   * Blocks all message request conversations and synchronizes across linked devices
   * @returns void
   */
  async function handleBlockAllRequestsClick(convoRequests: Array<ReduxConversationType>) {
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

          let syncRequired = false;
          const convoController = getConversationController();
          await Promise.all(
            convoRequests.map(async convo => {
              const { id } = convo;
              const convoModel = convoController.get(id);
              if (!convoModel.isBlocked()) {
                await BlockedNumberController.block(id);
                await convoModel.commit();
              }
              await convoModel.setIsApproved(false);

              syncRequired = true;
            })
          );

          if (syncRequired) {
            await forceSyncConfigurationNowIfNeeded();
          }
        },
      })
    );
  }

  return (
    <div className="module-left-pane-overlay">
      {hasRequests ? (
        <>
          <MessageRequestList />
          <SpacerLG />
          <SessionButton
            buttonColor={SessionButtonColor.Danger}
            buttonType={SessionButtonType.BrandOutline}
            text={buttonText}
            onClick={async () => {
              await handleBlockAllRequestsClick(messageRequests);
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

const MessageRequestListPlaceholder = styled.div`
  color: var(--color-text);
  margin-bottom: auto;
`;

const MessageRequestListContainer = styled.div`
  width: 100%;
  overflow-y: auto;
  border: var(--border-session);
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
