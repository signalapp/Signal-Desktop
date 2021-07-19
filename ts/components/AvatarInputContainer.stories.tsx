// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { v4 as uuid } from 'uuid';
import { noop } from 'lodash';

import { storiesOf } from '@storybook/react';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

import { AvatarInputContainer } from './AvatarInputContainer';
import { AvatarInputType } from './AvatarInput';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/AvatarInputContainer', module);

story.add('No photo (group)', () => (
  <AvatarInputContainer
    contextMenuId={uuid()}
    i18n={i18n}
    onAvatarChanged={noop}
  />
));

story.add('No photo (profile)', () => (
  <AvatarInputContainer
    contextMenuId={uuid()}
    i18n={i18n}
    onAvatarChanged={noop}
    type={AvatarInputType.Profile}
  />
));

story.add('Has photo', () => (
  <AvatarInputContainer
    avatarPath="/fixtures/kitten-3-64-64.jpg"
    contextMenuId={uuid()}
    i18n={i18n}
    onAvatarChanged={noop}
  />
));
