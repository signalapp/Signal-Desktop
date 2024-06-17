import classNames from 'classnames';

import { useDispatch } from 'react-redux';
import { MessageRenderingProps } from '../../../../models/messageType';
import {
  useMessageAttachments,
  useMessageDirection,
  useMessageLinkPreview,
} from '../../../../state/selectors';
import { useIsMessageSelectionMode } from '../../../../state/selectors/selectedConversation';
import { isImageAttachment } from '../../../../types/Attachment';
import { showLinkVisitWarningDialog } from '../../../dialog/SessionConfirm';
import { SessionIcon } from '../../../icon';
import { Image } from '../../Image';

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
  const dispatch = useDispatch();
  const direction = useMessageDirection(props.messageId);
  const attachments = useMessageAttachments(props.messageId);
  const previews = useMessageLinkPreview(props.messageId);
  const isMessageSelectionMode = useIsMessageSelectionMode();

  if (!props.messageId) {
    return null;
  }

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
