// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import { tw } from '../../axo/tw.dom.tsx';
import type { LocalizerType } from '../../types/Util.std.ts';
import { formatBackupKeyForDisplay } from '../../util/formatBackupKeyForDisplay.std.ts';

type SignalAccountKeysPropsType = Readonly<{
  i18n: LocalizerType;
  serviceId: string | undefined;
  backupKey: string | undefined;
}>;

export function SignalAccountKeys({
  i18n,
  serviceId,
  backupKey,
}: SignalAccountKeysPropsType): ReactNode {
  const backupKeyForDisplay =
    backupKey &&
    formatBackupKeyForDisplay(backupKey, {
      convertAmbiguousChars: true,
    });

  return (
    <>
      <img
        alt={i18n('icu:Preferences__SignalAccount__label')}
        className={tw('mx-auto mb-6.5')}
        src="images/signal-login.svg"
        width="98"
        height="56"
      />

      {serviceId && (
        <KeySection
          label={i18n('icu:Preferences__SignalAccountKeys__AccountKey')}
          value={serviceId}
        />
      )}
      <div className={tw('mb-4')} />
      {backupKeyForDisplay && (
        <KeySection
          label={i18n('icu:Preferences__SignalAccountKeys__RecoveryKey')}
          value={backupKeyForDisplay}
        />
      )}
    </>
  );
}

function KeySection({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactNode {
  return (
    <section>
      <h2 className={tw('px-4 py-2 type-body-medium font-semibold')}>
        {label}
      </h2>
      <div
        className={tw(
          'overflow-auto',
          'select-text',
          'curved-2xl bg-surface-card p-1 shadow-elevation-0',
          'forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]',
          'forced-colors:border forced-colors:border-[ButtonBorder]',
          'w-full px-4 py-2.5'
        )}
      >
        <div className={tw('w-full max-w-[40ch] font-mono')}>{value}</div>
      </div>
    </section>
  );
}
