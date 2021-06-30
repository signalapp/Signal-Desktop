import React from 'react';
import styled from 'styled-components';
import { getMessageById, getMessagesByConversation } from '../../../data/data';
import { getConversationController } from '../../../session/conversations';
import { AttachmentDownloads } from '../../../session/utils';
import { updateConfirmModal } from '../../../state/ducks/modalDialog';
import { SessionIcon, SessionIconSize, SessionIconType } from '../../session/icon';
import { SessionButtonColor } from '../../session/SessionButton';

const StyledTrustSenderUI = styled.div`
  padding: '${props => props.theme.common.margins.md}px';
  display: flex;
  align-items: center;
`;

const ClickToDownload = styled.div`
  padding: ${props => props.theme.common.margins.xs} ${props => props.theme.common.margins.md};
`;

export const ClickToTrustSender = (props: { messageId: string }) => {
  const openConfirmationModal = async (e: any) => {
    e.stopPropagation();
    e.preventDefault();
    const found = await getMessageById(props.messageId);
    if (!found) {
      window.log.warn('message not found ClickToTrustSender');
      return;
    }
    const sender = found.getSource();
    const convo = getConversationController().get(sender);
    window.inboxStore?.dispatch(
      updateConfirmModal({
        title: window.i18n(
          'trustThisContactDialogTitle',
          convo.getContactProfileNameOrShortenedPubKey()
        ),
        message: window.i18n(
          'trustThisContactDialogDescription',
          convo.getContactProfileNameOrShortenedPubKey()
        ),
        okTheme: SessionButtonColor.Green,
        onClickOk: async () => {
          convo.set({ isTrustedForAttachmentDownload: true });
          await convo.commit();
          const messagesInConvo = await getMessagesByConversation(convo.id, {
            limit: 100,
          });

          await Promise.all(
            messagesInConvo.map(async message => {
              const msgAttachments = message.get('attachments');
              if (message.get('direction') !== 'incoming') {
                return;
              }
              if (!msgAttachments || msgAttachments.length === 0) {
                return;
              }

              const downloadedAttachments = await Promise.all(
                msgAttachments.map(async (attachment: any, index: any) => {
                  if (attachment.path) {
                    return { ...attachment, pending: false };
                  }
                  return AttachmentDownloads.addJob(attachment, {
                    messageId: message.id,
                    type: 'attachment',
                    index,
                    isOpenGroupV2: false,
                    openGroupV2Details: undefined,
                  });
                })
              );

              message.set({ attachments: downloadedAttachments });
              await message.commit();
            })
          );
        },
      })
    );
  };

  return (
    <StyledTrustSenderUI onClick={openConfirmationModal}>
      <SessionIcon iconSize={SessionIconSize.Small} iconType={SessionIconType.Gallery} />
      <ClickToDownload>{window.i18n('clickToTrustContact')}</ClickToDownload>
    </StyledTrustSenderUI>
  );
};
