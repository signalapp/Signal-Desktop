import React from 'react';

import { SettingsHeader } from './SessionSettingsHeader';
import { SessionSettingListItem } from './SessionSettingListItem';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../SessionButton';
import { BlockedNumberController, PasswordUtil } from '../../../util';
import { ConversationLookupType } from '../../../state/ducks/conversations';
import { StateType } from '../../../state/reducer';
import { getConversationController } from '../../../session/conversations';
import { getConversationLookup } from '../../../state/selectors/conversations';
import { connect } from 'react-redux';
import {
  createOrUpdateItem,
  getPasswordHash,
  hasLinkPreviewPopupBeenDisplayed,
} from '../../../../ts/data/data';
import { shell } from 'electron';
import { mapDispatchToProps } from '../../../state/actions';
import { unblockConvoById } from '../../../interactions/conversationInteractions';
import { toggleAudioAutoplay } from '../../../state/ducks/userConfig';
import { sessionPassword, updateConfirmModal } from '../../../state/ducks/modalDialog';
import { PasswordAction } from '../../dialog/SessionPasswordDialog';
import { SessionIconButton } from '../icon';
import { ToastUtils } from '../../../session/utils';

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
  }

  public componentDidMount() {
    window.addEventListener('keyup', this.onKeyUp);

    const mediaSetting = window.getSettingValue('media-permissions');
    this.setState({ mediaSetting });

    setTimeout(() => ($('#password-lock-input') as any).focus(), 100);
  }

  public componentWillUnmount() {
    window.removeEventListener('keyup', this.onKeyUp);
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
            const storedSetting = window.getSettingValue(setting.id, comparisonValue);
            const value =
              storedSetting !== undefined
                ? storedSetting
                : setting.content && setting.content.defaultValue;

            const sliderFn =
              setting.type === SessionSettingType.Slider
                ? (settingValue: any) => window.setSettingValue(setting.id, settingValue)
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
          <input type="password" id="password-lock-input" defaultValue="" placeholder="Password" />

          {this.state.pwdLockError && (
            <div className="session-label warning">{this.state.pwdLockError}</div>
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
    const shouldRenderPasswordLock = this.state.shouldLockSettings && this.state.hasPassword;

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
    const openOxenWebsite = () => {
      void shell.openExternal('https://oxen.io/');
    };
    return (
      <div className="session-settings__version-info">
        <span className="text-selectable">v{window.versionInfo.version}</span>
        <span>
          <SessionIconButton iconSize={'medium'} iconType="oxen" onClick={openOxenWebsite} />
        </span>
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

  /**
   * If there's a custom afterClick function, execute it instead of automatically updating settings
   * @param item setting item
   * @param value new value to set
   */
  public updateSetting(item: any, value?: string) {
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
      },
      {
        id: 'link-preview-setting',
        title: window.i18n('linkPreviewsTitle'),
        description: window.i18n('linkPreviewDescription'),
        hidden: false,
        type: SessionSettingType.Toggle,
        category: SessionSettingCategory.Appearance,
        setFn: async () => {
          const newValue = !window.getSettingValue('link-preview-setting');
          window.setSettingValue('link-preview-setting', newValue);
          if (!newValue) {
            await createOrUpdateItem({ id: hasLinkPreviewPopupBeenDisplayed, value: false });
          } else {
            window.inboxStore?.dispatch(
              updateConfirmModal({
                title: window.i18n('linkPreviewsTitle'),
                message: window.i18n('linkPreviewsConfirmMessage'),
                okTheme: SessionButtonColor.Danger,
                // onClickOk:
              })
            );
          }
        },
        content: undefined,
        comparisonValue: undefined,
        onClick: undefined,
      },

      {
        id: 'start-in-tray-setting',
        title: window.i18n('startInTrayTitle'),
        description: window.i18n('startInTrayDescription'),
        hidden: false,
        type: SessionSettingType.Toggle,
        category: SessionSettingCategory.Appearance,
        setFn: async () => {
          try {
            const newValue = !(await window.getStartInTray());

            // make sure to write it here too, as this is the value used on the UI to mark the toggle as true/false
            window.setSettingValue('start-in-tray-setting', newValue);
            await window.setStartInTray(newValue);
            if (!newValue) {
              ToastUtils.pushRestartNeeded();
            }
          } catch (e) {
            window.log.warn('start in tray change error:', e);
          }
        },
        content: undefined,
        comparisonValue: undefined,
        onClick: undefined,
      },
      {
        id: 'audio-message-autoplay-setting',
        title: window.i18n('audioMessageAutoplayTitle'),
        description: window.i18n('audioMessageAutoplayDescription'),
        hidden: false,
        type: SessionSettingType.Toggle,
        category: SessionSettingCategory.Appearance,
        setFn: () => {
          window.inboxStore?.dispatch(toggleAudioAutoplay());
        },
        content: {
          defaultValue: window.inboxStore?.getState().userConfig.audioAutoplay,
        },
        comparisonValue: undefined,
        onClick: undefined,
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
            initialItem: window.getSettingValue('notification-setting') || 'message',
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
      },
      {
        id: 'session-survey',
        title: window.i18n('surveyTitle'),
        description: undefined,
        hidden: false,
        type: SessionSettingType.Button,
        category: SessionSettingCategory.Appearance,
        setFn: undefined,
        comparisonValue: undefined,
        onClick: () => {
          void shell.openExternal('https://getsession.org/survey');
        },
        content: {
          buttonText: window.i18n('goToOurSurvey'),
          buttonColor: SessionButtonColor.Primary,
        },
      },
      {
        id: 'help-translation',
        title: window.i18n('translation'),
        description: undefined,
        hidden: false,
        type: SessionSettingType.Button,
        category: SessionSettingCategory.Appearance,
        setFn: undefined,
        comparisonValue: undefined,
        onClick: () => {
          void shell.openExternal('https://crowdin.com/project/session-desktop/');
        },
        content: {
          buttonText: window.i18n('helpUsTranslateSession'),
          buttonColor: SessionButtonColor.Primary,
        },
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
          this.displayPasswordModal('set');
        },
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
          this.displayPasswordModal('change');
        },
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
          this.displayPasswordModal('remove');
        },
      },
    ];
  }

  private displayPasswordModal(passwordAction: PasswordAction) {
    window.inboxStore?.dispatch(
      sessionPassword({
        passwordAction,
        onOk: () => {
          this.onPasswordUpdated(passwordAction);
        },
      })
    );
  }

  private getBlockedUserSettings(): Array<LocalSettingType> {
    const results: Array<LocalSettingType> = [];
    const blockedNumbers = BlockedNumberController.getBlockedNumbers();

    for (const blockedNumber of blockedNumbers) {
      let title: string;

      const currentModel = getConversationController().get(blockedNumber);
      if (currentModel) {
        title = currentModel.getProfileName() || currentModel.getName() || window.i18n('anonymous');
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
          await unblockConvoById(blockedNumber);

          this.forceUpdate();
        },
        hidden: false,
        onClick: undefined,
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
        },
      ];
    }

    return results;
  }

  private async onKeyUp(event: any) {
    const lockPasswordFocussed = ($('#password-lock-input') as any).is(':focus');

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

const smart = connect(mapStateToProps, mapDispatchToProps);
export const SmartSettingsView = smart(SettingsViewInner);
