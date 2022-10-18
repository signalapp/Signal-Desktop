import classNames from 'classnames';
import React from 'react';
import { isImageAttachment } from '../../../../types/Attachment';
import { Image } from '../../Image';
import { MessageRenderingProps } from '../../../../models/messageType';
import { useDispatch, useSelector } from 'react-redux';
import {
  getIsMessageSelectionMode,
  getMessageLinkPreviewProps,
} from '../../../../state/selectors/conversations';
import { SessionIcon } from '../../../icon';
import { showLinkVisitWarningDialog } from '../../../dialog/SessionConfirm';

export type MessageLinkPreviewSelectorProps = Pick<
  MessageRenderingProps,
  'direction' | 'attachments' | 'previews'
>;

type Props = {
  handleImageError: () => void;
  messageId: string;
};

const linkPreviewsImageSize = 100;

export const MessageLinkPreview = (props: Props) => {
  const selected = useSelector(state => getMessageLinkPreviewProps(state as any, props.messageId));
  const dispatch = useDispatch();
  const isMessageSelectionMode = useSelector(getIsMessageSelectionMode);

  if (!selected) {
    return null;
  }
  const { direction, attachments, previews } = selected;

  // Attachments take precedence over Link Previews
  if (attachments && attachments.length) {
    return null;
  }

  if (!previews || previews.length < 1) {
    return null;
  }

  const first = previews[0];
  if (!first) {
    return null;
  }

  const previewHasImage = first.image && isImageAttachment(first.image);

  function openLinkFromPreview() {
    if (isMessageSelectionMode) {
      return;
    }
    if (previews?.length && previews[0].url) {
      showLinkVisitWarningDialog(previews[0].url, dispatch);
    }
  }

  return (
    <div
      role="button"
      className={classNames(
        `module-message__link-preview module-message__link-preview--${direction}`
      )}
      onClick={openLinkFromPreview}
    >
      <div className={classNames('module-message__link-preview__content')}>
        {previewHasImage ? (
          <div className="module-message__link-preview__image_container">
            <Image
              softCorners={true}
              alt={window.i18n('previewThumbnail', [first.domain])}
              height={linkPreviewsImageSize}
              width={linkPreviewsImageSize}
              url={first.image.url}
              attachment={first.image}
              onError={props.handleImageError}
            />
          </div>
        ) : (
          <div className="module-message__link-preview__icon_container">
            <div className="module-message__link-preview__icon_container__inner">
              <div className="module-message__link-preview__icon-container__circle-background">
                <SessionIcon iconType="link" iconSize="small" />
              </div>
            </div>
          </div>
        )}
        <div className={classNames('module-message__link-preview__text')}>
          <div className="module-message__link-preview__title">{first.title}</div>
          <div className="module-message__link-preview__location">{first.domain}</div>
        </div>
      </div>
    </div>
  );
};
