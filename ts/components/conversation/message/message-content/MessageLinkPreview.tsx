import classNames from 'classnames';
import React from 'react';
import { isImageAttachment } from '../../../../types/Attachment';
import { ImageGrid } from '../../ImageGrid';
import { Image } from '../../Image';
import { MessageRenderingProps } from '../../../../models/messageType';
import { useDispatch, useSelector } from 'react-redux';
import { getMessageLinkPreviewProps } from '../../../../state/selectors/conversations';
import { SessionIcon } from '../../../icon';
import { MINIMUM_LINK_PREVIEW_IMAGE_WIDTH } from '../message-item/Message';
import { showLinkVisitWarningDialog } from '../../../dialog/SessionConfirm';

export type MessageLinkPreviewSelectorProps = Pick<
  MessageRenderingProps,
  'attachments' | 'previews'
>;

type Props = {
  handleImageError: () => void;
  messageId: string;
};

export const MessageLinkPreview = (props: Props) => {
  const selected = useSelector(state => getMessageLinkPreviewProps(state as any, props.messageId));
  const dispatch = useDispatch();

  if (!selected) {
    return null;
  }
  const { attachments, previews } = selected;

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
  const width = first.image && first.image.width;
  const isFullSizeImage = width && width >= MINIMUM_LINK_PREVIEW_IMAGE_WIDTH;

  function openLinkFromPreview() {
    if (previews?.length && previews[0].url) {
      showLinkVisitWarningDialog(previews[0].url, dispatch);
    }
  }

  return (
    <div
      role="button"
      className={classNames('module-message__link-preview')}
      onClick={openLinkFromPreview}
    >
      {first.image && previewHasImage && isFullSizeImage ? (
        <ImageGrid attachments={[first.image]} onError={props.handleImageError} />
      ) : null}
      <div className={classNames('module-message__link-preview__content')}>
        {first.image && previewHasImage && !isFullSizeImage ? (
          <div className="module-message__link-preview__image_container">
            <Image
              softCorners={true}
              alt={window.i18n('previewThumbnail', [first.domain])}
              height={72}
              width={72}
              url={first.image.url}
              attachment={first.image}
              onError={props.handleImageError}
            />
          </div>
        ) : !first.image || !previewHasImage ? (
          <div className="module-message__link-preview__icon_container">
            <div className="module-message__link-preview__icon_container__inner">
              <div className="module-message__link-preview__icon-container__circle-background">
                <SessionIcon iconType="link" iconSize="small" />
              </div>
            </div>
          </div>
        ) : null}
        <div className={classNames('module-message__link-preview__text')}>
          <div className="module-message__link-preview__title">{first.title}</div>
          <div className="module-message__link-preview__location">{first.domain}</div>
        </div>
      </div>
    </div>
  );
};
