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
import lodash from 'lodash';

import { filterDOMProps } from '@react-aria/utils';
import type { AvatarColorType } from '../types/Colors.std.js';
import type { BadgeType } from '../badges/types.std.js';
import type { LocalizerType } from '../types/Util.std.js';
import { createLogger } from '../logging/log.std.js';
import { BadgeImageTheme } from '../badges/BadgeImageTheme.std.js';
import { HasStories } from '../types/Stories.std.js';
import { Spinner } from './Spinner.dom.js';
import { ThemeType } from '../types/Util.std.js';
import { assertDev } from '../util/assert.std.js';
import { getBadgeImageFileLocalPath } from '../badges/getBadgeImageFileLocalPath.std.js';
import { getInitials } from '../util/getInitials.std.js';
import { isBadgeVisible } from '../badges/isBadgeVisible.std.js';
import { SIGNAL_AVATAR_PATH } from '../types/SignalConversation.std.js';
import { getAvatarPlaceholderGradient } from '../utils/getAvatarPlaceholderGradient.std.js';

const { noop } = lodash;

const log = createLogger('Avatar');

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
  SEVENTY_TWO = 72,
  SIXTY_FOUR = 64,
  EIGHTY = 80,
  NINETY_SIX = 96,
  TWO_HUNDRED_SIXTEEN = 216,
}

type BadgePlacementType = { bottom: number; right: number };

export type Props = {
  avatarUrl?: string;
  avatarPlaceholderGradient?: Readonly<[string, string]>;
  blur?: AvatarBlur;
  color?: AvatarColorType;
  hasAvatar?: boolean;
  loading?: boolean;
  conversationType: 'group' | 'direct' | 'callLink';
  noteToSelf?: boolean;
  phoneNumber?: string;
  profileName?: string;
  sharedGroupNames: ReadonlyArray<string>;
  size: AvatarSize;
  title: string;
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
  [72, { bottom: -6, right: -6 }],
  [80, { bottom: -8, right: 0 }],
  [88, { bottom: -4, right: 3 }],
  [112, { bottom: -4, right: 3 }],
]);

export function Avatar({
  avatarUrl,
  avatarPlaceholderGradient = getAvatarPlaceholderGradient(0),
  badge,
  className,
  color = 'A200',
  conversationType,
  hasAvatar,
  i18n,
  innerRef,
  loading,
  noteToSelf,
  onClick,
  onClickBadge,
  size,
  theme,
  title,
  searchResult,
  storyRing,
  blur = AvatarBlur.NoBlur,
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
      log.warn('Image failed to load; failing over to placeholder');
      setImageBroken(true);
    };

    return () => {
      image.onerror = noop;
    };
  }, [avatarUrl]);

  const initials = getInitials(title);
  const hasLocalImage = !noteToSelf && avatarUrl && avatarUrl.length > 0;
  const hasValidImage = hasLocalImage && !imageBroken;
  const shouldUseInitials =
    !hasValidImage &&
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
  } else if (hasValidImage) {
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
  } else if (hasAvatar && !hasLocalImage) {
    contentsChildren = (
      <>
        <div
          className="module-Avatar__image"
          style={{
            backgroundImage: `linear-gradient(to bottom, ${avatarPlaceholderGradient[0]}, ${avatarPlaceholderGradient[1]})`,
          }}
        />
        {blur === AvatarBlur.BlurPictureWithClickToView && (
          <div className="module-Avatar__click-to-view">{i18n('icu:view')}</div>
        )}
      </>
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
