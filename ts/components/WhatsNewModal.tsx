// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild } from 'react';
import React from 'react';
import moment from 'moment';

import { Modal } from './Modal';
import type { IntlComponentsType } from './Intl';
import { Intl } from './Intl';
import { Emojify } from './conversation/Emojify';
import type { LocalizerType, RenderTextCallbackType } from '../types/Util';

export type PropsType = {
  hideWhatsNewModal: () => unknown;
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

const releaseNotes: ReleaseNotesType = {
  date: new Date(window.getBuildCreation?.() || Date.now()),
  version: window.getVersion?.(),
  features: [
    {
      key: 'WhatsNew__bugfixes--5',
      components: undefined,
    },
  ],
};

export const WhatsNewModal = ({
  i18n,
  hideWhatsNewModal,
}: PropsType): JSX.Element => {
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

  return (
    <Modal
      hasXButton
      i18n={i18n}
      onClose={hideWhatsNewModal}
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
};
