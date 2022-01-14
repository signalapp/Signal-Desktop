// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { storiesOf } from '@storybook/react';

import { QrCode } from './QrCode';

const story = storiesOf('Components/QrCode', module);

story.add('Default', () => (
  <QrCode
    alt="Scan this little code!"
    data="sgnl://linkdevice?uuid=gCkj0T2xiSUaPRhMYiF24w&pub_key=7RshtQrb3UTMowITe79uW9dgw_CLTGWenj0OT80i0HpH"
  />
));
