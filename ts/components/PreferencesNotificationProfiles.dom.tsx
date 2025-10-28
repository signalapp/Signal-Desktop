// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { MutableRefObject } from 'react';
import { DateInput, DateSegment, TimeField } from 'react-aria-components';
import { Time } from '@internationalized/date';
import { sample, isEqual, noop, range } from 'lodash';
import classNames from 'classnames';
import { Popper } from 'react-popper';

import {
  isEmojiVariantValue,
  getEmojiVariantByKey,
  getEmojiVariantKeyByValue,
} from './fun/data/emojis.std.js';
import { FunStaticEmoji } from './fun/FunEmoji.dom.js';
import { FunEmojiPicker } from './fun/FunEmojiPicker.dom.js';
import { useFunEmojiLocalizer } from './fun/useFunEmojiLocalizer.dom.js';
import { FunEmojiPickerButton } from './fun/FunButton.dom.js';
import { tw } from '../axo/tw.dom.js';
import { AxoButton } from '../axo/AxoButton.dom.js';
import { AxoSelect } from '../axo/AxoSelect.dom.js';
import { AxoSwitch } from '../axo/AxoSwitch.dom.js';
import { AxoSymbol } from '../axo/AxoSymbol.dom.js';
import { Input } from './Input.dom.js';
import { Checkbox } from './Checkbox.dom.js';
import { AvatarColorMap, AvatarColors } from '../types/Colors.std.js';
import { PreferencesSelectChatsDialog } from './preferences/PreferencesSelectChatsDialog.dom.js';
import {
  DayOfWeek,
  getMidnight,
  scheduleToTime,
} from '../types/NotificationProfile.std.js';
import { Avatar } from './Avatar.dom.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { formatTimestamp } from '../util/formatTimestamp.dom.js';
import { strictAssert } from '../util/assert.std.js';
import { ConfirmationDialog } from './ConfirmationDialog.dom.js';
import { SettingsPage } from '../types/Nav.std.js';
import { useConfirmDiscard } from '../hooks/useConfirmDiscard.dom.js';
import { AriaClickable } from '../axo/AriaClickable.dom.js';
import { offsetDistanceModifier } from '../util/popperUtil.std.js';
import { themeClassName2 } from '../util/theme.std.js';
import { useRefMerger } from '../hooks/useRefMerger.std.js';
import { handleOutsideClick } from '../util/handleOutsideClick.dom.js';
import { useEscapeHandling } from '../hooks/useEscapeHandling.dom.js';
import { Modal } from './Modal.dom.js';

import type { EmojiVariantKey } from './fun/data/emojis.std.js';
import type { LocalizerType } from '../types/I18N.std.js';
import type { ThemeType } from '../types/Util.std.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import type { GetConversationByIdType } from '../state/selectors/conversations.dom.js';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.js';
import type {
  NotificationProfileIdString,
  NotificationProfileType,
  ScheduleDays,
} from '../types/NotificationProfile.std.js';
import type { SettingsLocation } from '../types/Nav.std.js';

enum CreateFlowPage {
  Name = 'Name',
  Allowed = 'Allowed',
  Schedule = 'Schedule',
  Done = 'Done',
}

enum HomePage {
  List = 'List',
  Edit = 'Edit',
  Name = 'Name',
  Schedule = 'Schedule',
}

const DEFAULT_ALLOW_CALLS = true;
const DEFAULT_ALLOW_MENTIONS = false;

const NINE_AM = 900;
const FIVE_PM = 1700;

const DEFAULT_ENABLED = false;
const DEFAULT_START = NINE_AM;
const DEFAULT_END = FIVE_PM;

const WEEKDAY_SCHEDULE: ScheduleDays = {
  [DayOfWeek.MONDAY]: true,
  [DayOfWeek.TUESDAY]: true,
  [DayOfWeek.WEDNESDAY]: true,
  [DayOfWeek.THURSDAY]: true,
  [DayOfWeek.FRIDAY]: true,
  [DayOfWeek.SATURDAY]: false,
  [DayOfWeek.SUNDAY]: false,
};
const WEEKEND_SCHEDULE: ScheduleDays = {
  [DayOfWeek.MONDAY]: false,
  [DayOfWeek.TUESDAY]: false,
  [DayOfWeek.WEDNESDAY]: false,
  [DayOfWeek.THURSDAY]: false,
  [DayOfWeek.FRIDAY]: false,
  [DayOfWeek.SATURDAY]: true,
  [DayOfWeek.SUNDAY]: true,
};
const DAILY_SCHEDULE: ScheduleDays = {
  [DayOfWeek.MONDAY]: true,
  [DayOfWeek.TUESDAY]: true,
  [DayOfWeek.WEDNESDAY]: true,
  [DayOfWeek.THURSDAY]: true,
  [DayOfWeek.FRIDAY]: true,
  [DayOfWeek.SATURDAY]: true,
  [DayOfWeek.SUNDAY]: true,
};

const DEFAULT_SCHEDULE = WEEKDAY_SCHEDULE;

type CreateFlowProps = {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
  conversations: ReadonlyArray<ConversationType>;
  conversationSelector: GetConversationByIdType;
  createProfile: (profile: Omit<NotificationProfileType, 'id'>) => void;
  i18n: LocalizerType;
  setSettingsLocation: (location: SettingsLocation) => void;
  preferredBadgeSelector: PreferredBadgeSelectorType;
  theme: ThemeType;
};

type HomeProps = {
  activeProfileId: NotificationProfileIdString | undefined;
  allProfiles: ReadonlyArray<NotificationProfileType>;
  contentsRef: MutableRefObject<HTMLDivElement | null>;
  conversations: ReadonlyArray<ConversationType>;
  conversationSelector: GetConversationByIdType;
  hasOnboardingBeenSeen: boolean;
  i18n: LocalizerType;
  isSyncEnabled: boolean;
  loading: boolean;
  markProfileDeleted: (id: string) => void;
  preferredBadgeSelector: PreferredBadgeSelectorType;
  setHasOnboardingBeenSeen: (value: boolean) => void;
  setIsSyncEnabled: (value: boolean) => void;
  setSettingsLocation: (location: SettingsLocation) => void;
  setProfileOverride: (
    id: NotificationProfileIdString,
    enabled: boolean
  ) => void;
  theme: ThemeType;
  updateProfile: (profile: NotificationProfileType) => void;
};

function formatTimeForDisplay(time: number): string {
  const midnight = getMidnight(Date.now());
  const ms = scheduleToTime(midnight, time);
  return formatTimestamp(ms, { timeStyle: 'short' });
}

function need24HourTime(): boolean {
  const formatted = formatTimeForDisplay(FIVE_PM);
  return formatted.includes('17');
}

function formatTimeForInput(time: number): Time {
  const { hours, minutes } = getTimeDetails(time, true);
  return new Time(hours, minutes);
}
function addLeadingZero(minutes: number): string {
  if (minutes < 10) {
    return `0${minutes}`;
  }
  return minutes.toString();
}

function parseTimeFromInput(time: Time): number {
  return time.hour * 100 + time.minute;
}

type PERIOD = 'AM' | 'PM';
function hourTo24HourTime(hours: number, period: PERIOD) {
  if (period === 'AM' && hours === 12) {
    return 0;
  }
  if (period === 'AM') {
    return hours;
  }
  if (period === 'PM' && hours < 12) {
    return hours + 12;
  }

  return hours;
}
function hourFrom24HourTime(hours: number): { hours: number; period: PERIOD } {
  if (hours === 0) {
    return {
      hours: 12,
      period: 'AM',
    };
  }
  if (hours === 12) {
    return {
      hours: 12,
      period: 'PM',
    };
  }
  if (hours > 12) {
    return {
      hours: hours - 12,
      period: 'PM',
    };
  }
  return {
    hours,
    period: 'AM',
  };
}
function makeTime(
  rawHours: number,
  minutes: number,
  period: PERIOD | undefined
): number {
  if (!period) {
    return rawHours * 100 + minutes;
  }

  const hours = hourTo24HourTime(rawHours, period);
  return hours * 100 + minutes;
}

