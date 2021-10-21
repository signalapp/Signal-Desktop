import { shell } from 'electron';
import { createOrUpdateItem, hasLinkPreviewPopupBeenDisplayed } from '../../../data/data';
import { ToastUtils } from '../../../session/utils';
import { sessionPassword, updateConfirmModal } from '../../../state/ducks/modalDialog';
import { toggleAudioAutoplay } from '../../../state/ducks/userConfig';
import { PasswordAction } from '../../dialog/SessionPasswordDialog';
import { SessionButtonColor } from '../SessionButton';

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

export type LocalSettingType = {
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
};

function setNotificationSetting(settingID: string, selectedValue: string) {
  window.setSettingValue(settingID, selectedValue);
}

function displayPasswordModal(
  passwordAction: PasswordAction,
  onPasswordUpdated: (action: string) => void
) {
  window.inboxStore?.dispatch(
    sessionPassword({
      passwordAction,
      onOk: () => {
        onPasswordUpdated(passwordAction);
      },
    })
  );
}

// tslint:disable-next-line: max-func-body-length
export function getLocalSettings(
  hasPassword: boolean | null,
  onPasswordUpdated: (action: string) => void,
  forceUpdate: () => void
): Array<LocalSettingType> {
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
        setNotificationSetting('notification-setting', selectedValue);
        forceUpdate();
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
      setFn: async () => {
        await window.toggleMediaPermissions();
        forceUpdate();
      },
      content: undefined,
      comparisonValue: undefined,
      onClick: undefined,
    },
    {
      id: 'call-media-permissions',
      title: window.i18n('callMediaPermissionsTitle'),
      description: window.i18n('callMediaPermissionsDescription'),
      hidden: false,
      type: SessionSettingType.Toggle,
      category: SessionSettingCategory.Privacy,
      setFn: async () => {
        const currentValue = window.getCallMediaPermissions();
        if (!currentValue) {
          window.inboxStore?.dispatch(
            updateConfirmModal({
              message: window.i18n('callMediaPermissionsDialogContent'),
              okTheme: SessionButtonColor.Green,
              onClickOk: async () => {
                await window.toggleCallMediaPermissionsTo(true);
                forceUpdate();
              },
              onClickCancel: async () => {
                await window.toggleCallMediaPermissionsTo(false);
                forceUpdate();
              },
            })
          );
        } else {
          await window.toggleCallMediaPermissionsTo(false);
          forceUpdate();
        }
      },

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
      hidden: hasPassword,
      type: SessionSettingType.Button,
      category: SessionSettingCategory.Privacy,
      setFn: undefined,
      comparisonValue: undefined,
      content: {
        buttonText: window.i18n('setPassword'),
        buttonColor: SessionButtonColor.Primary,
      },
      onClick: () => {
        displayPasswordModal('set', onPasswordUpdated);
      },
    },
    {
      id: 'change-password',
      title: window.i18n('changeAccountPasswordTitle'),
      description: window.i18n('changeAccountPasswordDescription'),
      hidden: !hasPassword,
      type: SessionSettingType.Button,
      category: SessionSettingCategory.Privacy,
      setFn: undefined,
      comparisonValue: undefined,
      content: {
        buttonText: window.i18n('changePassword'),
        buttonColor: SessionButtonColor.Primary,
      },
      onClick: () => {
        displayPasswordModal('change', onPasswordUpdated);
      },
    },
    {
      id: 'remove-password',
      title: window.i18n('removeAccountPasswordTitle'),
      description: window.i18n('removeAccountPasswordDescription'),
      hidden: !hasPassword,
      type: SessionSettingType.Button,
      category: SessionSettingCategory.Privacy,
      setFn: undefined,
      comparisonValue: undefined,
      content: {
        buttonText: window.i18n('removePassword'),
        buttonColor: SessionButtonColor.Danger,
      },
      onClick: () => {
        displayPasswordModal('remove', onPasswordUpdated);
      },
    },
  ];
}
