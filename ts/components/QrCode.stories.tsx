// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './QrCode';
import { QrCode } from './QrCode';

export default {
  title: 'Components/QrCode',
} satisfies Meta<PropsType>;

export function Default(): JSX.Element {
  return (
    <QrCode
      alt="Scan this little code!"
      data="sgnl://linkdevice?uuid=gCkj0T2xiSUaPRhMYiF24w&pub_key=7RshtQrb3UTMowITe79uW9dgw_CLTGWenj0OT80i0HpH"
    />
  );
}
