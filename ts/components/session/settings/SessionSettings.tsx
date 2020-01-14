import React from 'react';

import { SettingsHeader } from './SessionSettingsHeader';
import { SessionSettingListItem } from './SessionSettingListItem';


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
  Slider = 'slider',
}

//const { Settings } = window.Signal.Types;

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

    // Grab initial values from database on startup
    // ID corresponds to instalGetter parameters in preload.js
    // They are NOT arbitrary; add with caution
    const localSettings = [
        {
            id: 'theme-setting',
            title: 'Light Mode',
            description: 'Choose the theme best suited to you',
            hidden: true,
            comparisonValue: 'light',
            type: SessionSettingType.Options,
            category: SessionSettingCategory.General,
            setFn: window.toggleTheme,
            childProps: {},
        },
        {
            id: 'hide-menu-bar',
            title: 'Hide Menu Bar',
            description: 'Toggle system menu bar visibi',
            hidden: !Settings.isHideMenuBarSupported(),
            type: SessionSettingType.Toggle,
            category: SessionSettingCategory.General,
            setFn: window.toggleMenuBar,
            childProps: {},
        },
        {
            id: 'notification-setting',
            title: 'Notifications',
            description: 'When messages arive, display notifications that reveal:',
            type: SessionSettingType.Options,
            category: SessionSettingCategory.Notifications,
            setFn: () => window.setSettingValue(this.getNotificationPreference()),
            childProps: {
                options: [
                    {
                        id: 'default',
                        desc: 'Both sender name and message',
                    },
                    {
                        id: 'name',
                        desc: 'Only sender name',
                    },
                    {
                        id: 'count',
                        desc: 'Neither name nor messsage',
                    },
                    {
                        id: 'off',
                        desc: 'Disable notificationss',
                    },
                ],
                activeIndex: 0
            },
        },
    ];

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
                    buttonText={setting.childProps.buttonText || undefined}
                    buttonColor={setting.childProps.buttonColor || undefined}
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
    if (item.setFn) {
        item.setFn();
    }

    return;
  }

  public getNotificationPreference(){
    const value = window.getSettingValue('notification-setting');
    return value || 'default';
  }

}
