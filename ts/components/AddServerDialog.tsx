import React from 'react';

import { SessionModal } from './session/SessionModal';
import { SessionButton } from './session/SessionButton';
import { SessionSpinner } from './session/SessionSpinner';

interface Props {
  i18n: any;
  onClose: any;
}

interface State {
  title: string;
  error: string | null;
  connecting: boolean;
  success: boolean;
  view: 'connecting' | 'default';
  serverUrl: string;
}

export class AddServerDialog extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);

    this.state = {
      title: this.props.i18n('addServerDialogTitle'),
      error: null,
      connecting: false,
      success: false,
      view: 'default',
      serverUrl: '',
    };

    this.showError = this.showError.bind(this);
    this.showView = this.showView.bind(this);
    this.attemptConnection = this.attemptConnection.bind(this);

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

            <input
              type="text"
              id="server-url"
              placeholder={i18n('serverUrl')}
              defaultValue={this.state.serverUrl}
            />
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
            <div className="session-modal__centered">
              <div className="spacer-lg" />
              <SessionSpinner />
              <div className="spacer-lg" />
            </div>

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
        connecting: false,
        success: false,
      });
    }

    if (view === 'connecting') {
      // TODO: Make this not hard coded
      const channelId = 1;
      const serverUrl = String(
        $('.session-modal #server-url').val()
      ).toLowerCase();

      this.setState({
        error: null,
        serverUrl: serverUrl,
      });

      if (serverUrl.length == 0) {
        this.setState({
          error: i18n('noServerUrl'),
          view: 'default',
        });

        return;
      }

      this.setState({
        title: i18n('connectingLoad'),
        view: 'connecting',
        connecting: true,
      });

      const connectionResult = this.attemptConnection(serverUrl, channelId);

      // Give 5s maximum for promise to revole. Else, throw error.
      const max_connection_duration = 5000;
      const connectionTimeout = setTimeout(() => {
        if (!this.state.success) {
          this.showView('default');

          this.setState({
            connecting: false,
            success: false,
            error: i18n('connectToServerFail'),
          });

          return;
        }
      }, max_connection_duration);

      connectionResult
        .then(() => {
          clearTimeout(connectionTimeout);

          if (this.state.connecting) {
            this.setState({
              success: true,
            });
            window.pushToast({
              title: i18n('connectToServerSuccess'),
              id: 'connectToServerSuccess',
              type: 'success',
            });
            this.closeDialog();
          }
        })
        .catch(error => {
          clearTimeout(connectionTimeout);

          this.showView('default');
          this.setState({
            connecting: false,
            success: false,
            error: error,
          });
        });
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
      case 'Enter':
        if (this.state.view == 'default') {
          this.showView('connecting');
        }
        break;
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

  private async attemptConnection(serverUrl: string, channelId: number) {
    const { i18n } = this.props;

    const rawServerUrl = serverUrl
      .replace(/^https?:\/\//i, '')
      .replace(/[/\\]+$/i, '');
    const sslServerUrl = `https://${rawServerUrl}`;
    const conversationId = `publicChat:${channelId}@${rawServerUrl}`;

    const conversationExists = window.ConversationController.get(
      conversationId
    );
    if (conversationExists) {
      // We are already a member of this public chat
      return new Promise((resolve, reject) => {
        if (false) {
          resolve();
        }
        reject(i18n('publicChatExists'));
      });
    }

    const serverAPI = await window.lokiPublicChatAPI.findOrCreateServer(
      sslServerUrl
    );
    if (!serverAPI) {
      // Url incorrect or server not compatible
      return new Promise((resolve, reject) => {
        if (false) {
          resolve();
        }
        reject(i18n('connectToServerFail'));
      });
    }

    const conversation = await window.ConversationController.getOrCreateAndWait(
      conversationId,
      'group'
    );

    await serverAPI.findOrCreateChannel(channelId, conversationId);
    await conversation.setPublicSource(sslServerUrl, channelId);
    await conversation.setFriendRequestStatus(
      window.friends.friendRequestStatusEnum.friends
    );

    return conversation;
  }
}
