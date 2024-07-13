// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { I18n } from '../I18n';
import type { LocalizerType } from '../../types/Util';

export type PropsType = {
  conversationId: string;
  i18n: LocalizerType;
  showGV2MigrationDialog: (id: string) => unknown;
};

export function GroupV1DisabledActions({
  conversationId,
  i18n,
  showGV2MigrationDialog,
}: PropsType): JSX.Element {
  return (
    <div className="module-group-v1-disabled-actions">
      <p className="module-group-v1-disabled-actions__message">
        <I18n
          i18n={i18n}
          id="icu:GroupV1--Migration--disabled--link"
          components={{
            // This is a render prop, not a component
            // eslint-disable-next-line react/no-unstable-nested-components
            learnMoreLink: parts => {
              return (
                <a
                  href="https://support.signal.org/hc/articles/360007319331"
                  target="_blank"
                  rel="noreferrer"
                  className="module-group-v1-disabled-actions__message__learn-more"
                >
                  {parts}
                </a>
              );
            },
          }}
        />
      </p>
      <div className="module-group-v1-disabled-actions__buttons">
        <button
          type="button"
          onClick={() => showGV2MigrationDialog(conversationId)}
          tabIndex={0}
          className="module-group-v1-disabled-actions__buttons__button"
        >
          {i18n('icu:MessageRequests--continue')}
        </button>
      </div>
    </div>
  );
}
