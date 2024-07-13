// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { Meta } from '@storybook/react';
import enMessages from '../../_locales/en/messages.json';
import { setupI18n } from '../util/setupI18n';
import { TextAttachment } from './TextAttachment';
import type { PropsType } from './TextAttachment';

const i18n = setupI18n('en', enMessages);

const getDefaultProps = (): PropsType => ({
  i18n,
  textAttachment: {},
});

export default {
  title: 'Components/TextAttachment',
} satisfies Meta<PropsType>;

export function SolidBgTextBg(): JSX.Element {
  return (
    <TextAttachment
      {...getDefaultProps()}
      textAttachment={{
        color: 4286869806,
        text: 'hello',
        textBackgroundColor: 4293263387,
        textForegroundColor: 4294967295,
        textStyle: 1,
      }}
    />
  );
}

export function Gradient(): JSX.Element {
  return (
    <TextAttachment
      {...getDefaultProps()}
      textAttachment={{
        gradient: {
          angle: 191,
          endColor: 4282529679,
          startColor: 4294260804,
        },
        text: 'hey',
        textBackgroundColor: 0,
        textForegroundColor: 4294704123,
        textStyle: 1,
      }}
    />
  );
}

export function TextWithLineBreaksCondensedFont(): JSX.Element {
  return (
    <TextAttachment
      {...getDefaultProps()}
      textAttachment={{
        gradient: {
          angle: 180,
          endColor: 4278884698,
          startColor: 4284861868,
        },
        text: 'Wow!\nThis is 2 lines!',
        textBackgroundColor: 4294967295,
        textForegroundColor: 4278249127,
        textStyle: 5,
      }}
    />
  );
}

export function TextWithLineBreaksAutowrapSerifFont(): JSX.Element {
  return (
    <TextAttachment
      {...getDefaultProps()}
      textAttachment={{
        color: 4278249127,
        text: 'Wrap?\nYes please, wrap this text automatically for me so that it fits nicely inside the story.',
        textBackgroundColor: 0,
        textForegroundColor: 4294967295,
        textStyle: 3,
      }}
    />
  );
}

export function AutowrapText(): JSX.Element {
  return (
    <TextAttachment
      {...getDefaultProps()}
      textAttachment={{
        gradient: {
          angle: 175,
          endColor: 4294859832,
          startColor: 4294950980,
        },
        text: 'This text should automatically wrap into multiple lines since it exceeds the bounds of the story',
        textBackgroundColor: 4294967295,
        textForegroundColor: 4278249037,
        textStyle: 1,
      }}
    />
  );
}

export function RomeoJuliet(): JSX.Element {
  return (
    <TextAttachment
      {...getDefaultProps()}
      textAttachment={{
        gradient: {
          angle: 180,
          endColor: 4286632135,
          startColor: 4278227945,
        },
        text: "Two households, both alike in dignity, In fair Verona, where we lay our scene, From ancient grudge break to new mutiny, Where civil blood makes civil hands unclean. From forth the fatal loins of these two foes A pair of star-cross'd lovers take their life; Whose misadventured piteous overthrows Do with their death bury their parents' strife. The fearful passage of their death-mark'd love, And the continuance of their parents' rage, Which, but their children's end, nought could remove, Is now the two hours' traffic of our stage; The which if you with patient ears attend, What here shall miss, our toil shall strive to mend.",
        textBackgroundColor: 0,
        textForegroundColor: 4294704123,
        textStyle: 4,
      }}
    />
  );
}

export function OverflowNewlineNumbers(): JSX.Element {
  return (
    <TextAttachment
      {...getDefaultProps()}
      textAttachment={{
        gradient: {
          angle: 175,
          endColor: 4294859832,
          startColor: 4294950980,
        },
        text: '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16',
        textBackgroundColor: 4294967295,
        textForegroundColor: 4278249037,
        textStyle: 1,
      }}
    />
  );
}

export function CharacterWrapBold(): JSX.Element {
  return (
    <TextAttachment
      {...getDefaultProps()}
      textAttachment={{
        color: 4278825851,
        text: 'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
        textBackgroundColor: 0,
        textForegroundColor: 4294704123,
        textStyle: 2,
      }}
    />
  );
}

