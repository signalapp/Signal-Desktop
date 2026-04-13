// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './MessageBody.dom.tsx';
import { MessageBody } from './MessageBody.dom.tsx';
import { BodyRange } from '../../types/BodyRange.std.ts';
import { RenderLocation } from './MessageTextRenderer.dom.tsx';
import { generateAci } from '../../test-helpers/serviceIdUtils.std.ts';

const SERVICE_ID_1 = generateAci();
const SERVICE_ID_2 = generateAci();
const SERVICE_ID_3 = generateAci();
const SERVICE_ID_4 = generateAci();
const SERVICE_ID_5 = generateAci();
const SERVICE_ID_6 = generateAci();
const SERVICE_ID_7 = generateAci();
const SERVICE_ID_8 = generateAci();
const SERVICE_ID_9 = generateAci();
const SERVICE_ID_10 = generateAci();
const SERVICE_ID_11 = generateAci();

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/MessageBody',
} satisfies Meta<Props>;

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  bodyRanges: overrideProps.bodyRanges,
  disableJumbomoji: overrideProps.disableJumbomoji || false,
  disableLinks: overrideProps.disableLinks || false,
  direction: 'incoming',
  i18n,
  isSpoilerExpanded: overrideProps.isSpoilerExpanded || {},
  onExpandSpoiler: overrideProps.onExpandSpoiler || action('onExpandSpoiler'),
  renderLocation: RenderLocation.Timeline,
  showConversation:
    overrideProps.showConversation || action('showConversation'),
  text: overrideProps.text || '',
  originalText: overrideProps.originalText || overrideProps.text || '',
  textAttachment: overrideProps.textAttachment || {
    pending: false,
  },
});

export function LinksEnabled(): React.JSX.Element {
  const props = createProps({
    text: 'Check out https://www.signal.org',
  });

  return <MessageBody {...props} />;
}

export function LinksDisabled(): React.JSX.Element {
  const props = createProps({
    disableLinks: true,
    text: 'Check out https://www.signal.org',
  });

  return <MessageBody {...props} />;
}

export function EmojiSizeBasedOnCount(): React.JSX.Element {
  const props = createProps();

  return (
    <>
      <MessageBody {...props} text="😹" />
      <br />
      <MessageBody {...props} text="😹😹😹" />
      <br />
      <MessageBody {...props} text="😹😹😹😹😹" />
      <br />
      <MessageBody {...props} text="😹😹😹😹😹😹😹" />
      <br />
      <MessageBody {...props} text="😹😹😹😹😹😹😹😹😹" />
    </>
  );
}

export function JumbomojiEnabled(): React.JSX.Element {
  const props = createProps({
    text: '😹',
  });

  return <MessageBody {...props} />;
}

export function JumbomojiDisabled(): React.JSX.Element {
  const props = createProps({
    disableJumbomoji: true,
    text: '😹',
  });

  return <MessageBody {...props} />;
}

export function JumbomojiDisabledByText(): React.JSX.Element {
  const props = createProps({
    text: 'not a jumbo kitty 😹',
  });

  return <MessageBody {...props} />;
}

export function TextPending(): React.JSX.Element {
  const props = createProps({
    text: 'Check out https://www.signal.org',
    textAttachment: {
      pending: true,
    },
  });

  return <MessageBody {...props} />;
}

export function MessageTooLong(): React.JSX.Element {
  const props = createProps({
    text: 'Check out https://www.signal.org',
    textAttachment: {
      wasTooBig: true,
    },
  });

  return <MessageBody {...props} />;
}

export function Mention(): React.JSX.Element {
  const props = createProps({
    bodyRanges: [
      {
        start: 5,
        length: 1,
        mentionAci: SERVICE_ID_1,
        replacementText: 'Bender B Rodriguez 🤖',
        conversationID: 'x',
      },
    ],
    text: 'Like \uFFFC once said: My story is a lot like yours, only more interesting because it involves robots',
  });

  return <MessageBody {...props} />;
}

export function MultipleMentions(): React.JSX.Element {
  const props = createProps({
    // These are intentionally in a mixed order to test how we deal with that
    bodyRanges: [
      {
        start: 2,
        length: 1,
        mentionAci: SERVICE_ID_2,
        replacementText: 'Philip J Fry',
        conversationID: 'x',
      },
      {
        start: 4,
        length: 1,
        mentionAci: SERVICE_ID_3,
        replacementText: 'Professor Farnsworth',
        conversationID: 'x',
      },
      {
        start: 0,
        length: 1,
        mentionAci: SERVICE_ID_4,
        replacementText: 'Yancy Fry',
        conversationID: 'x',
      },
    ],
    text: '\uFFFC \uFFFC \uFFFC',
  });

  return (
    <>
      <MessageBody {...props} />
      <hr />
      <MessageBody {...props} disableLinks />
    </>
  );
}

