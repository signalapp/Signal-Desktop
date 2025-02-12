// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AudioDevice } from '@signalapp/ringrtc';
import type { ReactNode } from 'react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { noop, partition } from 'lodash';
import classNames from 'classnames';
import { v4 as uuid } from 'uuid';
import * as LocaleMatcher from '@formatjs/intl-localematcher';

import type { MediaDeviceSettings } from '../types/Calling';
import type {
  NotificationSettingType,
  SentMediaQualitySettingType,
  ZoomFactorType,
} from '../types/Storage.d';
import type { ThemeSettingType } from '../types/StorageUIKeys';
import type { AnyToast } from '../types/Toast';
import { ToastType } from '../types/Toast';
import type { ConversationType } from '../state/ducks/conversations';
import type {
  ConversationColorType,
  CustomColorType,
  DefaultConversationColorType,
} from '../types/Colors';
import type {
  LocalizerType,
  SentMediaQualityType,
  ThemeType,
} from '../types/Util';

import { Button, ButtonVariant } from './Button';
import { ChatColorPicker } from './ChatColorPicker';
import { Checkbox } from './Checkbox';
import { WidthBreakpoint } from './_util';
import {
  CircleCheckbox,
  Variant as CircleCheckboxVariant,
} from './CircleCheckbox';
import { ConfirmationDialog } from './ConfirmationDialog';
import { DisappearingTimeDialog } from './DisappearingTimeDialog';
import { PhoneNumberDiscoverability } from '../util/phoneNumberDiscoverability';
import { PhoneNumberSharingMode } from '../util/phoneNumberSharingMode';
import { Select } from './Select';
import { Spinner } from './Spinner';
import { ToastManager } from './ToastManager';
import { getCustomColorStyle } from '../util/getCustomColorStyle';
import { shouldNeverBeCalled } from '../util/shouldNeverBeCalled';
import {
  DEFAULT_DURATIONS_IN_SECONDS,
  DEFAULT_DURATIONS_SET,
  format as formatExpirationTimer,
} from '../util/expirationTimer';
import { DurationInSeconds } from '../util/durations';
import { useEscapeHandling } from '../hooks/useEscapeHandling';
import { useUniqueId } from '../hooks/useUniqueId';
import { focusableSelector } from '../util/focusableSelectors';
import { Modal } from './Modal';
import { SearchInput } from './SearchInput';
import { removeDiacritics } from '../util/removeDiacritics';
import { assertDev } from '../util/assert';
import { I18n } from './I18n';

type CheckboxChangeHandlerType = (value: boolean) => unknown;
type SelectChangeHandlerType<T = string | number> = (value: T) => unknown;

export type PropsDataType = {
  // Settings
  blockedCount: number;
  customColors: Record<string, CustomColorType>;
  defaultConversationColor: DefaultConversationColorType;
  deviceName?: string;
  hasAudioNotifications?: boolean;
  hasAutoConvertEmoji: boolean;
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
  hasMessageAudio: boolean;
  hasMinimizeToAndStartInSystemTray: boolean;
  hasMinimizeToSystemTray: boolean;
  hasNotificationAttention: boolean;
  hasNotifications: boolean;
  hasReadReceipts: boolean;
  hasRelayCalls?: boolean;
  hasSpellCheck: boolean;
  hasStoriesDisabled: boolean;
  hasTextFormatting: boolean;
  hasTypingIndicators: boolean;
  lastSyncTime?: number;
  notificationContent: NotificationSettingType;
  phoneNumber: string | undefined;
  selectedCamera?: string;
  selectedMicrophone?: AudioDevice;
  selectedSpeaker?: AudioDevice;
  sentMediaQualitySetting: SentMediaQualitySettingType;
  themeSetting: ThemeSettingType;
  universalExpireTimer: DurationInSeconds;
  whoCanFindMe: PhoneNumberDiscoverability;
  whoCanSeeMe: PhoneNumberSharingMode;
  zoomFactor: ZoomFactorType;

  // Localization
  availableLocales: ReadonlyArray<string>;
  localeOverride: string | null;
  preferredSystemLocales: ReadonlyArray<string>;
  resolvedLocale: string;

  // Other props
  initialSpellCheckSetting: boolean;

  // Limited support features
  isAutoDownloadUpdatesSupported: boolean;
  isAutoLaunchSupported: boolean;
  isHideMenuBarSupported: boolean;
  isNotificationAttentionSupported: boolean;
  isSyncSupported: boolean;
  isSystemTraySupported: boolean;
  isMinimizeToAndStartInSystemTraySupported: boolean;

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
  onAutoConvertEmojiChange: CheckboxChangeHandlerType;
  onAutoDownloadUpdateChange: CheckboxChangeHandlerType;
  onAutoLaunchChange: CheckboxChangeHandlerType;
  onCallNotificationsChange: CheckboxChangeHandlerType;
  onCallRingtoneNotificationChange: CheckboxChangeHandlerType;
  onCountMutedConversationsChange: CheckboxChangeHandlerType;
  onHasStoriesDisabledChanged: SelectChangeHandlerType<boolean>;
  onHideMenuBarChange: CheckboxChangeHandlerType;
  onIncomingCallNotificationsChange: CheckboxChangeHandlerType;
  onLastSyncTimeChange: (time: number) => unknown;
  onLocaleChange: (locale: string | null) => void;
  onMediaCameraPermissionsChange: CheckboxChangeHandlerType;
  onMediaPermissionsChange: CheckboxChangeHandlerType;
  onMessageAudioChange: CheckboxChangeHandlerType;
  onMinimizeToAndStartInSystemTrayChange: CheckboxChangeHandlerType;
  onMinimizeToSystemTrayChange: CheckboxChangeHandlerType;
  onNotificationAttentionChange: CheckboxChangeHandlerType;
  onNotificationContentChange: SelectChangeHandlerType<NotificationSettingType>;
  onNotificationsChange: CheckboxChangeHandlerType;
  onRelayCallsChange: CheckboxChangeHandlerType;
  onSelectedCameraChange: SelectChangeHandlerType<string | undefined>;
  onSelectedMicrophoneChange: SelectChangeHandlerType<AudioDevice | undefined>;
  onSelectedSpeakerChange: SelectChangeHandlerType<AudioDevice | undefined>;
  onSentMediaQualityChange: SelectChangeHandlerType<SentMediaQualityType>;
  onSpellCheckChange: CheckboxChangeHandlerType;
  onTextFormattingChange: CheckboxChangeHandlerType;
  onThemeChange: SelectChangeHandlerType<ThemeType>;
  onUniversalExpireTimerChange: SelectChangeHandlerType<number>;
  onWhoCanSeeMeChange: SelectChangeHandlerType<PhoneNumberSharingMode>;
  onWhoCanFindMeChange: SelectChangeHandlerType<PhoneNumberDiscoverability>;
  onZoomFactorChange: SelectChangeHandlerType<ZoomFactorType>;

  // Localization
  i18n: LocalizerType;
};

