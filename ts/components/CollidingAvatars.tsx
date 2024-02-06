// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as uuid } from 'uuid';
import React, { useMemo, useCallback } from 'react';

import type { LocalizerType } from '../types/Util';
import type { ConversationType } from '../state/ducks/conversations';
import { Avatar, AvatarSize } from './Avatar';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  conversations: ReadonlyArray<ConversationType>;
}>;

const MAX_AVATARS = 2;

export function CollidingAvatars({
  i18n,
  conversations,
}: PropsType): JSX.Element {
  const clipId = useMemo(() => uuid(), []);
  const onRef = useCallback(
    (elem: HTMLDivElement | null): void => {
      if (elem) {
        // Note that these cannot be set through html attributes
        elem.style.setProperty('--clip-path', `url(#${clipId})`);
      }
    },
    [clipId]
  );

  return (
    <div className="CollidingAvatars" ref={onRef}>
      {conversations.slice(0, MAX_AVATARS).map(({ id, type, ...convo }) => {
        return (
          <Avatar
            key={id}
            className="CollidingAvatars__avatar"
            i18n={i18n}
            size={AvatarSize.TWENTY_FOUR}
            conversationType={type}
            badge={undefined}
            {...convo}
          />
        );
      })}
      {/*
        This clip path is a rectangle with the right-bottom corner cut off
        by a circle:

          AAAAAAA
          AAAAAAA
          AAAAA
          AAA
          AAA
          AA
          AA

        The idea is that we cut a circle away from the top avatar so that there
        is a bit of transparent area between two avatars:

          AAAAAAA
          AAAAAAA
          AAAAA
          AAA   B
          AAA  BB
          AA  BBB
          AA  BBB

        See CollidingAvatars.scss for how this clipPath is applied.
        */}
      <svg width={0} height={0} className="CollidingAvatars__clip_svg">
        <clipPath id={clipId} clipPathUnits="objectBoundingBox">
          <path d="M0 0 h1 v0.4166 A0.54166 0.54166 0 0 0.4166 1 H0 Z" />
        </clipPath>
      </svg>
    </div>
  );
}
