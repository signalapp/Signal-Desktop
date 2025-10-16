// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { type ComponentType, useEffect, useMemo, useId } from 'react';
import { VisuallyHidden } from 'react-aria';
import type { LocalizerType } from '../types/I18N.std.js';
import { Button, ButtonVariant } from './Button.dom.js';
import { Modal } from './Modal.dom.js';
import type { HydratedBodyRangesType } from '../types/BodyRange.std.js';
import type { SmartCompositionTextAreaProps } from '../state/smart/CompositionTextArea.preload.js';
import type { ThemeType } from '../types/Util.std.js';
import { EmojiSkinTone } from './fun/data/emojis.std.js';
import { FunGifPreview } from './fun/FunGif.dom.js';
import type { FunGifSelection } from './fun/panels/FunPanelGifs.dom.js';
import type { GifDownloadState } from '../state/smart/DraftGifMessageSendModal.preload.js';
import { LoadingState } from '../util/loadable.std.js';

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
          width={props.gifSelection.gif.attachmentMedia.width}
          height={props.gifSelection.gif.attachmentMedia.height}
          maxHeight={256}
          aria-label={props.gifSelection.gif.title}
          aria-describedby={descriptionId}
        />
        <VisuallyHidden id={descriptionId}>
          {props.gifSelection.gif.description}
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
