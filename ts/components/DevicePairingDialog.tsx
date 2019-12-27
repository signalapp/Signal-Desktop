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
      data: [],
    };
  }

  componentDidMount() {
    this.getSecondaryDevices();
  }

  private async getSecondaryDevices() {
    const secondaryDevices = await window.libloki.storage.getSecondaryDevicesFor(
      this.state.currentPubKey
    );
    this.setState({
      data: secondaryDevices,
      loading: false,
    });
  }

  public render() {
    const { i18n } = this.props;

    const newData = [
      '053e18835c106a5f9f463a44a9d7ff9a26281d529285a047bd969cfc59d4ab8607',
      '053e18835c106a5f9f463a44a9d7ff9a26281d529285a047bd969cfc59d4ab8604',
    ];
    setTimeout(() => {
      this.setState({
        data: newData,
      });
    }, 2000);

    return (
      <>
        {!this.state.loading ? (
          <SessionModal
            title={i18n('pairedDevices')}
            onOk={() => null}
            onClose={this.closeDialog}
          >
            {this.state.view === 'waitingForRequest' ? (
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
                {this.state.data.length == 0 ? (
                  <div className="session-modal__centered">
                    <div>{i18n('noPairedDevices')}</div>
                  </div>
                ) : (
                  <div className="session-modal__centered">
                    {this.state.data.map((pubKey: any) => {
                      const pubKeyInfo = this.getPubkeyName(pubKey);
                      const isFinalItem =
                        this.state.data[this.state.data.length - 1] === pubKey;

                      return (
                        <div key={pubKey}>
                          <p>
                            {pubKeyInfo.deviceAlias}
                            <br />
                            <span className="text-subtle">
                              Pairing Secret:
                            </span>{' '}
                            {pubKeyInfo.secretWords}
                          </p>
                          {!isFinalItem ? (
                            <hr className="text-soft fullwidth" />
                          ) : null}
                        </div>
                      );
                    })}
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
        ) : null}
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

    this.setState({ view });
  }

  private startReceivingRequests() {
    this.setState({
      isListening: true,
    });

    this.showView('waitingForRequest');

    //TESTING
    //TESTING
    //TESTING
    setTimeout(() => {
      this.setState({
        accepted: true,
        success: true,
      });
    }, 3000);
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
      const deviceAlias = this.getPubkeyName(this.state.currentPubKey)[
        'deviceAlias'
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

  allowDevice() {
    this.setState({
      accepted: true,
    });
    window.Whisper.trigger(
      'devicePairingRequestAccepted',
      this.state.currentPubKey,
      (errors: any) => this.transmisssionCB(errors)
    );
    this.showView();
  }

  transmisssionCB(errors: any) {
    if (!errors) {
      // this.$('.transmissionStatus').text(i18n('provideDeviceAlias'));
      // this.$('#deviceAliasView').show();
      // this.$('#deviceAlias').on('input', e => {
      //   if (e.target.value.trim()) {
      //     this.$('.requestAcceptedView .ok').removeAttr('disabled');
      //   } else {
      //     this.$('.requestAcceptedView .ok').attr('disabled', true);
      //   }
      // });
      // this.$('.requestAcceptedView .ok').show();
      // this.$('.requestAcceptedView .ok').attr('disabled', true);

      this.setState({
        success: true,
      });
    } else {
      // this.$('.transmissionStatus').text(errors);
      // this.$('.requestAcceptedView .ok').show();
    }
  }

  skipDevice() {
    window.Whisper.trigger(
      'devicePairingRequestRejected',
      this.state.currentPubKey
    );
    this.nextPubKey();
    this.showView();
  }

  nextPubKey() {
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
