import * as GoogleChrome from '../util/GoogleChrome';

import { AttachmentType } from '../types/Attachment';

type Props = {
  attachment: AttachmentType;
  url: string;
  caption?: string;
  onSave: (caption: string) => void;
  onClose: () => void;
};

const CaptionEditorObject = (props: Props) => {
  const { url, onClose, attachment } = props;
  const { contentType } = attachment || { contentType: null };

  const isImageTypeSupported = GoogleChrome.isImageTypeSupported(contentType);
  if (isImageTypeSupported) {
    return (
      <img
        className="module-caption-editor__image"
        alt={window.i18n('imageAttachmentAlt')}
        src={url}
        onClick={onClose}
      />
    );
  }

  const isVideoTypeSupported = GoogleChrome.isVideoTypeSupported(contentType);
  if (isVideoTypeSupported) {
    return (
      <video className="module-caption-editor__video" controls={true}>
        <source src={url} />
      </video>
    );
  }

  return <div className="module-caption-editor__placeholder" />;
};

/**
 * This actually no longer allows to edit the caption as we do not support this feature anymore.
 * This is just a lightbox to preview the attachments before sending them in a message
 */
export const CaptionEditor = (props: Props) => {
  const { onClose } = props;

  return (
    <div role="dialog" className="module-caption-editor">
      <div role="button" onClick={onClose} className="module-caption-editor__close-button" />
      <div className="module-caption-editor__media-container">
        <CaptionEditorObject {...props} />
      </div>
    </div>
  );
};
