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
  serverURL: string;
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
      serverURL: '',
    };

    this.showError = this.showError.bind(this);
    this.showView = this.showView.bind(this);
    this.attemptConnection = this.attemptConnection.bind(this);

    this.closeDialog = this.closeDialog.bind(this);
    this.onEnter = this.onEnter.bind(this);

    window.addEventListener('keyup', this.onEnter);
  }

  public render() {
    const { i18n } = this.props;

    return (
      <SessionModal
        title={this.state.title}
        onOk={() => null}
        onClose={this.closeDialog}
      >
        {this.state.view === 'default' && (
          <>
            <div className="spacer-lg" />

            <input
              type="text"
              id="server-url"
              placeholder={i18n('serverUrl')}
              defaultValue={this.state.serverURL}
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
        )}

        {this.state.view === 'connecting' && (
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
        )}
      </SessionModal>
    );
  }

  private showView(view: 'default' | 'connecting', error?: string) {
    const { i18n } = this.props;

    const isDefaultView = view === 'default';
    const isConnectingView = view === 'connecting';

    if (isDefaultView) {
      this.setState({
        title: i18n('addServerDialogTitle'),
        error: error || null,
        view: 'default',
        connecting: false,
        success: false,
      });

      return true;
    }

    if (isConnectingView) {
      // TODO: Make this not hard coded
      const channelId = 1;
      const serverURL = String(
        $('.session-modal #server-url').val()
      ).toLowerCase();

      const serverURLExists = serverURL.length > 0;

      if (!serverURLExists) {
        this.setState({
          error: i18n('noServerURL'),
          view: 'default',
        });

        return false;
      }

      this.setState({
        title: i18n('connectingLoad'),
        serverURL: serverURL,
        view: 'connecting',
        connecting: true,
        error: null,
      });

      const connectionResult = this.attemptConnection(serverURL, channelId);

      // Give 10s maximum for promise to resolve. Else, throw error.
      const maxConnectionDuration = 10000;
      const connectionTimeout = setTimeout(() => {
        if (!this.state.success) {
          this.showView('default', i18n('connectToServerFail'));

          return;
        }
      }, maxConnectionDuration);

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
        .catch((connectionError: string) => {
          clearTimeout(connectionTimeout);
          this.showView('default', connectionError);

          return false;
        });
    }

    return true;
  }

  private showError() {
    const message = this.state.error;

    return (
      <>
        {message && (
          <>
            <div className="session-label danger">{message}</div>
            <div className="spacer-lg" />
          </>
        )}
      </>
    );
  }

  private onEnter(event: any) {
    if (event.key === 'Enter') {
      if ($('#server-url').is(':focus')) {
        this.showView('connecting');
      }
    }
  }

  private closeDialog() {
    window.removeEventListener('keyup', this.onEnter);
    this.props.onClose();
  }

  private async attemptConnection(serverURL: string, channelId: number) {
    const { i18n } = this.props;

    const rawserverURL = serverURL
      .replace(/^https?:\/\//i, '')
      .replace(/[/\\]+$/i, '');
    const sslServerURL = `https://${rawserverURL}`;
    const conversationId = `publicChat:${channelId}@${rawserverURL}`;

    const conversationExists = window.ConversationController.get(
      conversationId
    );
    if (conversationExists) {
      // We are already a member of this public chat
      return new Promise((_resolve, reject) => {
        reject(i18n('publicChatExists'));
      });
    }

    const serverAPI = await window.lokiPublicChatAPI.findOrCreateServer(
      sslServerURL
    );
    if (!serverAPI) {
      // Url incorrect or server not compatible
      return new Promise((_resolve, reject) => {
        reject(i18n('connectToServerFail'));
      });
    }

    const conversation = await window.ConversationController.getOrCreateAndWait(
      conversationId,
      'group'
    );

    await serverAPI.findOrCreateChannel(channelId, conversationId);
    await conversation.setPublicSource(sslServerURL, channelId);
    await conversation.setFriendRequestStatus(
      window.friends.friendRequestStatusEnum.friends
    );

    return conversation;
  }
}
