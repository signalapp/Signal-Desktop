// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, JSX } from 'react';
import { useState, useCallback } from 'react';

import type { LocalizerType } from '../types/Util.std.ts';
import type { ShowToastAction } from '../state/ducks/toast.preload.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import {
  isVideoGoodForStories,
  ReasonVideoNotGood,
} from '../util/isVideoGoodForStories.std.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';
import { AxoDropdownMenu } from '../axo/AxoDropdownMenu.dom.tsx';
import { AxoIconButton } from '../axo/AxoIconButton.dom.tsx';

export type PropsType = {
  /** The trigger button, defaults to a "plus" icon button */
  children?: ReactNode;
  i18n: LocalizerType;
  maxAttachmentVideoSize: number;
  onAddStory: (file?: File) => unknown;
  onContextMenuShowingChanged?: (value: boolean) => void;
  showToast: ShowToastAction;
};

export function StoriesAddStoryButton({
  children,
  i18n,
  maxAttachmentVideoSize,
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
        maxAttachmentVideoSize,
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
  }, [setError, showToast, i18n, maxAttachmentVideoSize, onAddStory]);

  return (
    <>
      <AxoDropdownMenu.Root onOpenChange={onContextMenuShowingChanged}>
        <AxoDropdownMenu.Trigger>
          {children ?? (
            <AxoIconButton.Root
              variant="implied-secondary"
              size="sm"
              symbol="plus"
              label={i18n('icu:Stories__add')}
            />
          )}
        </AxoDropdownMenu.Trigger>
        <AxoDropdownMenu.Content>
          <AxoDropdownMenu.Item onSelect={onAddMedia}>
            {i18n('icu:Stories__add-story--media')}
          </AxoDropdownMenu.Item>
          <AxoDropdownMenu.Item onSelect={() => onAddStory()}>
            {i18n('icu:Stories__add-story--text')}
          </AxoDropdownMenu.Item>
        </AxoDropdownMenu.Content>
      </AxoDropdownMenu.Root>
      <AxoConfirmDialog.Root
        open={error != null}
        onOpenChange={() => setError(undefined)}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        // @ts-expect-error ConfirmationDialog migration: Needs description
        description={error}
      >
        <AxoConfirmDialog.Action
          variant="strong-primary"
          onClick={() => setError(undefined)}
        >
          {i18n('icu:ok')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
    </>
  );
}
