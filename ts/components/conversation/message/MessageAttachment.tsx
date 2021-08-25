import classNames from 'classnames';
import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import _ from 'underscore';
import { getMessageById } from '../../../data/data';
import { MessageRenderingProps } from '../../../models/messageType';
import {
  PropsForAttachment,
  showLightBox,
  toggleSelectedMessageId,
} from '../../../state/ducks/conversations';
import {
  getMessageAttachmentProps,
  isMessageSelectionMode,
} from '../../../state/selectors/conversations';
import {
  AttachmentType,
  AttachmentTypeWithPath,
  canDisplayImage,
  getExtensionForDisplay,
  hasImage,
  hasVideoScreenshot,
  isAudio,
  isImage,
  isVideo,
} from '../../../types/Attachment';
import { isFileDangerous } from '../../../util';
import { saveAttachmentToDisk } from '../../../util/attachmentsUtil';
import { Spinner } from '../../basic/Spinner';
import { LightBoxOptions } from '../../session/conversation/SessionConversation';
import { AudioPlayerWithEncryptedFile } from '../H5AudioPlayer';
import { ImageGrid } from '../ImageGrid';
import { ClickToTrustSender } from './ClickToTrustSender';

export type MessageAttachmentSelectorProps = Pick<
  MessageRenderingProps,
  | 'isTrustedForAttachmentDownload'
  | 'direction'
  | 'timestamp'
  | 'serverTimestamp'
  | 'authorPhoneNumber'
  | 'convoId'
> & {
  attachments: Array<PropsForAttachment>;
};

type Props = {
  messageId: string;
  imageBroken: boolean;
  handleImageError: () => void;
};

// tslint:disable-next-line max-func-body-length cyclomatic-complexity
export const MessageAttachment = (props: Props) => {
  const { messageId, imageBroken, handleImageError } = props;

  const dispatch = useDispatch();
  const attachmentProps = useSelector(state => getMessageAttachmentProps(state as any, messageId));
  const multiSelectMode = useSelector(isMessageSelectionMode);

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
    [messageId, multiSelectMode]
  );

  const onClickOnGenericAttachment = useCallback(
    (e: any) => {
      e.stopPropagation();
      e.preventDefault();
      if (!attachments?.length) {
        return;
      }

      const messageTimestamp = attachmentProps?.timestamp || attachmentProps?.serverTimestamp || 0;
      if (attachmentProps?.authorPhoneNumber && attachmentProps?.convoId) {
        void saveAttachmentToDisk({
          attachment: attachments[0],
          messageTimestamp,
          messageSender: attachmentProps?.authorPhoneNumber,
          conversationId: attachmentProps?.convoId,
        });
      }
    },
    [
      attachmentProps?.attachments,
      attachmentProps?.timestamp,
      attachmentProps?.serverTimestamp,
      attachmentProps?.authorPhoneNumber,
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
  const displayImage = canDisplayImage(attachments);

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
      <div className={classNames('module-message__attachment-container')}>
        <ImageGrid
          attachments={attachments}
          onError={handleImageError}
          onClickAttachment={onClickOnImageGrid}
        />
      </div>
    );
  } else if (!firstAttachment.pending && isAudio(attachments)) {
    return (
      <div
        role="main"
        onClick={(e: any) => {
          e.stopPropagation();
        }}
        style={{ padding: '5px 10px' }}
      >
        <AudioPlayerWithEncryptedFile
          src={firstAttachment.url}
          contentType={firstAttachment.contentType}
          messageId={messageId}
        />
      </div>
    );
  } else {
    const { pending, fileName, fileSize, contentType } = firstAttachment;
    const extension = getExtensionForDisplay({ contentType, fileName });
    const isDangerous = isFileDangerous(fileName || '');

    return (
      <div className={classNames('module-message__generic-attachment')}>
        {pending ? (
          <div className="module-message__generic-attachment__spinner-container">
            <Spinner size="small" direction={direction} />
          </div>
        ) : (
          <div className="module-message__generic-attachment__icon-container">
            <div
              role="button"
              className="module-message__generic-attachment__icon"
              onClick={onClickOnGenericAttachment}
            >
              {extension ? (
                <div className="module-message__generic-attachment__icon__extension">
                  {extension}
                </div>
              ) : null}
            </div>
            {isDangerous ? (
              <div className="module-message__generic-attachment__icon-dangerous-container">
                <div className="module-message__generic-attachment__icon-dangerous" />
              </div>
            ) : null}
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
      </div>
    );
  }
};

function attachmentIsAttachmentTypeWithPath(attac: any): attac is AttachmentTypeWithPath {
  return attac.path !== undefined;
}

const onClickAttachment = async (onClickProps: {
  attachment: AttachmentTypeWithPath | AttachmentType;
  messageId: string;
}) => {
  let index = -1;

  const found = await getMessageById(onClickProps.messageId);
  if (!found) {
    window.log.warn('Such message not found');
    return;
  }
  const msgAttachments = found.getPropsForMessage().attachments;

  const media = (msgAttachments || []).map(attachmentForMedia => {
    index++;
    const messageTimestamp =
      found.get('timestamp') || found.get('serverTimestamp') || found.get('received_at');

    return {
      index: _.clone(index),
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
      media: media as any,
      attachment: onClickProps.attachment,
    };
    window.inboxStore?.dispatch(showLightBox(lightBoxOptions));
  } else {
    window.log.warn('Attachment is not of the right type');
  }
};
