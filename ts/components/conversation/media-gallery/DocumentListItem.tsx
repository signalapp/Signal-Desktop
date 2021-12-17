import React, { useCallback } from 'react';
import classNames from 'classnames';

import moment from 'moment';
// tslint:disable-next-line:match-default-export-name
import formatFileSize from 'filesize';
import { useSelector } from 'react-redux';
import { getSelectedConversationKey } from '../../../state/selectors/conversations';
import { saveAttachmentToDisk } from '../../../util/attachmentsUtil';
import { MediaItemType } from '../../lightbox/LightboxGallery';

type Props = {
  // Required
  timestamp: number;

  // Optional
  fileName?: string;
  fileSize?: number | null;
  shouldShowSeparator?: boolean;
  mediaItem: MediaItemType;
};

export const DocumentListItem = (props: Props) => {
  const { shouldShowSeparator, fileName, fileSize, timestamp } = props;

  const defaultShowSeparator = shouldShowSeparator === undefined ? true : shouldShowSeparator;
  const selectedConversationKey = useSelector(getSelectedConversationKey) as string;

  const saveAttachmentCallback = useCallback(() => {
    void saveAttachmentToDisk({
      messageSender: props.mediaItem.messageSender,
      messageTimestamp: props.mediaItem.messageTimestamp,
      attachment: props.mediaItem.attachment,
      conversationId: selectedConversationKey,
    });
  }, [
    selectedConversationKey,
    props.mediaItem.messageSender,
    props.mediaItem.messageTimestamp,
    props.mediaItem.attachment,
  ]);

  return (
    <div
      className={classNames(
        'module-document-list-item',
        defaultShowSeparator ? 'module-document-list-item--with-separator' : null
      )}
    >
      <div
        className="module-document-list-item__content"
        role="button"
        onClick={saveAttachmentCallback}
      >
        <div className="module-document-list-item__icon" />
        <div className="module-document-list-item__metadata">
          <span className="module-document-list-item__file-name">{fileName}</span>
          <span className="module-document-list-item__file-size">
            {typeof fileSize === 'number' ? formatFileSize(fileSize) : ''}
          </span>
        </div>
        <div className="module-document-list-item__date">
          {moment(timestamp).format('ddd, MMM D, Y')}
        </div>
      </div>
    </div>
  );
};
