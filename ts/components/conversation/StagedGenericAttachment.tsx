import React from 'react';

import { AttachmentType, getExtensionForDisplay } from '../../types/Attachment';

interface Props {
  attachment: AttachmentType;
  onClose: (attachment: AttachmentType) => void;
}

export class StagedGenericAttachment extends React.Component<Props> {
  public render() {
    const { attachment, onClose } = this.props;
    const { fileName, contentType } = attachment;
    const extension = getExtensionForDisplay({ contentType, fileName });

    return (
      <div className="module-staged-generic-attachment">
        <div
          className="module-staged-generic-attachment__close-button"
          role="button"
          onClick={() => {
            if (onClose) {
              onClose(attachment);
            }
          }}
        />
        <div className="module-staged-generic-attachment__icon">
          {extension ? (
            <div className="module-staged-generic-attachment__icon__extension">{extension}</div>
          ) : null}
        </div>
        <div className="module-staged-generic-attachment__filename">{fileName}</div>
      </div>
    );
  }
}
