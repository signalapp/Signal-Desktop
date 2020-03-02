import React from 'react';

import { SettingsHeader } from './SessionSettingsHeader';
import { SessionSettingListItem } from './SessionSettingListItem';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from '../SessionButton';

export enum SessionSettingCategory {
  Appearance = 'appearance',
  Account = 'account',
  Privacy = 'privacy',
  Permissions = 'permissions',
  Notifications = 'notifications',
  Devices = 'devices',
  Blocked = 'blocked',
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
  pwdLockError: string | null;
  shouldLockSettings: boolean | null;
  linkedPubKeys: Array<any>;
}

interface LocalSettingType {
  category: SessionSettingCategory;
  description: string | undefined;
  comparisonValue: string | undefined;
  id: any;
  content: any | undefined;
  hidden: any;
  title: string;
  type: SessionSettingType | undefined;
  setFn: any;
  onClick: any;
  confirmationDialogParams: any | undefined;
}

export class SettingsView extends React.Component<SettingsViewProps, State> {
  public settingsViewRef: React.RefObject<HTMLDivElement>;

  public constructor(props: any) {
    super(props);

    this.state = {
      hasPassword: null,
      pwdLockError: null,
      shouldLockSettings: true,
      linkedPubKeys: new Array(),
    };

    this.settingsViewRef = React.createRef();
    this.onPasswordUpdated = this.onPasswordUpdated.bind(this);
    this.validatePasswordLock = this.validatePasswordLock.bind(this);

    this.hasPassword();
    this.refreshLinkedDevice = this.refreshLinkedDevice.bind(this);

    this.onKeyUp = this.onKeyUp.bind(this);
    window.addEventListener('keyup', this.onKeyUp);
  }

  public componentDidMount() {
    setTimeout(() => $('#password-lock-input').focus(), 100);

    window.Whisper.events.on('refreshLinkedDeviceList', async () => {
      setTimeout(() => {
        this.refreshLinkedDevice();
      }, 1000);
    });
    this.refreshLinkedDevice();
  }

  public componentWillUnmount() {
    window.Whisper.events.off('refreshLinkedDeviceList');
  }

