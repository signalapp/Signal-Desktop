// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
// @ts-expect-error -- no types
import '@signalapp/quill-cjs/dist/quill.core.css';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.js';
import type { Props } from './CompositionInput.dom.js';
import { CompositionInput } from './CompositionInput.dom.js';
import { generateAci } from '../types/ServiceId.std.js';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext.js';
import { EmojiSkinTone } from './fun/data/emojis.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/CompositionInput',
  argTypes: {},
  args: {},
} satisfies Meta<Props>;

const useProps = (overrideProps: Partial<Props> = {}): Props => {
  const conversation = getDefaultConversation();
  return {
    i18n,
    conversationId: conversation.id,
    disabled: overrideProps.disabled ?? false,
    draftText: overrideProps.draftText ?? null,
    draftEditMessage: overrideProps.draftEditMessage ?? null,
    draftBodyRanges: overrideProps.draftBodyRanges || [],
    getPreferredBadge: () => undefined,
    isActive: true,
    isFormattingEnabled:
      overrideProps.isFormattingEnabled === false
        ? overrideProps.isFormattingEnabled
        : true,
    large: overrideProps.large ?? false,
    onCloseLinkPreview: action('onCloseLinkPreview'),
    onEditorStateChange: action('onEditorStateChange'),
    onSelectEmoji: action('onSelectEmoji'),
    onSubmit: action('onSubmit'),
    onTextTooLong: action('onTextTooLong'),
    ourConversationId: 'me',
    platform: 'darwin',
    quotedMessageId: null,
    sendCounter: 0,
    sortedGroupMembers: overrideProps.sortedGroupMembers ?? [],
    emojiSkinToneDefault:
      overrideProps.emojiSkinToneDefault ?? EmojiSkinTone.None,
    theme: React.useContext(StorybookThemeContext),
    inputApi: null,
    shouldHidePopovers: null,
    linkPreviewResult: null,
  };
};

export function Default(): JSX.Element {
  const props = useProps();

  return <CompositionInput {...props} />;
}

export function Large(): JSX.Element {
  const props = useProps({
    large: true,
  });

  return <CompositionInput {...props} />;
}

export function Disabled(): JSX.Element {
  const props = useProps({
    disabled: true,
  });

  return <CompositionInput {...props} />;
}

export function StartingText(): JSX.Element {
  const props = useProps({
    draftText: "here's some starting text",
  });

  return <CompositionInput {...props} />;
}

export function MultilineText(): JSX.Element {
  const props = useProps({
    draftText: `here's some starting text
and more on another line
and yet another line
and yet another line
and yet another line
and yet another line
and yet another line
and yet another line
and we're done`,
  });

  return <CompositionInput {...props} />;
}

export function Emojis(): JSX.Element {
  const props = useProps({
    draftText: `⁣😐😐😐😐😐😐😐
😐😐😐😐😐😐😐
😐😐😐😂⁣😐😐😐
😐😐😐😐😐😐😐
😐😐😐😐😐😐😐`,
  });

  return <CompositionInput {...props} />;
}

export function Mentions(): JSX.Element {
  const props = useProps({
    sortedGroupMembers: [
      getDefaultConversation({
        title: 'Kate Beaton',
      }),
      getDefaultConversation({
        title: 'Parry Gripp',
      }),
    ],
    draftText: 'send _ a message',
    draftBodyRanges: [
      {
        start: 5,
        length: 1,
        mentionAci: generateAci(),
        conversationID: 'k',
        replacementText: 'Kate Beaton',
      },
    ],
  });

  return <CompositionInput {...props} />;
}

export function NoFormattingMenu(): JSX.Element {
  return <CompositionInput {...useProps({ isFormattingEnabled: false })} />;
}
