import React from 'react';
import ReactDOM from 'react-dom';

import {
  SessionSettingListItem,
  SessionSettingType,
} from './session/settings/SessionSettingListItem';

import { SessionSettingCategory } from './session/LeftPaneSettingSection';
import { SessionButtonColor } from './session/SessionButton';

// Grab initial values from database on startup
const localSettings = [
  {
    id: 'typingIndicators',
    title: 'Typing Indicators',
    description:
      'See and share when messages are being typed. This setting is optional and applies to all conversations.',
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.Privacy,
    value: false,
  },
  {
    id: 'screenLock',
    title: 'Screen Lock',
    description:
      'Unlock Loki Session using your password. Visit notification settings to customise.',
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.Privacy,
    value: true,
  },
  {
    id: 'screenSecurity',
    title: 'Screen Security',
    description:
      'Prevent Loki Session previews from appearing in desktop notifications.',
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.Privacy,
    value: false,
  },
  {
    id: 'linkPreviews',
    title: 'Send Link Previews',
    description:
      'Supported for Imgur, Instagram, Pinterest, Reddit and YouTube.',
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.Privacy,
    value: true,
  },
  {
    id: 'clearConversationHistory',
    title: 'Clear Conversation History',
    category: SessionSettingCategory.Privacy,
    type: SessionSettingType.Button,
    value: false,
    buttonText: 'Clear',
    buttonColor: SessionButtonColor.Danger,
  },
  {
    id: 'changePassword',
    title: 'Change Password',
    category: SessionSettingCategory.Account,
    type: SessionSettingType.Button,
    value: false,
    buttonText: 'Change',
    buttonColor: SessionButtonColor.Primary,
  },
  {
    id: 'removePassword',
    title: 'Remove Password',
    category: SessionSettingCategory.Account,
    type: SessionSettingType.Button,
    value: false,
    buttonText: 'Remove',
    buttonColor: SessionButtonColor.Danger,
  },
];

export class MainViewController {
  public static renderMessageView() {
    const element = (
      <div className="conversation-stack">
        <div className="conversation placeholder">
          <div className="conversation-header" />
          <div className="container">
            <div className="content">
              <img
                src="images/session/brand.svg"
                className="session-filter-color-green session-logo-128"
              />
              <p className="session-logo-text">SESSION</p>
            </div>
          </div>
        </div>
      </div>
    );

    ReactDOM.render(element, document.getElementById('main-view'));
  }

  public static renderSettingsView(category: SessionSettingCategory) {
    const element = (
      <div className="session-settings-list">
        {localSettings.map(setting => {
          return (
            <div key={setting.id}>
              {setting.category === category && (
                <SessionSettingListItem
                  title={setting.title}
                  description={setting.description}
                  type={setting.type}
                  value={setting.value}
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
      </div>
    );

    ReactDOM.render(element, document.getElementById('main-view'));
  }
}

export class SettingsManager {
  public static updateSetting({ id, type, value }) {
    if (type === SessionSettingType.Toggle) {
      alert(`You clicked a toggle with ID: ${id}`);

      // Manage toggle events

      return;
    }

    alert('you clicked something else');

    return;
  }
}
