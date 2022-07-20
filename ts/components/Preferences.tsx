// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useEffect, useState, useCallback } from 'react';
import { noop } from 'lodash';
import classNames from 'classnames';
import type { AudioDevice } from 'ringrtc';

import type { MediaDeviceSettings } from '../types/Calling';
import type {
  ZoomFactorType,
  NotificationSettingType,
} from '../types/Storage.d';
import type { ThemeSettingType } from '../types/StorageUIKeys';
import { Button, ButtonVariant } from './Button';
import { ChatColorPicker } from './ChatColorPicker';
import { Checkbox } from './Checkbox';
import { ConfirmationDialog } from './ConfirmationDialog';
import type { ConversationType } from '../state/ducks/conversations';
import type {
  ConversationColorType,
  CustomColorType,
  DefaultConversationColorType,
} from '../types/Colors';
import { DisappearingTimeDialog } from './DisappearingTimeDialog';
import type { LocalizerType, ThemeType } from '../types/Util';
import { PhoneNumberDiscoverability } from '../util/phoneNumberDiscoverability';
import { PhoneNumberSharingMode } from '../util/phoneNumberSharingMode';
import { Select } from './Select';
import { Spinner } from './Spinner';
import { TitleBarContainer } from './TitleBarContainer';
import type { ExecuteMenuRoleType } from './TitleBarContainer';
import { getCustomColorStyle } from '../util/getCustomColorStyle';
import {
  DEFAULT_DURATIONS_IN_SECONDS,
  DEFAULT_DURATIONS_SET,
  format as formatExpirationTimer,
} from '../util/expirationTimer';
import { useEscapeHandling } from '../hooks/useEscapeHandling';
import { useUniqueId } from '../hooks/useUniqueId';
import { useTheme } from '../hooks/useTheme';

type CheckboxChangeHandlerType = (value: boolean) => unknown;
type SelectChangeHandlerType<T = string | number> = (value: T) => unknown;

export type PropsDataType = {
  // Settings
  blockedCount: number;
  customColors: Record<string, CustomColorType>;
  defaultConversationColor: DefaultConversationColorType;
  deviceName?: string;
  hasAudioNotifications?: boolean;
  hasAutoDownloadUpdate: boolean;
  hasAutoLaunch: boolean;
  hasCallNotifications: boolean;
  hasCallRingtoneNotification: boolean;
  hasCountMutedConversations: boolean;
  hasHideMenuBar?: boolean;
  hasIncomingCallNotifications: boolean;
  hasLinkPreviews: boolean;
  hasMediaCameraPermissions: boolean;
  hasMediaPermissions: boolean;
  hasMinimizeToAndStartInSystemTray: boolean;
  hasMinimizeToSystemTray: boolean;
  hasNotificationAttention: boolean;
  hasNotifications: boolean;
  hasReadReceipts: boolean;
  hasRelayCalls?: boolean;
  hasSpellCheck: boolean;
  hasStoriesEnabled: boolean;
  hasTypingIndicators: boolean;
  lastSyncTime?: number;
  notificationContent: NotificationSettingType;
  selectedCamera?: string;
  selectedMicrophone?: AudioDevice;
  selectedSpeaker?: AudioDevice;
  themeSetting: ThemeSettingType;
  universalExpireTimer: number;
  whoCanFindMe: PhoneNumberDiscoverability;
  whoCanSeeMe: PhoneNumberSharingMode;
  zoomFactor: ZoomFactorType;

  // Other props
  hasCustomTitleBar: boolean;
  initialSpellCheckSetting: boolean;
  shouldShowStoriesSettings: boolean;

  // Limited support features
  isAudioNotificationsSupported: boolean;
  isAutoDownloadUpdatesSupported: boolean;
  isAutoLaunchSupported: boolean;
  isHideMenuBarSupported: boolean;
  isNotificationAttentionSupported: boolean;
  isPhoneNumberSharingSupported: boolean;
  isSyncSupported: boolean;
  isSystemTraySupported: boolean;

  availableCameras: Array<
    Pick<MediaDeviceInfo, 'deviceId' | 'groupId' | 'kind' | 'label'>
  >;
} & Omit<MediaDeviceSettings, 'availableCameras'>;

