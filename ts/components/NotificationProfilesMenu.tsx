// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util.js';
import {
  getMidnight,
  type NotificationProfileIdString,
  type NotificationProfileOverride,
  type NotificationProfileType,
} from '../types/NotificationProfile.js';
import { DAY, HOUR, SECOND } from '../util/durations/index.js';
import { formatTimestamp } from '../util/formatTimestamp.js';
import { AxoDropdownMenu } from '../axo/AxoDropdownMenu.js';
import { tw } from '../axo/tw.js';
import { ProfileAvatar } from './PreferencesNotificationProfiles.js';
import { AxoSymbol } from '../axo/AxoSymbol.js';

export type Props = Readonly<{
  activeProfileId: NotificationProfileIdString | undefined;
  allProfiles: ReadonlyArray<NotificationProfileType>;
  currentOverride: NotificationProfileOverride | undefined;
  i18n: LocalizerType;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
  onGoToSettings: () => void;
  trigger: React.ReactNode;
  setProfileOverride: (
    id: NotificationProfileIdString,
    enabled: boolean,
    endsAtMs?: number
  ) => void;
}>;

function getSixPm() {
  const midnight = getMidnight(Date.now());
  return midnight + 18 * HOUR;
}
function getEightAm() {
  const midnight = getMidnight(Date.now());
  return midnight + 8 * HOUR;
}
function getEightAmTomorrow() {
  const midnight = getMidnight(Date.now() + DAY);
  return midnight + 8 * HOUR;
}

export function NotificationProfilesMenu({
  activeProfileId,
  allProfiles,
  currentOverride,
  i18n,
  isOpen,
  loading,
  onClose,
  onGoToSettings,
  trigger,
  setProfileOverride,
}: Props): JSX.Element {
  const enabledOverrideEndTime = currentOverride?.enabled?.endsAtMs;
  const [now, setNow] = React.useState(Date.now());
  const [cachedProfiles, setCachedProfiles] = React.useState<
    ReadonlyArray<NotificationProfileType>
  >([]);

  React.useEffect(() => {
    if (!loading) {
      setCachedProfiles(allProfiles);
    }
  }, [loading, allProfiles]);

  let enabledLabel;
  if (activeProfileId && enabledOverrideEndTime) {
    enabledLabel = (
      <div>
        {i18n('icu:NotificationProfileMenu--on-with-end', {
          endTime: formatTimestamp(enabledOverrideEndTime, {
            timeStyle: 'short',
          }),
        })}
      </div>
    );
  } else if (activeProfileId) {
    enabledLabel = <div>{i18n('icu:NotificationProfileMenu--on')}</div>;
  }

  const profilesToRender = loading ? cachedProfiles : allProfiles;

  const sixPm = getSixPm();
  const eightAm = getEightAm();
  const eightAmTomorrow = getEightAmTomorrow();

  let targetTime = sixPm;

  if (now < eightAm) {
    targetTime = eightAm;
  } else if (now > sixPm) {
    targetTime = eightAmTomorrow;
  }

  React.useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 30 * SECOND);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <AxoDropdownMenu.Root
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          onClose();
        }
      }}
    >
      <AxoDropdownMenu.Trigger>{trigger}</AxoDropdownMenu.Trigger>
      <AxoDropdownMenu.Content>
        <div className={tw('col-span-2 p-1.5')}>
          <div className={tw('type-title-small text-label-primary')}>
            {i18n('icu:NotificationProfileMenu--header')}
          </div>
          <div className={tw('type-caption text-label-secondary')}>
            {enabledLabel}
          </div>
        </div>
        {profilesToRender.length > 0 ? (
          <AxoDropdownMenu.Separator />
        ) : undefined}
        {profilesToRender.map((profile, index) => {
          const isActive = activeProfileId && profile.id === activeProfileId;

          return (
            <React.Fragment key={profile.id}>
              {index > 0 && (
                <div
                  key={`${profile.id}_separator`}
                  role="separator"
                  aria-orientation="horizontal"
                  className={tw(
                    'col-span-1 col-start-2 mx-0.5 my-1 border-t-[0.5px] border-border-primary'
                  )}
                />
              )}
              <AxoDropdownMenu.Item
                key={profile.id}
                customIcon={
                  <ProfileAvatar
                    i18n={i18n}
                    isActive={isActive}
                    profile={profile}
                    size="small"
                  />
                }
                onSelect={event => {
                  event.preventDefault();
                  setProfileOverride(profile.id, !isActive);
                }}
              >
                {profile.name}
              </AxoDropdownMenu.Item>
              {isActive ? (
                <AxoDropdownMenu.Item
                  key={`${profile.id}_one-hour`}
                  onSelect={event => {
                    event.preventDefault();
                    setProfileOverride(profile.id, true, Date.now() + HOUR);
                  }}
                >
                  {i18n('icu:NotificationProfileMenu--for-one-hour')}
                </AxoDropdownMenu.Item>
              ) : null}
              {isActive ? (
                <AxoDropdownMenu.Item
                  key={`${profile.id}_until-time`}
                  onSelect={event => {
                    event.preventDefault();
                    setProfileOverride(profile.id, true, targetTime);
                  }}
                >
                  {i18n('icu:NotificationProfileMenu--until-time', {
                    time: formatTimestamp(targetTime, {
                      timeStyle: 'short',
                    }),
                  })}
                </AxoDropdownMenu.Item>
              ) : null}
            </React.Fragment>
          );
        })}
        <AxoDropdownMenu.Separator />
        <AxoDropdownMenu.Item
          onSelect={event => {
            event.preventDefault();
            onGoToSettings();
          }}
          customIcon={
            <span className={tw('p-0.5 leading-0')}>
              <AxoSymbol.Icon size={16} symbol="settings" label={null} />
            </span>
          }
        >
          {i18n('icu:NotificationProfileMenu--settings')}
        </AxoDropdownMenu.Item>
      </AxoDropdownMenu.Content>
    </AxoDropdownMenu.Root>
  );
}
