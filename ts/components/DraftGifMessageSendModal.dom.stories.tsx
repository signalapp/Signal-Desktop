// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useEffect, useState } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import {
  DraftGifMessageSendModal,
  type DraftGifMessageSendModalProps,
} from './DraftGifMessageSendModal.dom.js';
import { ThemeType } from '../types/Util.std.js';
import { CompositionTextArea } from './CompositionTextArea.dom.js';
import type { SmartCompositionTextAreaProps } from '../state/smart/CompositionTextArea.preload.js';
import { EmojiSkinTone } from './fun/data/emojis.std.js';
import { LoadingState } from '../util/loadable.std.js';
import { VIDEO_MP4 } from '../types/MIME.std.js';
import { drop } from '../util/drop.std.js';

const { i18n } = window.SignalContext;

const MOCK_GIF_URL =
  'https://media2.giphy.com/media/v1.Y2lkPTZhNGNmY2JhaXFlbXZxcHVjNXlmaGdlYWs1dTlwYnNrb2I5aGttbXViYjh4Z2hqbyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3kzJvEciJa94SMW3hN/giphy.mp4';
const MOCK_GIF_WIDTH = 480;
const MOCK_GIF_HEIGHT = 418;

export default {
  title: 'components/DraftGifMessageSendModal',
} satisfies Meta<DraftGifMessageSendModalProps>;

function RenderCompositionTextArea(props: SmartCompositionTextAreaProps) {
  return (
    <CompositionTextArea
      {...props}
      getPreferredBadge={() => undefined}
      i18n={i18n}
      isActive
      isFormattingEnabled
      onSelectEmoji={action('onSelectEmoji')}
      onEmojiSkinToneDefaultChange={action('onEmojiSkinToneDefaultChange')}
      onTextTooLong={action('onTextTooLong')}
      ourConversationId="me"
      platform="darwin"
      emojiSkinToneDefault={EmojiSkinTone.None}
      convertDraftBodyRangesIntoHydrated={() => []}
    />
  );
}

export function Default(): React.JSX.Element {
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      await new Promise(resolve => {
        setTimeout(resolve, 3000);
      });

      const response = await fetch(MOCK_GIF_URL, {
        signal: controller.signal,
      });

      const blob = await response.blob();
      const result = new File([blob], 'file.mp4');

      if (!controller.signal.aborted) {
        setFile(result);
      }
    }

    drop(run());

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <DraftGifMessageSendModal
      i18n={i18n}
      theme={ThemeType.light}
      RenderCompositionTextArea={RenderCompositionTextArea}
      draftText=""
      draftBodyRanges={[]}
      gifSelection={{
        gif: {
          id: '',
          title: '',
          description: '',
          previewMedia: {
            url: MOCK_GIF_URL,
            width: MOCK_GIF_WIDTH,
            height: MOCK_GIF_HEIGHT,
          },
          attachmentMedia: {
            url: MOCK_GIF_URL,
            width: MOCK_GIF_WIDTH,
            height: MOCK_GIF_HEIGHT,
          },
        },
      }}
      gifDownloadState={
        file == null
          ? {
              loadingState: LoadingState.Loading,
            }
          : {
              loadingState: LoadingState.Loaded,
              value: {
                file,
                attachment: {
                  pending: false,
                  path: '',
                  clientUuid: '',
                  contentType: VIDEO_MP4,
                  size: 0,
                },
              },
            }
      }
      onChange={action('onChange')}
      onSubmit={action('onSubmit')}
      onClose={action('onClose')}
    />
  );
}
