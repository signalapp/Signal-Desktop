// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties } from 'react';
import React, { useEffect, useState } from 'react';
import { noop } from 'lodash';

import * as log from '../logging/log';
import type { LocalizerType } from '../types/Util';
import { Spinner } from './Spinner';
import type { AvatarColorType } from '../types/Colors';
import { AvatarColors } from '../types/Colors';
import { getInitials } from '../util/getInitials';
import { imagePathToBytes } from '../util/imagePathToBytes';

export type PropsType = {
  avatarColor?: AvatarColorType;
  avatarUrl?: string;
  avatarValue?: Uint8Array;
  conversationTitle?: string;
  i18n: LocalizerType;
  isEditable?: boolean;
  isGroup?: boolean;
  noteToSelf?: boolean;
  onAvatarLoaded?: (avatarBuffer: Uint8Array) => unknown;
  onClear?: () => unknown;
  onClick?: () => unknown;
  style?: CSSProperties;
};

enum ImageStatus {
  Nothing = 'nothing',
  Loading = 'loading',
  HasImage = 'has-image',
}

export function AvatarPreview({
  avatarColor = AvatarColors[0],
  avatarUrl,
  avatarValue,
  conversationTitle,
  i18n,
  isEditable,
  isGroup,
  noteToSelf,
  onAvatarLoaded,
  onClear,
  onClick,
  style = {},
}: PropsType): JSX.Element {
  const [avatarPreview, setAvatarPreview] = useState<Uint8Array | undefined>();

  // Loads the initial avatarUrl if one is provided, but only if we're in editable mode.
  //   If we're not editable, we assume that we either have an avatarUrl or we show a
  //   default avatar.
  useEffect(() => {
    if (!isEditable) {
      return;
    }

    if (!avatarUrl) {
      return noop;
    }

    let shouldCancel = false;

    void (async () => {
      try {
        const buffer = await imagePathToBytes(avatarUrl);
        if (shouldCancel) {
          return;
        }
        setAvatarPreview(buffer);
        onAvatarLoaded?.(buffer);
      } catch (err) {
        if (shouldCancel) {
          return;
        }
        log.warn(
          `Failed to convert image URL to array buffer. Error message: ${
            err && err.message
          }`
        );
      }
    })();

    return () => {
      shouldCancel = true;
    };
  }, [avatarUrl, onAvatarLoaded, isEditable]);

  // Ensures that when avatarValue changes we generate new URLs
  useEffect(() => {
    if (avatarValue) {
      setAvatarPreview(avatarValue);
    } else {
      setAvatarPreview(undefined);
    }
  }, [avatarValue]);

  // Creates the object URL to render the Uint8Array image
  const [objectUrl, setObjectUrl] = useState<undefined | string>();

  useEffect(() => {
    if (!avatarPreview) {
      setObjectUrl(undefined);
      return noop;
    }

    const url = URL.createObjectURL(new Blob([avatarPreview]));
    setObjectUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [avatarPreview]);

  let imageStatus: ImageStatus;
  let encodedPath: string | undefined;
  if (avatarValue && !objectUrl) {
    imageStatus = ImageStatus.Loading;
  } else if (noteToSelf) {
    imageStatus = ImageStatus.Nothing;
  } else if (objectUrl) {
    encodedPath = objectUrl;
    imageStatus = ImageStatus.HasImage;
  } else if (avatarUrl) {
    encodedPath = avatarUrl;
    imageStatus = ImageStatus.HasImage;
  } else {
    imageStatus = ImageStatus.Nothing;
  }

  const isLoading = imageStatus === ImageStatus.Loading;

  const clickProps = onClick
    ? {
        role: 'button',
        onClick,
        tabIndex: 0,
        onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            onClick();
          }
        },
      }
    : {};
  const componentStyle = {
    ...style,
  };
  if (onClick) {
    componentStyle.cursor = 'pointer';
  }

  if (imageStatus === ImageStatus.Nothing) {
    let content: JSX.Element | string | undefined;
    if (isGroup) {
      content = (
        <div
          className={`BetterAvatarBubble--${avatarColor}--icon AvatarPreview__group`}
        />
      );
    } else if (noteToSelf) {
      content = (
        <div
          className={`BetterAvatarBubble--${avatarColor}--icon AvatarPreview__note_to_self`}
        />
      );
    } else {
      content = getInitials(conversationTitle);
    }

    return (
      <div className="AvatarPreview">
        <div
          className={`AvatarPreview__avatar BetterAvatarBubble--${avatarColor}`}
          {...clickProps}
          style={componentStyle}
        >
          {content}
          {isEditable && <div className="AvatarPreview__upload" />}
        </div>
      </div>
    );
  }

  return (
    <div className="AvatarPreview">
      <div
        className={`AvatarPreview__avatar AvatarPreview__avatar--${imageStatus}`}
        {...clickProps}
        style={
          imageStatus === ImageStatus.HasImage && encodedPath
            ? {
                ...componentStyle,
                backgroundImage: `url('${encodedPath}')`,
              }
            : componentStyle
        }
      >
        {isLoading && (
          <Spinner size="70px" svgSize="normal" direction="on-avatar" />
        )}
        {imageStatus === ImageStatus.HasImage && onClear && (
          <button
            aria-label={i18n('icu:delete')}
            className="AvatarPreview__clear"
            onClick={onClear}
            tabIndex={-1}
            type="button"
          />
        )}
        {isEditable && <div className="AvatarPreview__upload" />}
      </div>
    </div>
  );
}