function getTimeDetails(
  time: number,
  use24HourTime: boolean
): { hours: number; minutes: number; period: PERIOD | undefined } {
  const rawHours = Math.floor(time / 100);
  const minutes = time % 100;

  if (use24HourTime) {
    return { hours: rawHours, minutes, period: undefined };
  }

  const { hours, period } = hourFrom24HourTime(rawHours);
  return {
    hours,
    minutes,
    period,
  };
}

const ARGB_BITS = 0xff000000;
const A100_BACKGROUND_ARGB = 0xffe3e3fe;

function getRandomColor(): number {
  const colorName = sample(AvatarColors) || AvatarColors[0];
  const color = AvatarColorMap.get(colorName);
  if (!color) {
    return A100_BACKGROUND_ARGB; // A100, background, with bits for ARGB
  }

  const rgb = parseInt(color.bg.slice(1), 16);
  const argb = rgb + ARGB_BITS;

  return argb;
}

export function getColorFromProfile(argb: number): string {
  const rgb = argb - ARGB_BITS;
  return `#${rgb.toString(16)}`;
}

function getEmojiVariantKey(value: string): EmojiVariantKey | undefined {
  if (isEmojiVariantValue(value)) {
    return getEmojiVariantKeyByValue(value);
  }

  return undefined;
}

type ProfileToSave = Omit<NotificationProfileType, 'id'>;

export function NotificationProfilesCreateFlow({
  contentsRef,
  conversations,
  conversationSelector,
  createProfile,
  i18n,
  preferredBadgeSelector,
  setSettingsLocation,
  theme,
}: CreateFlowProps): JSX.Element {
  const [page, setPage] = React.useState(CreateFlowPage.Name);

  const [name, setName] = React.useState<string | undefined>();
  const [emoji, setEmoji] = React.useState<string | undefined>();
  const [allowedMembers, setAllowedMembers] = React.useState<
    ReadonlySet<string>
  >(new Set<string>());
  const [allowAllCalls, setAllowAllCalls] = React.useState(DEFAULT_ALLOW_CALLS);
  const [allowAllMentions, setAllowAllMentions] = React.useState(
    DEFAULT_ALLOW_MENTIONS
  );
  const [isEnabled, setIsEnabled] = React.useState<boolean>(DEFAULT_ENABLED);
  const [scheduleDays, setScheduledDays] =
    React.useState<ScheduleDays>(DEFAULT_SCHEDULE);
  const [startTime, setStartTime] = React.useState<number>(DEFAULT_START);
  const [endTime, setEndTime] = React.useState<number>(DEFAULT_END);
  const [color] = React.useState<number>(getRandomColor());

  const tryClose = React.useRef<() => void | undefined>();
  const [confirmDiscardModal, confirmDiscardIf] = useConfirmDiscard({
    i18n,
    name: 'NotificationProfilesCreateFlow',
    tryClose,
  });

  const onTryClose = React.useCallback(() => {
    const isDirty =
      page !== CreateFlowPage.Done && (Boolean(name) || Boolean(emoji));
    const discardChanges = noop;

    confirmDiscardIf(isDirty, discardChanges);
  }, [confirmDiscardIf, emoji, name, page]);
  tryClose.current = onTryClose;

  function makeNotificationProfile(): ProfileToSave {
    return {
      name: name || '',
      emoji,

      color,

      createdAtMs: Date.now(),

      allowAllCalls,
      allowAllMentions,

      allowedMembers,
      scheduleEnabled: isEnabled,

      scheduleStartTime: startTime,
      scheduleEndTime: endTime,
      scheduleDaysEnabled: scheduleDays,

      deletedAtTimestampMs: undefined,
      storageNeedsSync: true,
    };
  }

  const goToNotificationsProfilesHome = React.useCallback(() => {
    setSettingsLocation({ page: SettingsPage.NotificationProfilesHome });
  }, [setSettingsLocation]);

  function getPageContents() {
    switch (page) {
      case CreateFlowPage.Name:
        return (
          <NotificationProfilesNamePage
            contentsRef={contentsRef}
            i18n={i18n}
            initialName={name}
            initialEmoji={emoji}
            isEditing={false}
            onBack={goToNotificationsProfilesHome}
            onNext={() => {
              setPage(CreateFlowPage.Allowed);
            }}
            onUpdate={({ name: newName, emoji: newEmoji }) => {
              setEmoji(newEmoji);
              setName(newName);
            }}
            theme={theme}
          />
        );
      case CreateFlowPage.Allowed:
        return (
          <NotificationProfilesAllowedPage
            allowedMembers={Array.from(allowedMembers)}
            allowAllCalls={allowAllCalls}
            contentsRef={contentsRef}
            conversations={conversations}
            conversationSelector={conversationSelector}
            i18n={i18n}
            allowAllMentions={allowAllMentions}
            onBack={() => setPage(CreateFlowPage.Name)}
            onNext={() => setPage(CreateFlowPage.Schedule)}
            onSetAllowedMembers={(members: ReadonlyArray<string>) =>
              setAllowedMembers(new Set(members))
            }
            onSetAllowAllCalls={(value: boolean) => setAllowAllCalls(value)}
            onSetAllowAllMentions={() =>
              setAllowAllMentions(
                existingallowAllMentions => !existingallowAllMentions
              )
            }
            preferredBadgeSelector={preferredBadgeSelector}
            theme={theme}
          />
        );
      case CreateFlowPage.Schedule:
        return (
          <NotificationProfilesSchedulePage
            isEnabled={isEnabled}
            scheduleDays={scheduleDays}
            startTime={startTime}
            endTime={endTime}
            contentsRef={contentsRef}
            i18n={i18n}
            isEditing={false}
            onBack={() => setPage(CreateFlowPage.Allowed)}
            onNext={() => {
              const profile = makeNotificationProfile();
              createProfile(profile);
              setPage(CreateFlowPage.Done);
            }}
            onSetIsEnabled={(value: boolean) => setIsEnabled(value)}
            onSetScheduleDays={(schedule: ScheduleDays) =>
              setScheduledDays(schedule)
            }
            onSetStartTime={(value: number) => setStartTime(value)}
            onSetEndTime={(value: number) => setEndTime(value)}
            theme={theme}
          />
        );
      case CreateFlowPage.Done:
        return (
          <NotificationProfilesDonePage
            profile={makeNotificationProfile()}
            contentsRef={contentsRef}
            i18n={i18n}
            onNext={goToNotificationsProfilesHome}
          />
        );
      default:
        throw missingCaseError(page);
    }
  }
  return (
    <div className={tw('relative flex grow flex-col')}>
      {confirmDiscardModal}
      {getPageContents()}
    </div>
  );
}