type PropsFunctionType = {
  // Other props
  addCustomColor: (color: CustomColorType) => unknown;
  closeSettings: () => unknown;
  doDeleteAllData: () => unknown;
  doneRendering: () => unknown;
  editCustomColor: (colorId: string, color: CustomColorType) => unknown;
  executeMenuRole: ExecuteMenuRoleType;
  getConversationsWithCustomColor: (
    colorId: string
  ) => Promise<Array<ConversationType>>;
  makeSyncRequest: () => unknown;
  removeCustomColor: (colorId: string) => unknown;
  removeCustomColorOnConversations: (colorId: string) => unknown;
  resetAllChatColors: () => unknown;
  resetDefaultChatColor: () => unknown;
  setGlobalDefaultConversationColor: (
    color: ConversationColorType,
    customColorData?: {
      id: string;
      value: CustomColorType;
    }
  ) => unknown;

  // Change handlers
  onAudioNotificationsChange: CheckboxChangeHandlerType;
  onAutoDownloadUpdateChange: CheckboxChangeHandlerType;
  onAutoLaunchChange: CheckboxChangeHandlerType;
  onCallNotificationsChange: CheckboxChangeHandlerType;
  onCallRingtoneNotificationChange: CheckboxChangeHandlerType;
  onCountMutedConversationsChange: CheckboxChangeHandlerType;
  onHasStoriesEnabledChanged: SelectChangeHandlerType<boolean>;
  onHideMenuBarChange: CheckboxChangeHandlerType;
  onIncomingCallNotificationsChange: CheckboxChangeHandlerType;
  onLastSyncTimeChange: (time: number) => unknown;
  onMediaCameraPermissionsChange: CheckboxChangeHandlerType;
  onMediaPermissionsChange: CheckboxChangeHandlerType;
  onMinimizeToAndStartInSystemTrayChange: CheckboxChangeHandlerType;
  onMinimizeToSystemTrayChange: CheckboxChangeHandlerType;
  onNotificationAttentionChange: CheckboxChangeHandlerType;
  onNotificationContentChange: SelectChangeHandlerType<NotificationSettingType>;
  onNotificationsChange: CheckboxChangeHandlerType;
  onRelayCallsChange: CheckboxChangeHandlerType;
  onSelectedCameraChange: SelectChangeHandlerType<string | undefined>;
  onSelectedMicrophoneChange: SelectChangeHandlerType<AudioDevice | undefined>;
  onSelectedSpeakerChange: SelectChangeHandlerType<AudioDevice | undefined>;
  onSpellCheckChange: CheckboxChangeHandlerType;
  onThemeChange: SelectChangeHandlerType<ThemeType>;
  onUniversalExpireTimerChange: SelectChangeHandlerType<number>;
  onZoomFactorChange: SelectChangeHandlerType<ZoomFactorType>;

  // Localization
  i18n: LocalizerType;
};

export type PropsType = PropsDataType & PropsFunctionType;

enum Page {
  // Accessible through left nav
  General = 'General',
  Appearance = 'Appearance',
  Chats = 'Chats',
  Calls = 'Calls',
  Notifications = 'Notifications',
  Privacy = 'Privacy',

  // Sub pages
  ChatColor = 'ChatColor',
}

const DEFAULT_ZOOM_FACTORS = [
  {
    text: '75%',
    value: 0.75,
  },
  {
    text: '100%',
    value: 1,
  },
  {
    text: '125%',
    value: 1.25,
  },
  {
    text: '150%',
    value: 1.5,
  },
  {
    text: '200%',
    value: 2,
  },
];

