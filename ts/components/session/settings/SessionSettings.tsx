import React from 'react';

import { SettingsHeader } from './SessionSettingsHeader';
import { SessionSettingListItem } from './SessionSettingListItem';
import { SessionButtonColor } from '../SessionButton';

export enum SessionSettingCategory {
  General = 'general',
  Account = 'account',
  Privacy = 'privacy',
  Notifications = 'notifications',
  Devices = 'devices',
}

export enum SessionSettingType {
  Toggle = 'toggle',
  Options = 'options',
  Button = 'button',
}

//const { Settings } = window.Signal.Types;

// Grab initial values from database on startup
const localSettings = [
  {
    id: 'theme-setting',
    title: 'Light Mode',
    hidden: true,
    comparisonValue: 'light',
    description: 'Choose the theme best suited to you',
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.General,
    setFn: window.toggleTheme,
  },
  {
    id: 'hide-menu-bar',
    title: 'Hide Menu Bar',
    //hidden: !Settings.isHideMenuBarSupported(),
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.General,
    setFn: window.setHideMenuBar,
  },



  {
    id: 'typing-indicators-setting',
    title: 'Typing Indicators',
    description:
      'See and share when messages are being typed. This setting is optional and applies to all conversations.',
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.Privacy,
  },
  {
    id: 'qwer',
    title: 'Screen Lock',
    description:
      'Unlock Loki Session using your password. Visit notification settings to customise.',
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.Privacy,
  },
  {
    id: 'qewrtrg',
    title: 'Screen Security',
    description:
      'Prevent Loki Session previews from appearing in desktop notifications.',
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.Privacy,
  },
  {
    id: 'erhe',
    title: 'Send Link Previews',
    description:
      'Supported for Imgur, Instagram, Pinterest, Reddit and YouTube.',
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.Privacy,
  },
  {
    id: 'qwefwef',
    title: 'Clear Conversation History',
    category: SessionSettingCategory.Privacy,
    type: SessionSettingType.Button,
    buttonText: 'Clear',
    buttonColor: SessionButtonColor.Danger,
  },
  {
    id: 'ergreg',
    title: 'Change Password',
    category: SessionSettingCategory.Account,
    type: SessionSettingType.Button,
    buttonText: 'Change',
    buttonColor: SessionButtonColor.Primary,
  },
  {
    id: 'etyjhnyth',
    title: 'Remove Password',
    category: SessionSettingCategory.Account,
    type: SessionSettingType.Button,
    buttonText: 'Remove',
    buttonColor: SessionButtonColor.Danger,
  },
];

export interface SettingsViewProps {
  category: SessionSettingCategory;
}

export class SettingsView extends React.Component<SettingsViewProps> {
  public settingsViewRef: React.RefObject<HTMLDivElement>;

  public constructor(props: any) {
    super(props);
    this.settingsViewRef = React.createRef();
  }

  public renderSettingInCategory() {
    const { Settings } = window.Signal.Types;
    console.log(Settings);
    console.log(Settings);
    console.log(Settings);
    console.log(Settings);
    
    return (
      <>
        {localSettings.map(setting => {
          const { category } = this.props;
          const renderSettings = setting.category === category;

          return (
            <div key={setting.id}>
                {renderSettings && !(setting.hidden) && (
                <SessionSettingListItem
                title={setting.title}
                description={setting.description}
                type={setting.type}
                value={ window.getSettingValue(setting.id, setting.comparisonValue || null) }
                onClick={() => {
                    this.updateSetting(setting);
                }}
                buttonText={setting.buttonText || undefined}
                buttonColor={setting.buttonColor || undefined}
                />
            )}
            </div>
          );
        })}
      </>
    );
  }

  public render() {
    const { category } = this.props;

    return (
      <div className="session-settings">
        <SettingsHeader category={category} />
        <div ref={this.settingsViewRef} className="session-settings-list">
          {this.renderSettingInCategory()}
        </div>
      </div>
    );
  }

  public updateSetting(item: any) {
    if (item.type === SessionSettingType.Toggle) {
      // If no custom afterClick function given, alter values in storage here
      if (!item.setFn) {
        // Switch to opposite state
        const newValue = !window.getSettingValue(item.id);
        window.setSettingValue(item.id, newValue);
      }
    }

    // If there's a custom afterClick function,
    // execute it instead of automatically updating settings
    item.setFn && item.setFn();

    return;
  }
}
