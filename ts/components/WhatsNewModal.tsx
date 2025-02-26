// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';
import moment from 'moment';

import { Modal } from './Modal';
import { I18n } from './I18n';
import type { LocalizerType } from '../types/Util';

export type PropsType = {
  hideWhatsNewModal: () => unknown;
  i18n: LocalizerType;
};

type ReleaseNotesType = {
  date: Date;
  version: string;
  header?: JSX.Element;
  features: Array<JSX.Element>;
};

// Exported so it doesn't get marked unused
export function ExternalLink(props: {
  href: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <a href={props.href} target="_blank" rel="noreferrer">
      {props.children}
    </a>
  );
}

export function WhatsNewModal({
  i18n,
  hideWhatsNewModal,
}: PropsType): JSX.Element {
  let contentNode: ReactNode;

  const releaseNotes: ReleaseNotesType = {
    date: new Date(window.getBuildCreation?.() || Date.now()),
    version: window.getVersion?.(),
    features: [<I18n i18n={i18n} id="icu:WhatsNew__v7.45--0" />],
  };

  if (releaseNotes.features.length === 1 && !releaseNotes.header) {
    contentNode = <p>{releaseNotes.features[0]}</p>;
  } else {
    contentNode = (
      <>
        {releaseNotes.header ? <p>{releaseNotes.header}</p> : null}
        <ul>
          {releaseNotes.features.map(element => {
            return <li key={element.props.id}>{element}</li>;
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
