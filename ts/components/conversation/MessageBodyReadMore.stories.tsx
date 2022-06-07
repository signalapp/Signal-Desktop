// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';

import type { Props } from './MessageBodyReadMore';
import { MessageBodyReadMore } from './MessageBodyReadMore';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/MessageBodyReadMore',
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  bodyRanges: overrideProps.bodyRanges,
  direction: 'incoming',
  displayLimit: overrideProps.displayLimit,
  i18n,
  id: 'some-id',
  messageExpanded: action('messageExpanded'),
  text: text('text', overrideProps.text || ''),
});

function MessageBodyReadMoreTest({
  text: messageBodyText,
}: {
  text: string;
}): JSX.Element {
  const [displayLimit, setDisplayLimit] = useState<number | undefined>();

  return (
    <MessageBodyReadMore
      {...createProps({ text: messageBodyText })}
      displayLimit={displayLimit}
      messageExpanded={(_, newDisplayLimit) => setDisplayLimit(newDisplayLimit)}
    />
  );
}

export const LongText100More = (): JSX.Element => (
  <MessageBodyReadMoreTest
    text={`${'test '.repeat(160)}${'extra '.repeat(10)}`}
  />
);

LongText100More.story = {
  name: 'Long text + 100 more',
};

export const LotsOfCakeWithSomeCherriesOnTop = (): JSX.Element => (
  <MessageBodyReadMoreTest text={`x${'🍰'.repeat(399)}${'🍒'.repeat(100)}`} />
);

LotsOfCakeWithSomeCherriesOnTop.story = {
  name: 'Lots of cake with some cherries on top',
};

export const LeafyNotBuffered = (): JSX.Element => (
  <MessageBodyReadMoreTest text={`x${'🌿'.repeat(450)}`} />
);

LeafyNotBuffered.story = {
  name: 'Leafy not buffered',
};

export const Links = (): JSX.Element => (
  <MessageBodyReadMoreTest
    text={`${'test '.repeat(176)}https://www.signal.org`}
  />
);

export const ExcessiveAmountsOfCake = (): JSX.Element => (
  <MessageBodyReadMoreTest text={`x${'🍰'.repeat(20000)}`} />
);

ExcessiveAmountsOfCake.story = {
  name: 'Excessive amounts of cake',
};

export const LongText = (): JSX.Element => (
  <MessageBodyReadMoreTest
    text={`
      SCENE I. Rome. A street.
      Enter FLAVIUS, MARULLUS, and certain Commoners
      FLAVIUS
      Hence! home, you idle creatures get you home:
      Is this a holiday? what! know you not,
      Being mechanical, you ought not walk
      Upon a labouring day without the sign
      Of your profession? Speak, what trade art thou?
      First Commoner
      Why, sir, a carpenter.
      MARULLUS
      Where is thy leather apron and thy rule?
      What dost thou with thy best apparel on?
      You, sir, what trade are you?
      Second Commoner
      Truly, sir, in respect of a fine workman, I am but,
      as you would say, a cobbler.
      MARULLUS
      But what trade art thou? answer me directly.
      Second Commoner
      A trade, sir, that, I hope, I may use with a safe
      conscience; which is, indeed, sir, a mender of bad soles.
      MARULLUS
      What trade, thou knave? thou naughty knave, what trade?
      Second Commoner
      Nay, I beseech you, sir, be not out with me: yet,
      if you be out, sir, I can mend you.
      MARULLUS
      What meanest thou by that? mend me, thou saucy fellow!
      Second Commoner
      Why, sir, cobble you.
      FLAVIUS
      Thou art a cobbler, art thou?
      Second Commoner
      Truly, sir, all that I live by is with the awl: I
      meddle with no tradesman's matters, nor women's
      matters, but with awl. I am, indeed, sir, a surgeon
      to old shoes; when they are in great danger, I
      recover them. As proper men as ever trod upon
      neat's leather have gone upon my handiwork.
      FLAVIUS
      But wherefore art not in thy shop today?
      Why dost thou lead these men about the streets?
      Second Commoner
      Truly, sir, to wear out their shoes, to get myself
      into more work. But, indeed, sir, we make holiday,
      to see Caesar and to rejoice in his triumph.
      MARULLUS
      Wherefore rejoice? What conquest brings he home?
      What tributaries follow him to Rome,
      To grace in captive bonds his chariot-wheels?
      You blocks, you stones, you worse than senseless things!
      O you hard hearts, you cruel men of Rome,
      Knew you not Pompey? Many a time and oft
      Have you climb'd up to walls and battlements,
      To towers and windows, yea, to chimney-tops,
      Your infants in your arms, and there have sat
      The livelong day, with patient expectation,
      To see great Pompey pass the streets of Rome:
      And when you saw his chariot but appear,
      Have you not made an universal shout,
      That Tiber trembled underneath her banks,
      To hear the replication of your sounds
      Made in her concave shores?
      And do you now put on your best attire?
      And do you now cull out a holiday?
      And do you now strew flowers in his way
      That comes in triumph over Pompey's blood? Be gone!
      Run to your houses, fall upon your knees,
      Pray to the gods to intermit the plague
      That needs must light on this ingratitude.
      FLAVIUS
      Go, go, good countrymen, and, for this fault,
      Assemble all the poor men of your sort;
      Draw them to Tiber banks, and weep your tears
      Into the channel, till the lowest stream
      Do kiss the most exalted shores of all.
      Exeunt all the Commoners
      See whether their basest metal be not moved;
      They vanish tongue-tied in their guiltiness.
      Go you down that way towards the Capitol;
      This way will I
      disrobe the images,
      If you do find them deck'd with ceremonies.
      MARULLUS
      May we do so?
      You know it is the feast of Lupercal.
      FLAVIUS
      It is no matter; let no images
      Be hung with Caesar's trophies. I'll about,
      And drive away the vulgar from the streets:
      So do you too, where you perceive them thick.
      These growing feathers pluck'd from Caesar's wing
      Will make him fly an ordinary pitch,
      Who else would soar above the view of men
      And keep us all in servile fearfulness.
      `}
  />
);

LongText.story = {
  name: 'Long text',
};