export function NotificationProfilesHome({
  activeProfileId,
  allProfiles,
  contentsRef,
  conversations,
  conversationSelector,
  hasOnboardingBeenSeen,
  i18n,
  isSyncEnabled,
  loading,
  markProfileDeleted,
  preferredBadgeSelector,
  setHasOnboardingBeenSeen,
  setIsSyncEnabled,
  setSettingsLocation,
  setProfileOverride,
  theme,
  updateProfile,
}: HomeProps): JSX.Element {
  const [page, setPage] = React.useState(HomePage.List);
  const [profile, setProfile] = React.useState<
    NotificationProfileType | undefined
  >();
  const [isShowingOnboardModal, setIsShowingOnboardModal] =
    React.useState(false);

  const goBackToNotifications = React.useCallback(() => {
    setSettingsLocation({ page: SettingsPage.Notifications });
  }, [setSettingsLocation]);
  const goToNotificationsProfilesCreateFlow = React.useCallback(() => {
    setSettingsLocation({ page: SettingsPage.NotificationProfilesCreateFlow });
  }, [setSettingsLocation]);

  React.useEffect(() => {
    if (page === HomePage.List && !hasOnboardingBeenSeen) {
      if (allProfiles.length === 0) {
        setIsShowingOnboardModal(true);
      } else {
        setHasOnboardingBeenSeen(true);
      }
    }

    if (
      profile &&
      (page === HomePage.Name ||
        page === HomePage.Schedule ||
        page === HomePage.Edit)
    ) {
      const newProfile = allProfiles.find(item => item.id === profile.id);
      if (newProfile) {
        setProfile(newProfile);
      } else {
        setProfile(undefined);
        setPage(HomePage.List);
      }
    }
  }, [
    allProfiles,
    hasOnboardingBeenSeen,
    page,
    profile,
    setHasOnboardingBeenSeen,
    setPage,
    setProfile,
  ]);

  function getPageContents() {
    switch (page) {
      case HomePage.List:
        return (
          <NotificationProfilesListPage
            allProfiles={allProfiles}
            contentsRef={contentsRef}
            i18n={i18n}
            isSyncEnabled={isSyncEnabled}
            loading={loading}
            onCreateProfile={goToNotificationsProfilesCreateFlow}
            onEditProfile={(profileToEdit: NotificationProfileType) => {
              setProfile(profileToEdit);
              setPage(HomePage.Edit);
            }}
            onBack={goBackToNotifications}
            setIsSyncEnabled={setIsSyncEnabled}
          />
        );
      case HomePage.Name:
        strictAssert(profile, 'HomePage.Name: Need a profile to edit!');

        return (
          <NotificationProfilesNamePage
            contentsRef={contentsRef}
            i18n={i18n}
            initialName={profile.name}
            initialEmoji={profile?.emoji}
            isEditing
            onBack={() => setPage(HomePage.Edit)}
            onNext={() => {
              setPage(HomePage.Edit);
            }}
            onUpdate={({ emoji, name }) => {
              const newProfile = {
                ...profile,
                emoji,
                name,
              };
              updateProfile(newProfile);
              setProfile(newProfile);
            }}
            theme={theme}
          />
        );
      case HomePage.Schedule:
        strictAssert(profile, 'HomePage.Schedule: Need a profile to edit!');

        return (
          <NotificationProfilesSchedulePage
            isEnabled={profile.scheduleEnabled}
            scheduleDays={profile.scheduleDaysEnabled ?? DEFAULT_SCHEDULE}
            startTime={profile.scheduleStartTime ?? DEFAULT_START}
            endTime={profile.scheduleEndTime ?? DEFAULT_END}
            contentsRef={contentsRef}
            i18n={i18n}
            isEditing
            onBack={() => setPage(HomePage.Edit)}
            onNext={() => setPage(HomePage.Edit)} // TODO: probably don't show Next button?
            onSetIsEnabled={(scheduleEnabled: boolean) => {
              const newProfile = {
                ...profile,
                scheduleEnabled,
              };
              updateProfile(newProfile);
              setProfile(newProfile);
            }}
            onSetScheduleDays={(scheduleDaysEnabled: ScheduleDays) => {
              const newProfile = {
                ...profile,
                scheduleDaysEnabled,
              };
              updateProfile(newProfile);
              setProfile(newProfile);
            }}
            onSetStartTime={(scheduleStartTime: number) => {
              const newProfile = {
                ...profile,
                scheduleStartTime,
              };
              updateProfile(newProfile);
              setProfile(newProfile);
            }}
            onSetEndTime={(scheduleEndTime: number) => {
              const newProfile = {
                ...profile,
                scheduleEndTime,
              };
              updateProfile(newProfile);
              setProfile(newProfile);
            }}
            theme={theme}
          />
        );
      case HomePage.Edit:
        strictAssert(profile, 'HomePage.Edit: Need a profile to edit!');

        return (
          <NotificationProfilesEditPage
            activeProfileId={activeProfileId}
            profile={profile}
            contentsRef={contentsRef}
            conversations={conversations}
            conversationSelector={conversationSelector}
            i18n={i18n}
            onBack={() => setPage(HomePage.List)}
            onDeleteProfile={() => {
              markProfileDeleted(profile.id);
              setPage(HomePage.List);
            }}
            onEditName={() => setPage(HomePage.Name)}
            onEditProfile={newProfile => {
              setProfile(newProfile);
              updateProfile(newProfile);
            }}
            onEditSchedule={() => setPage(HomePage.Schedule)}
            onUpdateOverrideState={value =>
              setProfileOverride(profile.id, value)
            }
            preferredBadgeSelector={preferredBadgeSelector}
            theme={theme}
          />
        );
      default:
        throw missingCaseError(page);
    }
  }
  return (
    <div className={tw('relative flex grow flex-col')}>
      {isShowingOnboardModal ? (
        <NotificationProfilesOnboardingDialog
          i18n={i18n}
          onDismiss={() => {
            setHasOnboardingBeenSeen(true);
            setIsShowingOnboardModal(false);
          }}
        />
      ) : null}
      {getPageContents()}
    </div>
  );
}

function NotificationProfilesOnboardingDialog({
  i18n,
  onDismiss,
}: {
  i18n: LocalizerType;
  onDismiss: VoidFunction;
}) {
  return (
    <Modal
      modalName="NotificationProfilesOnboarding"
      onClose={onDismiss}
      i18n={i18n}
    >
      <div className={tw('flex flex-col items-center')}>
        <div className={tw('mt-4 mb-3')}>
          <ProfileAvatar i18n={i18n} size="large" />
        </div>
        <Title title={i18n('icu:NotificationProfiles--title')} />
        <p className={tw('mt-4 mb-12 max-w-[340px] text-center leading-5')}>
          {i18n('icu:NotificationProfiles--setup-description')}
        </p>
        <AxoButton.Root variant="primary" onClick={onDismiss} size="large">
          {i18n('icu:NotificationProfiles--setup-continue')}
        </AxoButton.Root>
      </div>
    </Modal>
  );
}

