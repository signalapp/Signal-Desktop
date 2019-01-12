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
  private handleKeyUpBound: () => void;
  private setFocusBound: () => void;
  private captureRefBound: () => void;
  private inputRef: React.Ref<HTMLInputElement> | null;

  constructor(props: Props) {
    super(props);

    this.handleKeyUpBound = this.handleKeyUp.bind(this);
    this.setFocusBound = this.setFocus.bind(this);
    this.captureRefBound = this.captureRef.bind(this);
    this.inputRef = null;
  }

  public handleKeyUp(event: React.KeyboardEvent<HTMLInputElement>) {
    const { close } = this.props;

    if (close && (event.key === 'Escape' || event.key === 'Enter')) {
      close();
    }
  }

  public setFocus() {
    if (this.inputRef) {
      // @ts-ignore
      this.inputRef.focus();
    }
  }

  public captureRef(ref: React.Ref<HTMLInputElement>) {
    this.inputRef = ref;

    // Forcing focus after a delay due to some focus contention with ConversationView
    setTimeout(() => {
      this.setFocus();
    }, 200);
  }

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
      <div
        role="dialog"
        onClick={this.setFocusBound}
        className="module-caption-editor"
      >
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
            ref={this.captureRefBound}
            onKeyUp={close ? this.handleKeyUpBound : undefined}
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
