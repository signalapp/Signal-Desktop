import React from 'react';

import { SettingsHeader } from './SessionSettingsHeader';
import { SessionSettingListItem } from './SessionSettingListItem';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from '../SessionButton';
import { BlockedNumberController, PasswordUtil } from '../../../util';
import { ToastUtils } from '../../../session/utils';
import { ConversationLookupType } from '../../../state/ducks/conversations';
import { StateType } from '../../../state/reducer';
import { ConversationController } from '../../../session/conversations';
import {
  getConversationLookup,
  getConversations,
} from '../../../state/selectors/conversations';
import { connect } from 'react-redux';
import { getPasswordHash } from '../../../../ts/data/data';

export enum SessionSettingCategory {
  Appearance = 'appearance',
  Account = 'account',
  Privacy = 'privacy',
  Permissions = 'permissions',
  Notifications = 'notifications',
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
  // pass the conversation as props, so our render is called everytime they change.
  // we have to do this to make the list refresh on unblock()
  conversations?: ConversationLookupType;
}

interface State {
  hasPassword: boolean | null;
  pwdLockError: string | null;
  mediaSetting: boolean | null;
  shouldLockSettings: boolean | null;
}

interface LocalSettingType {
  category: SessionSettingCategory;
  description: string | undefined;
  comparisonValue: string | undefined;
  id: any;
  value?: any;
  content: any | undefined;
  hidden: any;
  title?: string;
  type: SessionSettingType | undefined;
  setFn: any;
  onClick: any;
  confirmationDialogParams: any | undefined;
}

class SettingsViewInner extends React.Component<SettingsViewProps, State> {
  public settingsViewRef: React.RefObject<HTMLDivElement>;

  public constructor(props: any) {
    super(props);

    this.state = {
      hasPassword: null,
      pwdLockError: null,
      mediaSetting: null,
      shouldLockSettings: true,
    };

    this.settingsViewRef = React.createRef();
    this.onPasswordUpdated = this.onPasswordUpdated.bind(this);
    this.validatePasswordLock = this.validatePasswordLock.bind(this);

    void this.hasPassword();

    this.onKeyUp = this.onKeyUp.bind(this);
    window.addEventListener('keyup', this.onKeyUp);
  }

  public async componentWillMount() {
    const mediaSetting = await window.getSettingValue('media-permissions');
    this.setState({ mediaSetting });
  }

  public componentDidMount() {
    setTimeout(() => ($('#password-lock-input') as any).focus(), 100);
  }

