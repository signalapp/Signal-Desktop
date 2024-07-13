// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  AriaAttributes,
  CSSProperties,
  MouseEvent,
  ReactChild,
  ReactNode,
} from 'react';
import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { noop } from 'lodash';

import { filterDOMProps } from '@react-aria/utils';
import type { AvatarColorType } from '../types/Colors';
import type { BadgeType } from '../badges/types';
import type { LocalizerType } from '../types/Util';
import * as log from '../logging/log';
import { BadgeImageTheme } from '../badges/BadgeImageTheme';
import { HasStories } from '../types/Stories';
import { Spinner } from './Spinner';
import { ThemeType } from '../types/Util';
import { assertDev } from '../util/assert';
import { getBadgeImageFileLocalPath } from '../badges/getBadgeImageFileLocalPath';
import { getInitials } from '../util/getInitials';
import { isBadgeVisible } from '../badges/isBadgeVisible';
import { shouldBlurAvatar } from '../util/shouldBlurAvatar';
import { SIGNAL_AVATAR_PATH } from '../types/SignalConversation';

export enum AvatarBlur {
  NoBlur,
  BlurPicture,
  BlurPictureWithClickToView,
}

export enum AvatarSize {
  TWENTY = 20,
  TWENTY_FOUR = 24,
  TWENTY_EIGHT = 28,
  THIRTY = 30,
  THIRTY_TWO = 32,
  THIRTY_SIX = 36,
  FORTY = 40,
  FORTY_EIGHT = 48,
  FIFTY_TWO = 52,
  SIXTY_FOUR = 64,
  EIGHTY = 80,
  NINETY_SIX = 96,
  TWO_HUNDRED_SIXTEEN = 216,
}

type BadgePlacementType = { bottom: number; right: number };

export type Props = {
  avatarUrl?: string;
  blur?: AvatarBlur;
  color?: AvatarColorType;
  loading?: boolean;

  acceptedMessageRequest: boolean;
  conversationType: 'group' | 'direct' | 'callLink';
  isMe: boolean;
  noteToSelf?: boolean;
  phoneNumber?: string;
  profileName?: string;
  sharedGroupNames: ReadonlyArray<string>;
  size: AvatarSize;
  title: string;
  unblurredAvatarUrl?: string;
  searchResult?: boolean;
  storyRing?: HasStories;

  onClick?: (event: MouseEvent<HTMLButtonElement>) => unknown;
  onClickBadge?: (event: MouseEvent<HTMLButtonElement>) => unknown;

  // Matches Popper's RefHandler type
  innerRef?: React.Ref<HTMLDivElement>;

  i18n: LocalizerType;
} & (
  | { badge: undefined; theme?: ThemeType }
  | { badge: BadgeType; theme: ThemeType }
) &
  Pick<React.HTMLProps<HTMLDivElement>, 'className'> &
  AriaAttributes;

const BADGE_PLACEMENT_BY_SIZE = new Map<number, BadgePlacementType>([
  [28, { bottom: -4, right: -2 }],
  [30, { bottom: -4, right: -2 }],
  [32, { bottom: -4, right: -2 }],
  [36, { bottom: -3, right: 0 }],
  [40, { bottom: -6, right: -4 }],
  [48, { bottom: -6, right: -4 }],
  [52, { bottom: -6, right: -2 }],
  [56, { bottom: -6, right: 0 }],
  [64, { bottom: -6, right: 0 }],
  [80, { bottom: -8, right: 0 }],
  [88, { bottom: -4, right: 3 }],
  [112, { bottom: -4, right: 3 }],
]);

const getDefaultBlur = (
  ...args: Parameters<typeof shouldBlurAvatar>
): AvatarBlur =>
  shouldBlurAvatar(...args) ? AvatarBlur.BlurPicture : AvatarBlur.NoBlur;

