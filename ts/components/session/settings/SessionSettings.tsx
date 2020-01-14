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

// Grab initial values from database on startup
const localSettings = [
  {
    id: 'theme',
    title: 'Light Mode',
    description: 'Choose the theme best suited to you',
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.General,
    afterClick: () => window.toggleTheme(),
  },
  {
    id: 'typingIndicators',
    title: 'Typing Indicators',
    description:
      'See and share when messages are being typed. This setting is optional and applies to all conversations.',
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.Privacy,
  },
  {
    id: 'screenLock',
    title: 'Screen Lock',
    description:
      'Unlock Loki Session using your password. Visit notification settings to customise.',
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.Privacy,
  },
  {
    id: 'screenSecurity',
    title: 'Screen Security',
    description:
      'Prevent Loki Session previews from appearing in desktop notifications.',
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.Privacy,
  },
  {
    id: 'linkPreviews',
    title: 'Send Link Previews',
    description:
      'Supported for Imgur, Instagram, Pinterest, Reddit and YouTube.',
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.Privacy,
  },
  {
    id: 'clearConversationHistory',
    title: 'Clear Conversation History',
    category: SessionSettingCategory.Privacy,
    type: SessionSettingType.Button,
    buttonText: 'Clear',
    buttonColor: SessionButtonColor.Danger,
  },
  {
    id: 'changePassword',
    title: 'Change Password',
    category: SessionSettingCategory.Account,
    type: SessionSettingType.Button,
    buttonText: 'Change',
    buttonColor: SessionButtonColor.Primary,
  },
  {
    id: 'removePassword',
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
    return (
      <>
        {localSettings.map(setting => {
          const { category } = this.props;
          const renderSettings = setting.category === category;

          return (
            <div key={setting.id}>
              {renderSettings && (
                <SessionSettingListItem
                  title={setting.title}
                  description={setting.description}
                  type={setting.type}
                  value={window.getSettingValue(setting.id)}
                  onClick={() => {
                    SettingsManager.updateSetting(setting);
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
}

export class SettingsManager {
  public static updateSetting(item: any) {
    if (item.type === SessionSettingType.Toggle) {
      //alert(`You clicked a toggle with ID: ${item.id}`);
      // Manage toggle events
    }

    // If there's an onClick function, execute it
    item.afterClick && item.afterClick();

    return;
  }
}