  /* tslint:disable-next-line:max-func-body-length */
  public renderSettingInCategory() {
    const { category } = this.props;

    let settings: Array<LocalSettingType>;

    if (category === SessionSettingCategory.Blocked) {
      // special case for blocked user
      settings = this.getBlockedUserSettings();
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
            const storedSetting = window.getSettingValue(
              setting.id,
              comparisonValue
            );
            const value =
              storedSetting !== undefined
                ? storedSetting
                : setting.content && setting.content.defaultValue;

            const sliderFn =
              setting.type === SessionSettingType.Slider
                ? (settingValue: any) =>
                    window.setSettingValue(setting.id, settingValue)
                : () => null;

            const onClickFn =
              setting.onClick ||
              ((settingValue?: string) => {
                this.updateSetting(setting, settingValue);
              });

            return (
              <div key={setting.id}>
                {shouldRenderSettings && !setting.hidden && (
                  <SessionSettingListItem
                    title={setting.title}
                    description={description}
                    type={setting.type}
                    value={value}
                    onClick={onClickFn}
                    onSliderChange={sliderFn}
                    content={content}
                    confirmationDialogParams={setting.confirmationDialogParams}
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
            placeholder="Password"
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
            text={window.i18n('ok')}
            onClick={this.validatePasswordLock}
          />
        </div>
      </div>
    );
  }

  public async validatePasswordLock() {
    const enteredPassword = String(jQuery('#password-lock-input').val());

    if (!enteredPassword) {
      this.setState({
        pwdLockError: window.i18n('noGivenPassword'),
      });

      return false;
    }

    // Check if the password matches the hash we have stored
    const hash = await getPasswordHash();
    if (hash && !PasswordUtil.matchesHash(enteredPassword, hash)) {
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
          category={category}
          categoryTitle={window.i18n(`${category}SettingsTitle`)}
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
        <span className="text-selectable">v{window.versionInfo.version}</span>
        <span className="text-selectable">{window.versionInfo.commitHash}</span>
      </div>
    );
  }

  public setOptionsSetting(settingID: string, selectedValue: string) {
    window.setSettingValue(settingID, selectedValue);
  }

  public async hasPassword() {
    const hash = await getPasswordHash();

    this.setState({
      hasPassword: !!hash,
    });
  }

  public updateSetting(item: any, value?: string) {
    // If there's a custom afterClick function,
    // execute it instead of automatically updating settings

    if (item.setFn) {
      if (value) {
        item.setFn(value);
      } else {
        item.setFn();
      }
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

  // tslint:disable-next-line: max-func-body-length
  private getLocalSettings(): Array<LocalSettingType> {
    const { Settings } = window.Signal.Types;

    return [
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
        content: { defaultValue: true },
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
          title: window.i18n('linkPreviewsTitle'),
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
        setFn: (selectedValue: string) => {
          this.setOptionsSetting('notification-setting', selectedValue);
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
        id: 'media-permissions',
        title: window.i18n('mediaPermissionsTitle'),
        description: window.i18n('mediaPermissionsDescription'),
        hidden: false,
        type: SessionSettingType.Toggle,
        category: SessionSettingCategory.Privacy,
        setFn: window.toggleMediaPermissions,
        content: undefined,
        comparisonValue: undefined,
        onClick: undefined,
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
        id: 'auto-update',
        title: window.i18n('autoUpdateSettingTitle'),
        description: window.i18n('autoUpdateSettingDescription'),
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
        onClick: () => {
          window.Whisper.events.trigger('showPasswordDialog', {
            action: 'set',
            onSuccess: this.onPasswordUpdated,
          });
        },
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
        onClick: () => {
          window.Whisper.events.trigger('showPasswordDialog', {
            action: 'change',
            onSuccess: this.onPasswordUpdated,
          });
        },
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
        onClick: () => {
          window.Whisper.events.trigger('showPasswordDialog', {
            action: 'remove',
            onSuccess: this.onPasswordUpdated,
          });
        },
        confirmationDialogParams: undefined,
      },
    ];
  }

  private getBlockedUserSettings(): Array<LocalSettingType> {
    const results: Array<LocalSettingType> = [];
    const blockedNumbers = BlockedNumberController.getBlockedNumbers();

    for (const blockedNumber of blockedNumbers) {
      let title: string;

      const currentModel = ConversationController.getInstance().get(
        blockedNumber
      );
      if (currentModel) {
        title =
          currentModel.getProfileName() ||
          currentModel.getName() ||
          window.i18n('anonymous');
      } else {
        title = window.i18n('anonymous');
      }

      results.push({
        id: blockedNumber,
        title,
        description: '',
        type: SessionSettingType.Button,
        category: SessionSettingCategory.Blocked,
        content: {
          buttonColor: SessionButtonColor.Danger,
          buttonText: window.i18n('unblockUser'),
        },
        comparisonValue: undefined,
        setFn: async () => {
          if (currentModel) {
            await currentModel.unblock();
          } else {
            await BlockedNumberController.unblock(blockedNumber);
            this.forceUpdate();
          }
          ToastUtils.pushToastSuccess('unblocked', window.i18n('unblocked'));
        },
        hidden: false,
        onClick: undefined,
        confirmationDialogParams: undefined,
      });
    }

    if (blockedNumbers.length === 0) {
      return [
        {
          id: 'noBlockedContacts',
          title: '',
          description: window.i18n('noBlockedContacts'),
          type: undefined,
          category: SessionSettingCategory.Blocked,
          content: undefined,
          comparisonValue: undefined,
          setFn: undefined,
          hidden: false,
          onClick: undefined,
          confirmationDialogParams: undefined,
        },
      ];
    }

    return results;
  }

  private async onKeyUp(event: any) {
    const lockPasswordFocussed = ($('#password-lock-input') as any).is(
      ':focus'
    );

    if (event.key === 'Enter' && lockPasswordFocussed) {
      await this.validatePasswordLock();
    }

    event.preventDefault();
  }
}

const mapStateToProps = (state: StateType) => {
  return {
    conversations: getConversationLookup(state),
  };
};

const smart = connect(mapStateToProps);
export const SmartSettingsView = smart(SettingsViewInner);