export function ComplexMessageBody(): React.JSX.Element {
  const props = createProps({
    bodyRanges: [
      // These are intentionally in a mixed order to test how we deal with that
      {
        start: 78,
        length: 1,
        mentionAci: SERVICE_ID_5,
        replacementText: 'Acid Burn',
        conversationID: 'x',
      },
      {
        start: 80,
        length: 1,
        mentionAci: SERVICE_ID_6,
        replacementText: 'Cereal Killer',
        conversationID: 'x',
      },
      {
        start: 4,
        length: 1,
        mentionAci: SERVICE_ID_6,
        replacementText: 'Zero Cool',
        conversationID: 'x',
      },
    ],
    direction: 'outgoing',
    text: 'Hey \uFFFC\nCheck out https://www.signal.org I think you will really like it 😍\n\ncc \uFFFC \uFFFC',
  });

  return (
    <>
      <MessageBody {...props} />
      <hr />
      <MessageBody {...props} disableLinks />
    </>
  );
}

export function FormattingBasic(): React.JSX.Element {
  const [isSpoilerExpanded, setIsSpoilerExpanded] = React.useState({});

  const props = createProps({
    bodyRanges: [
      // Abracadabra
      {
        start: 36,
        length: 11,
        style: BodyRange.Style.BOLD,
      },
      // Open Sesame
      {
        start: 46,
        length: 10,
        style: BodyRange.Style.ITALIC,
      },
      // This is the key! And the treasure, too, if we can only get our hands on it!
      {
        start: 357,
        length: 75,
        style: BodyRange.Style.MONOSPACE,
      },

      // The real magic is to understand which words work, and when, and for what
      {
        start: 138,
        length: 73,
        style: BodyRange.Style.STRIKETHROUGH,
      },
      // as if the key to the treasure is the treasure!
      {
        start: 446,
        length: 46,
        style: BodyRange.Style.SPOILER,
      },
      {
        start: 110,
        length: 27,
        style: BodyRange.Style.NONE,
      },
    ],
    isSpoilerExpanded,
    onExpandSpoiler: data => setIsSpoilerExpanded(data),
    text: '… It’s in words that the magic is – Abracadabra, Open Sesame, and the rest – but the magic words in one story aren’t magical in the next. The real magic is to understand which words work, and when, and for what; the trick is to learn the trick. … And those words are made from the letters of our alphabet: a couple-dozen squiggles we can draw with the pen. This is the key! And the treasure, too, if we can only get our hands on it! It’s as if – as if the key to the treasure is the treasure!',
  });

  return (
    <>
      <MessageBody {...props} />
      <hr />
      <MessageBody {...props} disableLinks />
    </>
  );
}

export function FormattingSpoiler(): React.JSX.Element {
  const [isSpoilerExpanded, setIsSpoilerExpanded] = React.useState({});

  const props = createProps({
    bodyRanges: [
      {
        start: 8,
        length: 60,
        style: BodyRange.Style.SPOILER,
      },
      // This is touching, but not overlapping; they should not reveal together
      {
        start: 68,
        length: 29,
        style: BodyRange.Style.SPOILER,
      },
      // Note: in overlaps, the last spoiler wins
      {
        start: 94,
        length: 6,
        style: BodyRange.Style.SPOILER,
      },
      {
        start: 46,
        length: 22,
        style: BodyRange.Style.MONOSPACE,
      },
      {
        start: 72,
        length: 12,
        style: BodyRange.Style.BOLD,
      },
      {
        start: 90,
        length: 7,
        style: BodyRange.Style.ITALIC,
      },
      {
        start: 54,
        length: 1,
        mentionAci: SERVICE_ID_7,
        conversationID: 'a',
        replacementText: '🅰️ Alice',
      },
      {
        start: 60,
        length: 1,
        mentionAci: SERVICE_ID_8,
        conversationID: 'b',
        replacementText: '🅱️ Bob',
      },
    ],
    isSpoilerExpanded,
    onExpandSpoiler: data => setIsSpoilerExpanded(data),
    text: "This is a very secret https://somewhere.com 💡 thing, \uFFFC and \uFFFC, that you shouldn't be able to read. Stay away!",
  });

  return (
    <>
      <MessageBody {...props} />
      <hr />
      <MessageBody {...props} disableLinks />
      <hr />
      <MessageBody
        {...props}
        onExpandSpoiler={() => null}
        isSpoilerExpanded={{}}
      />
      <hr />
      <MessageBody {...props} disableLinks isSpoilerExpanded={{}} />
    </>
  );
}

