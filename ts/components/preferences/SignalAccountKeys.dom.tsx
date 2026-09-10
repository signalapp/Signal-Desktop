// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import { useState, useCallback, useMemo } from 'react';
import { tw } from '../../axo/tw.dom.tsx';
import { AxoButton } from '../../axo/AxoButton.dom.tsx';
import type { LocalizerType } from '../../types/Util.std.ts';
import { formatBackupKeyForDisplay } from '../../util/formatBackupKeyForDisplay.std.ts';

type SignalAccountKeysPropsType = Readonly<{
  i18n: LocalizerType;
  serviceId: string | undefined;
  backupKey: string | undefined;
  saveAccountKeysPDF: (() => Promise<void>) | undefined;
}>;

export function SignalAccountKeys({
  i18n,
  serviceId,
  backupKey,
  saveAccountKeysPDF: doSaveAccountKeysPDF,
}: SignalAccountKeysPropsType): ReactNode {
  const [isSaving, setIsSaving] = useState(false);

  const backupKeyForDisplay = useMemo(() => {
    if (!backupKey) {
      return undefined;
    }

    const display = formatBackupKeyForDisplay(backupKey, {
      convertAmbiguousChars: true,
    });

    const print = display.split(/\s+/g).map((part, i) => {
      // oxlint-disable-next-line react/no-array-index-key
      return <span key={`backup-part-${i}`}>{part}</span>;
    });

    return (
      <>
        <span className={tw('print:hidden')}>{display}</span>
        <span
          className={tw(
            'hidden grid-cols-4 gap-x-13 print:grid print:leading-6'
          )}
        >
          {print}
        </span>
      </>
    );
  }, [backupKey]);

  const saveAccountKeysPDF = useCallback(async () => {
    if (!doSaveAccountKeysPDF) {
      return;
    }

    setIsSaving(true);
    try {
      await doSaveAccountKeysPDF();
    } catch {
      // Ignore
      // oxlint-disable-next-line react/todo
    } finally {
      setIsSaving(false);
    }
  }, [doSaveAccountKeysPDF]);

  return (
    <div
      className={tw(
        'flex flex-col gap-4 print:mx-auto print:max-w-97.5 print:gap-8 print:pbs-30'
      )}
    >
      <div className={tw('text-center')}>
        <img
          alt={i18n('icu:Preferences__SignalAccount__label')}
          className={tw('mx-auto mb-2.5 print:mb-4')}
          src="images/signal-login.svg"
          width="98"
          height="56"
        />

        <div className={tw('hidden text-center print:block')}>
          <h1 className={tw('mb-2 type-title-medium')}>
            {i18n('icu:Preferences__SignalAccountKeys__Title')}
          </h1>
          {/* oxlint-disable-next-line better-tailwindcss/no-restricted-classes */}
          <div className={tw('type-body-large text-[#4D4D4D]')}>
            {i18n('icu:Preferences__SignalAccountKeys__Description')}
          </div>
        </div>
      </div>

      {serviceId && (
        <KeySection
          label={i18n('icu:Preferences__SignalAccountKeys__AccountID')}
        >
          {serviceId.toUpperCase()}
        </KeySection>
      )}
      {backupKeyForDisplay && (
        <KeySection
          label={i18n('icu:Preferences__SignalAccountKeys__RecoveryKey')}
        >
          {backupKeyForDisplay}
        </KeySection>
      )}

      {doSaveAccountKeysPDF && (
        <div className={tw('mx-auto')}>
          <AxoButton.Root
            symbol="download"
            variant="subtle-secondary"
            pending={isSaving}
            size="md"
            onClick={saveAccountKeysPDF}
          >
            {i18n('icu:Preferences__SignalAccountKeys__Save')}
          </AxoButton.Root>
        </div>
      )}
    </div>
  );
}

function KeySection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section>
      <h2
        className={tw(
          'px-4 py-2 type-body-medium font-semibold',
          'print:px-6 print:py-3 print:type-title-small'
        )}
      >
        {label}
      </h2>
      <div
        className={tw(
          'overflow-auto',
          'select-text',
          'curved-2xl bg-surface-card p-1 shadow-elevation-0',
          'forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]',
          'forced-colors:border forced-colors:border-[ButtonBorder]',
          'w-full px-4 py-2.5',

          'print:px-5 print:py-4',
          // oxlint-disable-next-line better-tailwindcss/no-restricted-classes
          'print:bg-[#F4F4F5] print:shadow-none',
          'print:flex print:justify-center'
        )}
      >
        <div
          className={tw(
            'w-full max-w-[40ch] font-mono tracking-[1.12px]',
            'print:max-w-fit print:type-body-large print:tracking-[1.12px]'
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