function NotificationProfilesNamePage({
  contentsRef,
  i18n,
  initialEmoji,
  initialName,
  isEditing,
  onBack,
  onNext,
  onUpdate,
  theme,
}: {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
  i18n: LocalizerType;
  initialEmoji: string | undefined;
  initialName?: string;
  isEditing: boolean;
  onBack: VoidFunction;
  onNext: () => void;
  onUpdate: (data: { emoji: string | undefined; name: string }) => void;
  theme: ThemeType;
}) {
  const [emojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const [name, setName] = React.useState(initialName);
  const [emoji, setEmoji] = React.useState<string | undefined>(initialEmoji);
  const emojiLocalizer = useFunEmojiLocalizer();

  const isValid = Boolean(name);
  const sampleProfileNames = React.useMemo(() => {
    return [
      {
        emoji: '💪',
        text: i18n('icu:NotificationProfiles--sample-name__work'),
      },
      {
        emoji: '😴',
        text: i18n('icu:NotificationProfiles--sample-name__sleep'),
      },
      {
        emoji: '🚗',
        text: i18n('icu:NotificationProfiles--sample-name__driving'),
      },
      {
        emoji: '😊',
        text: i18n('icu:NotificationProfiles--sample-name__downtime'),
      },
      {
        emoji: '💡',
        text: i18n('icu:NotificationProfiles--sample-name__focus'),
      },
    ] as const;
  }, [i18n]);

  const handleFunEmojiPickerOpenChange = React.useCallback((open: boolean) => {
    setEmojiPickerOpen(open);
  }, []);

  const handleInputChange = React.useCallback(
    (newName: string) => {
      setName(newName);

      if (newName === '') {
        setEmoji(undefined);
      } else {
        onUpdate({ name: newName, emoji });
      }
    },
    [emoji, setEmoji, setName, onUpdate]
  );

  const emojiKey = emoji ? getEmojiVariantKey(emoji) : null;

  return (
    <>
      <Header
        onBack={onBack}
        title={
          isEditing
            ? i18n('icu:NotificationProfiles--name-title--editing')
            : undefined
        }
        i18n={i18n}
      />
      <Container contentsRef={contentsRef}>
        {!isEditing ? (
          <Title title={i18n('icu:NotificationProfiles--name-title')} />
        ) : undefined}
        <div className={tw('mt-9 w-full grow')}>
          <Input
            expandable
            hasClearButton
            i18n={i18n}
            icon={
              <FunEmojiPicker
                open={emojiPickerOpen}
                onOpenChange={handleFunEmojiPickerOpenChange}
                placement="bottom"
                onSelectEmoji={data => {
                  const newEmoji = getEmojiVariantByKey(data.variantKey)?.value;

                  setEmoji(newEmoji);
                  if (name) {
                    onUpdate({ name, emoji: newEmoji });
                  }
                }}
                closeOnSelect
                theme={theme}
              >
                <FunEmojiPickerButton i18n={i18n} selectedEmoji={emojiKey} />
              </FunEmojiPicker>
            }
            maxLengthCount={140}
            maxByteCount={512}
            moduleClassName="NotificationProfiles__NamePage"
            onChange={handleInputChange}
            ref={undefined}
            placeholder={i18n('icu:NotificationProfiles--name-placeholder')}
            value={name}
            whenToShowRemainingCount={40}
          />
          <div className={tw('mx-auto w-full max-w-[320px]')}>
            {sampleProfileNames.map(item => {
              const itemEmojiKey = getEmojiVariantKey(item.emoji);
              strictAssert(
                itemEmojiKey,
                'Emoji for name defaults should exist'
              );
              const itemEmojiData = getEmojiVariantByKey(itemEmojiKey);

              return (
                <FullWidthButton
                  key={item.text}
                  className={tw('ms-[-4px] min-h-[52px] gap-4 ps-4 pe-3')}
                  onClick={() => {
                    const newName = item.text;
                    const newEmoji = item.emoji;

                    setName(newName);
                    setEmoji(newEmoji);
                    onUpdate({ emoji: newEmoji, name: newName });
                  }}
                >
                  <FunStaticEmoji
                    role="img"
                    aria-label={emojiLocalizer.getLocaleShortName(
                      itemEmojiData.key
                    )}
                    size={24}
                    emoji={itemEmojiData}
                  />
                  {item.text}
                </FullWidthButton>
              );
            })}
          </div>
        </div>
      </Container>
      <ButtonContainer>
        <AxoButton.Root
          variant="primary"
          size="large"
          type="button"
          form="notificationProfileName"
          disabled={!isValid}
          onClick={onNext}
        >
          {isEditing ? i18n('icu:done') : i18n('icu:next2')}
        </AxoButton.Root>
      </ButtonContainer>
    </>
  );
}

function NotificationProfilesAllowedPage({
  allowAllCalls,
  allowedMembers,
  contentsRef,
  conversations,
  conversationSelector,
  i18n,
  allowAllMentions,
  onBack,
  onNext,
  onSetAllowedMembers,
  onSetAllowAllCalls,
  onSetAllowAllMentions,
  preferredBadgeSelector,
  theme,
}: {
  allowAllCalls: boolean;
  allowedMembers: ReadonlyArray<string>;
  contentsRef: MutableRefObject<HTMLDivElement | null>;
  conversations: ReadonlyArray<ConversationType>;
  conversationSelector: GetConversationByIdType;
  i18n: LocalizerType;
  allowAllMentions: boolean;
  onBack: VoidFunction;
  onNext: VoidFunction;
  onSetAllowedMembers: (members: ReadonlyArray<string>) => void;
  onSetAllowAllCalls: (value: boolean) => void;
  onSetAllowAllMentions: (value: boolean) => void;
  preferredBadgeSelector: PreferredBadgeSelectorType;
  theme: ThemeType;
}) {
  return (
    <>
      <Header onBack={onBack} i18n={i18n} />
      <Container contentsRef={contentsRef}>
        <Title title={i18n('icu:NotificationProfiles--allowed-title')} />
        <p className={tw('mt-4 mb-13 max-w-[335px] text-center leading-5')}>
          {i18n('icu:NotificationProfiles--allowed-description')}
        </p>
        <AllowedMembersSection
          allowedMembers={allowedMembers}
          conversations={conversations}
          conversationSelector={conversationSelector}
          i18n={i18n}
          onSetAllowedMembers={onSetAllowedMembers}
          preferredBadgeSelector={preferredBadgeSelector}
          theme={theme}
          title={i18n('icu:NotificationProfiles--allowed-title')}
        />
        <ExceptionsSection
          allowAllCalls={allowAllCalls}
          allowAllMentions={allowAllMentions}
          i18n={i18n}
          onSetAllowAllCalls={onSetAllowAllCalls}
          onSetAllowAllMentions={onSetAllowAllMentions}
        />
      </Container>
      <ButtonContainer>
        <form
          onSubmit={e => {
            e.preventDefault();
            onNext();
          }}
        >
          <AxoButton.Root variant="primary" size="large" type="submit">
            {i18n('icu:next2')}
          </AxoButton.Root>
        </form>
      </ButtonContainer>
    </>
  );
}

function NotificationProfilesSchedulePage({
  isEnabled,
  scheduleDays,
  startTime,
  endTime,
  contentsRef,
  i18n,
  isEditing,
  onBack,
  onNext,
  onSetIsEnabled,
  onSetScheduleDays,
  onSetStartTime,
  onSetEndTime,
  theme,
}: {
  isEnabled: boolean;
  scheduleDays: ScheduleDays;
  startTime: number;
  endTime: number;
  contentsRef: MutableRefObject<HTMLDivElement | null>;
  i18n: LocalizerType;
  isEditing: boolean;
  onBack: () => void;
  onNext: () => void;
  onSetIsEnabled: (value: boolean) => void;
  onSetScheduleDays: (value: ScheduleDays) => void;
  onSetStartTime: (value: number) => void;
  onSetEndTime: (value: number) => void;
  theme: ThemeType;
}) {
  const daysInUIOrder = React.useMemo(() => {
    return [
      {
        dayOfWeek: DayOfWeek.SUNDAY,
        label: i18n('icu:NotificationProfiles--schedule-sunday'),
      },
      {
        dayOfWeek: DayOfWeek.MONDAY,
        label: i18n('icu:NotificationProfiles--schedule-monday'),
      },
      {
        dayOfWeek: DayOfWeek.TUESDAY,
        label: i18n('icu:NotificationProfiles--schedule-tuesday'),
      },
      {
        dayOfWeek: DayOfWeek.WEDNESDAY,
        label: i18n('icu:NotificationProfiles--schedule-wednesday'),
      },
      {
        dayOfWeek: DayOfWeek.THURSDAY,
        label: i18n('icu:NotificationProfiles--schedule-thursday'),
      },
      {
        dayOfWeek: DayOfWeek.FRIDAY,
        label: i18n('icu:NotificationProfiles--schedule-friday'),
      },
      {
        dayOfWeek: DayOfWeek.SATURDAY,
        label: i18n('icu:NotificationProfiles--schedule-saturday'),
      },
    ];
  }, [i18n]);

  return (
    <>
      <Header
        onBack={onBack}
        title={
          isEditing
            ? i18n('icu:NotificationProfiles--schedule-title--editing')
            : undefined
        }
        i18n={i18n}
      />
      <Container contentsRef={contentsRef}>
        {!isEditing && (
          <>
            <Title title={i18n('icu:NotificationProfiles--schedule-title')} />
            <FullWidthRow>
              <p
                className={tw(
                  'mx-auto mt-2 mb-4 max-w-[335px] text-center leading-5'
                )}
              >
                {i18n('icu:NotificationProfiles--schedule-description')}
              </p>
            </FullWidthRow>
          </>
        )}
        <FullWidthRow
          className={tw('mt-4 flex min-h-[40px] w-full items-center py-2')}
        >
          <div className={tw('grow type-body-large')}>
            {i18n('icu:NotificationProfiles--schedule-enable')}
          </div>
          <div className={tw('ms-4')}>
            <AxoSwitch.Root
              checked={isEnabled}
              onCheckedChange={onSetIsEnabled}
            />
          </div>
        </FullWidthRow>
        <FullWidthRow className={tw('mt-3 min-h-[40px] w-full pt-3 pb-2')}>
          <h2 className={tw('type-title-small')}>
            {i18n('icu:NotificationProfiles--schedule')}
          </h2>
        </FullWidthRow>
        <FullWidthRow className={tw('flex min-h-[40px] items-center')}>
          <span id="start-label" className={tw('grow')}>
            {i18n('icu:NotificationProfiles--schedule-from')}
          </span>
          <span className={tw('shrink-0')}>
            <TimePicker
              i18n={i18n}
              isDisabled={!isEnabled}
              labelId="start-label"
              onUpdateTime={onSetStartTime}
              theme={theme}
              time={startTime}
            />
          </span>
        </FullWidthRow>
        <FullWidthRow className={tw('flex min-h-[40px] items-center')}>
          <span id="end-label" className={tw('grow')}>
            {i18n('icu:NotificationProfiles--schedule-until')}
          </span>
          <span className={tw('shrink-0')}>
            <TimePicker
              i18n={i18n}
              isDisabled={!isEnabled}
              labelId="end-label"
              onUpdateTime={onSetEndTime}
              theme={theme}
              time={endTime}
            />
          </span>
        </FullWidthRow>
        <FullWidthRow className={tw('mt-3')}>
          {daysInUIOrder.map(day => {
            return (
              <DayCheckbox
                key={day.label}
                label={day.label}
                dayOfWeek={day.dayOfWeek}
                isEnabled={isEnabled}
                scheduleDays={scheduleDays}
                onSetScheduleDays={onSetScheduleDays}
              />
            );
          })}
        </FullWidthRow>
      </Container>
      <ButtonContainer>
        <AxoButton.Root
          variant="primary"
          size="large"
          type="button"
          onClick={onNext}
        >
          {isEditing ? i18n('icu:done') : i18n('icu:next2')}
        </AxoButton.Root>
      </ButtonContainer>
    </>
  );
}

function NotificationProfilesDonePage({
  contentsRef,
  i18n,
  onNext,
  profile,
}: {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
  i18n: LocalizerType;
  onNext: () => void;
  profile: ProfileToSave;
}): JSX.Element {
  return (
    <>
      <Header i18n={i18n} />
      <MidFloatingContainer contentsRef={contentsRef}>
        <div className={tw('mb-4')}>
          <ProfileAvatar i18n={i18n} profile={profile} size="large" />
        </div>
        <Title title={i18n('icu:NotificationProfiles--done-title')} />
        <p className={tw('mt-4 mb-6 max-w-[350px] text-center leading-5')}>
          {i18n('icu:NotificationProfiles--done-description')}
        </p>
        <AxoButton.Root
          variant="primary"
          size="large"
          type="button"
          onClick={onNext}
        >
          {i18n('icu:done')}
        </AxoButton.Root>
      </MidFloatingContainer>
    </>
  );
}

function NotificationProfilesListPage({
  allProfiles,
  contentsRef,
  i18n,
  isSyncEnabled,
  loading,
  onBack,
  onCreateProfile,
  onEditProfile,
  setIsSyncEnabled,
}: {
  allProfiles: ReadonlyArray<NotificationProfileType>;
  contentsRef: MutableRefObject<HTMLDivElement | null>;
  i18n: LocalizerType;
  isSyncEnabled: boolean;
  loading: boolean;
  onBack: () => void;
  onCreateProfile: () => void;
  onEditProfile: (profileToEdit: NotificationProfileType) => void;
  setIsSyncEnabled: (value: boolean) => void;
}) {
  const [cachedProfiles, setCachedProfiles] = React.useState<
    ReadonlyArray<NotificationProfileType>
  >([]);
  React.useEffect(() => {
    if (!loading) {
      setCachedProfiles(allProfiles);
    }
  }, [loading, allProfiles]);

  const profilesToRender = loading ? cachedProfiles : allProfiles;

  return (
    <>
      <Header
        onBack={onBack}
        title={i18n('icu:NotificationProfiles--title')}
        i18n={i18n}
      />
      <Container contentsRef={contentsRef}>
        <FullWidthRow className={tw('mt-3 min-h-[40px] pt-3')}>
          <h2 className={tw('type-title-small')}>
            {i18n('icu:NotificationProfiles--list--header')}
          </h2>
        </FullWidthRow>
        <FullWidthButton
          className={tw('min-h-[52px]')}
          onClick={() => onCreateProfile()}
        >
          <PlusIconInCircle />
          <span>{i18n('icu:NotificationProfiles--create')}</span>
        </FullWidthButton>
        {profilesToRender.map(profile => {
          return (
            <FullWidthButton
              key={profile.id}
              className={tw('min-h-[52px]')}
              onClick={() => onEditProfile(profile)}
              testId={`EditProfile--${profile.name}`}
            >
              <ProfileAvatar i18n={i18n} profile={profile} size="medium" />
              <span className={tw('ms-4')}>{profile.name}</span>
            </FullWidthButton>
          );
        })}
        <FullWidthDivider />
        <FullWidthRow className={tw('flex min-h-[40px] items-start pt-1')}>
          <div className={tw('grow')}>
            <div className={tw('type-body-large text-label-primary')}>
              {i18n('icu:NotificationProfiles--list--sync')}
            </div>
            <div className={tw('mt-1 type-body-small text-label-secondary')}>
              {i18n('icu:NotificationProfiles--list--sync--description')}
            </div>
          </div>
          <div className={tw('ms-4')}>
            <AxoSwitch.Root
              checked={isSyncEnabled}
              onCheckedChange={value => {
                setIsSyncEnabled(value);
              }}
            />
          </div>
        </FullWidthRow>
      </Container>
    </>
  );
}

function NotificationProfilesEditPage({
  activeProfileId,
  contentsRef,
  conversations,
  conversationSelector,
  i18n,
  onBack,
  onDeleteProfile,
  onEditName,
  onEditSchedule,
  onEditProfile,
  onUpdateOverrideState,
  preferredBadgeSelector,
  profile,
  theme,
}: {
  activeProfileId: NotificationProfileIdString | undefined;
  contentsRef: MutableRefObject<HTMLDivElement | null>;
  conversations: ReadonlyArray<ConversationType>;
  conversationSelector: GetConversationByIdType;
  i18n: LocalizerType;
  onBack: () => void;
  onDeleteProfile: () => void;
  onEditName: () => void;
  onEditSchedule: () => void;
  onEditProfile: (profile: NotificationProfileType) => void;
  onUpdateOverrideState: (value: boolean) => void;
  preferredBadgeSelector: PreferredBadgeSelectorType;
  profile: NotificationProfileType;
  theme: ThemeType;
}) {
  const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);

  const activeString = i18n('icu:NotificationProfiles--edit--is-active');
  const notActiveString = i18n('icu:NotificationProfiles--edit--is-not-active');
  const isProfileActive = activeProfileId === profile.id;
  const currentActiveString = isProfileActive ? activeString : notActiveString;

  const allowedMembersArray = React.useMemo(() => {
    return Array.from(profile.allowedMembers);
  }, [profile.allowedMembers]);

  return (
    <>
      {isConfirmingDelete ? (
        <ConfirmationDialog
          dialogName="NotificationProfileDelete"
          actions={[
            {
              action: onDeleteProfile,
              text: i18n('icu:NotificationProfiles--delete-button'),
              style: 'affirmative',
            },
          ]}
          i18n={i18n}
          onClose={() => setIsConfirmingDelete(false)}
        >
          {i18n('icu:NotificationProfiles--delete-confirmation')}
        </ConfirmationDialog>
      ) : null}
      <Header onBack={onBack} title={profile.name} i18n={i18n} />
      <Container contentsRef={contentsRef}>
        <AriaClickable.Root
          className={tw(
            'group mb-3 flex min-h-[80px] w-full items-center rounded-md border-[2.5px] border-transparent px-[11.5px] outline-none data-[focused]:border-color-label-light'
          )}
        >
          <ProfileAvatar i18n={i18n} profile={profile} size="medium" />
          <span className={tw('ms-3 text-start')}>{profile.name}</span>
          <span
            id="edit-icon"
            className={tw(
              'ms-2 opacity-0 group-hover:opacity-100 group-data-[focused]:opacity-100'
            )}
          >
            <AxoSymbol.Icon
              size={20}
              symbol="pencil"
              label={i18n('icu:NotificationProfiles--edit--edit-name-label')}
            />
            <AriaClickable.HiddenTrigger
              onClick={onEditName}
              aria-labelledby="edit-icon"
            />
          </span>

          <span className={tw('grow')} />
          <span>
            <AriaClickable.SubWidget>
              <AxoSelect.Root
                value={currentActiveString}
                onValueChange={stringValue => {
                  const value = stringValue === activeString;
                  onUpdateOverrideState(value);
                }}
              >
                <AxoSelect.Trigger placeholder={currentActiveString}>
                  {currentActiveString}
                </AxoSelect.Trigger>
                <AxoSelect.Content>
                  <AxoSelect.Item
                    key="isActive"
                    value={activeString}
                    textValue={activeString}
                  >
                    <AxoSelect.ItemText>{activeString}</AxoSelect.ItemText>
                  </AxoSelect.Item>
                  <AxoSelect.Item
                    key="isNotActive"
                    value={notActiveString}
                    textValue={notActiveString}
                  >
                    <AxoSelect.ItemText>{notActiveString}</AxoSelect.ItemText>
                  </AxoSelect.Item>
                </AxoSelect.Content>
              </AxoSelect.Root>
            </AriaClickable.SubWidget>
          </span>
        </AriaClickable.Root>

        <AllowedMembersSection
          allowedMembers={allowedMembersArray}
          conversations={conversations}
          conversationSelector={conversationSelector}
          i18n={i18n}
          onSetAllowedMembers={allowedMembers => {
            onEditProfile({
              ...profile,
              allowedMembers: new Set(allowedMembers),
            });
          }}
          preferredBadgeSelector={preferredBadgeSelector}
          theme={theme}
          title={i18n('icu:NotificationProfiles--edit--allowed')}
        />
        <FullWidthRow className={tw('mt-8 mb-2')}>
          <h2 className={tw('type-title-small')}>
            {i18n('icu:NotificationProfiles--schedule')}
          </h2>
        </FullWidthRow>
        <FullWidthButton
          testId="EditSchedule"
          onClick={onEditSchedule}
          className={tw('min-h-[55px] py-2')}
        >
          <div className={tw('grow text-start')}>
            <div>
              {i18n('icu:NotificationProfiles--edit--schedule-timing', {
                startTime: formatTimeForDisplay(
                  profile.scheduleStartTime ?? DEFAULT_START
                ),
                endTime: formatTimeForDisplay(
                  profile.scheduleEndTime ?? DEFAULT_END
                ),
              })}
            </div>
            <div className={tw('mt-0.5 type-body-small text-label-secondary')}>
              <ScheduleSummary
                i18n={i18n}
                scheduleDays={profile.scheduleDaysEnabled ?? DEFAULT_SCHEDULE}
              />
            </div>
          </div>
          <div className={tw('ms-5')}>
            {profile.scheduleEnabled
              ? i18n('icu:NotificationProfiles--edit--schedule-enabled')
              : i18n('icu:NotificationProfiles--edit--schedule-disabled')}
          </div>
        </FullWidthButton>
        <ExceptionsSection
          allowAllCalls={profile.allowAllCalls}
          allowAllMentions={profile.allowAllMentions}
          i18n={i18n}
          onSetAllowAllCalls={allowAllCalls => {
            onEditProfile({ ...profile, allowAllCalls });
          }}
          onSetAllowAllMentions={allowAllMentions => {
            onEditProfile({ ...profile, allowAllMentions });
          }}
        />
        <FullWidthButton
          className={tw('mt-6 min-h-[52px]')}
          onClick={() => setIsConfirmingDelete(true)}
        >
          <div className={tw('me-4 text-color-label-destructive')}>
            <AxoSymbol.Icon size={24} symbol="trash" label={null} />
          </div>
          <span className={tw('grow text-start text-color-label-destructive')}>
            {i18n('icu:NotificationProfiles--delete')}
          </span>
        </FullWidthButton>
      </Container>
      <ButtonContainer>
        <AxoButton.Root
          variant="primary"
          size="large"
          type="button"
          onClick={onBack}
        >
          {i18n('icu:done')}
        </AxoButton.Root>
      </ButtonContainer>
    </>
  );
}

