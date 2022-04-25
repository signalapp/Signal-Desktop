// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { storiesOf } from '@storybook/react';

import enMessages from '../../_locales/en/messages.json';
import { setupI18n } from '../util/setupI18n';
import { TextAttachment } from './TextAttachment';
import type { PropsType } from './TextAttachment';

const i18n = setupI18n('en', enMessages);

const getDefaultProps = (): PropsType => ({
  i18n,
  textAttachment: {},
});

const story = storiesOf('Components/TextAttachment', module);

story.add('Solid bg + text bg', () => (
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
));

story.add('Gradient', () => (
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
));

story.add('Text with line breaks (condensed font)', () => (
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
));

story.add('Text with line breaks + Autowrap (serif font)', () => (
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
));

story.add('Autowrap text', () => (
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
));

story.add('Romeo & Juliet', () => (
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
));

story.add('Overflow newline numbers', () => (
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
));

story.add('Character wrap (bold)', () => (
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
));

story.add('Mix of newlines, overflow, autowrap', () => (
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
));

story.add('Link preview', () => (
  <TextAttachment
    {...getDefaultProps()}
    textAttachment={{
      color: 4294951251,
      preview: {
        url: 'https://www.signal.org/workworkwork',
        title: 'Signal >> Careers',
      },
    }}
  />
));

story.add('Link preview (thumbnail)', () => (
  <TextAttachment
    {...getDefaultProps()}
    isThumbnail
    textAttachment={{
      color: 4294951251,
      preview: {
        url: 'https://www.signal.org/workworkwork',
        title: 'Signal >> Careers',
      },
    }}
  />
));

story.add('Link preview (long title)', () => (
  <TextAttachment
    {...getDefaultProps()}
    textAttachment={{
      color: 4294951251,
      preview: {
        title:
          '2021 Etihad Airways Abu Dhabi Grand Prix Race Summary - F1 RaceCast Dec 10 to Dec 12 - ESPN',
        url: 'https://www.espn.com/f1/race/_/id/600001776',
      },
      text: 'Spoiler alert!',
      textForegroundColor: 4294704123,
    }}
  />
));

story.add('Link preview (just url)', () => (
  <TextAttachment
    {...getDefaultProps()}
    textAttachment={{
      color: 4294951251,
      preview: {
        url: 'https://www.rolex.com/en-us/watches/day-date/m228236-0012.html',
      },
    }}
  />
));

story.add('Link preview (just url + text)', () => (
  <TextAttachment
    {...getDefaultProps()}
    textAttachment={{
      color: 4294951251,
      preview: {
        url: 'https://www.rolex.com/en-us/watches/day-date/m228236-0012.html',
      },
      text: 'Check this out!',
    }}
  />
));

story.add('Link preview (really long domain)', () => (
  <TextAttachment
    {...getDefaultProps()}
    textAttachment={{
      color: 4294951251,
      preview: {
        url: 'https://llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch.international/',
      },
    }}
  />
));

story.add('Link Preview w/ R&J', () => (
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
      },
    }}
  />
));
