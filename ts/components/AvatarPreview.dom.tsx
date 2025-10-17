// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties } from 'react';
import React, { useEffect, useState } from 'react';
import lodash from 'lodash';

import { createLogger } from '../logging/log.std.js';
import type { LocalizerType } from '../types/Util.std.js';
import { Spinner } from './Spinner.dom.js';
import type { AvatarColorType } from '../types/Colors.std.js';
import { AvatarColors } from '../types/Colors.std.js';
import { getInitials } from '../util/getInitials.std.js';
import { imagePathToBytes } from '../util/imagePathToBytes.dom.js';
import { type ConversationType } from '../state/ducks/conversations.preload.js';

const { noop } = lodash;

const log = createLogger('AvatarPreview');

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
  showUploadButton?: boolean;
  style?: CSSProperties;
} & Pick<ConversationType, 'avatarPlaceholderGradient' | 'hasAvatar'>;

enum ImageStatus {
  Nothing = 'nothing',
  Loading = 'loading',
  HasImage = 'has-image',
  HasPlaceholder = 'has-placeholder',
}

export function AvatarPreview({
  avatarPlaceholderGradient,
  avatarColor = AvatarColors[0],
  avatarUrl,
  avatarValue,
  conversationTitle,
  hasAvatar,
  i18n,
  isEditable,
  isGroup,
  noteToSelf,
  onAvatarLoaded,
  onClear,
  onClick,
  showUploadButton,
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
  } else if (hasAvatar && avatarPlaceholderGradient) {
    imageStatus = ImageStatus.HasPlaceholder;
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
          {showUploadButton && <div className="AvatarPreview__upload" />}
        </div>
      </div>
    );
  }

  if (imageStatus === ImageStatus.HasPlaceholder) {
    return (
      <div className="AvatarPreview">
        <div
          className="AvatarPreview__avatar"
          style={{
            ...componentStyle,
            backgroundImage: avatarPlaceholderGradient
              ? `linear-gradient(to bottom, ${avatarPlaceholderGradient[0]}, ${avatarPlaceholderGradient[1]})`
              : undefined,
          }}
        />
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
        {showUploadButton && <div className="AvatarPreview__upload" />}
      </div>
    </div>
  );
}
