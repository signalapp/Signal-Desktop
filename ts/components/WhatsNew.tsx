// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import moment from 'moment';

import { Modal } from './Modal';
import { Intl } from './Intl';
import { Emojify } from './conversation/Emojify';
import { LocalizerType } from '../types/Util';

export type PropsType = {
  i18n: LocalizerType;
};

type ReleaseNotesType = {
  date: Date;
  version: string;
  features: Array<string>;
};

export const WhatsNew = ({ i18n }: PropsType): JSX.Element => {
  const [releaseNotes, setReleaseNotes] = useState<
    ReleaseNotesType | undefined
  >();

  const viewReleaseNotes = () => {
    setReleaseNotes({
      date: new Date('09/10/2021'),
      version: window.getVersion(),
      features: ['WhatsNew__v5.17--1', 'WhatsNew__v5.17--2'],
    });
  };

  return (
    <>
      {releaseNotes && (
        <Modal
          hasXButton
          i18n={i18n}
          onClose={() => setReleaseNotes(undefined)}
          title={i18n('WhatsNew__modal-title')}
        >
          <>
            <span>
              {moment(releaseNotes.date).format('LL')} &middot;{' '}
              {releaseNotes.version}
            </span>
            <ul>
              {releaseNotes.features.map(featureKey => (
                <li key={featureKey}>
                  <Intl
                    i18n={i18n}
                    id={featureKey}
                    renderText={({ key, text }) => (
                      <Emojify key={key} text={text} />
                    )}
                  />
                </li>
              ))}
            </ul>
          </>
        </Modal>
      )}
      <Intl
        i18n={i18n}
        id="whatsNew"
        components={[
          <button className="WhatsNew" type="button" onClick={viewReleaseNotes}>
            {i18n('viewReleaseNotes')}
          </button>,
        ]}
      />
    </>
  );
};