export function MixOfNewlinesOverflowAutowrap(): JSX.Element {
  return (
    <TextAttachment
      {...getDefaultProps()}
      textAttachment={{
        color: 4294951251,
        text: 'A new line\nIs this a new line? Yes, indeed and I should be wrapped woooooooooooooooooooooooow this is working!\nCool.',
        textBackgroundColor: 0,
        textForegroundColor: 4278231014,
        textStyle: 1,
      }}
    />
  );
}

export function LinkPreview(): JSX.Element {
  return (
    <TextAttachment
      {...getDefaultProps()}
      textAttachment={{
        color: 4294951251,
        preview: {
          url: 'https://www.signal.org/workworkwork',
          title: 'Signal >> Careers',
          isCallLink: false,
        },
      }}
    />
  );
}

export function LinkPreviewThumbnail(): JSX.Element {
  return (
    <TextAttachment
      {...getDefaultProps()}
      isThumbnail
      textAttachment={{
        color: 4294951251,
        preview: {
          url: 'https://www.signal.org/workworkwork',
          title: 'Signal >> Careers',
          isCallLink: false,
        },
      }}
    />
  );
}

export function LinkPreviewLongTitle(): JSX.Element {
  return (
    <TextAttachment
      {...getDefaultProps()}
      textAttachment={{
        color: 4294951251,
        preview: {
          title:
            '2021 Etihad Airways Abu Dhabi Grand Prix Race Summary - F1 RaceCast Dec 10 to Dec 12 - ESPN',
          url: 'https://www.espn.com/f1/race/_/id/600001776',
          isCallLink: false,
        },
        text: 'Spoiler alert!',
        textForegroundColor: 4294704123,
      }}
    />
  );
}

export function LinkPreviewJustUrl(): JSX.Element {
  return (
    <TextAttachment
      {...getDefaultProps()}
      textAttachment={{
        color: 4294951251,
        preview: {
          url: 'https://www.rolex.com/en-us/watches/day-date/m228236-0012.html',
          isCallLink: false,
        },
      }}
    />
  );
}

export function LinkPreviewJustUrlText(): JSX.Element {
  return (
    <TextAttachment
      {...getDefaultProps()}
      textAttachment={{
        color: 4294951251,
        preview: {
          url: 'https://www.rolex.com/en-us/watches/day-date/m228236-0012.html',
          isCallLink: false,
        },
        text: 'Check this out!',
      }}
    />
  );
}

export function LinkPreviewReallyLongDomain(): JSX.Element {
  return (
    <TextAttachment
      {...getDefaultProps()}
      textAttachment={{
        color: 4294951251,
        preview: {
          url: 'https://llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch.international/',
          isCallLink: false,
        },
      }}
    />
  );
}

export function LinkPreviewWRJ(): JSX.Element {
  return (
    <TextAttachment
      {...getDefaultProps()}
      textAttachment={{
        gradient: {
          angle: 180,
          endColor: 4286632135,
          startColor: 4278227945,
        },
        text: "Two households, both alike in dignity, In fair Verona, where we lay our scene, From ancient grudge break to new mutiny, Where civil blood makes civil hands unclean. From forth the fatal loins of these two foes A pair of star-cross'd lovers take their life; Whose misadventured piteous overthrows Do with their death bury their parents' strife. The fearful passage of their death-mark'd love, And the continuance of their parents' rage, Which, but their children's end, nought could remove, Is now the two hours' traffic of our stage; The which if you with patient ears attend, What here shall miss, our toil shall strive to mend.",
        textBackgroundColor: 0,
        textForegroundColor: 4294704123,
        textStyle: 4,
        preview: {
          title: 'Romeo and Juliet: Entire Play',
          url: 'http://shakespeare.mit.edu/romeo_juliet/full.html',
          isCallLink: false,
        },
      }}
    />
  );
}

export function TextBackgroundAndLinkPreview(): JSX.Element {
  return (
    <TextAttachment
      {...getDefaultProps()}
      textAttachment={{
        gradient: {
          angle: 175,
          endColor: 4294859832,
          startColor: 4294950980,
        },
        text: 'Check out this neat video I found',
        textBackgroundColor: 4294967295,
        textForegroundColor: 4278249037,
        textStyle: 1,
        preview: {
          title: 'A really long title so that the we can test the margins',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          isCallLink: false,
        },
      }}
    />
  );
}
