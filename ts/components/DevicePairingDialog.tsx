import React from 'react';
import { QRCode } from 'react-qrcode';

import { SessionModal } from './session/SessionModal';
import { SessionButton } from './session/SessionButton';

interface Props {
  i18n: any;
  onClose: any;
  pubKeyToUnpair: string | null;
  pubKey: string | null;
}

interface State {
  currentPubKey: string | null;
  accepted: boolean;
  isListening: boolean;
  success: boolean;
  loading: boolean;
  view:
    | 'default'
    | 'waitingForRequest'
    | 'requestReceived'
    | 'requestAccepted'
    | 'confirmUnpair';
  pubKeyRequests: Array<any>;
  data: Array<any>;
}

export class DevicePairingDialog extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);

    this.closeDialog = this.closeDialog.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.startReceivingRequests = this.startReceivingRequests.bind(this);
    this.stopReceivingRequests = this.stopReceivingRequests.bind(this);
    this.getPubkeyName = this.getPubkeyName.bind(this);

    this.state = {
      currentPubKey: this.props.pubKey,
      accepted: false,
      isListening: false,
      success: false,
      loading: true,
      view: 'default',
      pubKeyRequests: [],
      data: ['22452653255643252533'],
    };
  }

  public componentDidMount() {
    this.getSecondaryDevices();
  }

  public render() {
    const { i18n } = this.props;

    const waitingForRequest = this.state.view === 'waitingForRequest';
    const nothingPaired = this.state.data.length === 0;

    console.log(this.state);
    console.log(this.state);
    console.log(this.state);
    console.log(this.state);
    console.log(this.state);

    console.log('dAAVIHN');
    // const renderPairedDevices = this.state.data.map((pubKey: any) => {
    //   const pubKeyInfo = this.getPubkeyName(pubKey);
    //   const isFinalItem =
    //     this.state.data[this.state.data.length - 1] === pubKey;

    //   return (
    //     <div key={pubKey}>
    //       <p>
    //         {pubKeyInfo.deviceAlias}
    //         <br />
    //         <span className="text-subtle">Pairing Secret:</span>{' '}
    //         {pubKeyInfo.secretWords}
    //       </p>
    //       {!isFinalItem ? <hr className="text-soft fullwidth" /> : null}
    //     </div>
    //   );
    // });

    return (
      <>
        {!this.state.loading && (
          <SessionModal
            title={i18n('pairedDevices')}
            onOk={() => null}
            onClose={this.closeDialog}
          >
            {waitingForRequest ? (
              <div className="session-modal__centered">
                <h3>{i18n('waitingForDeviceToRegister')}</h3>
                <small className="text-subtle">
                  {i18n('pairNewDevicePrompt')}
                </small>
                <div className="spacer-lg" />

                <div id="qr">
                  <QRCode value={window.textsecure.storage.user.getNumber()} />
                </div>

                <div className="spacer-lg" />
                <div className="session-modal__button-group__center">
                  <SessionButton
                    text={i18n('cancel')}
                    onClick={this.stopReceivingRequests}
                  />
                </div>
              </div>
            ) : (
              <>
                {nothingPaired ? (
                  <div className="session-modal__centered">
                    <div>{i18n('noPairedDevices')}</div>
                  </div>
                ) : (
                  <div className="session-modal__centered">
                    {'renderPairedDevices'}
                  </div>
                )}

                <div className="spacer-lg" />
                <div className="session-modal__button-group__center">
                  <SessionButton
                    text={i18n('pairNewDevice')}
                    onClick={this.startReceivingRequests}
                  />
                </div>
              </>
            )}
          </SessionModal>
        )}
      </>
    );
  }

  private showView(
    view?:
      | 'default'
      | 'waitingForRequest'
      | 'requestReceived'
      | 'requestAccepted'
      | 'confirmUnpair'
  ) {
    if (!view) {
      this.setState({
        view: 'default',
      });

      return;
    }

    if (view === 'waitingForRequest') {
      this.setState({
        view,
        isListening: true,
      });

      return;
    }
    this.setState({ view });
  }

  private getSecondaryDevices() {
    const secondaryDevices = window.libloki.storage
      .getSecondaryDevicesFor(this.state.currentPubKey)
      .then(() => {
        this.setState({
          data: secondaryDevices,
          loading: false,
        });
      });
  }

  private startReceivingRequests() {
    this.showView('waitingForRequest');
  }

  private getPubkeyName(pubKey: string | null) {
    if (!pubKey) {
      return {};
    }

    const secretWords = window.mnemonic.pubkey_to_secret_words(pubKey);
    const conv = window.ConversationController.get(this.state.currentPubKey);
    const deviceAlias = conv ? conv.getNickname() : 'Unnamed Device';

    return { deviceAlias, secretWords };
  }

  private stopReceivingRequests() {
    if (this.state.success) {
      const aliasKey = 'deviceAlias';
      const deviceAlias = this.getPubkeyName(this.state.currentPubKey)[
        aliasKey
      ];

      const conv = window.ConversationController.get(this.state.currentPubKey);
      if (conv) {
        conv.setNickname(deviceAlias);
      }
    }

    this.showView();
  }

  private requestReceived(secondaryDevicePubKey: string | EventHandlerNonNull) {
    // FIFO: push at the front of the array with unshift()
    this.state.pubKeyRequests.unshift(secondaryDevicePubKey);
    if (!this.state.currentPubKey) {
      this.nextPubKey();

      this.showView('requestReceived');
    }
  }

  private allowDevice() {
    this.setState({
      accepted: true,
    });
    window.Whisper.trigger(
      'devicePairingRequestAccepted',
      this.state.currentPubKey,
      (errors: any) => {
        this.transmisssionCB(errors);

        return true;
      }
    );
    this.showView();
  }

  private transmisssionCB(errors: any) {
    if (!errors) {
      this.setState({
        success: true,
      });
    } else {
      return;
    }
  }

  private skipDevice() {
    window.Whisper.trigger(
      'devicePairingRequestRejected',
      this.state.currentPubKey
    );
    this.nextPubKey();
    this.showView();
  }

  private nextPubKey() {
    // FIFO: pop at the back of the array using pop()
    const pubKeyRequests = this.state.pubKeyRequests;
    this.setState({
      currentPubKey: pubKeyRequests.pop(),
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

  private closeDialog() {
    window.removeEventListener('keyup', this.onKeyUp);
    this.stopReceivingRequests();
    this.props.onClose();
  }
}
