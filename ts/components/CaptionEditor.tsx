// tslint:disable:react-a11y-anchors

import React from 'react';
import * as GoogleChrome from '../util/GoogleChrome';

import { AttachmentType } from '../types/Attachment';

import { SessionInput } from './session/SessionInput';
import { SessionButton, SessionButtonColor, SessionButtonType } from './session/SessionButton';
import { darkTheme, lightTheme } from '../state/ducks/SessionTheme';

interface Props {
  attachment: AttachmentType;
  url: string;
  caption?: string;
  onSave: (caption: string) => void;
  onClose: () => void;
}

interface State {
  caption: string;
}

export class CaptionEditor extends React.Component<Props, State> {
  private readonly inputRef: React.RefObject<any>;

  constructor(props: Props) {
    super(props);

    const { caption } = props;
    this.state = {
      caption: caption || '',
    };
    this.onSave = this.onSave.bind(this);
    this.onChange = this.onChange.bind(this);
    this.inputRef = React.createRef();
  }

  public onSave() {
    const { onSave } = this.props;
    const { caption } = this.state;

    onSave(caption);
  }

  public onChange(value: string) {
    this.setState({
      caption: value,
    });
  }

  public renderObject() {
    const { url, onClose, attachment } = this.props;
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
  }

  public render() {
    const { onClose } = this.props;
    const { caption } = this.state;

    return (
      <div role="dialog" className="module-caption-editor">
        <div role="button" onClick={onClose} className="module-caption-editor__close-button" />
        <div className="module-caption-editor__media-container">{this.renderObject()}</div>
        <div className="module-caption-editor__bottom-bar">
          <div className="module-caption-editor__input-container">
            <SessionInput
              type="text"
              autoFocus={true}
              maxLength={200}
              ref={this.inputRef}
              placeholder={window.i18n('addACaption')}
              enableShowHide={false}
              onValueChanged={this.onChange}
              onEnterPressed={this.onSave}
              value={caption}
              theme={darkTheme}
            />
            <SessionButton
              text={window.i18n('save')}
              onClick={this.onSave}
              buttonType={SessionButtonType.Brand}
              buttonColor={SessionButtonColor.Green}
              disabled={!caption}
            />
          </div>
        </div>
      </div>
    );
  }
}
