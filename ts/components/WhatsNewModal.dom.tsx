// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';
import moment from 'moment';

import { Modal } from './Modal.dom.tsx';
import { I18n } from './I18n.dom.tsx';
import type { LocalizerType } from '../types/Util.std.ts';
import { tw } from '../axo/tw.dom.tsx';

export type PropsType = {
  hideWhatsNewModal: () => unknown;
  i18n: LocalizerType;
};

type ReleaseNotesType = {
  date: Date;
  version: string;
  header?: React.JSX.Element;
  features: Array<React.JSX.Element>;
};

export function WhatsNewModal({
  i18n,
  hideWhatsNewModal,
}: PropsType): React.JSX.Element {
  let contentNode: ReactNode;

  const releaseNotes: ReleaseNotesType = {
    date: new Date(window.getBuildCreation?.() || Date.now()),
    version: window.getVersion?.(),
    features: [<I18n i18n={i18n} id="icu:WhatsNew__bugfixes--4" />],
  };

  if (releaseNotes.features.length === 1 && !releaseNotes.header) {
    contentNode = <p className={tw('mt-2')}>{releaseNotes.features[0]}</p>;
  } else {
    contentNode = (
      <>
        {releaseNotes.header ? <p>{releaseNotes.header}</p> : null}
        <ul className={tw('ms-4 mt-2 list-disc')}>
          {releaseNotes.features.map(element => {
            return (
              <li className={tw('mt-2')} key={element.props.id}>
                {element}
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <Modal
      modalName="WhatsNewModal"
      hasXButton
      i18n={i18n}
      onClose={hideWhatsNewModal}
      title={i18n('icu:WhatsNew__modal-title')}
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
