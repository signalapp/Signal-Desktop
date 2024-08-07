import classNames from 'classnames';
import { clone } from 'lodash';
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { Data } from '../../../../data/data';
import { MessageModelType, MessageRenderingProps } from '../../../../models/messageType';
import { PropsForAttachment, toggleSelectedMessageId } from '../../../../state/ducks/conversations';
import { LightBoxOptions, updateLightBoxOptions } from '../../../../state/ducks/modalDialog';
import { StateType } from '../../../../state/reducer';
import { useMessageSelected } from '../../../../state/selectors';
import {
  getMessageAttachmentProps,
  isMessageSelectionMode,
} from '../../../../state/selectors/conversations';
import {
  AttachmentType,
  AttachmentTypeWithPath,
  canDisplayImagePreview,
  getExtensionForDisplay,
  hasImage,
  hasVideoScreenshot,
  isAudio,
  isImage,
  isVideo,
} from '../../../../types/Attachment';
import { saveAttachmentToDisk } from '../../../../util/attachmentsUtil';
import { MediaItemType } from '../../../lightbox/LightboxGallery';
import { Spinner } from '../../../loading';
import { AudioPlayerWithEncryptedFile } from '../../H5AudioPlayer';
import { ImageGrid } from '../../ImageGrid';
import { ClickToTrustSender } from './ClickToTrustSender';
import { MessageHighlighter } from './MessageHighlighter';

export type MessageAttachmentSelectorProps = Pick<
  MessageRenderingProps,
  | 'isTrustedForAttachmentDownload'
  | 'direction'
  | 'timestamp'
  | 'serverTimestamp'
  | 'sender'
  | 'convoId'
> & {
  attachments: Array<PropsForAttachment>;
};

type Props = {
  messageId: string;
  imageBroken: boolean;
  handleImageError: () => void;
  highlight?: boolean;
};

const StyledImageGridContainer = styled.div<{
  messageDirection: MessageModelType;
}>`
  text-align: center;
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: ${props => (props.messageDirection === 'incoming' ? 'flex-start' : 'flex-end')};
`;

const StyledGenericAttachmentContainer = styled(MessageHighlighter)<{ selected: boolean }>`
  ${props => props.selected && 'box-shadow: var(--drop-shadow);'}
`;

