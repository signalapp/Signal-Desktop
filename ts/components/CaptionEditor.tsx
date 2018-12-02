// tslint:disable:react-a11y-anchors

import React from 'react';
import * as GoogleChrome from '../util/GoogleChrome';

import { AttachmentType } from './conversation/types';

import { Localizer } from '../types/Util';

interface Props {
  attachment: AttachmentType;
  i18n: Localizer;
  url: string;
  caption?: string;
  onChangeCaption?: (caption: string) => void;
  close?: () => void;
}

export class CaptionEditor extends React.Component<Props> {
  public renderObject() {
    const { url, i18n, attachment } = this.props;
    const { contentType } = attachment || { contentType: null };

    const isImageTypeSupported = GoogleChrome.isImageTypeSupported(contentType);
    if (isImageTypeSupported) {
      return (
        <img
          className="module-caption-editor__image"
          alt={i18n('imageAttachmentAlt')}
          src={url}
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
  }

  public render() {
    const { caption, i18n, close, onChangeCaption } = this.props;

    return (
      <div className="module-caption-editor">
        <div
          role="button"
          onClick={close}
          className="module-caption-editor__close-button"
        />
        <div className="module-caption-editor__media-container">
          {this.renderObject()}
        </div>
        <div className="module-caption-editor__bottom-bar">
          <div className="module-caption-editor__add-caption-button" />
          <input
            type="text"
            value={caption || ''}
            maxLength={200}
            placeholder={i18n('addACaption')}
            className="module-caption-editor__caption-input"
            onChange={event => {
              if (onChangeCaption) {
                onChangeCaption(event.target.value);
              }
            }}
          />
        </div>
      </div>
    );
  }
}