// Utility components

export function FullWidthButton({
  children,
  className,
  onClick,
  testId,
}: {
  children: React.ReactNode;
  className?: string;
  onClick: () => void;
  testId?: string;
}): JSX.Element {
  return (
    <button
      className={classNames(
        tw(
          'flex w-full items-center rounded-md border-[2.5px] border-transparent px-[11.5px] outline-none focus-visible:border-color-label-light'
        ),
        className
      )}
      data-testid={testId}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function FullWidthRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={classNames(tw('w-full px-[14px]'), className)}>
      {children}
    </div>
  );
}

function FullWidthDivider() {
  return (
    <div className={tw('my-3 w-full px-[14px]')}>
      <hr
        aria-orientation="horizontal"
        className={tw('border-t-[0.5px] border-label-secondary')}
      />
    </div>
  );
}

function Header({
  onBack,
  title,
  i18n,
}: {
  onBack?: VoidFunction;
  title?: string;
  i18n: LocalizerType;
}) {
  return (
    <div className="Preferences__title">
      {onBack ? (
        <button
          aria-label={i18n('icu:goBack')}
          className="Preferences__back-icon"
          onClick={onBack}
          type="button"
        />
      ) : null}
      {title ? <div className="Preferences__title--header">{title}</div> : null}
    </div>
  );
}

