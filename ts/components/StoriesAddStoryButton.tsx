// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useState, useCallback } from 'react';

import type { LocalizerType } from '../types/Util';
import type { ShowToastActionCreatorType } from '../state/ducks/toast';
import { ContextMenu } from './ContextMenu';
import { Theme } from '../util/theme';
import { ToastType } from '../types/Toast';
import {
  isVideoGoodForStories,
  ReasonVideoNotGood,
} from '../util/isVideoGoodForStories';
import { ConfirmationDialog } from './ConfirmationDialog';

export type PropsType = {
  children?: ReactNode;
  i18n: LocalizerType;
  maxAttachmentSizeInKb: number;
  moduleClassName?: string;
  onAddStory: (file?: File) => unknown;
  onContextMenuShowingChanged?: (value: boolean) => void;
  showToast: ShowToastActionCreatorType;
};

export function StoriesAddStoryButton({
  children,
  i18n,
  maxAttachmentSizeInKb,
  moduleClassName,
  onAddStory,
  showToast,
  onContextMenuShowingChanged,
}: PropsType): JSX.Element {
  const [error, setError] = useState<string | undefined>();

  const onAddMedia = useCallback(() => {
    const input = document.createElement('input');
    input.accept = 'image/*,video/mp4';
    input.type = 'file';
    input.onchange = async () => {
      const file = input.files ? input.files[0] : undefined;

      if (!file) {
        return;
      }

      const result = await isVideoGoodForStories(file, {
        maxAttachmentSizeInKb,
      });

      if (
        result.reason === ReasonVideoNotGood.UnsupportedCodec ||
        result.reason === ReasonVideoNotGood.UnsupportedContainer
      ) {
        showToast(ToastType.StoryVideoUnsupported);
        return;
      }

      if (result.reason === ReasonVideoNotGood.TooLong) {
        setError(
          i18n('icu:StoryCreator__error--video-too-long', {
            maxDurationInSec: result.maxDurationInSec,
          })
        );
        return;
      }

      if (result.reason === ReasonVideoNotGood.TooBig) {
        setError(
          i18n('icu:StoryCreator__error--video-too-big', result.renderDetails)
        );
        return;
      }

      if (result.reason !== ReasonVideoNotGood.AllGoodNevermind) {
        showToast(ToastType.StoryVideoError);
        return;
      }

      onAddStory(file);
    };
    input.click();
  }, [setError, showToast, i18n, maxAttachmentSizeInKb, onAddStory]);

  return (
    <>
      <ContextMenu
        ariaLabel={i18n('Stories__add')}
        i18n={i18n}
        onMenuShowingChanged={onContextMenuShowingChanged}
        menuOptions={[
          {
            label: i18n('Stories__add-story--media'),
            onClick: onAddMedia,
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
      {error && (
        <ConfirmationDialog
          dialogName="StoriesAddStoryButton.error"
          noDefaultCancelButton
          actions={[
            {
              action: () => {
                setError(undefined);
              },
              style: 'affirmative',
              text: i18n('Confirmation--confirm'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setError(undefined);
          }}
        >
          {error}
        </ConfirmationDialog>
      )}
    </>
  );
}
