// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { noop } from 'lodash';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { Button } from './Button';
import { Modal } from './Modal';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Modal', module);

const onClose = action('onClose');

const LOREM_IPSUM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec a diam lectus. Sed sit amet ipsum mauris. Maecenas congue ligula ac quam viverra nec consectetur ante hendrerit. Donec et mollis dolor. Praesent et diam eget libero egestas mattis sit amet vitae augue. Nam tincidunt congue enim, ut porta lorem lacinia consectetur. Donec ut libero sed arcu vehicula ultricies a non tortor. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean ut gravida lorem. Ut turpis felis, pulvinar a semper sed, adipiscing id dolor. Pellentesque auctor nisi id magna consequat sagittis. Curabitur dapibus enim sit amet elit pharetra tincidunt feugiat nisl imperdiet. Ut convallis libero in urna ultrices accumsan. Donec sed odio eros. Donec viverra mi quis quam pulvinar at malesuada arcu rhoncus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. In rutrum accumsan ultricies. Mauris vitae nisi at sem facilisis semper ac in est.';

story.add('Bare bones, short', () => <Modal i18n={i18n}>Hello world!</Modal>);

story.add('Bare bones, long', () => (
  <Modal i18n={i18n}>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
  </Modal>
));

story.add('Bare bones, long, with button', () => (
  <Modal i18n={i18n}>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <Modal.ButtonFooter>
      <Button onClick={noop}>Okay</Button>
    </Modal.ButtonFooter>
  </Modal>
));

story.add('Title, X button, body, and button footer', () => (
  <Modal i18n={i18n} title="Hello world" onClose={onClose} hasXButton>
    {LOREM_IPSUM}
    <Modal.ButtonFooter>
      <Button onClick={noop}>Okay</Button>
    </Modal.ButtonFooter>
  </Modal>
));

story.add('Lots of buttons in the footer', () => (
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
));

story.add('Long body with title', () => (
  <Modal i18n={i18n} title="Hello world" onClose={onClose}>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
  </Modal>
));

story.add('Long body with title and button', () => (
  <Modal i18n={i18n} title="Hello world" onClose={onClose}>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <p>{LOREM_IPSUM}</p>
    <Modal.ButtonFooter>
      <Button onClick={noop}>Okay</Button>
    </Modal.ButtonFooter>
  </Modal>
));

story.add('Long body with long title and X button', () => (
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
));

story.add('With sticky buttons long body', () => (
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
));

story.add('With sticky buttons short body', () => (
  <Modal hasStickyButtons hasXButton i18n={i18n} onClose={onClose}>
    <p>{LOREM_IPSUM.slice(0, 140)}</p>
    <Modal.ButtonFooter>
      <Button onClick={noop}>Okay</Button>
      <Button onClick={noop}>Okay</Button>
    </Modal.ButtonFooter>
  </Modal>
));

story.add('Sticky footer, Lots of buttons', () => (
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
));
