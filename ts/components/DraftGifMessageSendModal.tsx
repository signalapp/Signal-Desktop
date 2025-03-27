// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { type ComponentType, useEffect, useMemo } from 'react';
import { useId, VisuallyHidden } from 'react-aria';
import type { LocalizerType } from '../types/I18N';
import { Button, ButtonVariant } from './Button';
import { Modal } from './Modal';
import type { HydratedBodyRangesType } from '../types/BodyRange';
import type { SmartCompositionTextAreaProps } from '../state/smart/CompositionTextArea';
import type { ThemeType } from '../types/Util';
import { EmojiSkinTone } from './fun/data/emojis';
import { FunGifPreview } from './fun/FunGif';
import type { FunGifSelection } from './fun/panels/FunPanelGifs';
import type { GifDownloadState } from '../state/smart/DraftGifMessageSendModal';
import { LoadingState } from '../util/loadable';

export type DraftGifMessageSendModalProps = Readonly<{
  i18n: LocalizerType;
  theme: ThemeType;
  RenderCompositionTextArea: ComponentType<SmartCompositionTextAreaProps>;
  draftText: string;
  draftBodyRanges: HydratedBodyRangesType;
  gifSelection: FunGifSelection;
  gifDownloadState: GifDownloadState;
  onChange: (
    messageText: string,
    bodyRanges: HydratedBodyRangesType,
    caretLocation?: number
  ) => unknown;
  onSubmit: () => void;
  onClose: () => void;
}>;

export function DraftGifMessageSendModal(
  props: DraftGifMessageSendModalProps
): JSX.Element {
  const { i18n, RenderCompositionTextArea } = props;
  const descriptionId = useId();

  const url = useMemo(() => {
    return props.gifDownloadState.value?.file != null
      ? URL.createObjectURL(props.gifDownloadState.value?.file)
      : null;
  }, [props.gifDownloadState]);

  useEffect(() => {
    return () => {
      if (url != null) {
        URL.revokeObjectURL(url);
      }
    };
  }, [url]);

  return (
    <Modal
      i18n={i18n}
      hasXButton
      title={i18n('icu:DraftGifMessageSendModal__Title')}
      modalName="DraftGifMessageSendModal"
      moduleClassName="DraftGifMessageSendModal"
      onClose={props.onClose}
      useFocusTrap
      noMouseClose
      padded={false}
      modalFooter={
        <>
          <Button variant={ButtonVariant.Secondary} onClick={props.onClose}>
            {i18n('icu:DraftGifMessageSendModal__CancelButtonLabel')}
          </Button>
          <Button
            onClick={props.onSubmit}
            disabled={
              props.gifDownloadState.loadingState !== LoadingState.Loaded
            }
          >
            {i18n('icu:DraftGifMessageSendModal__SendButtonLabel')}
          </Button>
        </>
      }
    >
      <div className="DraftGifMessageSendModal__GifPreview">
        <FunGifPreview
          src={url}
          state={props.gifDownloadState.loadingState}
          width={props.gifSelection.width}
          height={props.gifSelection.height}
          maxHeight={256}
          aria-label={props.gifSelection.title}
          aria-describedby={descriptionId}
        />
        <VisuallyHidden id={descriptionId}>
          {props.gifSelection.description}
        </VisuallyHidden>
      </div>
      <RenderCompositionTextArea
        bodyRanges={props.draftBodyRanges}
        draftText={props.draftText}
        isActive
        onChange={props.onChange}
        onSubmit={props.onSubmit}
        theme={props.theme}
        emojiSkinToneDefault={EmojiSkinTone.None}
      />
    </Modal>
  );
}
