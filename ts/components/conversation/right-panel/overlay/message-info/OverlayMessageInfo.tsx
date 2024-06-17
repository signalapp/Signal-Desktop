import { useCallback, useEffect, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
// tslint:disable-next-line: no-submodule-imports
import useKey from 'react-use/lib/useKey';
import { PropsForAttachment, closeRightPanel } from '../../../../../state/ducks/conversations';
import { resetRightOverlayMode, setRightOverlayMode } from '../../../../../state/ducks/section';
import { getMessageInfoId } from '../../../../../state/selectors/conversations';
import { Flex } from '../../../../basic/Flex';
import { Header, HeaderTitle, StyledScrollContainer } from '../components';

import { IsDetailMessageViewContext } from '../../../../../contexts/isDetailViewContext';
import { Data } from '../../../../../data/data';
import { useRightOverlayMode } from '../../../../../hooks/useUI';
import {
  replyToMessage,
  resendMessage,
} from '../../../../../interactions/conversationInteractions';
import { deleteMessagesById } from '../../../../../interactions/conversations/unsendingInteractions';
import {
  useMessageAttachments,
  useMessageDirection,
  useMessageIsDeletable,
  useMessageQuote,
  useMessageSender,
  useMessageServerTimestamp,
  useMessageText,
  useMessageTimestamp,
} from '../../../../../state/selectors';
import { useSelectedConversationKey } from '../../../../../state/selectors/selectedConversation';
import { canDisplayImagePreview } from '../../../../../types/Attachment';
import { isAudio } from '../../../../../types/MIME';
import {
  getAudioDuration,
  getVideoDuration,
} from '../../../../../types/attachments/VisualAttachment';
import { GoogleChrome } from '../../../../../util';
import { saveAttachmentToDisk } from '../../../../../util/attachmentsUtil';
import { SpacerLG, SpacerMD, SpacerXL } from '../../../../basic/Text';
import { PanelButtonGroup, PanelIconButton } from '../../../../buttons';
import { Message } from '../../../message/message-item/Message';
import { AttachmentInfo, MessageInfo } from './components';
import { AttachmentCarousel } from './components/AttachmentCarousel';

// NOTE we override the default max-widths when in the detail isDetailView
const StyledMessageBody = styled.div`
  padding-bottom: var(--margins-lg);
  .module-message {
    pointer-events: none;

    max-width: 100%;
    @media (min-width: 1200px) {
      max-width: 100%;
    }
  }
`;

const MessageBody = ({
  messageId,
  supportsAttachmentCarousel,
}: {
  messageId: string;
  supportsAttachmentCarousel: boolean;
}) => {
  const quote = useMessageQuote(messageId);
  const text = useMessageText(messageId);

  // NOTE we don't want to render the message body if it's empty and the attachments carousel can render it instead
  if (supportsAttachmentCarousel && !text && !quote) {
    return null;
  }

  return (
    <IsDetailMessageViewContext.Provider value={true}>
      <StyledMessageBody>
        <Message messageId={messageId} />
      </StyledMessageBody>
    </IsDetailMessageViewContext.Provider>
  );
};

const StyledMessageInfoContainer = styled.div`
  height: calc(100% - 48px);
  width: 100%;
  max-width: 650px;
  overflow: hidden auto;
  z-index: 2;

  margin-inline-start: auto;
  margin-inline-end: auto;
  padding: var(--margins-sm) var(--margins-2xl) var(--margins-lg);
`;

type MessageInfoProps = {
  errors: Array<Error>;
  attachments: Array<PropsForAttachment>;
};

async function getPropsForMessageInfo(
  messageId: string | undefined,
  attachments: Array<PropsForAttachment>
): Promise<MessageInfoProps | null> {
  if (!messageId) {
    return null;
  }
  const found = await Data.getMessageById(messageId);
  const attachmentsWithMediaDetails: Array<PropsForAttachment> = [];
  if (found) {
    // process attachments so we have the fileSize, url and screenshots
    for (let i = 0; i < attachments.length; i++) {
      const props = found.getPropsForAttachment(attachments[i]);
      if (
        props?.contentType &&
        GoogleChrome.isVideoTypeSupported(props?.contentType) &&
        !props.duration &&
        props.url
      ) {
        // eslint-disable-next-line no-await-in-loop
        const duration = await getVideoDuration({
          objectUrl: props.url,
          contentType: props.contentType,
        });
        attachmentsWithMediaDetails.push({
          ...props,
          duration,
        });
      } else if (props?.contentType && isAudio(props.contentType) && !props.duration && props.url) {
        // eslint-disable-next-line no-await-in-loop
        const duration = await getAudioDuration({
          objectUrl: props.url,
          contentType: props.contentType,
        });

        attachmentsWithMediaDetails.push({
          ...props,
          duration,
        });
      } else if (props) {
        attachmentsWithMediaDetails.push(props);
      }
    }

    // This will make the error message for outgoing key errors a bit nicer
    const errors = (found.get('errors') || []).map((error: any) => {
      return error;
    });

    const toRet: MessageInfoProps = {
      errors,
      attachments: attachmentsWithMediaDetails,
    };

    return toRet;
  }
  return null;
}

function useMessageInfo(messageId: string | undefined) {
  const [details, setDetails] = useState<MessageInfoProps | null>(null);

  const fromState = useMessageAttachments(messageId);

  // this is not ideal, but also doesn't seem to create any performance issue at the moment.
  // TODO: ideally, we'd want to save the attachment duration anytime we save one to the disk (incoming/outgoing), and just retrieve it from the redux state here.
  useEffect(() => {
    let mounted = true;
    // eslint-disable-next-line more/no-then
    void getPropsForMessageInfo(messageId, fromState || [])
      .then(result => {
        if (mounted) {
          setDetails(result);
        }
      })
      .catch(window.log.error);

    return () => {
      mounted = false;
    };
  }, [fromState, messageId]);

  return details;
}

export const OverlayMessageInfo = () => {
  const dispatch = useDispatch();

  const rightOverlayMode = useRightOverlayMode();
  const messageId = useSelector(getMessageInfoId);
  const messageInfo = useMessageInfo(messageId);
  const isDeletable = useMessageIsDeletable(messageId);
  const direction = useMessageDirection(messageId);
  const timestamp = useMessageTimestamp(messageId);
  const serverTimestamp = useMessageServerTimestamp(messageId);
  const sender = useMessageSender(messageId);

  // we close the right panel when switching conversation so the convoId of that message is always the selectedConversationKey
  // is always the currently selected conversation
  const convoId = useSelectedConversationKey();

  const closePanel = useCallback(() => {
    dispatch(closeRightPanel());
    dispatch(resetRightOverlayMode());
  }, [dispatch]);

  useKey('Escape', closePanel);

  // close the panel if the messageInfo is associated with a deleted message
  useEffect(() => {
    if (!sender) {
      closePanel();
    }
  }, [sender, closePanel]);

  if (!rightOverlayMode || !messageInfo || !convoId || !messageId || !sender) {
    return null;
  }

  const { params } = rightOverlayMode;
  const visibleAttachmentIndex = params?.visibleAttachmentIndex || 0;

  const { errors, attachments } = messageInfo;

  const hasAttachments = attachments && attachments.length > 0;
  const supportsAttachmentCarousel = canDisplayImagePreview(attachments);
  const hasErrors = errors && errors.length > 0;

  const handleChangeAttachment = (changeDirection: 1 | -1) => {
    if (!hasAttachments) {
      return;
    }

    const newVisibleIndex = visibleAttachmentIndex + changeDirection;
    if (newVisibleIndex > attachments.length - 1) {
      return;
    }

    if (newVisibleIndex < 0) {
      return;
    }

    if (attachments[newVisibleIndex]) {
      dispatch(
        setRightOverlayMode({
          type: 'message_info',
          params: { messageId, visibleAttachmentIndex: newVisibleIndex },
        })
      );
    }
  };

  return (
    <StyledScrollContainer>
      <Flex container={true} flexDirection={'column'} alignItems={'center'}>
        <Header hideBackButton={true} closeButtonOnClick={closePanel}>
          <HeaderTitle>{window.i18n('messageInfo')}</HeaderTitle>
        </Header>
        <StyledMessageInfoContainer>
          <MessageBody
            messageId={messageId}
            supportsAttachmentCarousel={supportsAttachmentCarousel}
          />
          {hasAttachments && (
            <>
              {supportsAttachmentCarousel && (
                <>
                  <AttachmentCarousel
                    messageId={messageId}
                    attachments={attachments}
                    visibleIndex={visibleAttachmentIndex}
                    nextAction={() => {
                      handleChangeAttachment(1);
                    }}
                    previousAction={() => {
                      handleChangeAttachment(-1);
                    }}
                  />
                  <SpacerXL />
                </>
              )}
              <AttachmentInfo attachment={attachments[visibleAttachmentIndex]} />
              <SpacerMD />
            </>
          )}
          <MessageInfo messageId={messageId} errors={messageInfo.errors} />
          <SpacerLG />
          <PanelButtonGroup style={{ margin: '0' }}>
            <PanelIconButton
              text={window.i18n('replyToMessage')}
              iconType="reply"
              onClick={() => {
                // eslint-disable-next-line more/no-then
                void replyToMessage(messageId).then(foundIt => {
                  if (foundIt) {
                    dispatch(closeRightPanel());
                    dispatch(resetRightOverlayMode());
                  }
                });
              }}
              dataTestId="reply-to-msg-from-details"
            />
            {hasErrors && direction === 'outgoing' && (
              <PanelIconButton
                text={window.i18n('resend')}
                iconType="resend"
                onClick={() => {
                  void resendMessage(messageId);
                  dispatch(closeRightPanel());
                  dispatch(resetRightOverlayMode());
                }}
                dataTestId="resend-msg-from-details"
              />
            )}
            {hasAttachments && (
              <PanelIconButton
                text={window.i18n('save')}
                iconType="saveToDisk"
                dataTestId="save-attachment-from-details"
                onClick={() => {
                  if (hasAttachments) {
                    void saveAttachmentToDisk({
                      conversationId: convoId,
                      messageSender: sender,
                      messageTimestamp: serverTimestamp || timestamp || Date.now(),
                      attachment: attachments[visibleAttachmentIndex],
                      index: visibleAttachmentIndex,
                    });
                  }
                }}
              />
            )}
            {isDeletable && (
              <PanelIconButton
                text={window.i18n('delete')}
                iconType="delete"
                color={'var(--danger-color)'}
                dataTestId="delete-from-details"
                onClick={() => {
                  void deleteMessagesById([messageId], convoId);
                }}
              />
            )}
          </PanelButtonGroup>
          <SpacerXL />
        </StyledMessageInfoContainer>
      </Flex>
    </StyledScrollContainer>
  );
};