function Container({
  children,
  contentsRef,
}: {
  children: React.ReactNode;
  contentsRef: MutableRefObject<HTMLDivElement | null>;
}) {
  return (
    <div className={tw('relative flex grow overflow-y-scroll')}>
      <div className={tw('grow')} />
      <div
        ref={contentsRef}
        className={tw(
          'flex w-full max-w-[798px] grow flex-col items-center px-[10px]'
        )}
      >
        {children}
      </div>
      <div className={tw('grow')} />
    </div>
  );
}

function Title({ title }: { title: string }) {
  return <h1 className={tw('type-title-medium')}>{title}</h1>;
}

function ButtonContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={tw(
        'mx-auto flex w-full max-w-[798px] justify-end p-6 pe-[33px]'
      )}
    >
      {children}
    </div>
  );
}

function MidFloatingContainer({
  children,
  contentsRef,
}: {
  children: React.ReactNode;
  contentsRef: MutableRefObject<HTMLDivElement | null>;
}) {
  return (
    <div className={tw('relative h-full grow')}>
      <div
        className={tw(
          'absolute top-4/10 flex w-full transform-[translateY(-40%)] flex-col items-center px-4'
        )}
        ref={contentsRef}
      >
        {children}
      </div>
    </div>
  );
}

function DayCheckbox({
  label,
  dayOfWeek,
  isEnabled,
  scheduleDays,
  onSetScheduleDays,
}: {
  label: string;
  dayOfWeek: DayOfWeek;
  isEnabled: boolean;
  scheduleDays: ScheduleDays;
  onSetScheduleDays: (value: ScheduleDays) => void;
}) {
  return (
    <div className={tw('py-[3px]')}>
      <Checkbox
        label={label}
        disabled={!isEnabled}
        checked={scheduleDays[dayOfWeek]}
        name={`dayEnabled-${dayOfWeek}`}
        onChange={value => {
          onSetScheduleDays({
            ...scheduleDays,
            [dayOfWeek]: value,
          });
        }}
      />
    </div>
  );
}

