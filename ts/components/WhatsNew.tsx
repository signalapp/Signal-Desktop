// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactChild, ReactNode, useState } from 'react';
import moment from 'moment';

import { Modal } from './Modal';
import { Intl, IntlComponentsType } from './Intl';
import { Emojify } from './conversation/Emojify';
import type { LocalizerType, RenderTextCallbackType } from '../types/Util';

export type PropsType = {
  i18n: LocalizerType;
};

type ReleaseNotesType = {
  date: Date;
  version: string;
  features: Array<{ key: string; components: IntlComponentsType }>;
};

const renderText: RenderTextCallbackType = ({ key, text }) => (
  <Emojify key={key} text={text} />
);

export const WhatsNew = ({ i18n }: PropsType): JSX.Element => {
  const [releaseNotes, setReleaseNotes] = useState<
    ReleaseNotesType | undefined
  >();

  const viewReleaseNotes = () => {
    setReleaseNotes({
      date: new Date(window.getBuildCreation?.() || Date.now()),
      version: window.getVersion(),
      features: [{ key: 'WhatsNew__v5.20', components: undefined }],
    });
  };

  let modalNode: ReactNode;
  if (releaseNotes) {
    let contentNode: ReactChild;
    if (releaseNotes.features.length === 1) {
      const { key, components } = releaseNotes.features[0];
      contentNode = (
        <p>
          <Intl
            i18n={i18n}
            id={key}
            renderText={renderText}
            components={components}
          />
        </p>
      );
    } else {
      contentNode = (
        <ul>
          {releaseNotes.features.map(({ key, components }) => (
            <li key={key}>
              <Intl
                i18n={i18n}
                id={key}
                renderText={renderText}
                components={components}
              />
            </li>
          ))}
        </ul>
      );
    }

    modalNode = (
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
          {contentNode}
        </>
      </Modal>
    );
  }

  return (
    <>
      {modalNode}
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
