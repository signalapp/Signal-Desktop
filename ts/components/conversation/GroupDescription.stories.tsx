// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { text } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { GroupDescription, PropsType } from './GroupDescription';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/GroupDescription', module);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  title: text('title', overrideProps.title || 'Sample Title'),
  text: text('text', overrideProps.text || 'Default group description'),
});

story.add('Default', () => <GroupDescription {...createProps()} />);

story.add('Long', () => (
  <GroupDescription
    {...createProps({
      text:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas sed vehicula urna. Ut rhoncus, justo a vestibulum elementum, libero ligula molestie massa, et volutpat nibh ipsum sit amet enim. Vestibulum ac mi enim. Nulla fringilla justo justo, volutpat semper ex convallis quis. Proin posuere, mi at auctor tincidunt, magna turpis mattis nibh, ullamcorper vehicula lectus mauris in mauris. Nullam blandit sapien tortor, quis vehicula quam molestie nec. Nam sagittis dolor in eros dapibus scelerisque. Proin vitae ex sed magna lobortis tincidunt. Aenean dictum laoreet dolor, at suscipit ligula fermentum ac. Nam condimentum turpis quis sollicitudin rhoncus.',
    })}
  />
));
