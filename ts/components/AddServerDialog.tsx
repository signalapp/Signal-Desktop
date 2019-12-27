import React from 'react';
import { ImpulseSpinner } from 'react-spinners-kit';

import { SessionModal } from './session/SessionModal';
import { SessionButton } from './session/SessionButton';

interface Props {
  i18n: any;
  onClose: any;
}

interface State {
  title: string;
  error: string | null;
  connecting: boolean;
  view: 'connecting' | 'default';
}

export class AddServerDialog extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);

    this.state = {
      title: '',
      error: null,
      connecting: false,
      view: 'default',
    };

    this.confirm = this.confirm.bind(this);
    this.showError = this.showError.bind(this);
    this.showView = this.showView.bind(this);

    this.closeDialog = this.closeDialog.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
  }

  public render() {
    const { i18n } = this.props;

    return (
      <SessionModal
        title={this.state.title}
        onOk={() => null}
        onClose={this.closeDialog}
      >
        {this.state.view === 'default' ? (
          <>
            <div className="spacer-lg" />

            <input type="text" id="server-url" placeholder="Server Url" />
            <div className="spacer-sm" />

            {this.showError()}

            <div className="session-modal__button-group">
              <SessionButton
                text={i18n('connect')}
                onClick={() => this.showView('connecting')}
              />

              <SessionButton text={i18n('cancel')} onClick={this.closeDialog} />
            </div>
          </>
        ) : null}

        {this.state.view === 'connecting' ? (
          <>
            connecting!
            <br />
            <ClipLoader/>


            <div className="spacer-lg" />
            <div className="session-modal__button-group">
              <SessionButton
                text={i18n('cancel')}
                onClick={() => this.showView('default')}
              />
            </div>
          </>
        ) : null}
      </SessionModal>
    );
  }

  private showView(view: 'default' | 'connecting') {
    const { i18n } = this.props;

    if (view === 'default') {
      this.setState({
        title: i18n('addServerDialogTitle'),
        error: null,
        view: 'default',
      });
    }

    if (view === 'connecting') {
      this.setState({
        title: i18n('connectingLoad'),
        error: null,
        view: 'connecting',
      });
    }
  }

  private confirm() {
    // const { i18n } = this.props;

    // Remove error if there is one
    this.setState({
      error: null,
    });

    const connected = false;

    const serverUrl = String(
      $('.add-server-dialog #server-url').val()
    ).toLowerCase();
    // // TODO: Make this not hard coded
    const channelId = 1;

    console.log(serverUrl);

    if (connected) {
      //   window.pushToast({
      //     title: i18n('connectToServerSuccess'),
      //     type: 'success',
      //     id: 'connectToServerSuccess',
      //   });
      this.closeDialog();
    }
  }

  private showError() {
    const message = this.state.error;
    return (
      <>
        {message ? (
          <>
            <div className="session-label danger">{message}</div>
            <div className="spacer-lg" />
          </>
        ) : null}
      </>
    );
    // if (_.isEmpty(message)) {
    //   this.$('.error').text('');
    //   this.$('.error').hide();
    // } else {
    //   this.$('.error').text(`Error: ${message}`);
    //   this.$('.error').show();
    // }
    // $('input').focus();
  }

  private onKeyUp(event: any) {
    switch (event.key) {
      case 'Esc':
      case 'Escape':
        this.closeDialog();
        break;
      default:
    }
  }

  private closeDialog() {
    window.removeEventListener('keyup', this.onKeyUp);
    this.props.onClose();
  }
}
