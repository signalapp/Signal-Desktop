import React from 'react';

interface Props {
  titleText: string;
  messageText: string;
  okText: string;
  cancelText: string;
  onConfirm: any;
  onClose: any;
}

export class ConfirmDialog extends React.Component<Props> {
  constructor(props: any) {
    super(props);
  }

  public render() {
    return (
      <div className="content">
        <p className="titleText">{this.props.titleText}</p>
        <p className="messageText">{this.props.messageText}</p>
        <div className="buttons">
          <button className="cancel" tabIndex={0} onClick={this.props.onClose}>
            {this.props.cancelText}
          </button>
          <button className="ok" tabIndex={0} onClick={this.props.onConfirm}>
            {this.props.okText}
          </button>
        </div>
      </div>
    );
  }
}
