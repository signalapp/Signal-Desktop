// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../../types/Util.std.ts';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { AxoSymbol } from '../../axo/AxoSymbol.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';

export type PropsType = Readonly<{
  conversationType: 'group' | 'direct';
  i18n: LocalizerType;
  onClose: () => void;
}>;

export function ProfileNameWarningModal({
  conversationType,
  i18n,
  onClose,
}: PropsType): React.JSX.Element {
  return (
    <AxoDialog.Root open onOpenChange={onClose}>
      <AxoDialog.Content
        size="sm"
        escape="cancel-is-noop"
        disableMissingAriaDescriptionWarning
      >
        <AxoDialog.Header>
          <AxoDialog.Close aria-label={i18n('icu:close')} />
        </AxoDialog.Header>
        <AxoDialog.Body padding="normal">
          <div className={tw('flex justify-center')}>
            <div
              className={tw(
                'rounded-3xl bg-legacy-warning-badge/12 px-4 py-1.5',
                'type-title-large font-regular text-legacy-warning-badge'
              )}
            >
              {conversationType === 'direct' ? (
                <AxoSymbol.InlineGlyph symbol="person-question" label={null} />
              ) : (
                <AxoSymbol.InlineGlyph symbol="person-question" label={null} />
              )}
            </div>
          </div>
          <div className={tw('mt-5 mb-12 type-body-medium text-label-primary')}>
            {conversationType === 'direct' ? (
              <>
                {i18n('icu:ProfileNameWarningModal__description--direct')}
                <ul className={tw('list-disc ps-4 [&>li]:mt-3')}>
                  <li>
                    {i18n(
                      'icu:ProfileNameWarningModal__warning--signal-cant-verify'
                    )}
                  </li>
                  <li>
                    {i18n(
                      'icu:ProfileNameWarningModal__warning--signal-wont-contact'
                    )}
                  </li>
                  <li>
                    {i18n('icu:ProfileNameWarningModal__warning--be-cautious')}
                  </li>
                  <li>
                    {i18n(
                      'icu:ProfileNameWarningModal__warning--dont-share-info'
                    )}
                  </li>
                </ul>
              </>
            ) : (
              <>
                {i18n('icu:ProfileNameWarningModal__description--group')}
                <ul className={tw('list-disc ps-4 [&>li]:mt-3')}>
                  <li>
                    {i18n('icu:ProfileNameWarningModal__list--item1--group')}
                  </li>
                  <li>
                    {i18n('icu:ProfileNameWarningModal__list--item2--group')}
                  </li>
                  <li>
                    {i18n('icu:ProfileNameWarningModal__list--item3--group')}
                  </li>
                </ul>
              </>
            )}
          </div>
        </AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