type IconSize = 'large' | 'medium' | 'medium-small' | 'small';

function EmojiOrMoon({
  emoji,
  forceLightTheme,
  i18n,
  size,
}: {
  emoji?: EmojiVariantKey | undefined;
  forceLightTheme?: boolean;
  i18n: LocalizerType;
  size: IconSize;
}) {
  const emojiLocalizer = useFunEmojiLocalizer();
  const sizeMap = React.useMemo(
    () => ({
      large: 48 as const,
      medium: 20 as const,
      'medium-small': 16 as const,
      small: 12 as const,
    }),
    []
  );

  if (!emoji) {
    return (
      <div
        className={tw(
          'absolute start-1/2 top-1/2 -translate-1/2 leading-none text-color-label-primary'
        )}
        style={
          forceLightTheme
            ? {
                colorScheme: 'light',
              }
            : {}
        }
      >
        <AxoSymbol.Icon
          label={i18n('icu:NotificationProfile--moon-icon')}
          size={sizeMap[size]}
          symbol="moon-fill"
        />
      </div>
    );
  }

  const emojiData = getEmojiVariantByKey(emoji);

  return (
    <span className={tw('absolute start-1/2 top-1/2 -translate-1/2 leading-0')}>
      <FunStaticEmoji
        role="img"
        aria-label={emojiLocalizer.getLocaleShortName(emojiData.key)}
        size={sizeMap[size]}
        emoji={emojiData}
      />
    </span>
  );
}

function PlusIconInCircle() {
  return (
    <div
      className={tw(
        'me-3 flex size-[36px] items-center justify-center rounded-full bg-background-secondary'
      )}
    >
      <AxoSymbol.Icon size={20} symbol="plus" label={null} />
    </div>
  );
}

function AllowedMembersSection({
  allowedMembers,
  conversations,
  conversationSelector,
  i18n,
  onSetAllowedMembers,
  preferredBadgeSelector,
  theme,
  title,
}: {
  allowedMembers: ReadonlyArray<string>;
  conversations: ReadonlyArray<ConversationType>;
  conversationSelector: GetConversationByIdType;
  i18n: LocalizerType;
  onSetAllowedMembers: (members: ReadonlyArray<string>) => void;
  preferredBadgeSelector: PreferredBadgeSelectorType;
  theme: ThemeType;
  title: string;
}) {
  const [showingMemberChooser, setShowingMemberChooser] = React.useState(false);

  return (
    <>
      {showingMemberChooser ? (
        <PreferencesSelectChatsDialog
          i18n={i18n}
          title={i18n('icu:NotificationProfiles--allowed-title')}
          conversations={conversations}
          conversationSelector={conversationSelector}
          onClose={({ selectedRecipientIds }) => {
            onSetAllowedMembers(selectedRecipientIds);
            setShowingMemberChooser(false);
          }}
          preferredBadgeSelector={preferredBadgeSelector}
          theme={theme}
          initialSelection={{
            selectedRecipientIds: Array.from(allowedMembers),
            selectAllIndividualChats: false,
            selectAllGroupChats: false,
          }}
          showChatTypes={false}
        />
      ) : null}
      <FullWidthRow>
        <h2 className={tw('mb-1 type-title-small')}>{title}</h2>
      </FullWidthRow>
      <FullWidthButton
        onClick={() => setShowingMemberChooser(true)}
        className={tw('min-h-[52px]')}
      >
        <PlusIconInCircle />
        <span>{i18n('icu:NotificationProfiles--allowed-add-label')}</span>
      </FullWidthButton>
      {allowedMembers.map(member => {
        const conversation = conversationSelector(member);
        const badge = preferredBadgeSelector(conversation.badges);

        return (
          <FullWidthButton
            key={conversation.id}
            onClick={() => setShowingMemberChooser(true)}
            className={tw('min-h-[52px]')}
          >
            <div
              className={tw(
                'me-3 flex size-[36px] items-center justify-center rounded-full bg-background-secondary'
              )}
            >
              <Avatar
                {...conversation}
                badge={badge}
                conversationType={conversation.type}
                i18n={i18n}
                size={36}
                theme={theme}
              />
            </div>
            <span>{conversation.title}</span>
          </FullWidthButton>
        );
      })}
    </>
  );
}

function ExceptionsSection({
  allowAllCalls,
  allowAllMentions,
  i18n,
  onSetAllowAllMentions,
  onSetAllowAllCalls,
}: {
  allowAllCalls: boolean;
  allowAllMentions: boolean;
  i18n: LocalizerType;
  onSetAllowAllMentions: (value: boolean) => void;
  onSetAllowAllCalls: (value: boolean) => void;
}) {
  return (
    <>
      <FullWidthRow className={tw('mt-8 mb-1')}>
        <h2 className={tw('type-title-small')}>
          {i18n('icu:NotificationProfiles--exceptions')}
        </h2>
      </FullWidthRow>
      <FullWidthRow className={tw('flex min-h-[40px] items-center')}>
        <div className={tw('grow type-body-large')}>
          {i18n('icu:NotificationProfiles--exceptions--allow-all-calls')}
        </div>
        <div className={tw('ms-4')}>
          <AxoSwitch.Root
            checked={allowAllCalls}
            onCheckedChange={onSetAllowAllCalls}
          />
        </div>
      </FullWidthRow>
      <FullWidthRow className={tw('flex min-h-[40px] items-center')}>
        <div className={tw('grow type-body-large')}>
          {i18n('icu:NotificationProfiles--exceptions--notify-for-mentions')}
        </div>
        <div className={tw('ms-4')}>
          <AxoSwitch.Root
            checked={allowAllMentions}
            onCheckedChange={onSetAllowAllMentions}
          />
        </div>
      </FullWidthRow>
    </>
  );
}

export function ProfileAvatar({
  i18n,
  isActive,
  profile,
  size,
}: {
  i18n: LocalizerType;
  isActive?: boolean;
  profile?: ProfileToSave;
  size: IconSize;
}): React.ReactNode {
  const emoji = profile?.emoji ? getEmojiVariantKey(profile.emoji) : undefined;
  const backgroundColor = profile?.color
    ? getColorFromProfile(profile.color)
    : undefined;
  const forceLightTheme = profile && !profile.emoji;

  const sizeMap = React.useMemo(
    () => ({
      large: tw('size-[80px]'),
      medium: tw('size-[36px]'),
      'medium-small': tw('size-[28px]'),
      small: tw('size-[20px]'),
    }),
    []
  );
  const sizeClass = sizeMap[size];

  return (
    <div
      className={classNames(
        tw('relative rounded-full'),
        sizeClass,
        isActive ? tw('border-2 border-border-selected') : undefined,
        !backgroundColor ? tw('bg-color-label-light-disabled') : undefined
      )}
      style={{ backgroundColor }}
    >
      <EmojiOrMoon
        emoji={emoji}
        forceLightTheme={forceLightTheme}
        i18n={i18n}
        size={size}
      />
    </div>
  );
}

