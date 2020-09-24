import React from 'react';
import * as GoogleChrome from '../util/GoogleChrome';

import { AttachmentType } from '../types/Attachment';

import { LocalizerType } from '../types/Util';

export interface Props {
  attachment: AttachmentType;
  i18n: LocalizerType;
  url: string;
  caption?: string;
  onSave?: (caption: string) => void;
  close?: () => void;
}

interface State {
  caption: string;
}

export class CaptionEditor extends React.Component<Props, State> {
  private readonly handleKeyDownBound: (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => void;

  private readonly setFocusBound: () => void;

  private readonly onChangeBound: (
    event: React.FormEvent<HTMLInputElement>
  ) => void;

  private readonly onSaveBound: () => void;

  private readonly inputRef: React.RefObject<HTMLInputElement>;

  constructor(props: Props) {
    super(props);

    const { caption } = props;
    this.state = {
      caption: caption || '',
    };

    this.handleKeyDownBound = this.handleKeyDown.bind(this);
    this.setFocusBound = this.setFocus.bind(this);
    this.onChangeBound = this.onChange.bind(this);
    this.onSaveBound = this.onSave.bind(this);
    this.inputRef = React.createRef();
  }

  public componentDidMount(): void {
    // Forcing focus after a delay due to some focus contention with ConversationView
    setTimeout(() => {
      this.setFocus();
    }, 200);
  }

  public handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    const { close, onSave } = this.props;

    if (close && event.key === 'Escape') {
      close();

      event.stopPropagation();
      event.preventDefault();
    }

    if (onSave && event.key === 'Enter') {
      const { caption } = this.state;
      onSave(caption);

      event.stopPropagation();
      event.preventDefault();
    }
  }

  public setFocus(): void {
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  }

  public onSave(): void {
    const { onSave } = this.props;
    const { caption } = this.state;

    if (onSave) {
      onSave(caption);
    }
  }

  public onChange(event: React.FormEvent<HTMLInputElement>): void {
    const { value } = event.target as HTMLInputElement;

    this.setState({
      caption: value,
    });
  }

  public renderObject(): JSX.Element {
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
        <video className="module-caption-editor__video" controls>
          <source src={url} />
        </video>
      );
    }

    return <div className="module-caption-editor__placeholder" />;
  }

  // Events handled by props
  /* eslint-disable jsx-a11y/click-events-have-key-events */
  public render(): JSX.Element {
    const { i18n, close } = this.props;
    const { caption } = this.state;
    const onKeyDown = close ? this.handleKeyDownBound : undefined;

    return (
      <div
        role="presentation"
        onClick={this.setFocusBound}
        className="module-caption-editor"
      >
        <div
          // Okay that this isn't a button; the escape key can be used to close this view
          role="button"
          onClick={close}
          className="module-caption-editor__close-button"
          tabIndex={0}
          aria-label={i18n('close')}
        />
        <div className="module-caption-editor__media-container">
          {this.renderObject()}
        </div>
        <div className="module-caption-editor__bottom-bar">
          <div className="module-caption-editor__input-container">
            <input
              type="text"
              ref={this.inputRef}
              value={caption}
              maxLength={200}
              placeholder={i18n('addACaption')}
              className="module-caption-editor__caption-input"
              onKeyDown={onKeyDown}
              onChange={this.onChangeBound}
            />
            {caption ? (
              <button
                type="button"
                onClick={this.onSaveBound}
                className="module-caption-editor__save-button"
              >
                {i18n('save')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
  /* eslint-enable jsx-a11y/click-events-have-key-events */
}
