// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useState, useCallback } from 'react';

import type { LocalizerType } from '../types/Util.std.js';
import type { ShowToastAction } from '../state/ducks/toast.preload.js';
import { ContextMenu } from './ContextMenu.dom.js';
import { ToastType } from '../types/Toast.dom.js';
import {
  isVideoGoodForStories,
  ReasonVideoNotGood,
} from '../util/isVideoGoodForStories.std.js';
import { ConfirmationDialog } from './ConfirmationDialog.dom.js';

export type PropsType = {
  children?: ReactNode;
  i18n: LocalizerType;
  maxAttachmentSizeInKb: number;
  moduleClassName?: string;
  onAddStory: (file?: File) => unknown;
  onContextMenuShowingChanged?: (value: boolean) => void;
  showToast: ShowToastAction;
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
        showToast({ toastType: ToastType.StoryVideoUnsupported });
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
          i18n('icu:StoryCreator__error--video-too-big', {
            limit: result.renderDetails.limit,
            units: result.renderDetails.units,
          })
        );
        return;
      }

      if (result.reason !== ReasonVideoNotGood.AllGoodNevermind) {
        showToast({ toastType: ToastType.StoryVideoError });
        return;
      }

      onAddStory(file);
    };
    input.click();
  }, [setError, showToast, i18n, maxAttachmentSizeInKb, onAddStory]);

  return (
    <>
      <ContextMenu
        ariaLabel={i18n('icu:Stories__add')}
        i18n={i18n}
        onMenuShowingChanged={onContextMenuShowingChanged}
        menuOptions={[
          {
            label: i18n('icu:Stories__add-story--media'),
            onClick: onAddMedia,
          },
          {
            label: i18n('icu:Stories__add-story--text'),
            onClick: () => onAddStory(),
          },
        ]}
        moduleClassName={moduleClassName}
        popperOptions={{
          placement: 'bottom',
          strategy: 'absolute',
        }}
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
              text: i18n('icu:Confirmation--confirm'),
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