export type PropsType = PropsDataType & PropsFunctionType;

export type PropsPreloadType = Omit<PropsType, 'i18n'>;

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
  PNP = 'PNP',
}

enum LanguageDialog {
  Selection,
  Confirmation,
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

export function Preferences({
  addCustomColor,
  availableCameras,
  availableLocales,
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
  getConversationsWithCustomColor,
  hasAudioNotifications,
  hasAutoConvertEmoji,
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
  hasMessageAudio,
  hasMinimizeToAndStartInSystemTray,
  hasMinimizeToSystemTray,
  hasNotificationAttention,
  hasNotifications,
  hasReadReceipts,
  hasRelayCalls,
  hasSpellCheck,
  hasStoriesDisabled,
  hasTextFormatting,
  hasTypingIndicators,
  i18n,
  initialSpellCheckSetting,
  isAutoDownloadUpdatesSupported,
  isAutoLaunchSupported,
  isHideMenuBarSupported,
  isNotificationAttentionSupported,
  isSyncSupported,
  isSystemTraySupported,
  isMinimizeToAndStartInSystemTraySupported,
  lastSyncTime,
  makeSyncRequest,
  notificationContent,
  onAudioNotificationsChange,
  onAutoConvertEmojiChange,
  onAutoDownloadUpdateChange,
  onAutoLaunchChange,
  onCallNotificationsChange,
  onCallRingtoneNotificationChange,
  onCountMutedConversationsChange,
  onHasStoriesDisabledChanged,
  onHideMenuBarChange,
  onIncomingCallNotificationsChange,
  onLastSyncTimeChange,
  onLocaleChange,
  onMediaCameraPermissionsChange,
  onMediaPermissionsChange,
  onMessageAudioChange,
  onMinimizeToAndStartInSystemTrayChange,
  onMinimizeToSystemTrayChange,
  onNotificationAttentionChange,
  onNotificationContentChange,
  onNotificationsChange,
  onRelayCallsChange,
  onSelectedCameraChange,
  onSelectedMicrophoneChange,
  onSelectedSpeakerChange,
  onSentMediaQualityChange,
  onSpellCheckChange,
  onTextFormattingChange,
  onThemeChange,
  onUniversalExpireTimerChange,
  onWhoCanSeeMeChange,
  onWhoCanFindMeChange,
  onZoomFactorChange,
  phoneNumber = '',
  preferredSystemLocales,
  removeCustomColor,
  removeCustomColorOnConversations,
  resetAllChatColors,
  resetDefaultChatColor,
  resolvedLocale,
  selectedCamera,
  selectedMicrophone,
  selectedSpeaker,
  sentMediaQualitySetting,
  setGlobalDefaultConversationColor,
  localeOverride,
  themeSetting,
  universalExpireTimer = DurationInSeconds.ZERO,
  whoCanFindMe,
  whoCanSeeMe,
  zoomFactor,
}: PropsType): JSX.Element {
  const storiesId = useUniqueId();
  const themeSelectId = useUniqueId();
  const zoomSelectId = useUniqueId();
  const languageId = useUniqueId();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmStoriesOff, setConfirmStoriesOff] = useState(false);
  const [page, setPage] = useState<Page>(Page.General);
  const [showSyncFailed, setShowSyncFailed] = useState(false);
  const [nowSyncing, setNowSyncing] = useState(false);
  const [showDisappearingTimerDialog, setShowDisappearingTimerDialog] =
    useState(false);
  const [languageDialog, setLanguageDialog] = useState<LanguageDialog | null>(
    null
  );
  const [selectedLanguageLocale, setSelectedLanguageLocale] = useState<
    string | null
  >(localeOverride);
  const [languageSearchInput, setLanguageSearchInput] = useState('');
  const [toast, setToast] = useState<AnyToast | undefined>();
  const [confirmPnpNotDiscoverable, setConfirmPnpNoDiscoverable] =
    useState(false);