function ScheduleSummary({
  i18n,
  scheduleDays,
}: {
  i18n: LocalizerType;
  scheduleDays: ScheduleDays;
}): string {
  const daysInUIOrder = React.useMemo(() => {
    return [
      {
        dayOfWeek: DayOfWeek.SUNDAY,
        label: i18n('icu:NotificationProfiles--schedule-sunday-short'),
      },
      {
        dayOfWeek: DayOfWeek.MONDAY,
        label: i18n('icu:NotificationProfiles--schedule-monday-short'),
      },
      {
        dayOfWeek: DayOfWeek.TUESDAY,
        label: i18n('icu:NotificationProfiles--schedule-tuesday-short'),
      },
      {
        dayOfWeek: DayOfWeek.WEDNESDAY,
        label: i18n('icu:NotificationProfiles--schedule-wednesday-short'),
      },
      {
        dayOfWeek: DayOfWeek.THURSDAY,
        label: i18n('icu:NotificationProfiles--schedule-thursday-short'),
      },
      {
        dayOfWeek: DayOfWeek.FRIDAY,
        label: i18n('icu:NotificationProfiles--schedule-friday-short'),
      },
      {
        dayOfWeek: DayOfWeek.SATURDAY,
        label: i18n('icu:NotificationProfiles--schedule-saturday-short'),
      },
    ];
  }, [i18n]);

  if (isEqual(scheduleDays, DEFAULT_SCHEDULE)) {
    return i18n('icu:NotificationProfiles--schedule-weekdays');
  }
  if (isEqual(scheduleDays, WEEKEND_SCHEDULE)) {
    return i18n('icu:NotificationProfiles--schedule-weekends');
  }
  if (isEqual(scheduleDays, DAILY_SCHEDULE)) {
    return i18n('icu:NotificationProfiles--schedule-daily');
  }

  let result = '';
  daysInUIOrder.forEach(day => {
    if (!scheduleDays[day.dayOfWeek]) {
      return;
    }

    if (result) {
      result += i18n('icu:NotificationProfiles--schedule-separator');
    }

    result += day.label;
  });

  return result;
}

const HOURS_24 = range(0, 24);
const HOURS_12 = range(1, 13);
const MINUTES = range(0, 60);

function TimePicker({
  i18n,
  isDisabled,
  labelId,
  theme,
  time,
  onUpdateTime,
}: {
  i18n: LocalizerType;
  isDisabled: boolean;
  labelId: string;
  theme: ThemeType;
  time: number;
  onUpdateTime: (value: number) => void;
}) {
  const [isShowingPopup, setIsShowingPopup] = React.useState(false);
  const use24HourTime = need24HourTime();
  const AM_PM: Array<PERIOD> = ['AM', 'PM'];
  const periodLookup = React.useMemo(() => {
    return {
      AM: i18n('icu:NotificationProfile--am'),
      PM: i18n('icu:NotificationProfile--pm'),
    };
  }, [i18n]);
  const [timeFieldElement, setTimeFieldElement] = React.useState<
    HTMLDivElement | undefined
  >();
  const [popupElement, setPopupElement] = React.useState<
    HTMLDivElement | undefined
  >();
  const { minutes, hours, period } = getTimeDetails(time, use24HourTime);
  const refMerger = useRefMerger();
  const selectedHour = React.useRef<HTMLButtonElement | null>(null);
  const selectedMinute = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (!isShowingPopup || !popupElement) {
      return noop;
    }
    return handleOutsideClick(
      (_target, event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        setIsShowingPopup(false);
        return true;
      },
      {
        containerElements: [popupElement],
        name: 'TimePicker.popup',
      }
    );
  }, [isShowingPopup, popupElement, setIsShowingPopup]);

  React.useEffect(() => {
    if (!isShowingPopup || !popupElement) {
      return;
    }
    if (selectedHour.current) {
      selectedHour.current.focus();
    }
    if (selectedMinute.current) {
      selectedMinute.current.scrollIntoView();
    }
  }, [isShowingPopup, popupElement, setIsShowingPopup]);

  useEscapeHandling(
    isShowingPopup ? () => setIsShowingPopup(false) : undefined
  );

  return (
    <>
      {isShowingPopup && (
        <Popper
          placement="bottom-end"
          modifiers={[offsetDistanceModifier(6)]}
          referenceElement={timeFieldElement}
        >
          {({ ref, style }) => (
            <div
              ref={refMerger(ref, (element: HTMLDivElement | null) =>
                setPopupElement(element ?? undefined)
              )}
              style={style}
              className={classNames(
                'TimePickerPopup',
                tw(
                  'flex h-[244px] rounded-[10px] bg-background-secondary p-1 shadow-elevation-1'
                ),
                use24HourTime ? tw('w-[102px]') : tw('w-[150px]'),
                theme ? themeClassName2(theme) : undefined
              )}
            >
              <div className={tw('w-[46px] overflow-y-scroll')}>
                {(use24HourTime ? HOURS_24 : HOURS_12).map(hour => {
                  const isSelected = hour === hours;

                  return (
                    <button
                      key={hour.toString()}
                      ref={isSelected ? selectedHour : null}
                      className={classNames(
                        tw('w-[46px] rounded-sm py-[7px] type-body-medium'),
                        isSelected ? tw('bg-fill-secondary') : null
                      )}
                      type="button"
                      onClick={() => {
                        const newTime = makeTime(hour, minutes, period);
                        onUpdateTime(newTime);
                      }}
                    >
                      {hour}
                    </button>
                  );
                })}
              </div>
              <div className={tw('ms-0.5 w-[46px] overflow-y-scroll')}>
                {MINUTES.map(minute => {
                  const isSelected = minute === minutes;

                  return (
                    <button
                      key={minute.toString()}
                      ref={isSelected ? selectedMinute : null}
                      className={classNames(
                        tw('w-[46px] rounded-sm py-[7px] type-body-medium'),
                        isSelected ? tw('bg-fill-secondary') : null
                      )}
                      type="button"
                      onClick={() => {
                        const newTime = makeTime(hours, minute, period);
                        onUpdateTime(newTime);
                      }}
                    >
                      {addLeadingZero(minute)}
                    </button>
                  );
                })}
              </div>
              {!use24HourTime ? (
                <div className={tw('ms-0.5 w-[46px] overflow-y-scroll')}>
                  {AM_PM.map(item => {
                    const isSelected = item === period;

                    return (
                      <button
                        key={item}
                        className={classNames(
                          tw('w-[46px] rounded-sm py-[7px] type-body-medium'),
                          isSelected ? tw('bg-fill-secondary') : null
                        )}
                        type="button"
                        onClick={() => {
                          const newTime = makeTime(hours, minutes, item);
                          onUpdateTime(newTime);
                        }}
                      >
                        {periodLookup[item]}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}
        </Popper>
      )}
      <TimeField
        ref={element => {
          setTimeFieldElement(element ?? undefined);
        }}
        className={tw(
          'flex items-center rounded-lg border-[2.5px] border-transparent bg-fill-secondary px-2 py-0.5 focus-within:border-border-focused'
        )}
        aria-labelledby={labelId}
        hourCycle={use24HourTime ? 24 : 12}
        isDisabled={isDisabled}
        minValue={new Time(0, 0)}
        maxValue={new Time(23, 59)}
        onChange={value => {
          if (!value) {
            return;
          }
          onUpdateTime(parseTimeFromInput(value));
        }}
        value={formatTimeForInput(time)}
      >
        <DateInput
          className={tw('inline-flex min-w-[5em] items-center leading-none')}
        >
          {segment => {
            // We don't need the space between the time and the am/pm
            if (segment.type === 'literal' && segment.text === ' ') {
              return <span />;
            }
            if (segment.type === 'literal') {
              // eslint-disable-next-line no-param-reassign
              segment.text = i18n('icu:NotificationProfile--time-separator');
            }
            return (
              <DateSegment
                className={classNames(
                  tw(
                    'inline-block px-[1px] type-body-medium outline-none focus:bg-fill-selected'
                  ),
                  segment.type === 'literal' ? tw('px-[3px]') : null,
                  segment.type === 'dayPeriod' ? tw('ps-[2px]') : null,
                  segment.type === 'hour' ? tw('flex-grow text-end') : null,
                  isDisabled ? tw('text-label-placeholder') : null
                )}
                segment={segment}
              />
            );
          }}
        </DateInput>
        <button
          className={classNames(
            tw(
              'ms-3 p-0.5 leading-none outline-0 focus-visible:bg-fill-selected'
            ),
            isDisabled ? tw('text-label-placeholder') : null
          )}
          type="button"
          onClick={() => {
            if (isDisabled) {
              return;
            }
            setIsShowingPopup(!isShowingPopup);
          }}
        >
          <AxoSymbol.Icon
            size={14}
            symbol="chevron-down"
            label={i18n('icu:NotificationProfiles--open-time-picker')}
          />
        </button>
      </TimeField>
    </>
  );
}
