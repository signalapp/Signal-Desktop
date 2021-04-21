// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  FunctionComponent,
  ReactNode,
  useEffect,
  useState,
} from 'react';
import classNames from 'classnames';

import { Spinner } from './Spinner';

import { getInitials } from '../util/getInitials';
import { LocalizerType } from '../types/Util';
import { ColorType } from '../types/Colors';
import * as log from '../logging/log';

export enum AvatarSize {
  TWENTY_EIGHT = 28,
  THIRTY_TWO = 32,
  FIFTY_TWO = 52,
  EIGHTY = 80,
  NINETY_SIX = 96,
  ONE_HUNDRED_TWELVE = 112,
}

export type Props = {
  avatarPath?: string;
  color?: ColorType;
  loading?: boolean;

  conversationType: 'group' | 'direct';
  noteToSelf?: boolean;
  title: string;
  name?: string;
  phoneNumber?: string;
  profileName?: string;
  size: AvatarSize;

  onClick?: () => unknown;

  // Matches Popper's RefHandler type
  innerRef?: React.Ref<HTMLDivElement>;

  i18n: LocalizerType;
} & Pick<React.HTMLProps<HTMLDivElement>, 'className'>;

export const Avatar: FunctionComponent<Props> = ({
  avatarPath,
  className,
  color,
  conversationType,
  i18n,
  innerRef,
  loading,
  noteToSelf,
  onClick,
  size,
  title,
}) => {
  const [imageBroken, setImageBroken] = useState(false);

  useEffect(() => {
    setImageBroken(false);
  }, [avatarPath]);

  const initials = getInitials(title);
  const hasImage = !noteToSelf && avatarPath && !imageBroken;
  const shouldUseInitials =
    !hasImage && conversationType === 'direct' && Boolean(initials);

  let contents: ReactNode;
  if (loading) {
    const svgSize = size < 40 ? 'small' : 'normal';
    contents = (
      <div className="module-Avatar__spinner-container">
        <Spinner
          size={`${size - 8}px`}
          svgSize={svgSize}
          direction="on-avatar"
        />
      </div>
    );
  } else if (hasImage) {
    contents = (
      <img
        onError={() => {
          log.warn('Avatar: Image failed to load; failing over to placeholder');
          setImageBroken(true);
        }}
        alt={i18n('contactAvatarAlt', [title])}
        src={avatarPath}
      />
    );
  } else if (noteToSelf) {
    contents = (
      <div
        className={classNames(
          'module-Avatar__icon',
          'module-Avatar__icon--note-to-self'
        )}
      />
    );
  } else if (shouldUseInitials) {
    contents = (
      <div
        className="module-Avatar__label"
        style={{ fontSize: Math.ceil(size * 0.5) }}
      >
        {initials}
      </div>
    );
  } else {
    contents = (
      <div
        className={classNames(
          'module-Avatar__icon',
          `module-Avatar__icon--${conversationType}`
        )}
      />
    );
  }

  if (onClick) {
    contents = (
      <button className="module-Avatar__button" type="button" onClick={onClick}>
        {contents}
      </button>
    );
  }

  return (
    <div
      className={classNames(
        'module-Avatar',
        hasImage ? 'module-Avatar--with-image' : 'module-Avatar--no-image',
        {
          [`module-Avatar--${color}`]: !hasImage,
        },
        className
      )}
      style={{
        minWidth: size,
        width: size,
        height: size,
      }}
      ref={innerRef}
    >
      {contents}
    </div>
  );
};