  function closeLanguageDialog() {
    setLanguageDialog(null);
    setSelectedLanguageLocale(localeOverride);
  }

  useEffect(() => {
    doneRendering();
  }, [doneRendering]);

  useEscapeHandling(() => {
    if (languageDialog != null) {
      closeLanguageDialog();
    } else {
      closeSettings();
    }
  });

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

  const settingsPaneRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const settingsPane = settingsPaneRef.current;
    if (!settingsPane) {
      return;
    }

    const elements = settingsPane.querySelectorAll<
      | HTMLAnchorElement
      | HTMLButtonElement
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
    >(focusableSelector);
    if (!elements.length) {
      return;
    }
    elements[0]?.focus();
  }, [page]);

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

  const localeDisplayNames = window.SignalContext.getLocaleDisplayNames();

  const getLocaleDisplayName = useCallback(
    (inLocale: string, ofLocale: string): string => {
      const displayName = localeDisplayNames[inLocale]?.[ofLocale];
      assertDev(
        displayName != null,
        `Locale display name in ${inLocale} of ${ofLocale} does not exist`
      );
      return (
        displayName ??
        new Intl.DisplayNames(inLocale, {
          type: 'language',
          languageDisplay: 'standard',
          style: 'long',
          fallback: 'code',
        }).of(ofLocale)
      );
    },
    [localeDisplayNames]
  );

  const localeSearchOptions = useMemo(() => {
    const collator = new Intl.Collator('en', { usage: 'sort' });

    const availableLocalesOptions = availableLocales
      .map(locale => {
        const currentLocaleLabel = getLocaleDisplayName(resolvedLocale, locale);
        const matchingLocaleLabel = getLocaleDisplayName(locale, locale);
        return { locale, currentLocaleLabel, matchingLocaleLabel };
      })
      .sort((a, b) => {
        return collator.compare(a.locale, b.locale);
      });

    const [localeOverrideMatches, localeOverrideNonMatches] = partition(
      availableLocalesOptions,
      option => {
        return option.locale === localeOverride;
      }
    );

    const preferredSystemLocaleMatch = LocaleMatcher.match(
      preferredSystemLocales as Array<string>, // bad types
      availableLocales as Array<string>, // bad types
      'en',
      { algorithm: 'best fit' }
    );

    return [
      ...localeOverrideMatches,
      {
        locale: null,
        currentLocaleLabel: i18n('icu:Preferences__Language__SystemLanguage'),
        matchingLocaleLabel: getLocaleDisplayName(
          preferredSystemLocaleMatch,
          preferredSystemLocaleMatch
        ),
      },
      ...localeOverrideNonMatches,
    ];
  }, [
    i18n,
    availableLocales,
    resolvedLocale,
    localeOverride,
    preferredSystemLocales,
    getLocaleDisplayName,
  ]);

  const localeSearchResults = useMemo(() => {
    return localeSearchOptions.filter(option => {
      const input = removeDiacritics(languageSearchInput.trim().toLowerCase());

      if (input === '') {
        return true;
      }

      function isMatch(value: string) {
        return removeDiacritics(value.toLowerCase()).includes(input);
      }

      return (
        isMatch(option.currentLocaleLabel) ||
        (option.matchingLocaleLabel && isMatch(option.matchingLocaleLabel))
      );
    });
  }, [localeSearchOptions, languageSearchInput]);

  let settings: JSX.Element | undefined;
  if (page === Page.General) {
    settings = (
      <>
        <div className="Preferences__title">
          <div className="Preferences__title--header">
            {i18n('icu:Preferences__button--general')}
          </div>
        </div>
        <SettingsRow>
          <Control
            left={i18n('icu:Preferences--phone-number')}
            right={phoneNumber}
          />
          <Control
            left={
              <>
                <div>{i18n('icu:Preferences--device-name')}</div>
                <div className="Preferences__description">
                  {i18n('icu:Preferences--device-name__description')}
                </div>
              </>
            }
            right={deviceName}
          />
        </SettingsRow>
        <SettingsRow title={i18n('icu:Preferences--system')}>
          {isAutoLaunchSupported && (
            <Checkbox
              checked={hasAutoLaunch}
              label={i18n('icu:autoLaunchDescription')}
              moduleClassName="Preferences__checkbox"
              name="autoLaunch"
              onChange={onAutoLaunchChange}
            />
          )}
          {isHideMenuBarSupported && (
            <Checkbox
              checked={hasHideMenuBar}
              label={i18n('icu:hideMenuBar')}
              moduleClassName="Preferences__checkbox"
              name="hideMenuBar"
              onChange={onHideMenuBarChange}
            />
          )}
          {isSystemTraySupported && (
            <>
              <Checkbox
                checked={hasMinimizeToSystemTray}
                label={i18n('icu:SystemTraySetting__minimize-to-system-tray')}
                moduleClassName="Preferences__checkbox"
                name="system-tray-setting-minimize-to-system-tray"
                onChange={onMinimizeToSystemTrayChange}
              />
              {isMinimizeToAndStartInSystemTraySupported && (
                <Checkbox
                  checked={hasMinimizeToAndStartInSystemTray}
                  disabled={!hasMinimizeToSystemTray}
                  label={i18n(
                    'icu:SystemTraySetting__minimize-to-and-start-in-system-tray'
                  )}
                  moduleClassName="Preferences__checkbox"
                  name="system-tray-setting-minimize-to-and-start-in-system-tray"
                  onChange={onMinimizeToAndStartInSystemTrayChange}
                />
              )}
            </>
          )}
        </SettingsRow>
        <SettingsRow title={i18n('icu:permissions')}>
          <Checkbox
            checked={hasMediaPermissions}
            label={i18n('icu:mediaPermissionsDescription')}
            moduleClassName="Preferences__checkbox"
            name="mediaPermissions"
            onChange={onMediaPermissionsChange}
          />
          <Checkbox
            checked={hasMediaCameraPermissions}
            label={i18n('icu:mediaCameraPermissionsDescription')}
            moduleClassName="Preferences__checkbox"
            name="mediaCameraPermissions"
            onChange={onMediaCameraPermissionsChange}
          />
        </SettingsRow>
        {isAutoDownloadUpdatesSupported && (
          <SettingsRow title={i18n('icu:Preferences--updates')}>
            <Checkbox
              checked={hasAutoDownloadUpdate}
              label={i18n('icu:Preferences__download-update')}
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
            {i18n('icu:Preferences__button--appearance')}
          </div>
        </div>
        <SettingsRow>
          <Control
            icon="Preferences__LanguageIcon"
            left={i18n('icu:Preferences__Language__Label')}
            right={
              <span
                className="Preferences__LanguageButton"
                lang={localeOverride ?? resolvedLocale}
              >
                {localeOverride != null
                  ? getLocaleDisplayName(resolvedLocale, localeOverride)
                  : i18n('icu:Preferences__Language__SystemLanguage')}
              </span>
            }
            onClick={() => {
              setLanguageDialog(LanguageDialog.Selection);
            }}
          />
          {languageDialog === LanguageDialog.Selection && (
            <Modal
              i18n={i18n}
              modalName="Preferences__LanguageModal"
              moduleClassName="Preferences__LanguageModal"
              padded={false}
              onClose={closeLanguageDialog}
              title={i18n('icu:Preferences__Language__ModalTitle')}
              modalHeaderChildren={
                <SearchInput
                  i18n={i18n}
                  value={languageSearchInput}
                  placeholder={i18n(
                    'icu:Preferences__Language__SearchLanguages'
                  )}
                  moduleClassName="Preferences__LanguageModal__SearchInput"
                  onChange={event => {
                    setLanguageSearchInput(event.currentTarget.value);
                  }}
                />
              }
              modalFooter={
                <>
                  <Button
                    variant={ButtonVariant.Secondary}
                    onClick={closeLanguageDialog}
                  >
                    {i18n('icu:cancel')}
                  </Button>
                  <Button
                    variant={ButtonVariant.Primary}
                    disabled={selectedLanguageLocale === localeOverride}
                    onClick={() => {
                      setLanguageDialog(LanguageDialog.Confirmation);
                    }}
                  >
                    {i18n('icu:Preferences__LanguageModal__Set')}
                  </Button>
                </>
              }
            >
              {localeSearchResults.length === 0 && (
                <div className="Preferences__LanguageModal__NoResults">
                  {i18n('icu:Preferences__Language__NoResults', {
                    searchTerm: languageSearchInput.trim(),
                  })}
                </div>
              )}
              {localeSearchResults.map(option => {
                const id = `${languageId}:${option.locale ?? 'system'}`;
                const isSelected = option.locale === selectedLanguageLocale;
                return (
                  <button
                    key={id}
                    type="button"
                    className="Preferences__LanguageModal__Item"
                    onClick={() => {
                      setSelectedLanguageLocale(option.locale);
                    }}
                    aria-pressed={isSelected}
                  >
                    <span className="Preferences__LanguageModal__Item__Inner">
                      <span className="Preferences__LanguageModal__Item__Label">
                        <span className="Preferences__LanguageModal__Item__Current">
                          {option.currentLocaleLabel}
                        </span>
                        {option.matchingLocaleLabel != null && (
                          <span
                            lang={option.locale ?? resolvedLocale}
                            className="Preferences__LanguageModal__Item__Matching"
                          >
                            {option.matchingLocaleLabel}
                          </span>
                        )}
                      </span>
                      {isSelected && (
                        <span className="Preferences__LanguageModal__Item__Check" />
                      )}
                    </span>
                  </button>
                );
              })}
            </Modal>
          )}
          {languageDialog === LanguageDialog.Confirmation && (
            <ConfirmationDialog
              dialogName="Preferences__Language"
              i18n={i18n}
              title={i18n('icu:Preferences__LanguageModal__Restart__Title')}
              onCancel={closeLanguageDialog}
              onClose={closeLanguageDialog}
              cancelText={i18n('icu:cancel')}
              actions={[
                {
                  text: i18n('icu:Preferences__LanguageModal__Restart__Button'),
                  style: 'affirmative',
                  action: () => {
                    onLocaleChange(selectedLanguageLocale);
                  },
                },
              ]}
            >
              {i18n('icu:Preferences__LanguageModal__Restart__Description')}
            </ConfirmationDialog>
          )}
          <Control
            icon
            left={
              <label htmlFor={themeSelectId}>
                {i18n('icu:Preferences--theme')}
              </label>
            }
            right={
              <Select
                id={themeSelectId}
                onChange={onThemeChange}
                options={[
                  {
                    text: i18n('icu:themeSystem'),
                    value: 'system',
                  },
                  {
                    text: i18n('icu:themeLight'),
                    value: 'light',
                  },
                  {
                    text: i18n('icu:themeDark'),
                    value: 'dark',
                  },
                ]}
                value={themeSetting}
              />
            }
          />
          <Control
            icon
            left={i18n('icu:showChatColorEditor')}
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
            icon
            left={
              <label htmlFor={zoomSelectId}>
                {i18n('icu:Preferences--zoom')}
              </label>
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
        ? i18n('icu:spellCheckWillBeEnabled')
        : i18n('icu:spellCheckWillBeDisabled');
    }

    const lastSyncDate = new Date(lastSyncTime || 0);

    settings = (
      <>
        <div className="Preferences__title">
          <div className="Preferences__title--header">
            {i18n('icu:Preferences__button--chats')}
          </div>
        </div>
        <SettingsRow title={i18n('icu:Preferences__button--chats')}>
          <Checkbox
            checked={hasSpellCheck}
            description={spellCheckDirtyText}
            label={i18n('icu:spellCheckDescription')}
            moduleClassName="Preferences__checkbox"
            name="spellcheck"
            onChange={onSpellCheckChange}
          />
          <Checkbox
            checked={hasTextFormatting}
            label={i18n('icu:textFormattingDescription')}
            moduleClassName="Preferences__checkbox"
            name="textFormatting"
            onChange={onTextFormattingChange}
          />
          <Checkbox
            checked={hasLinkPreviews}
            description={i18n('icu:Preferences__link-previews--description')}
            disabled
            label={i18n('icu:Preferences__link-previews--title')}
            moduleClassName="Preferences__checkbox"
            name="linkPreviews"
            onChange={noop}
          />
          <Checkbox
            checked={hasAutoConvertEmoji}
            description={
              <I18n
                i18n={i18n}
                id="icu:Preferences__auto-convert-emoji--description"
              />
            }
            label={i18n('icu:Preferences__auto-convert-emoji--title')}
            moduleClassName="Preferences__checkbox"
            name="autoConvertEmoji"
            onChange={onAutoConvertEmojiChange}
          />
          <Control
            left={i18n('icu:Preferences__sent-media-quality')}
            right={
              <Select
                onChange={onSentMediaQualityChange}
                options={[
                  {
                    text: i18n('icu:sentMediaQualityStandard'),
                    value: 'standard',
                  },
                  {
                    text: i18n('icu:sentMediaQualityHigh'),
                    value: 'high',
                  },
                ]}
                value={sentMediaQualitySetting}
              />
            }
          />
        </SettingsRow>
        {isSyncSupported && (
          <SettingsRow>
            <Control
              left={
                <>
                  <div>{i18n('icu:sync')}</div>
                  <div className="Preferences__description">
                    {i18n('icu:syncExplanation')}{' '}
                    {i18n('icu:Preferences--lastSynced', {
                      date: lastSyncDate.toLocaleDateString(),
                      time: lastSyncDate.toLocaleTimeString(),
                    })}
                  </div>
                  {showSyncFailed && (
                    <div className="Preferences__description Preferences__description--error">
                      {i18n('icu:syncFailed')}
                    </div>
                  )}
                </>
              }
              right={
                <div className="Preferences__right-button">
                  <Button
                    aria-label={
                      nowSyncing ? i18n('icu:syncing') : i18n('icu:syncNow')
                    }
                    aria-live="polite"
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
                    {nowSyncing ? (
                      <Spinner svgSize="small" />
                    ) : (
                      i18n('icu:syncNow')
                    )}
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
            {i18n('icu:Preferences__button--calls')}
          </div>
        </div>
        <SettingsRow title={i18n('icu:calling')}>
          <Checkbox
            checked={hasIncomingCallNotifications}
            label={i18n('icu:incomingCallNotificationDescription')}
            moduleClassName="Preferences__checkbox"
            name="incomingCallNotification"
            onChange={onIncomingCallNotificationsChange}
          />
          <Checkbox
            checked={hasCallRingtoneNotification}
            label={i18n('icu:callRingtoneNotificationDescription')}
            moduleClassName="Preferences__checkbox"
            name="callRingtoneNotification"
            onChange={onCallRingtoneNotificationChange}
          />
        </SettingsRow>
        <SettingsRow title={i18n('icu:Preferences__devices')}>
          <Control
            left={
              <>
                <label className="Preferences__select-title" htmlFor="video">
                  {i18n('icu:callingDeviceSelection__label--video')}
                </label>
                <Select
                  ariaLabel={i18n('icu:callingDeviceSelection__label--video')}
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
                              'icu:callingDeviceSelection__select--no-device'
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
                  {i18n('icu:callingDeviceSelection__label--audio-input')}
                </label>
                <Select
                  ariaLabel={i18n(
                    'icu:callingDeviceSelection__label--audio-input'
                  )}
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
                              'icu:callingDeviceSelection__select--no-device'
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
                  {i18n('icu:callingDeviceSelection__label--audio-output')}
                </label>
                <Select
                  ariaLabel={i18n(
                    'icu:callingDeviceSelection__label--audio-output'
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
                              'icu:callingDeviceSelection__select--no-device'
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
        <SettingsRow title={i18n('icu:Preferences--advanced')}>
          <Checkbox
            checked={hasRelayCalls}
            description={i18n('icu:alwaysRelayCallsDetail')}
            label={i18n('icu:alwaysRelayCallsDescription')}
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
            {i18n('icu:Preferences__button--notifications')}
          </div>
        </div>
        <SettingsRow>
          <Checkbox
            checked={hasNotifications}
            label={i18n('icu:Preferences__enable-notifications')}
            moduleClassName="Preferences__checkbox"
            name="notifications"
            onChange={onNotificationsChange}
          />
          <Checkbox
            checked={hasCallNotifications}
            label={i18n('icu:callSystemNotificationDescription')}
            moduleClassName="Preferences__checkbox"
            name="callSystemNotification"
            onChange={onCallNotificationsChange}
          />
          {isNotificationAttentionSupported && (
            <Checkbox
              checked={hasNotificationAttention}
              label={i18n('icu:notificationDrawAttention')}
              moduleClassName="Preferences__checkbox"
              name="notificationDrawAttention"
              onChange={onNotificationAttentionChange}
            />
          )}
          <Checkbox
            checked={hasCountMutedConversations}
            label={i18n('icu:countMutedConversationsDescription')}
            moduleClassName="Preferences__checkbox"
            name="countMutedConversations"
            onChange={onCountMutedConversationsChange}
          />
        </SettingsRow>
        <SettingsRow>
          <Control
            left={i18n('icu:Preferences--notification-content')}
            right={
              <Select
                ariaLabel={i18n('icu:Preferences--notification-content')}
                disabled={!hasNotifications}
                onChange={onNotificationContentChange}
                options={[
                  {
                    text: i18n('icu:nameAndMessage'),
                    value: 'message',
                  },
                  {
                    text: i18n('icu:nameOnly'),
                    value: 'name',
                  },
                  {
                    text: i18n('icu:noNameOrMessage'),
                    value: 'count',
                  },
                ]}
                value={notificationContent}
              />
            }
          />
        </SettingsRow>
        <SettingsRow>
          <Checkbox
            checked={hasAudioNotifications}
            label={i18n('icu:audioNotificationDescription')}
            moduleClassName="Preferences__checkbox"
            name="audioNotification"
            onChange={onAudioNotificationsChange}
          />
          <Checkbox
            checked={hasMessageAudio}
            description={i18n('icu:Preferences__message-audio-description')}
            label={i18n('icu:Preferences__message-audio-title')}
            moduleClassName="Preferences__checkbox"
            name="messageAudio"
            onChange={onMessageAudioChange}
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
            {i18n('icu:Preferences__button--privacy')}
          </div>
        </div>
        <SettingsRow>
          <Control
            left={
              <div className="Preferences__pnp">
                <h3>{i18n('icu:Preferences__pnp__row--title')}</h3>
                <div className="Preferences__description">
                  {i18n('icu:Preferences__pnp__row--body')}
                </div>
              </div>
            }
            right={
              <Button
                onClick={() => setPage(Page.PNP)}
                variant={ButtonVariant.Secondary}
              >
                {i18n('icu:Preferences__pnp__row--button')}
              </Button>
            }
          />
        </SettingsRow>
        <SettingsRow>
          <Control
            left={i18n('icu:Preferences--blocked')}
            right={i18n('icu:Preferences--blocked-count', {
              num: blockedCount,
            })}
          />
        </SettingsRow>
        <SettingsRow title={i18n('icu:Preferences--messaging')}>
          <Checkbox
            checked={hasReadReceipts}
            disabled
            label={i18n('icu:Preferences--read-receipts')}
            moduleClassName="Preferences__checkbox"
            name="readReceipts"
            onChange={noop}
          />
          <Checkbox
            checked={hasTypingIndicators}
            disabled
            label={i18n('icu:Preferences--typing-indicators')}
            moduleClassName="Preferences__checkbox"
            name="typingIndicators"
            onChange={noop}
          />
          <div className="Preferences__padding">
            <div className="Preferences__description">
              {i18n('icu:Preferences__privacy--description')}
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
        <SettingsRow title={i18n('icu:disappearingMessages')}>
          <Control
            left={
              <>
                <div>
                  {i18n('icu:settings__DisappearingMessages__timer__label')}
                </div>
                <div className="Preferences__description">
                  {i18n('icu:settings__DisappearingMessages__footer')}
                </div>
              </>
            }
            right={
              <Select
                ariaLabel={i18n(
                  'icu:settings__DisappearingMessages__timer__label'
                )}
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
                      : DurationInSeconds.fromSeconds(-1),
                    text: isCustomDisappearingMessageValue
                      ? formatExpirationTimer(i18n, universalExpireTimer)
                      : i18n('icu:selectedCustomDisappearingTimeOption'),
                  },
                ])}
                value={universalExpireTimer}
              />
            }
          />
        </SettingsRow>
        <SettingsRow title={i18n('icu:Stories__title')}>
          <Control
            left={
              <label htmlFor={storiesId}>
                <div>{i18n('icu:Stories__settings-toggle--title')}</div>
                <div className="Preferences__description">
                  {i18n('icu:Stories__settings-toggle--description')}
                </div>
              </label>
            }
            right={
              hasStoriesDisabled ? (
                <Button
                  onClick={() => onHasStoriesDisabledChanged(false)}
                  variant={ButtonVariant.Secondary}
                >
                  {i18n('icu:Preferences__turn-stories-on')}
                </Button>
              ) : (
                <Button
                  className="Preferences__stories-off"
                  onClick={() => setConfirmStoriesOff(true)}
                  variant={ButtonVariant.SecondaryDestructive}
                >
                  {i18n('icu:Preferences__turn-stories-off')}
                </Button>
              )
            }
          />
        </SettingsRow>
        <SettingsRow>
          <Control
            left={
              <>
                <div>{i18n('icu:clearDataHeader')}</div>
                <div className="Preferences__description">
                  {i18n('icu:clearDataExplanation')}
                </div>
              </>
            }
            right={
              <div className="Preferences__right-button">
                <Button
                  onClick={() => setConfirmDelete(true)}
                  variant={ButtonVariant.SecondaryDestructive}
                >
                  {i18n('icu:clearDataButton')}
                </Button>
              </div>
            }
          />
        </SettingsRow>
        {confirmDelete ? (
          <ConfirmationDialog
            dialogName="Preference.deleteAllData"
            actions={[
              {
                action: doDeleteAllData,
                style: 'negative',
                text: i18n('icu:clearDataButton'),
              },
            ]}
            i18n={i18n}
            onClose={() => {
              setConfirmDelete(false);
            }}
            title={i18n('icu:deleteAllDataHeader')}
          >
            {i18n('icu:deleteAllDataBody')}
          </ConfirmationDialog>
        ) : null}
        {confirmStoriesOff ? (
          <ConfirmationDialog
            dialogName="Preference.turnStoriesOff"
            actions={[
              {
                action: () => onHasStoriesDisabledChanged(true),
                style: 'negative',
                text: i18n('icu:Preferences__turn-stories-off--action'),
              },
            ]}
            i18n={i18n}
            onClose={() => {
              setConfirmStoriesOff(false);
            }}
          >
            {i18n('icu:Preferences__turn-stories-off--body')}
          </ConfirmationDialog>
        ) : null}
      </>
    );
  } else if (page === Page.ChatColor) {
    settings = (
      <>
        <div className="Preferences__title">
          <button
            aria-label={i18n('icu:goBack')}
            className="Preferences__back-icon"
            onClick={() => setPage(Page.Appearance)}
            type="button"
          />
          <div className="Preferences__title--header">
            {i18n('icu:ChatColorPicker__menu-title')}
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
  } else if (page === Page.PNP) {
    let sharingDescription: string;

    if (whoCanSeeMe === PhoneNumberSharingMode.Everybody) {
      sharingDescription = i18n(
        'icu:Preferences__pnp__sharing--description--everyone'
      );
    } else if (whoCanFindMe === PhoneNumberDiscoverability.Discoverable) {
      sharingDescription = i18n(
        'icu:Preferences__pnp__sharing--description--nobody'
      );
    } else {
      sharingDescription = i18n(
        'icu:Preferences__pnp__sharing--description--nobody--not-discoverable'
      );
    }
    settings = (
      <>
        <div className="Preferences__title">
          <button
            aria-label={i18n('icu:goBack')}
            className="Preferences__back-icon"
            onClick={() => setPage(Page.Privacy)}
            type="button"
          />
          <div className="Preferences__title--header">
            {i18n('icu:Preferences__pnp--page-title')}
          </div>
        </div>

        <SettingsRow
          title={i18n('icu:Preferences__pnp__sharing--title')}
          className={classNames('Preferences__settings-row--pnp-sharing', {
            'Preferences__settings-row--pnp-sharing--nobody':
              whoCanSeeMe === PhoneNumberSharingMode.Nobody,
          })}
        >
          <SettingsRadio
            onChange={onWhoCanSeeMeChange}
            options={[
              {
                text: i18n('icu:Preferences__pnp__sharing__everyone'),
                value: PhoneNumberSharingMode.Everybody,
              },
              {
                text: i18n('icu:Preferences__pnp__sharing__nobody'),
                value: PhoneNumberSharingMode.Nobody,
              },
            ]}
            value={whoCanSeeMe}
          />
          <div className="Preferences__padding">
            <div className="Preferences__description">{sharingDescription}</div>
          </div>
        </SettingsRow>

        <SettingsRow
          title={i18n('icu:Preferences__pnp__discoverability--title')}
        >
          <SettingsRadio
            onChange={value => {
              if (value === PhoneNumberDiscoverability.NotDiscoverable) {
                setConfirmPnpNoDiscoverable(true);
              } else {
                onWhoCanFindMeChange(value);
              }
            }}
            options={[
              {
                text: i18n('icu:Preferences__pnp__discoverability__everyone'),
                value: PhoneNumberDiscoverability.Discoverable,
              },
              {
                text: i18n('icu:Preferences__pnp__discoverability__nobody'),
                value: PhoneNumberDiscoverability.NotDiscoverable,
                readOnly: whoCanSeeMe === PhoneNumberSharingMode.Everybody,
                onClick:
                  whoCanSeeMe === PhoneNumberSharingMode.Everybody
                    ? () =>
                        setToast({ toastType: ToastType.WhoCanFindMeReadOnly })
                    : noop,
              },
            ]}
            value={whoCanFindMe}
          />
          <div className="Preferences__padding">
            <div className="Preferences__description">
              {whoCanFindMe === PhoneNumberDiscoverability.Discoverable
                ? i18n(
                    'icu:Preferences__pnp__discoverability--description--everyone'
                  )
                : i18n(
                    'icu:Preferences__pnp__discoverability--description--nobody'
                  )}
            </div>
          </div>
        </SettingsRow>
        {confirmPnpNotDiscoverable && (
          <ConfirmationDialog
            i18n={i18n}
            title={i18n(
              'icu:Preferences__pnp__discoverability__nobody__confirmModal__title'
            )}
            dialogName="Preference.turnPnpDiscoveryOff"
            onClose={() => {
              setConfirmPnpNoDiscoverable(false);
            }}
            actions={[
              {
                action: () =>
                  onWhoCanFindMeChange(
                    PhoneNumberDiscoverability.NotDiscoverable
                  ),
                style: 'affirmative',
                text: i18n('icu:ok'),
              },
            ]}
          >
            {i18n(
              'icu:Preferences__pnp__discoverability__nobody__confirmModal__description',
              {
                // This is a rare instance where we want to interpolate the exact
                // text of the string into quotes in the translation as an
                // explanation.
                settingTitle: i18n(
                  'icu:Preferences__pnp__discoverability--title'
                ),
                nobodyLabel: i18n(
                  'icu:Preferences__pnp__discoverability__nobody'
                ),
              }
            )}
          </ConfirmationDialog>
        )}
      </>
    );
  }

  return (
    <>
      <div className="module-title-bar-drag-area" />
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
            {i18n('icu:Preferences__button--general')}
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
            {i18n('icu:Preferences__button--appearance')}
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
            {i18n('icu:Preferences__button--chats')}
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
            {i18n('icu:Preferences__button--calls')}
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
            {i18n('icu:Preferences__button--notifications')}
          </button>

          <button
            type="button"
            className={classNames({
              Preferences__button: true,
              'Preferences__button--privacy': true,
              'Preferences__button--selected':
                page === Page.Privacy || page === Page.PNP,
            })}
            onClick={() => setPage(Page.Privacy)}
          >
            {i18n('icu:Preferences__button--privacy')}
          </button>
        </div>
        <div className="Preferences__settings-pane" ref={settingsPaneRef}>
          {settings}
        </div>
      </div>
      <ToastManager
        OS="unused"
        hideToast={() => setToast(undefined)}
        i18n={i18n}
        onShowDebugLog={shouldNeverBeCalled}
        onUndoArchive={shouldNeverBeCalled}
        openFileInFolder={shouldNeverBeCalled}
        showAttachmentNotAvailableModal={shouldNeverBeCalled}
        toast={toast}
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
        isInFullScreenCall={false}
      />
    </>
  );
}

function SettingsRow({
  children,
  title,
  className,
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}): JSX.Element {
  return (
    <fieldset className={classNames('Preferences__settings-row', className)}>
      {title && <legend className="Preferences__padding">{title}</legend>}
      {children}
    </fieldset>
  );
}

function Control({
  icon,
  left,
  onClick,
  right,
}: {
  /** A className or `true` to leave room for icon */
  icon?: string | true;
  left: ReactNode;
  onClick?: () => unknown;
  right: ReactNode;
}): JSX.Element {
  const content = (
    <>
      {icon && (
        <div
          className={classNames(
            'Preferences__control--icon',
            icon === true ? null : icon
          )}
        />
      )}
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
}

type SettingsRadioOptionType<Enum> = Readonly<{
  text: string;
  value: Enum;
  readOnly?: boolean;
  onClick?: () => void;
}>;

function SettingsRadio<Enum>({
  value,
  options,
  onChange,
}: {
  value: Enum;
  options: ReadonlyArray<SettingsRadioOptionType<Enum>>;
  onChange: (value: Enum) => void;
}): JSX.Element {
  const htmlIds = useMemo(() => {
    return Array.from({ length: options.length }, () => uuid());
  }, [options.length]);

  return (
    <div className="Preferences__padding">
      {options.map(({ text, value: optionValue, readOnly, onClick }, i) => {
        const htmlId = htmlIds[i];
        return (
          <label
            className={classNames('Preferences__settings-radio__label', {
              'Preferences__settings-radio__label--readonly': readOnly,
            })}
            key={htmlId}
            htmlFor={htmlId}
          >
            <CircleCheckbox
              isRadio
              variant={CircleCheckboxVariant.Small}
              id={htmlId}
              checked={value === optionValue}
              onClick={onClick}
              onChange={readOnly ? noop : () => onChange(optionValue)}
            />
            {text}
          </label>
        );
      })}
    </div>
  );
}

function localizeDefault(i18n: LocalizerType, deviceLabel: string): string {
  return deviceLabel.toLowerCase().startsWith('default')
    ? deviceLabel.replace(
        /default/i,
        i18n('icu:callingDeviceSelection__select--default')
      )
    : deviceLabel;
}
