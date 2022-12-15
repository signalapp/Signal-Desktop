// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';

import type { LocalizerType } from '../types/Util';
import type { ShowToastActionCreatorType } from '../state/ducks/toast';
import { ContextMenu } from './ContextMenu';
import { Theme } from '../util/theme';
import { ToastType } from '../types/Toast';
import {
  isVideoGoodForStories,
  ReasonVideoNotGood,
} from '../util/isVideoGoodForStories';

export type PropsType = {
  children?: ReactNode;
  i18n: LocalizerType;
  moduleClassName?: string;
  onAddStory: (file?: File) => unknown;
  onContextMenuShowingChanged?: (value: boolean) => void;
  showToast: ShowToastActionCreatorType;
};

export function StoriesAddStoryButton({
  children,
  i18n,
  moduleClassName,
  onAddStory,
  showToast,
  onContextMenuShowingChanged,
}: PropsType): JSX.Element {
  return (
    <ContextMenu
      ariaLabel={i18n('Stories__add')}
      i18n={i18n}
      onMenuShowingChanged={onContextMenuShowingChanged}
      menuOptions={[
        {
          label: i18n('Stories__add-story--media'),
          onClick: () => {
            const input = document.createElement('input');
            input.accept = 'image/*,video/mp4';
            input.type = 'file';
            input.onchange = async () => {
              const file = input.files ? input.files[0] : undefined;

              if (!file) {
                return;
              }

              const result = await isVideoGoodForStories(file);

              if (
                result === ReasonVideoNotGood.UnsupportedCodec ||
                result === ReasonVideoNotGood.UnsupportedContainer
              ) {
                showToast(ToastType.StoryVideoUnsupported);
                return;
              }

              if (result === ReasonVideoNotGood.TooLong) {
                showToast(ToastType.StoryVideoTooLong);
                return;
              }

              if (result !== ReasonVideoNotGood.AllGoodNevermind) {
                showToast(ToastType.StoryVideoError);
                return;
              }

              onAddStory(file);
            };
            input.click();
          },
        },
        {
          label: i18n('Stories__add-story--text'),
          onClick: () => onAddStory(),
        },
      ]}
      moduleClassName={moduleClassName}
      popperOptions={{
        placement: 'bottom',
        strategy: 'absolute',
      }}
      theme={Theme.Dark}
    >
      {children}
    </ContextMenu>
  );
}
