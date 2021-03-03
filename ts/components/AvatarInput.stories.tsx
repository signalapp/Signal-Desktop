// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { chunk, noop } from 'lodash';

import { storiesOf } from '@storybook/react';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

import { AvatarInput } from './AvatarInput';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/AvatarInput', module);

const TEST_IMAGE = new Uint8Array(
  chunk(
    '89504e470d0a1a0a0000000d4948445200000008000000080103000000fec12cc800000006504c5445ff00ff00ff000c82e9800000001849444154085b633061a8638863a867f8c720c760c12000001a4302f4d81dd9870000000049454e44ae426082',
    2
  ).map(bytePair => parseInt(bytePair.join(''), 16))
).buffer;

const Wrapper = ({ startValue }: { startValue: undefined | ArrayBuffer }) => {
  const [value, setValue] = useState<undefined | ArrayBuffer>(startValue);
  const [objectUrl, setObjectUrl] = useState<undefined | string>();

  useEffect(() => {
    if (!value) {
      setObjectUrl(undefined);
      return noop;
    }
    const url = URL.createObjectURL(new Blob([value]));
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [value]);

  return (
    <>
      <div
        style={{
          background: 'rgba(255, 0, 255, 0.1)',
        }}
      >
        <AvatarInput
          contextMenuId={uuid()}
          i18n={i18n}
          value={value}
          onChange={setValue}
        />
      </div>
      <figure>
        <figcaption>Processed image (if it exists)</figcaption>
        {objectUrl && <img src={objectUrl} alt="" />}
      </figure>
    </>
  );
};

story.add('No start state', () => {
  return <Wrapper startValue={undefined} />;
});

story.add('Starting with a value', () => {
  return <Wrapper startValue={TEST_IMAGE} />;
});
