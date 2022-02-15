import React from 'react';
import styled from 'styled-components';
import {
  acceptConversation,
  blockConvoById,
  declineConversation,
} from '../../interactions/conversationInteractions';
import { forceSyncConfigurationNowIfNeeded } from '../../session/utils/syncUtils';
import { ReduxConversationType } from '../../state/ducks/conversations';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';

export const ConversationMessageRequestButtons = (props: {
  selectedConversation: ReduxConversationType;
}) => {
  const { selectedConversation } = props;
  const { isApproved, type } = selectedConversation;
  const showMsgRequestUI = !isApproved && type === 'private';

  const handleDeclineConversationRequest = () => {
    window.inboxStore?.dispatch(
      updateConfirmModal({
        okText: window.i18n('decline'),
        cancelText: window.i18n('cancel'),
        message: window.i18n('declineRequestMessage'),
        onClickOk: async () => {
          await declineConversation(selectedConversation.id, false);
          await blockConvoById(selectedConversation.id);
          await forceSyncConfigurationNowIfNeeded();
        },
        onClickCancel: () => {
          window.inboxStore?.dispatch(updateConfirmModal(null));
        },
        onClickClose: () => {
          window.inboxStore?.dispatch(updateConfirmModal(null));
        },
      })
    );
  };

  const handleAcceptConversationRequest = async () => {
    const { id } = selectedConversation;
    await acceptConversation(id, true);
  };

  if (!showMsgRequestUI) {
    return null;
  }

  return (
    <ConversationRequestBanner>
      <ConversationBannerRow>
        <SessionButton
          buttonColor={SessionButtonColor.Green}
          buttonType={SessionButtonType.BrandOutline}
          onClick={handleAcceptConversationRequest}
          text={window.i18n('accept')}
        />
        <SessionButton
          buttonColor={SessionButtonColor.Danger}
          buttonType={SessionButtonType.BrandOutline}
          text={window.i18n('decline')}
          onClick={handleDeclineConversationRequest}
        />
      </ConversationBannerRow>
    </ConversationRequestBanner>
  );
};

const ConversationBannerRow = styled.div`
  display: flex;
  flex-direction: row;
  gap: var(--margins-lg);
  justify-content: center;
`;

const ConversationRequestBanner = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: var(--margins-lg);
  gap: var(--margins-lg);
`;
