import React from 'react';

import { SettingsHeader } from './SessionSettingsHeader';
import { SessionSettingListItem } from './SessionSettingListItem';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from '../SessionButton';

export enum SessionSettingCategory {
  General = 'general',
  Account = 'account',
  Privacy = 'privacy',
  Permissions = 'permissions',
  Notifications = 'notifications',
  Devices = 'devices',
}

export enum SessionSettingType {
  Toggle = 'toggle',
  Options = 'options',
  Button = 'button',
  Slider = 'slider',
}

export interface SettingsViewProps {
  category: SessionSettingCategory;
}

interface State {
  hasPassword: boolean | null;
  shouldLockSettings: boolean | null;
  pwdLockError: string | null;
}

export class SettingsView extends React.Component<SettingsViewProps, State> {
  public settingsViewRef: React.RefObject<HTMLDivElement>;

  public constructor(props: any) {
    super(props);

    this.state = {
      hasPassword: null,
      pwdLockError: null,
      shouldLockSettings: true,
    };

    this.settingsViewRef = React.createRef();
    this.onPasswordUpdated = this.onPasswordUpdated.bind(this);
    this.validatePasswordLock = this.validatePasswordLock.bind(this);

    this.hasPassword();
  }

  /* tslint:disable-next-line:max-func-body-length */
  public renderSettingInCategory() {
    const { Settings } = window.Signal.Types;

    // Grab initial values from database on startup
    // ID corresponds to instalGetter parameters in preload.js
    // They are NOT arbitrary; add with caution
    const localSettings = [
      {
        id: 'theme-setting',
        title: window.i18n('themeToggleTitle'),
        description: 'Choose the theme best suited to you',
        hidden: true,
        comparisonValue: 'light',
        type: SessionSettingType.Toggle,
        category: SessionSettingCategory.General,
        setFn: window.toggleTheme,
        content: {},
      },
      {
        id: 'hide-menu-bar',
        title: window.i18n('hideMenuBarTitle'),
        description: window.i18n('hideMenuBarDescription'),
        hidden: !Settings.isHideMenuBarSupported(),
        type: SessionSettingType.Toggle,
        category: SessionSettingCategory.General,
        setFn: window.toggleMenuBar,
        content: {},
      },
      {
        id: 'spell-check',
        title: window.i18n('spellCheckTitle'),
        description: window.i18n('spellCheckDescription'),
        hidden: false,
        type: SessionSettingType.Toggle,
        category: SessionSettingCategory.General,
        setFn: window.toggleSpellCheck,
        content: {},
      },
      {
        id: 'link-preview-setting',
        title: window.i18n('linkPreviewsTitle'),
        description: window.i18n('linkPreviewDescription'),
        hidden: false,
        type: SessionSettingType.Toggle,
        category: SessionSettingCategory.General,
        setFn: window.toggleLinkPreview,
        content: {},
      },
      {
        id: 'notification-setting',
        title: window.i18n('notificationSettingsDialog'),
        type: SessionSettingType.Options,
        category: SessionSettingCategory.Notifications,
        setFn: () => {
          this.setOptionsSetting('notification-setting');
        },
        content: {
          options: {
            group: 'notification-setting',
            initalItem:
              window.getSettingValue('notification-setting') || 'message',
            items: [
              {
                label: window.i18n('nameAndMessage'),
                value: 'message',
              },
              {
                label: window.i18n('nameOnly'),
                value: 'name',
              },
              {
                label: window.i18n('noNameOrMessage'),
                value: 'count',
              },
              {
                label: window.i18n('disableNotifications'),
                value: 'off',
              },
            ],
          },
        },
      },
      {
        id: 'media-permissions',
        title: window.i18n('mediaPermissionsTitle'),
        description: window.i18n('mediaPermissionsDescription'),
        hidden: false,
        type: SessionSettingType.Toggle,
        category: SessionSettingCategory.Permissions,
        setFn: window.toggleMediaPermissions,
        content: {},
      },
      {
        id: 'message-ttl',
        title: window.i18n('messageTTL'),
        description: window.i18n('messageTTLSettingDescription'),
        hidden: false,
        type: SessionSettingType.Slider,
        category: SessionSettingCategory.Privacy,
        setFn: undefined,
        content: {
          defaultValue: 24,
        },
      },
      {
        id: 'set-password',
        title: window.i18n('setAccountPasswordTitle'),
        description: window.i18n('setAccountPasswordDescription'),
        hidden: this.state.hasPassword,
        type: SessionSettingType.Button,
        category: SessionSettingCategory.Privacy,
        setFn: undefined,
        content: {
          buttonText: window.i18n('setPassword'),
          buttonColor: SessionButtonColor.Primary,
        },
        onClick: () =>
          window.showPasswordDialog({
            action: 'set',
            onSuccess: this.onPasswordUpdated,
          }),
      },
      {
        id: 'change-password',
        title: window.i18n('changeAccountPasswordTitle'),
        description: window.i18n('changeAccountPasswordDescription'),
        hidden: !this.state.hasPassword,
        type: SessionSettingType.Button,
        category: SessionSettingCategory.Privacy,
        setFn: undefined,
        content: {
          buttonText: window.i18n('changePassword'),
          buttonColor: SessionButtonColor.Primary,
        },
        onClick: () =>
          window.showPasswordDialog({
            action: 'change',
            onSuccess: this.onPasswordUpdated,
          }),
      },
      {
        id: 'remove-password',
        title: window.i18n('removeAccountPasswordTitle'),
        description: window.i18n('removeAccountPasswordDescription'),
        hidden: !this.state.hasPassword,
        type: SessionSettingType.Button,
        category: SessionSettingCategory.Privacy,
        setFn: undefined,
        content: {
          buttonText: window.i18n('removePassword'),
          buttonColor: SessionButtonColor.Danger,
        },
        onClick: () =>
          window.showPasswordDialog({
            action: 'remove',
            onSuccess: this.onPasswordUpdated,
          }),
      },
    ];

    return (
      <>
        {this.state.hasPassword !== null &&
          localSettings.map(setting => {
            const { category } = this.props;
            const content = setting.content || undefined;
            const shouldRenderSettings = setting.category === category;
            const description = setting.description || '';

            const comparisonValue = setting.comparisonValue || null;
            const value =
              window.getSettingValue(setting.id, comparisonValue) ||
              setting.content.defaultValue;

            const sliderFn =
              setting.type === SessionSettingType.Slider
                ? (settingValue: any) =>
                    window.setSettingValue(setting.id, settingValue)
                : () => null;

            const onClickFn =
              setting.onClick ||
              (() => {
                this.updateSetting(setting);
              });

            return (
              <div key={setting.id}>
                {shouldRenderSettings &&
                  !setting.hidden && (
                    <SessionSettingListItem
                      title={setting.title}
                      description={description}
                      type={setting.type}
                      value={value}
                      onClick={onClickFn}
                      onSliderChange={sliderFn}
                      content={content}
                    />
                  )}
              </div>
            );
          })}
      </>
    );
  }

