import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import {
  acceptConversation,
  blockConvoById,
  declineConversation,
} from '../../interactions/conversationInteractions';
import { forceSyncConfigurationNowIfNeeded } from '../../session/utils/syncUtils';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { getSelectedConversation } from '../../state/selectors/conversations';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';

export const ConversationMessageRequestButtons = () => {
  const selectedConversation = useSelector(getSelectedConversation);

  if (!selectedConversation) {
    return null;
  }

  const showMsgRequestUI =
    !selectedConversation.isApproved && selectedConversation.type === 'private';
  const dispatch = useDispatch();

  const handleDeclineConversationRequest = () => {
    dispatch(
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
          dispatch(updateConfirmModal(null));
        },
        onClickClose: () => {
          dispatch(updateConfirmModal(null));
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
