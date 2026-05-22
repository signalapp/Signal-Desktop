// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { type ComponentType, useEffect, useMemo, useId, type JSX } from 'react';
import { VisuallyHidden } from 'react-aria';
import type { LocalizerType } from '../types/I18N.std.ts';
import type { HydratedBodyRangesType } from '../types/BodyRange.std.ts';
import type { SmartCompositionTextAreaProps } from '../state/smart/CompositionTextArea.preload.tsx';
import type { ThemeType } from '../types/Util.std.ts';
import { FunGifPreview } from './fun/FunGif.dom.tsx';
import type { FunGifSelection } from './fun/panels/FunPanelGifs.dom.tsx';
import type { GifDownloadState } from '../state/smart/DraftGifMessageSendModal.preload.tsx';
import { LoadingState } from '../util/loadable.std.ts';
import { Emoji } from '../axo/emoji.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';

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
    <AxoDialog.Root open onOpenChange={props.onClose}>
      <AxoDialog.Content size="sm" escape="cancel-is-destructive">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:DraftGifMessageSendModal__Title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body padding="only-scrollbar-gutter">
          <div className={tw('flex justify-center px-2')}>
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
            emojiSkinToneDefault={Emoji.SkinTone.None}
          />
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="secondary" onClick={props.onClose}>
              {i18n('icu:cancel')}
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="primary"
              onClick={props.onSubmit}
              disabled={
                props.gifDownloadState.loadingState !== LoadingState.Loaded
              }
            >
              {i18n('icu:DraftGifMessageSendModal__SendButtonLabel')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
