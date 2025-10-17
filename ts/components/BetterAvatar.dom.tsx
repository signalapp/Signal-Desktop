// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MouseEvent } from 'react';
import React, { useEffect, useState } from 'react';
import lodash from 'lodash';
import type { AvatarDataType } from '../types/Avatar.std.js';
import { BetterAvatarBubble } from './BetterAvatarBubble.dom.js';
import type { LocalizerType } from '../types/Util.std.js';
import { Spinner } from './Spinner.dom.js';
import { avatarDataToBytes } from '../util/avatarDataToBytes.dom.js';

const { noop } = lodash;

type AvatarSize = 48 | 80;

export type PropsType = {
  avatarData: AvatarDataType;
  i18n: LocalizerType;
  isSelected?: boolean;
  onClick: (avatarBuffer: Uint8Array | undefined) => unknown;
  onDelete: () => unknown;
  size?: AvatarSize;
};

export function BetterAvatar({
  avatarData,
  i18n,
  isSelected,
  onClick,
  onDelete,
  size = 48,
}: PropsType): JSX.Element {
  const [avatarBuffer, setAvatarBuffer] = useState<Uint8Array | undefined>(
    avatarData.buffer
  );
  const [avatarURL, setAvatarURL] = useState<string | undefined>(undefined);

  useEffect(() => {
    let shouldCancel = false;

    async function makeAvatar() {
      const buffer = await avatarDataToBytes(avatarData);
      if (!shouldCancel) {
        setAvatarBuffer(buffer);
      }
    }

    // If we don't have this we'll get lots of flashing because avatarData
    // changes too much. Once we have a buffer set we don't need to reload.
    if (avatarBuffer) {
      return noop;
    }

    void makeAvatar();

    return () => {
      shouldCancel = true;
    };
  }, [avatarBuffer, avatarData]);

  // Convert avatar's Uint8Array to a URL object
  useEffect(() => {
    if (avatarBuffer) {
      const url = URL.createObjectURL(new Blob([avatarBuffer]));

      setAvatarURL(url);
    }
  }, [avatarBuffer]);

  // Clean up any remaining object URLs
  useEffect(() => {
    return () => {
      if (avatarURL) {
        URL.revokeObjectURL(avatarURL);
      }
    };
  }, [avatarURL]);

  const isEditable = Boolean(avatarData.color);
  const handleDelete = !avatarData.icon
    ? (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        onDelete();
      }
    : undefined;

  return (
    <BetterAvatarBubble
      i18n={i18n}
      isSelected={isSelected}
      onDelete={handleDelete}
      onSelect={() => {
        onClick(avatarBuffer);
      }}
      style={{
        backgroundImage: avatarURL ? `url(${avatarURL})` : undefined,
        backgroundSize: size,
        // +8 so that the size is the actual size we want, 8 is the invisible
        // padding around the bubble to make room for the selection border
        height: size + 8,
        width: size + 8,
      }}
    >
      {isEditable && isSelected && (
        <div className="BetterAvatarBubble--editable" />
      )}
      {!avatarURL && (
        <div className="module-Avatar__spinner-container">
          <Spinner
            size={`${size - 8}px`}
            svgSize="small"
            direction="on-avatar"
          />
        </div>
      )}
    </BetterAvatarBubble>
  );
}