export function FormattingNesting(): React.JSX.Element {
  const props = createProps({
    bodyRanges: [
      {
        start: 0,
        length: 40,
        style: BodyRange.Style.BOLD,
      },
      {
        start: 0,
        length: 111,
        style: BodyRange.Style.ITALIC,
      },
      {
        start: 40,
        length: 60,
        style: BodyRange.Style.STRIKETHROUGH,
      },
      {
        start: 64,
        length: 14,
        style: BodyRange.Style.MONOSPACE,
      },
      {
        start: 29,
        length: 1,
        mentionAci: SERVICE_ID_7,
        conversationID: 'a',
        replacementText: '🅰️ Alice',
      },
      {
        start: 61,
        length: 1,
        mentionAci: SERVICE_ID_8,
        conversationID: 'b',
        replacementText: '🅱️ Bob',
      },
      {
        start: 68,
        length: 1,
        mentionAci: SERVICE_ID_9,
        conversationID: 'c',
        replacementText: 'Charlie',
      },
      {
        start: 80,
        length: 1,
        mentionAci: SERVICE_ID_10,
        conversationID: 'd',
        replacementText: 'Dan',
      },
      {
        start: 105,
        length: 1,
        mentionAci: SERVICE_ID_11,
        conversationID: 'e',
        replacementText: 'Eve',
      },
    ],

    //                                                                     m            m
    //     b                                      bs                                                          s
    //     i                                                                                                             i
    text: 'Italic Start and Bold Start .\uFFFC. Bold EndStrikethrough Start .\uFFFC. Mono\uFFFCpace Pop! .\uFFFC. Strikethrough End Ital\uFFFCc End',
  });

  return (
    <>
      <MessageBody {...props} />
      <hr />
      <MessageBody {...props} disableLinks />
    </>
  );
}

export function FormattingComplex(): React.JSX.Element {
  const [isSpoilerExpanded, setIsSpoilerExpanded] = React.useState({});
  const text =
    'Computational processes \uFFFC are abstract beings that inhabit computers. ' +
    'As they evolve, processes manipulate other abstract things called data. ' +
    'The evolution of a process is directed by a pattern of rules called a program. ' +
    'People create programs to direct processes. In effect, we conjure the spirits of ' +
    'the computer with our spells.\n\n' +
    'link preceded by emoji: 🤖https://signal.org/\n\n' +
    'link overlapping strikethrough: https://signal.org/ (up to "...//signal")\n\n' +
    'strikethrough going through mention \uFFFC all the way';

  const props = createProps({
    bodyRanges: [
      // mention
      {
        start: 24,
        length: 1,
        mentionAci: SERVICE_ID_3,
        conversationID: 'x',
        replacementText: '🤖 Hello',
      },
      // bold wraps mention
      {
        start: 14,
        length: 31,
        style: BodyRange.Style.BOLD,
      },
      // italic overlaps with bold
      {
        start: 29,
        length: 39,
        style: BodyRange.Style.ITALIC,
      },
      // strikethrough overlaps link
      {
        start: 397,
        length: 29,
        style: BodyRange.Style.STRIKETHROUGH,
      },
      // strikethrough over mention
      {
        start: 465,
        length: 31,
        style: BodyRange.Style.STRIKETHROUGH,
      },
      // mention 2
      {
        start: 491,
        length: 1,
        mentionAci: SERVICE_ID_3,
        conversationID: 'x',
        replacementText: '🤖 Hello',
      },
    ],
    isSpoilerExpanded,
    onExpandSpoiler: data => setIsSpoilerExpanded(data),
    text,
  });

  return <MessageBody {...props} />;
}

export function ZalgoText(): React.JSX.Element {
  const text = 'T̸͎̆̏̇̊̄͜ͅh̸͙̟͎̯̍͋͜͜i̸̪͚̼̜̦̲̇͒̇͝͝ś̴̡̩͙͜͝ ̴̼̣̩͂͑͠i̸̡̞̯͗s̵͙̔͛͊͑̔ ̶͇̒͝f̴̗͇͙̳͕̅̈́̏̉ò̵̲͉̤̬̖̱ȓ̶̳̫͗͝m̶̗͚̓ą̶̘̳͉̣̿̋t̴͎͎̞̤̱̅̓͝͝t̶̝͊͗é̵̛̥̔̃̀d̸̢̘̹̥̋͆ ̸̘͓͐̓̅̚ẕ̸͉̊̊͝a̴̙̖͎̥̥̅̽́͑͘ͅl̴͔̪͙͔̑̈́g̴͔̝̙̰̊͆̎͌́ǫ̵̪̤̖̖͗̑̎̿̄̎ ̵̪͈̲͇̫̼͌̌͛̚t̸̠́ẽ̴̡̺̖͘x̵͈̰̮͔̃̔͗̑̓͘t';

  const props = createProps({
    bodyRanges: [
      // This
      {
        start: 0,
        length: 39,
        style: BodyRange.Style.BOLD,
      },
      // is
      {
        start: 49,
        length: 13,
        style: BodyRange.Style.ITALIC,
      },
      // formatted
      {
        start: 65,
        length: 73,
        style: BodyRange.Style.STRIKETHROUGH,
      },
      // zalgo text
      {
        start: 145,
        length: 92,
        style: BodyRange.Style.MONOSPACE,
      },
    ],
    text,
  });

  return <MessageBody {...props} />;
}

export function LinkOverReadMoreBoundary(): React.JSX.Element {
  const text = 'https://hello.me';
  const originalText = 'https://hello.me123';

  const props = createProps({
    text,
    originalText,
  });

  return <MessageBody {...props} />;
}