  public renderPasswordLock() {
    return (
      <div className="session-settings__password-lock">
        <div className="session-settings__password-lock-box">
          <h3>{window.i18n('password')}</h3>
          <input
            type="password"
            id="password-lock-input"
            defaultValue=""
            placeholder=" "
          />

          {this.state.pwdLockError && (
            <>
              <div className="session-label warning">
                {this.state.pwdLockError}
              </div>
              <div className="spacer-lg" />
            </>
          )}

          <SessionButton
            buttonType={SessionButtonType.BrandOutline}
            buttonColor={SessionButtonColor.Green}
            text={window.i18n('enter')}
            onClick={this.validatePasswordLock}
          />
        </div>
      </div>
    );
  }

  public async validatePasswordLock() {
    const enteredPassword = String($('#password-lock-input').val());

    if (!enteredPassword) {
      this.setState({
        pwdLockError: window.i18n('noGivenPassword'),
      });

      return false;
    }

    // Check if the password matches the hash we have stored
    const hash = await window.Signal.Data.getPasswordHash();
    if (hash && !window.passwordUtil.matchesHash(enteredPassword, hash)) {
      this.setState({
        pwdLockError: window.i18n('invalidPassword'),
      });

      return false;
    }

    // Unlocked settings
    this.setState({
      shouldLockSettings: false,
    });

    return true;
  }

  public hasPassword() {
    const hashPromise = window.Signal.Data.getPasswordHash();

    hashPromise.then((hash: any) => {
      this.setState({
        hasPassword: !!hash,
      });
    });
  }

  public render() {
    const { category } = this.props;
    const shouldRenderPasswordLock =
      this.state.shouldLockSettings && this.state.hasPassword;

    return (
      <div className="session-settings">
        <SettingsHeader category={category} />
        {shouldRenderPasswordLock ? (
          this.renderPasswordLock()
        ) : (
          <div ref={this.settingsViewRef} className="session-settings-list">
            {this.renderSettingInCategory()}
          </div>
        )}
      </div>
    );
  }

  public updateSetting(item: any) {
    // If there's a custom afterClick function,
    // execute it instead of automatically updating settings
    if (item.setFn) {
      item.setFn();
    } else {
      if (item.type === SessionSettingType.Toggle) {
        // If no custom afterClick function given, alter values in storage here
        // Switch to opposite state
        const newValue = !window.getSettingValue(item.id);
        window.setSettingValue(item.id, newValue);
      }
    }
  }

  public setOptionsSetting(settingID: string) {
    const selectedValue = $(`#${settingID} .session-radio input:checked`).val();
    window.setSettingValue(settingID, selectedValue);
  }

  public onPasswordUpdated(action: string) {
    if (action === 'set' || action === 'change') {
      this.setState({
        hasPassword: true,
        shouldLockSettings: true,
      });
    }

    if (action === 'remove') {
      this.setState({
        hasPassword: false,
      });
    }
  }
}
