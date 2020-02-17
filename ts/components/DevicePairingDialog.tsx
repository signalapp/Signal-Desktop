import React, { ChangeEvent } from 'react';
import { QRCode } from 'react-qr-svg';

import { SessionModal } from './session/SessionModal';
import { SessionButton, SessionButtonColor } from './session/SessionButton';
import { SessionSpinner } from './session/SessionSpinner';

interface Props {
  onClose: any;
  pubKeyToUnpair: string | undefined;
}

interface State {
  currentPubKey: string | undefined;
  accepted: boolean;
  pubKeyRequests: Array<any>;
  currentView: 'filterRequestView' | 'qrcodeView' | 'unpairDeviceView';
  errors: any;
  loading: boolean;
  deviceAlias: string | undefined;
}

export class DevicePairingDialog extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);

    this.closeDialog = this.closeDialog.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.stopReceivingRequests = this.stopReceivingRequests.bind(this);
    this.startReceivingRequests = this.startReceivingRequests.bind(this);
    this.skipDevice = this.skipDevice.bind(this);
    this.allowDevice = this.allowDevice.bind(this);
    this.validateSecondaryDevice = this.validateSecondaryDevice.bind(this);
    this.handleUpdateDeviceAlias = this.handleUpdateDeviceAlias.bind(this);
    this.triggerUnpairDevice = this.triggerUnpairDevice.bind(this);

    this.state = {
      currentPubKey: undefined,
      accepted: false,
      pubKeyRequests: Array(),
      currentView: props.pubKeyToUnpair ? 'unpairDeviceView' : 'qrcodeView',
      loading: false,
      errors: undefined,
      deviceAlias: 'Unnamed Device',
    };
  }

  public componentWillMount() {
    if (this.state.currentView === 'qrcodeView') {
      this.startReceivingRequests();
    }
  }

  public componentWillUnmount() {
    this.closeDialog();
  }

  public renderErrors() {
    const { errors } = this.state;

    return (
      <>
        {errors && (
          <>
            <div className="spacer-xs" />
            <div className="session-label danger">{errors}</div>
          </>
        )}
      </>
    );
  }

  public renderFilterRequestsView() {
    const { currentPubKey, accepted, deviceAlias } = this.state;
    let secretWords: undefined;
    if (currentPubKey) {
      secretWords = window.mnemonic.pubkey_to_secret_words(currentPubKey);
    }

    if (accepted) {
      return (
        <SessionModal
          title={window.i18n('provideDeviceAlias')}
          onOk={() => null}
          onClose={this.closeDialog}
        >
          <div className="session-modal__centered">
            {this.renderErrors()}
            <input
              type="text"
              onChange={this.handleUpdateDeviceAlias}
              value={deviceAlias}
              id={currentPubKey}
            />
            <div className="session-modal__button-group">
              <SessionButton
                text={window.i18n('ok')}
                onClick={this.validateSecondaryDevice}
                disabled={!deviceAlias}
              />
            </div>
            <SessionSpinner loading={this.state.loading} />
          </div>
        </SessionModal>
      );
    }

    return (
      <SessionModal
        title={window.i18n('allowPairingWithDevice')}
        onOk={() => null}
        onClose={this.closeDialog}
      >
        <div className="session-modal__centered">
          {this.renderErrors()}
          <label>{window.i18n('secretWords')}</label>
          <div className="text-subtle">{secretWords}</div>
          <div className="session-modal__button-group">
            <SessionButton
              text={window.i18n('cancel')}
              onClick={this.skipDevice}
            />
            <SessionButton
              text={window.i18n('allowPairing')}
              onClick={this.allowDevice}
              buttonColor={SessionButtonColor.Green}
            />
          </div>
        </div>
      </SessionModal>
    );
  }

  public renderQrCodeView() {
    const requestReceived = this.hasReceivedRequests();
    const title = window.i18n('pairingDevice');

    return (
      <SessionModal title={title} onOk={() => null} onClose={this.closeDialog}>
        <div className="session-modal__centered">
          {this.renderErrors()}
          <h4>{window.i18n('waitingForDeviceToRegister')}</h4>
          <small className="text-subtle">
            {window.i18n('pairNewDevicePrompt')}
          </small>
          <div className="spacer-lg" />

          <div className="qr-image">
            <QRCode
              value={window.textsecure.storage.user.getNumber()}
              level="L"
            />
          </div>

          <div className="spacer-lg" />
          <div className="session-modal__button-group__center">
            {!requestReceived ? (
              <SessionButton
                text={window.i18n('cancel')}
                onClick={this.closeDialog}
              />
            ) : null}
          </div>
        </div>
      </SessionModal>
    );
  }

  public renderUnpairDeviceView() {
    const { pubKeyToUnpair } = this.props;
    const secretWords = window.mnemonic.pubkey_to_secret_words(pubKeyToUnpair);
    const conv = window.ConversationController.get(pubKeyToUnpair);
    let description;

    if (conv && conv.getNickname()) {
      description = `${conv.getNickname()}: ${window.shortenPubkey(
        pubKeyToUnpair
      )} ${secretWords}`;
    } else {
      description = `${window.shortenPubkey(pubKeyToUnpair)} ${secretWords}`;
    }

    return (
      <SessionModal
        title={window.i18n('unpairDevice')}
        onOk={() => null}
        onClose={this.closeDialog}
      >
        <div className="session-modal__centered">
          {this.renderErrors()}
          <p className="session-modal__description">
            {window.i18n('confirmUnpairingTitle')}
            <br />
            <span className="text-subtle">{description}</span>
          </p>
          <div className="spacer-xs" />
          <div className="session-modal__button-group">
            <SessionButton
              text={window.i18n('cancel')}
              onClick={this.closeDialog}
            />
            <SessionButton
              text={window.i18n('unpairDevice')}
              onClick={this.triggerUnpairDevice}
              buttonColor={SessionButtonColor.Danger}
            />
          </div>
        </div>
      </SessionModal>
    );
  }

  public render() {
    const { currentView } = this.state;
    const renderQrCodeView = currentView === 'qrcodeView';
    const renderFilterRequestView = currentView === 'filterRequestView';
    const renderUnpairDeviceView = currentView === 'unpairDeviceView';

    return (
      <>
        {renderQrCodeView && this.renderQrCodeView()}
        {renderFilterRequestView && this.renderFilterRequestsView()}
        {renderUnpairDeviceView && this.renderUnpairDeviceView()}
      </>
    );
  }

  private reset() {
    this.setState({
      currentPubKey: undefined,
      accepted: false,
      pubKeyRequests: Array(),
      currentView: 'filterRequestView',
      deviceAlias: 'Unnamed Device',
    });
  }

  private startReceivingRequests() {
    this.reset();
    window.Whisper.events.on(
      'devicePairingRequestReceived',
      (pubKey: string) => {
        this.requestReceived(pubKey);
      }
    );
    this.setState({ currentView: 'qrcodeView' });
  }

  private stopReceivingRequests() {
    this.setState({ currentView: 'filterRequestView' });
    window.Whisper.events.off('devicePairingRequestReceived');
  }

  private requestReceived(secondaryDevicePubKey: string | EventHandlerNonNull) {
    // FIFO: push at the front of the array with unshift()
    this.state.pubKeyRequests.unshift(secondaryDevicePubKey);
    window.pushToast({
      title: window.i18n('gotPairingRequest'),
      description: `${window.shortenPubkey(
        secondaryDevicePubKey
      )} ${window.i18n(
        'showPairingWordsTitle'
      )}: ${window.mnemonic.pubkey_to_secret_words(secondaryDevicePubKey)}`,
    });
    if (!this.state.currentPubKey) {
      this.nextPubKey();
      this.stopReceivingRequests();
    }
  }

  private allowDevice() {
    this.setState({
      accepted: true,
    });
  }

  private transmissionCB(errors: any) {
    if (!errors) {
      this.setState({
        errors: null,
      });
      this.closeDialog();
      window.pushToast({
        title: window.i18n('devicePairedSuccessfully'),
      });
      const conv = window.ConversationController.get(this.state.currentPubKey);
      if (conv) {
        conv.setNickname(this.state.deviceAlias);
      }

      return;
    }

    this.setState({
      errors: errors,
    });
  }

  private skipDevice() {
    window.Whisper.events.trigger(
      'devicePairingRequestRejected',
      this.state.currentPubKey
    );

    this.closeDialog();
  }

  private nextPubKey() {
    // FIFO: pop at the back of the array using pop()
    this.setState({
      currentPubKey: this.state.pubKeyRequests.pop(),
    });
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

  private validateSecondaryDevice() {
    this.setState({ loading: true });
    window.Whisper.events.trigger(
      'devicePairingRequestAccepted',
      this.state.currentPubKey,
      (errors: any) => {
        this.transmissionCB(errors);
        window.Whisper.events.trigger('refreshLinkedDeviceList');

        return true;
      }
    );
  }

  private hasReceivedRequests() {
    return this.state.currentPubKey || this.state.pubKeyRequests.length > 0;
  }

  private closeDialog() {
    window.removeEventListener('keyup', this.onKeyUp);
    this.stopReceivingRequests();
    window.Whisper.events.off('devicePairingRequestReceived');
    if (this.state.currentPubKey && !this.state.accepted) {
      window.Whisper.events.trigger(
        'devicePairingRequestRejected',
        this.state.currentPubKey
      );
    }
    this.props.onClose();
  }

  private handleUpdateDeviceAlias(value: ChangeEvent<HTMLInputElement>) {
    const trimmed = value.target.value.trim();
    if (!!trimmed) {
      this.setState({ deviceAlias: trimmed });
    } else {
      this.setState({ deviceAlias: undefined });
    }
  }

  private triggerUnpairDevice() {
    window.Whisper.events.trigger(
      'deviceUnpairingRequested',
      this.props.pubKeyToUnpair
    );
    window.pushToast({
      title: window.i18n('deviceUnpaired'),
    });
    this.closeDialog();
  }
}