export const MessageAttachment = (props: Props) => {
  const { messageId, imageBroken, handleImageError, highlight = false } = props;

  const dispatch = useDispatch();
  const attachmentProps = useSelector((state: StateType) =>
    getMessageAttachmentProps(state, messageId)
  );

  const multiSelectMode = useSelector(isMessageSelectionMode);
  const selected = useMessageSelected(messageId);
  const onClickOnImageGrid = useCallback(
    (attachment: AttachmentTypeWithPath | AttachmentType) => {
      if (multiSelectMode) {
        dispatch(toggleSelectedMessageId(messageId));
      } else {
        void onClickAttachment({
          attachment,
          messageId,
        });
      }
    },
    [dispatch, messageId, multiSelectMode]
  );

  const onClickOnGenericAttachment = useCallback(
    (e: any) => {
      e.stopPropagation();
      e.preventDefault();
      if (!attachmentProps?.attachments?.length || attachmentProps?.attachments[0]?.pending) {
        return;
      }

      const messageTimestamp = attachmentProps?.timestamp || attachmentProps?.serverTimestamp || 0;
      if (attachmentProps?.sender && attachmentProps?.convoId) {
        void saveAttachmentToDisk({
          attachment: attachmentProps?.attachments[0],
          messageTimestamp,
          messageSender: attachmentProps?.sender,
          conversationId: attachmentProps?.convoId,
          index: 0,
        });
      }
    },
    [
      attachmentProps?.attachments,
      attachmentProps?.timestamp,
      attachmentProps?.serverTimestamp,
      attachmentProps?.sender,
      attachmentProps?.convoId,
    ]
  );

  if (!attachmentProps) {
    return null;
  }

  const { attachments, direction, isTrustedForAttachmentDownload } = attachmentProps;

  if (!attachments || !attachments[0]) {
    return null;
  }

  const firstAttachment = attachments[0];
  const displayImage = canDisplayImagePreview(attachments);

  if (!isTrustedForAttachmentDownload) {
    return <ClickToTrustSender messageId={messageId} />;
  }

  if (
    displayImage &&
    !imageBroken &&
    ((isImage(attachments) && hasImage(attachments)) ||
      (isVideo(attachments) && hasVideoScreenshot(attachments)))
  ) {
    return (
      <MessageHighlighter highlight={highlight}>
        <StyledImageGridContainer messageDirection={direction}>
          <ImageGrid
            messageId={messageId}
            attachments={attachments}
            onError={handleImageError}
            onClickAttachment={onClickOnImageGrid}
          />
        </StyledImageGridContainer>
      </MessageHighlighter>
    );
  }

  if (!firstAttachment.pending && !firstAttachment.error && isAudio(attachments)) {
    return (
      <MessageHighlighter
        highlight={highlight}
        role="main"
        onClick={(e: any) => {
          if (multiSelectMode) {
            dispatch(toggleSelectedMessageId(messageId));
          }
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <AudioPlayerWithEncryptedFile
          src={firstAttachment.url}
          contentType={firstAttachment.contentType}
          messageId={messageId}
        />
      </MessageHighlighter>
    );
  }
  const { pending, fileName, fileSize, contentType } = firstAttachment;
  const extension = getExtensionForDisplay({ contentType, fileName });

  return (
    <StyledGenericAttachmentContainer
      highlight={highlight}
      selected={selected}
      className={'module-message__generic-attachment'}
      onClick={onClickOnGenericAttachment}
    >
      {pending ? (
        <div className="module-message__generic-attachment__spinner-container">
          <Spinner size="small" />
        </div>
      ) : (
        <div className="module-message__generic-attachment__icon-container">
          <div role="button" className="module-message__generic-attachment__icon">
            {extension ? (
              <div className="module-message__generic-attachment__icon__extension">{extension}</div>
            ) : null}
          </div>
        </div>
      )}
      <div className="module-message__generic-attachment__text">
        <div
          className={classNames(
            'module-message__generic-attachment__file-name',
            `module-message__generic-attachment__file-name--${direction}`
          )}
        >
          {fileName}
        </div>
        <div
          className={classNames(
            'module-message__generic-attachment__file-size',
            `module-message__generic-attachment__file-size--${direction}`
          )}
        >
          {fileSize}
        </div>
      </div>
    </StyledGenericAttachmentContainer>
  );
};

function attachmentIsAttachmentTypeWithPath(attac: any): attac is AttachmentTypeWithPath {
  return attac.path !== undefined;
}

export async function showLightboxFromAttachmentProps(
  messageId: string,
  selected: AttachmentTypeWithPath | AttachmentType | PropsForAttachment
) {
  const found = await Data.getMessageById(messageId);
  if (!found) {
    window.log.warn(`showLightboxFromAttachmentProps Message not found ${messageId}}`);
    return;
  }

  const msgAttachments = found.getPropsForMessage().attachments;

  let index = -1;

  const media = (msgAttachments || []).map(attachmentForMedia => {
    index++;
    const messageTimestamp =
      found.get('timestamp') || found.get('serverTimestamp') || found.get('received_at') || -1;

    return {
      index: clone(index),
      objectURL: attachmentForMedia.url || undefined,
      contentType: attachmentForMedia.contentType,
      attachment: attachmentForMedia,
      messageSender: found.getSource(),
      messageTimestamp,
      messageId,
    };
  });

  if (attachmentIsAttachmentTypeWithPath(selected)) {
    const lightBoxOptions: LightBoxOptions = {
      media,
      attachment: selected,
    };
    window.inboxStore?.dispatch(updateLightBoxOptions(lightBoxOptions));
  } else {
    window.log.warn('Attachment is not of the right type');
  }
}

const onClickAttachment = async (onClickProps: {
  attachment: AttachmentTypeWithPath | AttachmentType;
  messageId: string;
}) => {
  let index = -1;

  const found = await Data.getMessageById(onClickProps.messageId);
  if (!found) {
    window.log.warn('Such message not found');
    return;
  }
  const msgAttachments = found.getPropsForMessage().attachments;

  const media: Array<MediaItemType> = (msgAttachments || []).map(attachmentForMedia => {
    index++;
    const messageTimestamp =
      found.get('timestamp') || found.get('serverTimestamp') || found.get('received_at') || -1;

    return {
      index: clone(index),
      objectURL: attachmentForMedia.url || undefined,
      contentType: attachmentForMedia.contentType,
      attachment: attachmentForMedia,
      messageSender: found.getSource(),
      messageTimestamp,
      messageId: onClickProps.messageId,
    };
  });

  if (attachmentIsAttachmentTypeWithPath(onClickProps.attachment)) {
    const lightBoxOptions: LightBoxOptions = {
      media,
      attachment: onClickProps.attachment,
    };
    window.inboxStore?.dispatch(updateLightBoxOptions(lightBoxOptions));
  } else {
    window.log.warn('Attachment is not of the right type');
  }
};