export function Avatar({
  acceptedMessageRequest,
  avatarUrl,
  badge,
  className,
  color = 'A200',
  conversationType,
  i18n,
  isMe,
  innerRef,
  loading,
  noteToSelf,
  onClick,
  onClickBadge,
  sharedGroupNames,
  size,
  theme,
  title,
  unblurredAvatarUrl,
  searchResult,
  storyRing,
  blur = getDefaultBlur({
    acceptedMessageRequest,
    avatarUrl,
    isMe,
    sharedGroupNames,
    unblurredAvatarUrl,
  }),
  ...ariaProps
}: Props): JSX.Element {
  const [imageBroken, setImageBroken] = useState(false);

  useEffect(() => {
    setImageBroken(false);
  }, [avatarUrl]);

  useEffect(() => {
    if (!avatarUrl) {
      return noop;
    }

    const image = new Image();
    image.src = avatarUrl;
    image.onerror = () => {
      log.warn('Avatar: Image failed to load; failing over to placeholder');
      setImageBroken(true);
    };

    return () => {
      image.onerror = noop;
    };
  }, [avatarUrl]);

  const initials = getInitials(title);
  const hasImage = !noteToSelf && avatarUrl && !imageBroken;
  const shouldUseInitials =
    !hasImage &&
    conversationType === 'direct' &&
    Boolean(initials) &&
    title !== i18n('icu:unknownContact');

  let contentsChildren: ReactNode;
  if (loading) {
    const svgSize = size < 40 ? 'small' : 'normal';
    contentsChildren = (
      <div className="module-Avatar__spinner-container">
        <Spinner
          size={`${size - 8}px`}
          svgSize={svgSize}
          direction="on-avatar"
        />
      </div>
    );
  } else if (hasImage) {
    assertDev(avatarUrl, 'avatarUrl should be defined here');

    assertDev(
      blur !== AvatarBlur.BlurPictureWithClickToView ||
        size >= AvatarSize.EIGHTY,
      'Rendering "click to view" for a small avatar. This may not render correctly'
    );

    const isBlurred =
      blur === AvatarBlur.BlurPicture ||
      blur === AvatarBlur.BlurPictureWithClickToView;
    contentsChildren = (
      <>
        <div
          className="module-Avatar__image"
          style={{
            backgroundImage: `url('${avatarUrl}')`,
            ...(isBlurred ? { filter: `blur(${Math.ceil(size / 2)}px)` } : {}),
          }}
        />
        {blur === AvatarBlur.BlurPictureWithClickToView && (
          <div className="module-Avatar__click-to-view">{i18n('icu:view')}</div>
        )}
      </>
    );
  } else if (searchResult) {
    contentsChildren = (
      <div
        className={classNames(
          'module-Avatar__icon',
          'module-Avatar__icon--search-result'
        )}
      />
    );
  } else if (noteToSelf) {
    contentsChildren = (
      <div
        className={classNames(
          'module-Avatar__icon',
          'module-Avatar__icon--note-to-self'
        )}
      />
    );
  } else if (shouldUseInitials) {
    contentsChildren = (
      <div
        aria-hidden="true"
        className="module-Avatar__label"
        style={{ fontSize: Math.ceil(size * 0.45) }}
      >
        {initials}
      </div>
    );
  } else {
    contentsChildren = (
      <div
        className={classNames(
          'module-Avatar__icon',
          `module-Avatar__icon--${conversationType}`
        )}
      />
    );
  }

  let contents: ReactChild;
  const contentsClassName = classNames(
    'module-Avatar__contents',
    `module-Avatar__contents--${color}`
  );
  if (onClick) {
    contents = (
      <button
        {...filterDOMProps(ariaProps)}
        className={contentsClassName}
        type="button"
        onClick={onClick}
      >
        {contentsChildren}
      </button>
    );
  } else {
    contents = <div className={contentsClassName}>{contentsChildren}</div>;
  }

  let badgeNode: ReactNode;
  const badgeSize = _getBadgeSize(size);
  if (badge && theme && !noteToSelf && badgeSize && isBadgeVisible(badge)) {
    const badgePlacement = _getBadgePlacement(size);
    const badgeTheme =
      theme === ThemeType.light ? BadgeImageTheme.Light : BadgeImageTheme.Dark;
    const badgeImagePath = getBadgeImageFileLocalPath(
      badge,
      badgeSize,
      badgeTheme
    );
    if (badgeImagePath) {
      const positionStyles: CSSProperties = {
        width: badgeSize,
        height: badgeSize,
        ...badgePlacement,
      };
      if (onClickBadge) {
        badgeNode = (
          <button
            aria-label={badge.name}
            className="module-Avatar__badge module-Avatar__badge--button"
            onClick={onClickBadge}
            style={{
              backgroundImage: `url('${encodeURI(badgeImagePath)}')`,
              ...positionStyles,
            }}
            type="button"
          />
        );
      } else {
        badgeNode = (
          <img
            alt={badge.name}
            className="module-Avatar__badge module-Avatar__badge--static"
            src={badgeImagePath}
            style={positionStyles}
          />
        );
      }
    }
  }

  return (
    <div
      aria-label={i18n('icu:contactAvatarAlt', {
        name: title,
      })}
      className={classNames(
        'module-Avatar',
        Boolean(storyRing) && 'module-Avatar--with-story',
        storyRing === HasStories.Unread && 'module-Avatar--with-story--unread',
        className,
        avatarUrl === SIGNAL_AVATAR_PATH
          ? 'module-Avatar--signal-official'
          : undefined
      )}
      style={{
        minWidth: size,
        width: size,
        height: size,
      }}
      ref={innerRef}
    >
      {contents}
      {badgeNode}
    </div>
  );
}

// This is only exported for testing.
export function _getBadgeSize(avatarSize: number): undefined | number {
  if (avatarSize < 24) {
    return undefined;
  }
  if (avatarSize <= 36) {
    return 16;
  }
  if (avatarSize <= 64) {
    return 24;
  }
  if (avatarSize <= 112) {
    return 36;
  }
  return Math.round(avatarSize * 0.4);
}

// This is only exported for testing.
export function _getBadgePlacement(
  avatarSize: number
): Readonly<BadgePlacementType> {
  return BADGE_PLACEMENT_BY_SIZE.get(avatarSize) || { bottom: 0, right: 0 };
}
