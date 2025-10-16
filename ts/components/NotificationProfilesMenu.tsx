// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util.std.js';
import {
  getMidnight,
  type NotificationProfileIdString,
  type NotificationProfileOverride,
  type NotificationProfileType,
} from '../types/NotificationProfile.std.js';
import { DAY, HOUR, SECOND } from '../util/durations/index.std.js';
import { formatTimestamp } from '../util/formatTimestamp.dom.js';
import { AxoDropdownMenu } from '../axo/AxoDropdownMenu.dom.js';
import { ProfileAvatar } from './PreferencesNotificationProfiles.dom.js';

export type Props = Readonly<{
  activeProfileId: NotificationProfileIdString | undefined;
  allProfiles: ReadonlyArray<NotificationProfileType>;
  currentOverride: NotificationProfileOverride | undefined;
  i18n: LocalizerType;
  loading: boolean;
  onGoToSettings: () => void;
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
  loading,
  onGoToSettings,
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
    <>
      <AxoDropdownMenu.Header
        label={i18n('icu:NotificationProfileMenu--header')}
        description={enabledLabel}
      />
      {profilesToRender.length > 0 ? <AxoDropdownMenu.Separator /> : undefined}
      {profilesToRender.map((profile, index) => {
        const isActive = activeProfileId && profile.id === activeProfileId;

        return (
          <React.Fragment key={profile.id}>
            {index > 0 && <AxoDropdownMenu.ContentSeparator />}
            <AxoDropdownMenu.CustomItem
              key={profile.id}
              leading={
                <ProfileAvatar
                  i18n={i18n}
                  isActive={isActive}
                  profile={profile}
                  size="small"
                />
              }
              text={profile.name}
              onSelect={event => {
                event.preventDefault();
                setProfileOverride(profile.id, !isActive);
              }}
            />
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
      <AxoDropdownMenu.Item onSelect={onGoToSettings} symbol="settings">
        {i18n('icu:NotificationProfileMenu--settings')}
      </AxoDropdownMenu.Item>
    </>
  );
}
