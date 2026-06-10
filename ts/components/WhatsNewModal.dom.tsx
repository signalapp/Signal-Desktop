// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode, JSX } from 'react';
import moment from 'moment';
import { I18n } from './I18n.dom.tsx';
import type { LocalizerType } from '../types/Util.std.ts';
import { tw } from '../axo/tw.dom.tsx';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';

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

export function WhatsNewModal({
  i18n,
  hideWhatsNewModal,
}: PropsType): JSX.Element {
  let contentNode: ReactNode;

  const releaseNotes: ReleaseNotesType = {
    date: new Date(window.getBuildCreation?.() || Date.now()),
    version: window.getVersion?.(),
    features: [
      <I18n i18n={i18n} id="icu:WhatsNew__8.15--0" />,
      <I18n i18n={i18n} id="icu:WhatsNew__8.15--1" />,
    ],
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
    <AxoDialog.Root open onOpenChange={hideWhatsNewModal}>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>{i18n('icu:WhatsNew__modal-title')}</AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoDialog.Description>
            <h3>
              {moment(releaseNotes.date).format('LL')} &middot;{' '}
              {releaseNotes.version}
            </h3>
            {contentNode}
          </AxoDialog.Description>
        </AxoDialog.Body>
        <AxoDialog.Footer />
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
