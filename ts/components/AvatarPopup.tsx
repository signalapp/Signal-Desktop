import * as React from 'react';
import classNames from 'classnames';
import { LocalizerType } from '../types/Util';
import { Avatar, Props as AvatarProps } from './Avatar';

import { isEmpty } from 'lodash';

export type Props = {
  readonly i18n: LocalizerType;

  onViewPreferences: () => unknown;
  onViewArchive: () => unknown;

  // Matches Popper's RefHandler type
  innerRef?: (ref: HTMLElement | null) => void;
  style: React.CSSProperties;
} & AvatarProps;

export const AvatarPopup = (props: Props) => {
  const focusRef = React.useRef<HTMLButtonElement>(null);
  const {
    i18n,
    profileName,
    phoneNumber,
    onViewPreferences,
    onViewArchive,
    style,
  } = props;

  const hasProfileName = !isEmpty(profileName);

  // Note: mechanisms to dismiss this view are all in its host, MainHeader

  // Focus first button after initial render, restore focus on teardown
  React.useEffect(() => {
    const lastFocused = document.activeElement as any;
    if (focusRef.current) {
      focusRef.current.focus();
    }

    return () => {
      if (lastFocused && lastFocused.focus) {
        lastFocused.focus();
      }
    };
  }, []);

  return (
    <div style={style} className="module-avatar-popup">
      <div className="module-avatar-popup__profile">
        <Avatar {...props} size={52} />
        <div className="module-avatar-popup__profile__text">
          <div className="module-avatar-popup__profile__name">
            {hasProfileName ? profileName : phoneNumber}
          </div>
          {hasProfileName ? (
            <div className="module-avatar-popup__profile__number">
              {phoneNumber}
            </div>
          ) : null}
        </div>
      </div>
      <hr className="module-avatar-popup__divider" />
      <button
        ref={focusRef}
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
          {i18n('mainMenuSettings')}
        </div>
      </button>
      <button className="module-avatar-popup__item" onClick={onViewArchive}>
        <div
          className={classNames(
            'module-avatar-popup__item__icon',
            'module-avatar-popup__item__icon-archive'
          )}
        />
        <div className="module-avatar-popup__item__text">
          {i18n('avatarMenuViewArchive')}
        </div>
      </button>
    </div>
  );
};
