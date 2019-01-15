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
  onSave?: (caption: string) => void;
  close?: () => void;
}

interface State {
  caption: string;
}

export class CaptionEditor extends React.Component<Props, State> {
  private handleKeyUpBound: (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => void;
  private setFocusBound: () => void;
  // TypeScript doesn't like our React.Ref typing here, so we omit it
  private captureRefBound: () => void;
  private onChangeBound: () => void;
  private onSaveBound: () => void;
  private inputRef: React.Ref<HTMLInputElement> | null;

  constructor(props: Props) {
    super(props);

    const { caption } = props;
    this.state = {
      caption: caption || '',
    };

    this.handleKeyUpBound = this.handleKeyUp.bind(this);
    this.setFocusBound = this.setFocus.bind(this);
    this.captureRefBound = this.captureRef.bind(this);
    this.onChangeBound = this.onChange.bind(this);
    this.onSaveBound = this.onSave.bind(this);
    this.inputRef = null;
  }

  public handleKeyUp(event: React.KeyboardEvent<HTMLInputElement>) {
    const { close, onSave } = this.props;

    if (close && event.key === 'Escape') {
      close();
    }

    if (onSave && event.key === 'Enter') {
      const { caption } = this.state;
      onSave(caption);
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

  public onSave() {
    const { onSave } = this.props;
    const { caption } = this.state;

    if (onSave) {
      onSave(caption);
    }
  }

  public onChange(event: React.FormEvent<HTMLInputElement>) {
    // @ts-ignore
    const { value } = event.target;

    this.setState({
      caption: value,
    });
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
    const { i18n, close } = this.props;
    const { caption } = this.state;

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
          <div className="module-caption-editor__input-container">
            <input
              type="text"
              ref={this.captureRefBound}
              value={caption}
              maxLength={200}
              placeholder={i18n('addACaption')}
              className="module-caption-editor__caption-input"
              onKeyUp={close ? this.handleKeyUpBound : undefined}
              onChange={this.onChangeBound}
            />
            {caption ? (
              <div
                role="button"
                onClick={this.onSaveBound}
                className="module-caption-editor__save-button"
              >
                {i18n('save')}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
}
