import React from 'react';
import { QRCode } from 'react-qrcode'

import { SessionModal } from './session/SessionModal';
import { SessionButton } from './session/SessionButton';


interface Props {
    i18n: any,
    onClose: any,
    pubKeyToUnpair: string | null;
    pubKey: string | null;
}

interface State {
    accepted: boolean;
    isListening: boolean;
    success: boolean;
    loading: boolean;
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
        accepted: false,
        isListening: false,
        success: false,
        loading: true,
        data: [],
    };
  }

  componentDidMount() {
    this.getSecondaryDevices();    
  }

  private async getSecondaryDevices(){
    const secondaryDevices = await window.libloki.storage.getSecondaryDevicesFor(this.props.pubKey);
    this.setState({
        data: secondaryDevices,
        loading: false
    });
  }

  public render() {
    const {i18n, } = this.props;


    const newData = ['053e18835c106a5f9f463a44a9d7ff9a26281d529285a047bd969cfc59d4ab8607'];
    setTimeout(() => {
        this.setState({
            data: newData,
        });
    }, 2000);
    
    return (
        <>
        { ! this.state.loading ? (
            <SessionModal
                title={i18n('pairedDevices')}
                onOk={() => null}
                onClose={this.closeDialog}
            >
                { this.state.isListening ? (
                    <div>
                        {i18n('waitingForDeviceToRegister')}
                        <div className="spacer-lg"></div>

                        <div id="qr">
                            <QRCode value={window.textsecure.storage.user.getNumber()}/>
                        </div>

                    </div>
                )
                : (
                    <>
                        {this.state.data.length == 0 ? (
                            <>
                                <div>{i18n('noPairedDevices')}</div>
                                <div className="spacer-lg"></div>

                                <div className="session-modal__button-group__center">
                                    <SessionButton
                                    text = {i18n('pairNewDevice')}
                                    onClick = {this.startReceivingRequests}
                                    />
                                </div>
                            </>
                        )
                        : (
                            <>
                              {
                                this.state.data.map((pubKey: any) => {
                                  const pubKeyInfo = this.getPubkeyName(pubKey);
                                  return (
                                    <p>
                                      { pubKeyInfo.deviceAlias }
                                      <br/>
                                      <span className="text-subtle">Pairing Secret:</span> { pubKeyInfo.secretWords }
                                    </p>
                                  );
                                })
                              }
                            </>
                        )}
                        
                        
                    </>
                )}
            </SessionModal>
        ) : null }
      </>
    );
  }

  

  private startReceivingRequests() {
    this.setState({
        isListening: true,
    });
  }

  private getPubkeyName(pubKey: string) {
    const secretWords = window.mnemonic.pubkey_to_secret_words(pubKey);
    const conv = window.ConversationController.get(this.props.pubKey);
    const deviceAlias = conv ? conv.getNickname() : 'Unnamed Device';
    return {deviceAlias, secretWords};
  }

  private stopReceivingRequests() {
    if (this.state.success) {
      const conv = window.ConversationController.get(this.props.pubKey);
      //if (conv) {
      //  conv.setNickname(this.props.deviceAlias);
      //}
    }
    this.forceUpdate();
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