export const Preferences = ({
  addCustomColor,
  availableCameras,
  availableMicrophones,
  availableSpeakers,
  blockedCount,
  closeSettings,
  customColors,
  defaultConversationColor,
  deviceName = '',
  doDeleteAllData,
  doneRendering,
  editCustomColor,
  executeMenuRole,
  getConversationsWithCustomColor,
  hasAudioNotifications,
  hasAutoDownloadUpdate,
  hasAutoLaunch,
  hasCallNotifications,
  hasCallRingtoneNotification,
  hasCountMutedConversations,
  hasHideMenuBar,
  hasIncomingCallNotifications,
  hasLinkPreviews,
  hasMediaCameraPermissions,
  hasMediaPermissions,
  hasMinimizeToAndStartInSystemTray,
  hasMinimizeToSystemTray,
  hasNotificationAttention,
  hasNotifications,
  hasReadReceipts,
  hasRelayCalls,
  hasSpellCheck,
  hasStoriesEnabled,
  hasTypingIndicators,
  i18n,
  initialSpellCheckSetting,
  isAudioNotificationsSupported,
  isAutoDownloadUpdatesSupported,
  isAutoLaunchSupported,
  isHideMenuBarSupported,
  isPhoneNumberSharingSupported,
  isNotificationAttentionSupported,
  isSyncSupported,
  isSystemTraySupported,
  hasCustomTitleBar,
  lastSyncTime,
  makeSyncRequest,
  notificationContent,
  onAudioNotificationsChange,
  onAutoDownloadUpdateChange,
  onAutoLaunchChange,
  onCallNotificationsChange,
  onCallRingtoneNotificationChange,
  onCountMutedConversationsChange,
  onHasStoriesEnabledChanged,
  onHideMenuBarChange,
  onIncomingCallNotificationsChange,
  onLastSyncTimeChange,
  onMediaCameraPermissionsChange,
  onMediaPermissionsChange,
  onMinimizeToAndStartInSystemTrayChange,
  onMinimizeToSystemTrayChange,
  onNotificationAttentionChange,
  onNotificationContentChange,
  onNotificationsChange,
  onRelayCallsChange,
  onSelectedCameraChange,
  onSelectedMicrophoneChange,
  onSelectedSpeakerChange,
  onSpellCheckChange,
  onThemeChange,
  onUniversalExpireTimerChange,
  onZoomFactorChange,
  removeCustomColor,
  removeCustomColorOnConversations,
  resetAllChatColors,
  resetDefaultChatColor,
  selectedCamera,
  selectedMicrophone,
  selectedSpeaker,
  setGlobalDefaultConversationColor,
  shouldShowStoriesSettings,
  themeSetting,
  universalExpireTimer = 0,
  whoCanFindMe,
  whoCanSeeMe,
  zoomFactor,
}: PropsType): JSX.Element => {
  const storiesId = useUniqueId();
  const themeSelectId = useUniqueId();
  const zoomSelectId = useUniqueId();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [page, setPage] = useState<Page>(Page.General);
  const [showSyncFailed, setShowSyncFailed] = useState(false);
  const [nowSyncing, setNowSyncing] = useState(false);
  const [showDisappearingTimerDialog, setShowDisappearingTimerDialog] =
    useState(false);
  const theme = useTheme();

  useEffect(() => {
    doneRendering();
  }, [doneRendering]);

  useEscapeHandling(closeSettings);

  const onZoomSelectChange = useCallback(
    (value: string) => {
      const number = parseFloat(value);
      onZoomFactorChange(number as unknown as ZoomFactorType);
    },
    [onZoomFactorChange]
  );

  const onAudioInputSelectChange = useCallback(
    (value: string) => {
      if (value === 'undefined') {
        onSelectedMicrophoneChange(undefined);
      } else {
        onSelectedMicrophoneChange(availableMicrophones[parseInt(value, 10)]);
      }
    },
    [onSelectedMicrophoneChange, availableMicrophones]
  );

  const onAudioOutputSelectChange = useCallback(
    (value: string) => {
      if (value === 'undefined') {
        onSelectedSpeakerChange(undefined);
      } else {
        onSelectedSpeakerChange(availableSpeakers[parseInt(value, 10)]);
      }
    },
    [onSelectedSpeakerChange, availableSpeakers]
  );

  let settings: JSX.Element | undefined;
  if (page === Page.General) {
    settings = (
      <>
        <div className="Preferences__title">
          <div className="Preferences__title--header">
            {i18n('Preferences__button--general')}
          </div>
        </div>
        <SettingsRow>
          <Control left={i18n('Preferences--device-name')} right={deviceName} />
        </SettingsRow>
        <SettingsRow title={i18n('Preferences--system')}>
          {isAutoLaunchSupported && (
            <Checkbox
              checked={hasAutoLaunch}
              label={i18n('autoLaunchDescription')}
              moduleClassName="Preferences__checkbox"
              name="autoLaunch"
              onChange={onAutoLaunchChange}
            />
          )}
          {isHideMenuBarSupported && (
            <Checkbox
              checked={hasHideMenuBar}
              label={i18n('hideMenuBar')}
              moduleClassName="Preferences__checkbox"
              name="hideMenuBar"
              onChange={onHideMenuBarChange}
            />
          )}
          {isSystemTraySupported && (
            <>
              <Checkbox
                checked={hasMinimizeToSystemTray}
                label={i18n('SystemTraySetting__minimize-to-system-tray')}
                moduleClassName="Preferences__checkbox"
                name="system-tray-setting-minimize-to-system-tray"
                onChange={onMinimizeToSystemTrayChange}
              />
              <Checkbox
                checked={hasMinimizeToAndStartInSystemTray}
                disabled={!hasMinimizeToSystemTray}
                label={i18n(
                  'SystemTraySetting__minimize-to-and-start-in-system-tray'
                )}
                moduleClassName="Preferences__checkbox"
                name="system-tray-setting-minimize-to-and-start-in-system-tray"
                onChange={onMinimizeToAndStartInSystemTrayChange}
              />
            </>
          )}
        </SettingsRow>
        <SettingsRow title={i18n('permissions')}>
          <Checkbox
            checked={hasMediaPermissions}
            label={i18n('mediaPermissionsDescription')}
            moduleClassName="Preferences__checkbox"
            name="mediaPermissions"
            onChange={onMediaPermissionsChange}
          />
          <Checkbox
            checked={hasMediaCameraPermissions}
            label={i18n('mediaCameraPermissionsDescription')}
            moduleClassName="Preferences__checkbox"
            name="mediaCameraPermissions"
            onChange={onMediaCameraPermissionsChange}
          />
        </SettingsRow>
        {isAutoDownloadUpdatesSupported && (
          <SettingsRow title={i18n('Preferences--updates')}>
            <Checkbox
              checked={hasAutoDownloadUpdate}
              label={i18n('Preferences__download-update')}
              moduleClassName="Preferences__checkbox"
              name="autoDownloadUpdate"
              onChange={onAutoDownloadUpdateChange}
            />
          </SettingsRow>
        )}
      </>
    );
  } else if (page === Page.Appearance) {
    let zoomFactors = DEFAULT_ZOOM_FACTORS;

    if (!zoomFactors.some(({ value }) => value === zoomFactor)) {
      zoomFactors = [
        ...zoomFactors,
        {
          text: `${Math.round(zoomFactor * 100)}%`,
          value: zoomFactor,
        },
      ].sort((a, b) => a.value - b.value);
    }

    settings = (
      <>
        <div className="Preferences__title">
          <div className="Preferences__title--header">
            {i18n('Preferences__button--appearance')}
          </div>
        </div>
        <SettingsRow>
          <Control
            left={
              <label htmlFor={themeSelectId}>
                {i18n('Preferences--theme')}
              </label>
            }
            right={
              <Select
                id={themeSelectId}
                onChange={onThemeChange}
                options={[
                  {
                    text: i18n('themeSystem'),
                    value: 'system',
                  },
                  {
                    text: i18n('themeLight'),
                    value: 'light',
                  },
                  {
                    text: i18n('themeDark'),
                    value: 'dark',
                  },
                ]}
                value={themeSetting}
              />
            }
          />
          <Control
            left={i18n('showChatColorEditor')}
            onClick={() => {
              setPage(Page.ChatColor);
            }}
            right={
              <div
                className={`ConversationDetails__chat-color ConversationDetails__chat-color--${defaultConversationColor.color}`}
                style={{
                  ...getCustomColorStyle(
                    defaultConversationColor.customColorData?.value
                  ),
                }}
              />
            }
          />
          <Control
            left={
              <label htmlFor={zoomSelectId}>{i18n('Preferences--zoom')}</label>
            }
            right={
              <Select
                id={zoomSelectId}
                onChange={onZoomSelectChange}
                options={zoomFactors}
                value={zoomFactor}
              />
            }
          />
        </SettingsRow>
      </>
    );
  } else if (page === Page.Chats) {
    let spellCheckDirtyText: string | undefined;
    if (initialSpellCheckSetting !== hasSpellCheck) {
      spellCheckDirtyText = hasSpellCheck
        ? i18n('spellCheckWillBeEnabled')
        : i18n('spellCheckWillBeDisabled');
    }

    const lastSyncDate = new Date(lastSyncTime || 0);

    settings = (
      <>
        <div className="Preferences__title">
          <div className="Preferences__title--header">
            {i18n('Preferences__button--chats')}
          </div>
        </div>
        <SettingsRow title={i18n('Preferences__button--chats')}>
          <Checkbox
            checked={hasSpellCheck}
            description={spellCheckDirtyText}
            label={i18n('spellCheckDescription')}
            moduleClassName="Preferences__checkbox"
            name="spellcheck"
            onChange={onSpellCheckChange}
          />
          <Checkbox
            checked={hasLinkPreviews}
            description={i18n('Preferences__link-previews--description')}
            disabled
            label={i18n('Preferences__link-previews--title')}
            moduleClassName="Preferences__checkbox"
            name="linkPreviews"
            onChange={noop}
          />
        </SettingsRow>
        {isSyncSupported && (
          <SettingsRow>
            <Control
              left={
                <>
                  <div>{i18n('sync')}</div>
                  <div className="Preferences__description">
                    {i18n('syncExplanation')}{' '}
                    {i18n('Preferences--lastSynced', {
                      date: lastSyncDate.toLocaleDateString(),
                      time: lastSyncDate.toLocaleTimeString(),
                    })}
                  </div>
                  {showSyncFailed && (
                    <div className="Preferences__description Preferences__description--error">
                      {i18n('syncFailed')}
                    </div>
                  )}
                </>
              }
              right={
                <div className="Preferences__right-button">
                  <Button
                    disabled={nowSyncing}
                    onClick={async () => {
                      setShowSyncFailed(false);
                      setNowSyncing(true);
                      try {
                        await makeSyncRequest();
                        onLastSyncTimeChange(Date.now());
                      } catch (err) {
                        setShowSyncFailed(true);
                      } finally {
                        setNowSyncing(false);
                      }
                    }}
                    variant={ButtonVariant.SecondaryAffirmative}
                  >
                    {nowSyncing ? <Spinner svgSize="small" /> : i18n('syncNow')}
                  </Button>
                </div>
              }
            />
          </SettingsRow>
        )}
      </>
    );
  } else if (page === Page.Calls) {
    settings = (
      <>
        <div className="Preferences__title">
          <div className="Preferences__title--header">
            {i18n('Preferences__button--calls')}
          </div>
        </div>
        <SettingsRow title={i18n('calling')}>
          <Checkbox
            checked={hasIncomingCallNotifications}
            label={i18n('incomingCallNotificationDescription')}
            moduleClassName="Preferences__checkbox"
            name="incomingCallNotification"
            onChange={onIncomingCallNotificationsChange}
          />
          <Checkbox
            checked={hasCallRingtoneNotification}
            label={i18n('callRingtoneNotificationDescription')}
            moduleClassName="Preferences__checkbox"
            name="callRingtoneNotification"
            onChange={onCallRingtoneNotificationChange}
          />
        </SettingsRow>
        <SettingsRow title={i18n('Preferences__devices')}>
          <Control
            left={
              <>
                <label className="Preferences__select-title" htmlFor="video">
                  {i18n('callingDeviceSelection__label--video')}
                </label>
                <Select
                  ariaLabel={i18n('callingDeviceSelection__label--video')}
                  disabled={!availableCameras.length}
                  moduleClassName="Preferences__select"
                  name="video"
                  onChange={onSelectedCameraChange}
                  options={
                    availableCameras.length
                      ? availableCameras.map(device => ({
                          text: localizeDefault(i18n, device.label),
                          value: device.deviceId,
                        }))
                      : [
                          {
                            text: i18n(
                              'callingDeviceSelection__select--no-device'
                            ),
                            value: 'undefined',
                          },
                        ]
                  }
                  value={selectedCamera}
                />
              </>
            }
            right={<div />}
          />
          <Control
            left={
              <>
                <label
                  className="Preferences__select-title"
                  htmlFor="audio-input"
                >
                  {i18n('callingDeviceSelection__label--audio-input')}
                </label>
                <Select
                  ariaLabel={i18n('callingDeviceSelection__label--audio-input')}
                  disabled={!availableMicrophones.length}
                  moduleClassName="Preferences__select"
                  name="audio-input"
                  onChange={onAudioInputSelectChange}
                  options={
                    availableMicrophones.length
                      ? availableMicrophones.map(device => ({
                          text: localizeDefault(i18n, device.name),
                          value: device.index,
                        }))
                      : [
                          {
                            text: i18n(
                              'callingDeviceSelection__select--no-device'
                            ),
                            value: 'undefined',
                          },
                        ]
                  }
                  value={selectedMicrophone?.index}
                />
              </>
            }
            right={<div />}
          />
          <Control
            left={
              <>
                <label
                  className="Preferences__select-title"
                  htmlFor="audio-output"
                >
                  {i18n('callingDeviceSelection__label--audio-output')}
                </label>
                <Select
                  ariaLabel={i18n(
                    'callingDeviceSelection__label--audio-output'
                  )}
                  disabled={!availableSpeakers.length}
                  moduleClassName="Preferences__select"
                  name="audio-output"
                  onChange={onAudioOutputSelectChange}
                  options={
                    availableSpeakers.length
                      ? availableSpeakers.map(device => ({
                          text: localizeDefault(i18n, device.name),
                          value: device.index,
                        }))
                      : [
                          {
                            text: i18n(
                              'callingDeviceSelection__select--no-device'
                            ),
                            value: 'undefined',
                          },
                        ]
                  }
                  value={selectedSpeaker?.index}
                />
              </>
            }
            right={<div />}
          />
        </SettingsRow>
        <SettingsRow title={i18n('Preferences--advanced')}>
          <Checkbox
            checked={hasRelayCalls}
            description={i18n('alwaysRelayCallsDetail')}
            label={i18n('alwaysRelayCallsDescription')}
            moduleClassName="Preferences__checkbox"
            name="relayCalls"
            onChange={onRelayCallsChange}
          />
        </SettingsRow>
      </>
    );
  } else if (page === Page.Notifications) {
    settings = (
      <>
        <div className="Preferences__title">
          <div className="Preferences__title--header">
            {i18n('Preferences__button--notifications')}
          </div>
        </div>
        <SettingsRow>
          <Checkbox
            checked={hasNotifications}
            label={i18n('Preferences__enable-notifications')}
            moduleClassName="Preferences__checkbox"
            name="notifications"
            onChange={onNotificationsChange}
          />
          <Checkbox
            checked={hasCallNotifications}
            label={i18n('callSystemNotificationDescription')}
            moduleClassName="Preferences__checkbox"
            name="callSystemNotification"
            onChange={onCallNotificationsChange}
          />
          {isNotificationAttentionSupported && (
            <Checkbox
              checked={hasNotificationAttention}
              label={i18n('notificationDrawAttention')}
              moduleClassName="Preferences__checkbox"
              name="notificationDrawAttention"
              onChange={onNotificationAttentionChange}
            />
          )}
          {isAudioNotificationsSupported && (
            <Checkbox
              checked={hasAudioNotifications}
              label={i18n('audioNotificationDescription')}
              moduleClassName="Preferences__checkbox"
              name="audioNotification"
              onChange={onAudioNotificationsChange}
            />
          )}
          <Checkbox
            checked={hasCountMutedConversations}
            label={i18n('countMutedConversationsDescription')}
            moduleClassName="Preferences__checkbox"
            name="countMutedConversations"
            onChange={onCountMutedConversationsChange}
          />
        </SettingsRow>
        <SettingsRow>
          <Control
            left={i18n('Preferences--notification-content')}
            right={
              <Select
                ariaLabel={i18n('Preferences--notification-content')}
                disabled={!hasNotifications}
                onChange={onNotificationContentChange}
                options={[
                  {
                    text: i18n('nameAndMessage'),
                    value: 'message',
                  },
                  {
                    text: i18n('nameOnly'),
                    value: 'name',
                  },
                  {
                    text: i18n('noNameOrMessage'),
                    value: 'count',
                  },
                ]}
                value={notificationContent}
              />
            }
          />
        </SettingsRow>
      </>
    );
  } else if (page === Page.Privacy) {
    const isCustomDisappearingMessageValue =
      !DEFAULT_DURATIONS_SET.has(universalExpireTimer);

    settings = (
      <>
        <div className="Preferences__title">
          <div className="Preferences__title--header">
            {i18n('Preferences__button--privacy')}
          </div>
        </div>
        <SettingsRow>
          <Control
            left={i18n('Preferences--blocked')}
            right={
              blockedCount === 1
                ? i18n('Preferences--blocked-count-singular', [
                    String(blockedCount),
                  ])
                : i18n('Preferences--blocked-count-plural', [
                    String(blockedCount || 0),
                  ])
            }
          />
        </SettingsRow>
        {isPhoneNumberSharingSupported ? (
          <SettingsRow title={i18n('Preferences__who-can--title')}>
            <Control
              left={i18n('Preferences--see-me')}
              right={
                <Select
                  ariaLabel={i18n('Preferences--see-me')}
                  disabled
                  onChange={noop}
                  options={[
                    {
                      text: i18n('Preferences__who-can--everybody'),
                      value: PhoneNumberSharingMode.Everybody,
                    },
                    {
                      text: i18n('Preferences__who-can--contacts'),
                      value: PhoneNumberSharingMode.ContactsOnly,
                    },
                    {
                      text: i18n('Preferences__who-can--nobody'),
                      value: PhoneNumberSharingMode.Nobody,
                    },
                  ]}
                  value={whoCanSeeMe}
                />
              }
            />
            <Control
              left={i18n('Preferences--find-me')}
              right={
                <Select
                  ariaLabel={i18n('Preferences--find-me')}
                  disabled
                  onChange={noop}
                  options={[
                    {
                      text: i18n('Preferences__who-can--everybody'),
                      value: PhoneNumberDiscoverability.Discoverable,
                    },
                    {
                      text: i18n('Preferences__who-can--nobody'),
                      value: PhoneNumberDiscoverability.NotDiscoverable,
                    },
                  ]}
                  value={whoCanFindMe}
                />
              }
            />
            <div className="Preferences__padding">
              <div className="Preferences__description">
                {i18n('Preferences__privacy--description')}
              </div>
            </div>
          </SettingsRow>
        ) : null}
        <SettingsRow title={i18n('Preferences--messaging')}>
          <Checkbox
            checked={hasReadReceipts}
            disabled
            label={i18n('Preferences--read-receipts')}
            moduleClassName="Preferences__checkbox"
            name="readReceipts"
            onChange={noop}
          />
          <Checkbox
            checked={hasTypingIndicators}
            disabled
            label={i18n('Preferences--typing-indicators')}
            moduleClassName="Preferences__checkbox"
            name="typingIndicators"
            onChange={noop}
          />
          <div className="Preferences__padding">
            <div className="Preferences__description">
              {i18n('Preferences__privacy--description')}
            </div>
          </div>
        </SettingsRow>
        {showDisappearingTimerDialog && (
          <DisappearingTimeDialog
            i18n={i18n}
            initialValue={universalExpireTimer}
            onClose={() => setShowDisappearingTimerDialog(false)}
            onSubmit={onUniversalExpireTimerChange}
          />
        )}
        <SettingsRow title={i18n('disappearingMessages')}>
          <Control
            left={
              <>
                <div>
                  {i18n('settings__DisappearingMessages__timer__label')}
                </div>
                <div className="Preferences__description">
                  {i18n('settings__DisappearingMessages__footer')}
                </div>
              </>
            }
            right={
              <Select
                ariaLabel={i18n('settings__DisappearingMessages__timer__label')}
                onChange={value => {
                  if (
                    value === String(universalExpireTimer) ||
                    value === '-1'
                  ) {
                    setShowDisappearingTimerDialog(true);
                    return;
                  }

                  onUniversalExpireTimerChange(parseInt(value, 10));
                }}
                options={DEFAULT_DURATIONS_IN_SECONDS.map(seconds => {
                  const text = formatExpirationTimer(i18n, seconds, {
                    capitalizeOff: true,
                  });
                  return {
                    value: seconds,
                    text,
                  };
                }).concat([
                  {
                    value: isCustomDisappearingMessageValue
                      ? universalExpireTimer
                      : -1,
                    text: isCustomDisappearingMessageValue
                      ? formatExpirationTimer(i18n, universalExpireTimer)
                      : i18n('selectedCustomDisappearingTimeOption'),
                  },
                ])}
                value={universalExpireTimer}
              />
            }
          />
        </SettingsRow>
        {shouldShowStoriesSettings && (
          <SettingsRow title={i18n('Stories__title')}>
            <Control
              left={
                <label htmlFor={storiesId}>
                  <div>{i18n('Stories__settings-toggle--title')}</div>
                  <div className="Preferences__description">
                    {i18n('Stories__settings-toggle--description')}
                  </div>
                </label>
              }
              right={
                <Select
                  id={storiesId}
                  onChange={value => {
                    onHasStoriesEnabledChanged(value === 'true');
                  }}
                  options={[
                    {
                      text: i18n('on'),
                      value: 'true',
                    },
                    {
                      text: i18n('off'),
                      value: 'false',
                    },
                  ]}
                  value={String(hasStoriesEnabled)}
                />
              }
            />
          </SettingsRow>
        )}
        <SettingsRow>
          <Control
            left={
              <>
                <div>{i18n('clearDataHeader')}</div>
                <div className="Preferences__description">
                  {i18n('clearDataExplanation')}
                </div>
              </>
            }
            right={
              <div className="Preferences__right-button">
                <Button
                  onClick={() => setConfirmDelete(true)}
                  variant={ButtonVariant.SecondaryDestructive}
                >
                  {i18n('clearDataButton')}
                </Button>
              </div>
            }
          />
        </SettingsRow>
        {confirmDelete ? (
          <ConfirmationDialog
            actions={[
              {
                action: doDeleteAllData,
                style: 'negative',
                text: i18n('clearDataButton'),
              },
            ]}
            i18n={i18n}
            onClose={() => {
              setConfirmDelete(false);
            }}
            title={i18n('deleteAllDataHeader')}
          >
            {i18n('deleteAllDataBody')}
          </ConfirmationDialog>
        ) : null}
      </>
    );
  } else if (page === Page.ChatColor) {
    settings = (
      <>
        <div className="Preferences__title">
          <button
            aria-label={i18n('goBack')}
            className="Preferences__back-icon"
            onClick={() => setPage(Page.Appearance)}
            type="button"
          />
          <div className="Preferences__title--header">
            {i18n('ChatColorPicker__menu-title')}
          </div>
        </div>
        <ChatColorPicker
          customColors={customColors}
          getConversationsWithCustomColor={getConversationsWithCustomColor}
          i18n={i18n}
          isGlobal
          selectedColor={defaultConversationColor.color}
          selectedCustomColor={defaultConversationColor.customColorData || {}}
          // actions
          addCustomColor={addCustomColor}
          colorSelected={noop}
          editCustomColor={editCustomColor}
          removeCustomColor={removeCustomColor}
          removeCustomColorOnConversations={removeCustomColorOnConversations}
          resetAllChatColors={resetAllChatColors}
          resetDefaultChatColor={resetDefaultChatColor}
          setGlobalDefaultConversationColor={setGlobalDefaultConversationColor}
        />
      </>
    );
  }

  return (
    <TitleBarContainer
      hasCustomTitleBar={hasCustomTitleBar}
      theme={theme}
      executeMenuRole={executeMenuRole}
    >
      <div className="Preferences">
        <div className="Preferences__page-selector">
          <button
            type="button"
            className={classNames({
              Preferences__button: true,
              'Preferences__button--general': true,
              'Preferences__button--selected': page === Page.General,
            })}
            onClick={() => setPage(Page.General)}
          >
            {i18n('Preferences__button--general')}
          </button>
          <button
            type="button"
            className={classNames({
              Preferences__button: true,
              'Preferences__button--appearance': true,
              'Preferences__button--selected':
                page === Page.Appearance || page === Page.ChatColor,
            })}
            onClick={() => setPage(Page.Appearance)}
          >
            {i18n('Preferences__button--appearance')}
          </button>
          <button
            type="button"
            className={classNames({
              Preferences__button: true,
              'Preferences__button--chats': true,
              'Preferences__button--selected': page === Page.Chats,
            })}
            onClick={() => setPage(Page.Chats)}
          >
            {i18n('Preferences__button--chats')}
          </button>
          <button
            type="button"
            className={classNames({
              Preferences__button: true,
              'Preferences__button--calls': true,
              'Preferences__button--selected': page === Page.Calls,
            })}
            onClick={() => setPage(Page.Calls)}
          >
            {i18n('Preferences__button--calls')}
          </button>
          <button
            type="button"
            className={classNames({
              Preferences__button: true,
              'Preferences__button--notifications': true,
              'Preferences__button--selected': page === Page.Notifications,
            })}
            onClick={() => setPage(Page.Notifications)}
          >
            {i18n('Preferences__button--notifications')}
          </button>
          <button
            type="button"
            className={classNames({
              Preferences__button: true,
              'Preferences__button--privacy': true,
              'Preferences__button--selected': page === Page.Privacy,
            })}
            onClick={() => setPage(Page.Privacy)}
          >
            {i18n('Preferences__button--privacy')}
          </button>
        </div>
        <div className="Preferences__settings-pane">{settings}</div>
      </div>
    </TitleBarContainer>
  );
};

const SettingsRow = ({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}): JSX.Element => {
  return (
    <div className="Preferences__settings-row">
      {title && <h3 className="Preferences__padding">{title}</h3>}
      {children}
    </div>
  );
};

const Control = ({
  left,
  onClick,
  right,
}: {
  left: ReactNode;
  onClick?: () => unknown;
  right: ReactNode;
}): JSX.Element => {
  const content = (
    <>
      <div className="Preferences__control--key">{left}</div>
      <div className="Preferences__control--value">{right}</div>
    </>
  );

  if (onClick) {
    return (
      <button
        className="Preferences__control Preferences__control--clickable"
        type="button"
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div className="Preferences__control">{content}</div>;
};

function localizeDefault(i18n: LocalizerType, deviceLabel: string): string {
  return deviceLabel.toLowerCase().startsWith('default')
    ? deviceLabel.replace(
        /default/i,
        i18n('callingDeviceSelection__select--default')
      )
    : deviceLabel;
}
