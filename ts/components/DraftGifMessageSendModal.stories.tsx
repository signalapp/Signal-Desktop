// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useEffect, useState } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import {
  DraftGifMessageSendModal,
  type DraftGifMessageSendModalProps,
} from './DraftGifMessageSendModal';
import { ThemeType } from '../types/Util';
import { CompositionTextArea } from './CompositionTextArea';
import type { SmartCompositionTextAreaProps } from '../state/smart/CompositionTextArea';
import { EmojiSkinTone } from './fun/data/emojis';
import { LoadingState } from '../util/loadable';
import { VIDEO_MP4 } from '../types/MIME';
import { drop } from '../util/drop';

const { i18n } = window.SignalContext;

const MOCK_GIF_URL =
  'https://media.tenor.com/ihqN6a3iiYEAAAPo/pikachu-shocked-face-stunned.mp4';

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
      onPickEmoji={action('onPickEmoji')}
      onEmojiSkinToneDefaultChange={action('onEmojiSkinToneDefaultChange')}
      onTextTooLong={action('onTextTooLong')}
      ourConversationId="me"
      platform="darwin"
      emojiSkinToneDefault={EmojiSkinTone.None}
    />
  );
}

export function Default(): JSX.Element {
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
            url: '',
            width: 640,
            height: 640,
          },
          attachmentMedia: {
            url: '',
            width: 640,
            height: 640,
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