  /* tslint:disable-next-line:max-func-body-length */
  public renderSettingInCategory(): JSX.Element {
    const { category } = this.props;

    let settings: Array<LocalSettingType>;

    if (category === SessionSettingCategory.Devices) {
      // special case for linked devices
      settings = this.getLinkedDeviceSettings();
    } else {
      // Grab initial values from database on startup
      // ID corresponds to installGetter parameters in preload.js
      // They are NOT arbitrary; add with caution

      settings = this.getLocalSettings();
    }

    return (
      <>
        {this.state.hasPassword !== null &&
          settings.map(setting => {
            const content = setting.content || undefined;
            const shouldRenderSettings = setting.category === category;
            const description = setting.description || '';

            const comparisonValue = setting.comparisonValue || null;
            const value =
              window.getSettingValue(setting.id, comparisonValue) ||
              (setting.content && setting.content.defaultValue);

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
                      confirmationDialogParams={
                        setting.confirmationDialogParams
                      }
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
            placeholder={' '}
            maxLength={window.CONSTANTS.MAX_PASSWORD_LENGTH}
          />

          <div className="spacer-xs" />

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
      pwdLockError: null,
    });

    return true;
  }

  public render() {
    const { category } = this.props;
    const shouldRenderPasswordLock =
      this.state.shouldLockSettings && this.state.hasPassword;

    return (
      <div className="session-settings">
        <SettingsHeader
          showLinkDeviceButton={!shouldRenderPasswordLock}
          category={category}
        />

        <div className="session-settings-view">
          {shouldRenderPasswordLock ? (
            this.renderPasswordLock()
          ) : (
            <div ref={this.settingsViewRef} className="session-settings-list">
              {this.renderSettingInCategory()}
            </div>
          )}
          {this.renderSessionInfo()}
        </div>
      </div>
    );
  }

  public renderSessionInfo(): JSX.Element {
    return (
      <div className="session-settings__version-info">
        <span>v{window.versionInfo.version}</span>
        <span>{window.versionInfo.commitHash}</span>
      </div>
    );
  }

  public setOptionsSetting(settingID: string) {
    const selectedValue = $(`#${settingID} .session-radio input:checked`).val();
    window.setSettingValue(settingID, selectedValue);
  }

  public hasPassword() {
    const hashPromise = window.Signal.Data.getPasswordHash();

    hashPromise.then((hash: any) => {
      this.setState({
        hasPassword: !!hash,
      });
    });
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

  public onPasswordUpdated(action: string) {
    if (action === 'set' || action === 'change') {
      this.setState({
        hasPassword: true,
        shouldLockSettings: true,
        pwdLockError: null,
      });
    }

    if (action === 'remove') {
      this.setState({
        hasPassword: false,
      });
    }
  }

  private getPubkeyName(pubKey: string | null) {
    if (!pubKey) {
      return {};
    }

    const secretWords = window.mnemonic.pubkey_to_secret_words(pubKey);
    const conv = window.ConversationController.get(pubKey);
    const deviceAlias = conv ? conv.getNickname() : 'Unnamed Device';

    return { deviceAlias, secretWords };
  }

  // tslint:disable-next-line: max-func-body-length
  private getLocalSettings(): Array<LocalSettingType> {
    const { Settings } = window.Signal.Types;

    return [
      {
        id: 'theme-setting',
        title: window.i18n('themeToggleTitle'),
        description: window.i18n('themeToggleDescription'),
        hidden: true,
        comparisonValue: 'light',
        type: SessionSettingType.Toggle,
        category: SessionSettingCategory.Appearance,
        setFn: window.toggleTheme,
        content: undefined,
        onClick: undefined,
        confirmationDialogParams: undefined,
      },
      {
        id: 'hide-menu-bar',
        title: window.i18n('hideMenuBarTitle'),
        description: window.i18n('hideMenuBarDescription'),
        hidden: !Settings.isHideMenuBarSupported(),
        type: SessionSettingType.Toggle,
        category: SessionSettingCategory.Appearance,
        setFn: window.toggleMenuBar,
        content: { defaultValue: true },
        comparisonValue: undefined,
        onClick: undefined,
        confirmationDialogParams: undefined,
      },
      {
        id: 'spell-check',
        title: window.i18n('spellCheckTitle'),
        description: window.i18n('spellCheckDescription'),
        hidden: false,
        type: SessionSettingType.Toggle,
        category: SessionSettingCategory.Appearance,
        setFn: window.toggleSpellCheck,
        content: undefined,
        comparisonValue: undefined,
        onClick: undefined,
        confirmationDialogParams: undefined,
      },
      {
        id: 'link-preview-setting',
        title: window.i18n('linkPreviewsTitle'),
        description: window.i18n('linkPreviewDescription'),
        hidden: false,
        type: SessionSettingType.Toggle,
        category: SessionSettingCategory.Appearance,
        setFn: window.toggleLinkPreview,
        content: undefined,
        comparisonValue: undefined,
        onClick: undefined,
        confirmationDialogParams: {
          shouldShowConfirm: () =>
            !window.getSettingValue('link-preview-setting'),
          title: window.i18n('linkPreviewsConfirmTitle'),
          message: window.i18n('linkPreviewsConfirmMessage'),
          okTheme: 'danger',
        },
      },
      {
        id: 'notification-setting',
        title: window.i18n('notificationSettingsDialog'),
        type: SessionSettingType.Options,
        category: SessionSettingCategory.Notifications,
        comparisonValue: undefined,
        description: undefined,
        hidden: undefined,
        onClick: undefined,
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
        confirmationDialogParams: undefined,
      },
      {
        id: 'media-permissions',
        title: window.i18n('mediaPermissionsTitle'),
        description: window.i18n('mediaPermissionsDescription'),
        hidden: false,
        type: SessionSettingType.Toggle,
        category: SessionSettingCategory.Permissions,
        setFn: window.toggleMediaPermissions,
        content: undefined,
        comparisonValue: undefined,
        onClick: undefined,
        confirmationDialogParams: undefined,
      },
      {
        id: 'message-ttl',
        title: window.i18n('messageTTL'),
        description: window.i18n('messageTTLSettingDescription'),
        hidden: false,
        type: SessionSettingType.Slider,
        category: SessionSettingCategory.Privacy,
        setFn: undefined,
        comparisonValue: undefined,
        onClick: undefined,
        content: {
          dotsEnabled: true,
          step: 6,
          min: 12,
          max: 96,
          defaultValue: 24,
          info: (value: number) => `${value} Hours`,
        },
        confirmationDialogParams: undefined,
      },
      {
        id: 'zoom-factor-setting',
        title: window.i18n('zoomFactorSettingTitle'),
        description: undefined,
        hidden: false,
        type: SessionSettingType.Slider,
        category: SessionSettingCategory.Appearance,
        setFn: undefined,
        comparisonValue: undefined,
        onClick: undefined,
        content: {
          dotsEnabled: true,
          step: 20,
          min: 60,
          max: 200,
          defaultValue: 100,
          info: (value: number) => `${value}%`,
        },
        confirmationDialogParams: undefined,
      },
      {
        id: 'read-receipt-setting',
        title: window.i18n('readReceiptSettingTitle'),
        description: window.i18n('readReceiptSettingDescription'),
        hidden: false,
        type: SessionSettingType.Toggle,
        category: SessionSettingCategory.Privacy,
        setFn: undefined,
        comparisonValue: undefined,
        onClick: undefined,
        content: {},
        confirmationDialogParams: undefined,
      },
      {
        id: 'typing-indicators-setting',
        title: window.i18n('typingIndicatorsSettingTitle'),
        description: window.i18n('typingIndicatorsSettingDescription'),
        hidden: false,
        type: SessionSettingType.Toggle,
        category: SessionSettingCategory.Privacy,
        setFn: undefined,
        comparisonValue: undefined,
        onClick: undefined,
        content: {},
        confirmationDialogParams: undefined,
      },
      {
        id: 'set-password',
        title: window.i18n('setAccountPasswordTitle'),
        description: window.i18n('setAccountPasswordDescription'),
        hidden: this.state.hasPassword,
        type: SessionSettingType.Button,
        category: SessionSettingCategory.Privacy,
        setFn: undefined,
        comparisonValue: undefined,
        content: {
          buttonText: window.i18n('setPassword'),
          buttonColor: SessionButtonColor.Primary,
        },
        onClick: () =>
          window.showPasswordDialog({
            action: 'set',
            onSuccess: this.onPasswordUpdated,
          }),
        confirmationDialogParams: undefined,
      },
      {
        id: 'change-password',
        title: window.i18n('changeAccountPasswordTitle'),
        description: window.i18n('changeAccountPasswordDescription'),
        hidden: !this.state.hasPassword,
        type: SessionSettingType.Button,
        category: SessionSettingCategory.Privacy,
        setFn: undefined,
        comparisonValue: undefined,
        content: {
          buttonText: window.i18n('changePassword'),
          buttonColor: SessionButtonColor.Primary,
        },
        onClick: () =>
          window.showPasswordDialog({
            action: 'change',
            onSuccess: this.onPasswordUpdated,
          }),
        confirmationDialogParams: undefined,
      },
      {
        id: 'remove-password',
        title: window.i18n('removeAccountPasswordTitle'),
        description: window.i18n('removeAccountPasswordDescription'),
        hidden: !this.state.hasPassword,
        type: SessionSettingType.Button,
        category: SessionSettingCategory.Privacy,
        setFn: undefined,
        comparisonValue: undefined,
        content: {
          buttonText: window.i18n('removePassword'),
          buttonColor: SessionButtonColor.Danger,
        },
        onClick: () =>
          window.showPasswordDialog({
            action: 'remove',
            onSuccess: this.onPasswordUpdated,
          }),
        confirmationDialogParams: undefined,
      },
    ];
  }

  private getLinkedDeviceSettings(): Array<LocalSettingType> {
    const { linkedPubKeys } = this.state;

    if (linkedPubKeys && linkedPubKeys.length > 0) {
      return linkedPubKeys.map((pubkey: any) => {
        const { deviceAlias, secretWords } = this.getPubkeyName(pubkey);
        const description = `${secretWords} ${window.shortenPubkey(pubkey)}`;

        if (window.lokiFeatureFlags.multiDeviceUnpairing) {
          return {
            id: pubkey,
            title: deviceAlias,
            description: description,
            type: SessionSettingType.Button,
            category: SessionSettingCategory.Devices,
            content: {
              buttonColor: SessionButtonColor.Danger,
              buttonText: window.i18n('unpairDevice'),
            },
            comparisonValue: undefined,
            setFn: () => {
              window.Whisper.events.trigger('showDevicePairingDialog', {
                pubKeyToUnpair: pubkey,
              });
            },
            hidden: undefined,
            onClick: undefined,
            confirmationDialogParams: undefined,
          };
        } else {
          return {
            id: pubkey,
            title: deviceAlias,
            description: description,
            type: undefined,
            category: SessionSettingCategory.Devices,
            content: {},
            comparisonValue: undefined,
            setFn: undefined,
            hidden: undefined,
            onClick: undefined,
            confirmationDialogParams: undefined,
          };
        }
      });
    } else {
      return [
        {
          id: 'no-linked-device',
          title: window.i18n('noPairedDevices'),
          type: undefined,
          description: '',
          category: SessionSettingCategory.Devices,
          content: {},
          comparisonValue: undefined,
          onClick: undefined,
          setFn: undefined,
          hidden: undefined,
          confirmationDialogParams: undefined,
        },
      ];
    }
  }

  private refreshLinkedDevice() {
    const ourPubKey = window.textsecure.storage.user.getNumber();

    window.libloki.storage
      .getSecondaryDevicesFor(ourPubKey)
      .then((pubKeys: any) => {
        this.setState({
          linkedPubKeys: pubKeys,
        });
      });
  }

  private async onKeyUp(event: any) {
    const lockPasswordFocussed = $('#password-lock-input').is(':focus');

    if (event.key === 'Enter' && lockPasswordFocussed) {
      await this.validatePasswordLock();
    }

    event.preventDefault();
  }
}
