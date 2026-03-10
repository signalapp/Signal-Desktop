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
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext.std.js';
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
    showViewOnceButton: false,
    isViewOnceActive: false,
    onToggleViewOnce: action('onToggleViewOnce'),
  };
};

export function Default(): React.JSX.Element {
  const props = useProps();

  return <CompositionInput {...props} />;
}

export function Large(): React.JSX.Element {
  const props = useProps({
    large: true,
  });

  return <CompositionInput {...props} />;
}

export function Disabled(): React.JSX.Element {
  const props = useProps({
    disabled: true,
  });

  return <CompositionInput {...props} />;
}

export function StartingText(): React.JSX.Element {
  const props = useProps({
    draftText: "here's some starting text",
  });

  return <CompositionInput {...props} />;
}

export function MultilineText(): React.JSX.Element {
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

export function Emojis(): React.JSX.Element {
  const props = useProps({
    draftText: `⁣😐😐😐😐😐😐😐
😐😐😐😐😐😐😐
😐😐😐😂⁣😐😐😐
😐😐😐😐😐😐😐
😐😐😐😐😐😐😐`,
  });

  return <CompositionInput {...props} />;
}

export function Mentions(): React.JSX.Element {
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

export function NoFormattingMenu(): React.JSX.Element {
  return <CompositionInput {...useProps({ isFormattingEnabled: false })} />;
}

export function ViewOnceButton(): React.JSX.Element {
  const [isActive, setIsActive] = React.useState(false);
  const props = useProps();

  return (
    <CompositionInput
      {...props}
      showViewOnceButton
      isViewOnceActive={isActive}
      onToggleViewOnce={() => setIsActive(!isActive)}
    />
  );
}

export function ViewOnceButtonActive(): React.JSX.Element {
  const props = useProps();

  return (
    <CompositionInput
      {...props}
      showViewOnceButton
      isViewOnceActive
      onToggleViewOnce={action('onToggleViewOnce')}
    />
  );
}
