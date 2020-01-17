import React from 'react';
import { SessionIconButton, SessionIconSize, SessionIconType } from '../icon';

import { SessionSettingCategory, SettingsViewProps } from './SessionSettings';
import { SessionButton } from '../SessionButton';

export class SettingsHeader extends React.Component<SettingsViewProps> {
  public constructor(props: any) {
    super(props);
    this.showAddLinkedDeviceModal = this.showAddLinkedDeviceModal.bind(this);
  }

  public focusSearch() {
    $('.left-pane-setting-section .session-search-input input').focus();
  }

  public showAddLinkedDeviceModal() {
    window.Whisper.events.trigger('showDevicePairingDialog');
  }

  public render() {
    const { category } = this.props;
    const categoryString = String(category);
    const categoryTitlePrefix =
      categoryString[0].toUpperCase() + categoryString.substr(1);
    // Remove 's' on the end to keep words in singular form
    const categoryTitle =
      categoryTitlePrefix[categoryTitlePrefix.length - 1] === 's'
        ? `${categoryTitlePrefix.slice(0, -1)} Settings`
        : `${categoryTitlePrefix} Settings`;
    const showSearch = false;
    const showAddDevice = category === SessionSettingCategory.Devices;

    return (
      <div className="session-settings-header">
        <div className="session-settings-header-title">{categoryTitle}</div>
        {showSearch && <SessionIconButton
          iconType={SessionIconType.Search}
          iconSize={SessionIconSize.Huge}
          onClick={this.focusSearch}
        />
          }
        {showAddDevice && (
          <SessionButton
            text={window.i18n('linkNewDevice')}
            onClick={this.showAddLinkedDeviceModal}
          />
        )}
      </div>
    );
  }
}
