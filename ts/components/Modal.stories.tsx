// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { noop } from 'lodash';

import { action } from '@storybook/addon-actions';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { Button } from './Button';
import { Modal } from './Modal';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Modal',
};

const onClose = action('onClose');

const LOREM_IPSUM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec a diam lectus. Sed sit amet ipsum mauris. Maecenas congue ligula ac quam viverra nec consectetur ante hendrerit. Donec et mollis dolor. Praesent et diam eget libero egestas mattis sit amet vitae augue. Nam tincidunt congue enim, ut porta lorem lacinia consectetur. Donec ut libero sed arcu vehicula ultricies a non tortor. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean ut gravida lorem. Ut turpis felis, pulvinar a semper sed, adipiscing id dolor. Pellentesque auctor nisi id magna consequat sagittis. Curabitur dapibus enim sit amet elit pharetra tincidunt feugiat nisl imperdiet. Ut convallis libero in urna ultrices accumsan. Donec sed odio eros. Donec viverra mi quis quam pulvinar at malesuada arcu rhoncus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. In rutrum accumsan ultricies. Mauris vitae nisi at sem facilisis semper ac in est.';

export const BareBonesShort = (): JSX.Element => (
  <Modal i18n={i18n} useFocusTrap={false}>
    Hello world!
  </Modal>
);

BareBonesShort.story = {
  name: 'Bare bones, short',
};

export const BareBonesLong = (): JSX.Element => (
  <Modal i18n={i18n} useFocusTrap={false}>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
  </Modal>
);

BareBonesLong.story = {
  name: 'Bare bones, long',
};

export const BareBonesLongWithButton = (): JSX.Element => (
  <Modal i18n={i18n}>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <Modal.ButtonFooter>
      <Button onClick={noop}>Okay</Button>
    </Modal.ButtonFooter>
  </Modal>
);

BareBonesLongWithButton.story = {
  name: 'Bare bones, long, with button',
};

export const TitleXButtonBodyAndButtonFooter = (): JSX.Element => (
  <Modal i18n={i18n} title="Hello world" onClose={onClose} hasXButton>
    {LOREM_IPSUM}
    <Modal.ButtonFooter>
      <Button onClick={noop}>Okay</Button>
    </Modal.ButtonFooter>
  </Modal>
);

TitleXButtonBodyAndButtonFooter.story = {
  name: 'Title, X button, body, and button footer',
};

export const LotsOfButtonsInTheFooter = (): JSX.Element => (
  <Modal i18n={i18n} onClose={onClose}>
    Hello world!
    <Modal.ButtonFooter>
      <Button onClick={noop}>Okay</Button>
      <Button onClick={noop}>Okay</Button>
      <Button onClick={noop}>Okay</Button>
      <Button onClick={noop}>
        This is a button with a fairly large amount of text
      </Button>
      <Button onClick={noop}>Okay</Button>
      <Button onClick={noop}>
        This is a button with a fairly large amount of text
      </Button>
      <Button onClick={noop}>Okay</Button>
    </Modal.ButtonFooter>
  </Modal>
);

LotsOfButtonsInTheFooter.story = {
  name: 'Lots of buttons in the footer',
};

export const LongBodyWithTitle = (): JSX.Element => (
  <Modal i18n={i18n} title="Hello world" onClose={onClose} useFocusTrap={false}>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
  </Modal>
);

LongBodyWithTitle.story = {
  name: 'Long body with title',
};

export const LongBodyWithTitleAndButton = (): JSX.Element => (
  <Modal i18n={i18n} title="Hello world" onClose={onClose}>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <Modal.ButtonFooter>
      <Button onClick={noop}>Okay</Button>
    </Modal.ButtonFooter>
  </Modal>
);

LongBodyWithTitleAndButton.story = {
  name: 'Long body with title and button',
};

export const LongBodyWithLongTitleAndXButton = (): JSX.Element => (
  <Modal
    i18n={i18n}
    title={LOREM_IPSUM.slice(0, 104)}
    hasXButton
    onClose={onClose}
  >
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
  </Modal>
);

LongBodyWithLongTitleAndXButton.story = {
  name: 'Long body with long title and X button',
};

export const WithStickyButtonsLongBody = (): JSX.Element => (
  <Modal hasStickyButtons hasXButton i18n={i18n} onClose={onClose}>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <Modal.ButtonFooter>
      <Button onClick={noop}>Okay</Button>
      <Button onClick={noop}>Okay</Button>
    </Modal.ButtonFooter>
  </Modal>
);

WithStickyButtonsLongBody.story = {
  name: 'With sticky buttons long body',
};

export const WithStickyButtonsShortBody = (): JSX.Element => (
  <Modal hasStickyButtons hasXButton i18n={i18n} onClose={onClose}>
    <p>{LOREM_IPSUM.slice(0, 140)}</p>
    <Modal.ButtonFooter>
      <Button onClick={noop}>Okay</Button>
      <Button onClick={noop}>Okay</Button>
    </Modal.ButtonFooter>
  </Modal>
);

WithStickyButtonsShortBody.story = {
  name: 'With sticky buttons short body',
};

export const StickyFooterLotsOfButtons = (): JSX.Element => (
  <Modal hasStickyButtons i18n={i18n} onClose={onClose} title="OK">
    <p>{LOREM_IPSUM}</p>
    <Modal.ButtonFooter>
      <Button onClick={noop}>Okay</Button>
      <Button onClick={noop}>Okay</Button>
      <Button onClick={noop}>Okay</Button>
      <Button onClick={noop}>
        This is a button with a fairly large amount of text
      </Button>
      <Button onClick={noop}>Okay</Button>
      <Button onClick={noop}>
        This is a button with a fairly large amount of text
      </Button>
      <Button onClick={noop}>Okay</Button>
    </Modal.ButtonFooter>
  </Modal>
);

StickyFooterLotsOfButtons.story = {
  name: 'Sticky footer, Lots of buttons',
};

export const WithBackButton = (): JSX.Element => (
  <Modal
    hasXButton
    i18n={i18n}
    onBackButtonClick={noop}
    useFocusTrap={false}
    title="The Modal Title"
  >
    Hello world!
  </Modal>
);

WithBackButton.story = {
  name: 'Back Button',
};
