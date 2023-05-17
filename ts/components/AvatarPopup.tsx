// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import classNames from 'classnames';

import type { Props as AvatarProps } from './Avatar';
import { Avatar, AvatarSize } from './Avatar';
import { useRestoreFocus } from '../hooks/useRestoreFocus';

import type { LocalizerType, ThemeType } from '../types/Util';
import { UserText } from './UserText';

export type Props = {
  readonly i18n: LocalizerType;
  readonly theme: ThemeType;

  hasPendingUpdate: boolean;

  onEditProfile: () => unknown;
  onStartUpdate: () => unknown;
  onViewPreferences: () => unknown;
  onViewArchive: () => unknown;

  // Matches Popper's RefHandler type
  innerRef?: React.Ref<HTMLDivElement>;
  style: React.CSSProperties;
  name?: string;
} & Omit<AvatarProps, 'onClick' | 'size'>;

export function AvatarPopup(props: Props): JSX.Element {
  const {
    hasPendingUpdate,
    i18n,
    name,
    onEditProfile,
    onStartUpdate,
    onViewArchive,
    onViewPreferences,
    phoneNumber,
    profileName,
    style,
    title,
  } = props;

  const shouldShowNumber = Boolean(name || profileName);

  // Note: mechanisms to dismiss this view are all in its host, MainHeader

  // Focus first button after initial render, restore focus on teardown
  const [focusRef] = useRestoreFocus();

  return (
    <div style={style} className="module-avatar-popup">
      <button
        className="module-avatar-popup__profile"
        onClick={onEditProfile}
        ref={focusRef}
        type="button"
      >
        <Avatar {...props} size={AvatarSize.FORTY_EIGHT} />
        <div className="module-avatar-popup__profile__text">
          <div className="module-avatar-popup__profile__name">
            <UserText text={profileName || title} />
          </div>
          {shouldShowNumber ? (
            <div className="module-avatar-popup__profile__number">
              {phoneNumber}
            </div>
          ) : null}
        </div>
      </button>
      <hr className="module-avatar-popup__divider" />
      <button
        type="button"
        className="module-avatar-popup__item"
        onClick={onViewPreferences}
      >
        <div
          className={classNames(
            'module-avatar-popup__item__icon',
            'module-avatar-popup__item__icon-settings'
          )}
        />
        <div className="module-avatar-popup__item__text">
          {i18n('icu:mainMenuSettings')}
        </div>
      </button>
      <button
        type="button"
        className="module-avatar-popup__item"
        onClick={onViewArchive}
      >
        <div
          className={classNames(
            'module-avatar-popup__item__icon',
            'module-avatar-popup__item__icon-archive'
          )}
        />
        <div className="module-avatar-popup__item__text">
          {i18n('icu:avatarMenuViewArchive')}
        </div>
      </button>
      {hasPendingUpdate && (
        <button
          type="button"
          className="module-avatar-popup__item"
          onClick={onStartUpdate}
        >
          <div
            className={classNames(
              'module-avatar-popup__item__icon',
              'module-avatar-popup__item__icon--update'
            )}
          />
          <div className="module-avatar-popup__item__text">
            {i18n('icu:avatarMenuUpdateAvailable')}
          </div>
          <div className="module-avatar-popup__item--badge" />
        </button>
      )}
    </div>
  );
}
