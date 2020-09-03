import React from 'react';
import { SessionIconButton, SessionIconSize, SessionIconType } from '../icon';

import { SessionSettingCategory, SettingsViewProps } from './SessionSettings';
import { SessionButton } from '../SessionButton';
import { UserUtil } from '../../../util';
import { PubKey } from '../../../session/types';
import { MultiDeviceProtocol } from '../../../session/protocols';

interface Props extends SettingsViewProps {
  // showLinkDeviceButton is used to completely hide the button while the settings password lock is displayed
  showLinkDeviceButton: boolean | null;
  // isSecondaryDevice is used to just disable the linkDeviceButton when we are already a secondary device
  isSecondaryDevice: boolean;
  categoryTitle: string;
}

export class SettingsHeader extends React.Component<Props, any> {
  public static defaultProps = {
    showLinkDeviceButton: false,
  };

  public constructor(props: any) {
    super(props);
    // mark the linkDeviceButton as disabled by default.
    // it will be enabled if needed during componentDidMount().
    this.state = {
      disableLinkDeviceButton: true,
    };
    this.showAddLinkedDeviceModal = this.showAddLinkedDeviceModal.bind(this);
  }

  public focusSearch() {
    ($(
      '.left-pane-setting-section .session-search-input input'
    ) as any).focus();
  }

  public showAddLinkedDeviceModal() {
    window.Whisper.events.trigger('showDevicePairingDialog');
  }

  public componentDidMount() {
    if (!this.props.isSecondaryDevice) {
      window.Whisper.events.on('refreshLinkedDeviceList', async () => {
        void this.refreshLinkedDevice();
      });
      void this.refreshLinkedDevice();
    }
  }

  public async refreshLinkedDevice() {
    const ourPubKey = await UserUtil.getCurrentDevicePubKey();
    if (ourPubKey) {
      const pubKey = new PubKey(ourPubKey);
      const devices = await MultiDeviceProtocol.getSecondaryDevices(pubKey);

      this.setState({ disableLinkDeviceButton: devices.length > 0 });
    }
  }

  public componentWillUnmount() {
    if (!this.props.isSecondaryDevice) {
      window.Whisper.events.off('refreshLinkedDeviceList');
    }
  }

  public render() {
    const { category, categoryTitle } = this.props;
    const { disableLinkDeviceButton } = this.state;
    const showSearch = false;
    const showAddDevice =
      category === SessionSettingCategory.Devices &&
      this.props.showLinkDeviceButton;

    return (
      <div className="session-settings-header">
        <div className="session-settings-header-title">{categoryTitle}</div>
        {showSearch && (
          <SessionIconButton
            iconType={SessionIconType.Search}
            iconSize={SessionIconSize.Huge}
            onClick={this.focusSearch}
          />
        )}
        {showAddDevice && (
          <SessionButton
            text={window.i18n('linkNewDevice')}
            onClick={this.showAddLinkedDeviceModal}
            disabled={disableLinkDeviceButton}
          />
        )}
      </div>
    );
  }
}
