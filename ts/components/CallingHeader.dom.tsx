// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import { useCallback } from 'react';

import type { LocalizerType } from '../types/Util.std.ts';
import { CallViewMode } from '../types/Calling.std.ts';
import { AxoDropdownMenu } from '../axo/AxoDropdownMenu.dom.tsx';
import { AxoIconButton } from '../axo/AxoIconButton.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import type { AxoSymbolIconName } from '../axo/_internal/AxoSymbolDefs.generated.std.ts';
import { missingCaseError } from '../util/missingCaseError.std.ts';

export type PropsType = {
  callViewMode?: CallViewMode;
  i18n: LocalizerType;
  isGroupCall?: boolean;
  onCancel?: () => void;
  participantCount: number;
  togglePip?: () => void;
  toggleSettings: () => void;
  changeCallView?: (mode: CallViewMode) => void;
};

export function CallingHeader({
  callViewMode,
  changeCallView,
  i18n,
  isGroupCall = false,
  onCancel,
  participantCount,
  togglePip,
  toggleSettings,
}: PropsType): JSX.Element {
  const handleViewModeChange = useCallback(
    (value: string) => {
      changeCallView?.(value as CallViewMode);
    },
    [changeCallView]
  );

  return (
    <div
      className={tw(
        'absolute inset-e-6 top-[calc(32px+var(--title-bar-drag-area-height))] flex gap-3'
      )}
    >
      {isGroupCall &&
        participantCount > 2 &&
        callViewMode &&
        changeCallView && (
          <AxoDropdownMenu.Root>
            <AxoDropdownMenu.Trigger>
              <AxoIconButton.Root
                variant="floating-secondary"
                size="lg"
                iconWeight={300}
                symbol={getCallViewModeIcon(callViewMode)}
                label={i18n('icu:calling__change-view')}
                tooltip={false}
              />
            </AxoDropdownMenu.Trigger>
            <AxoDropdownMenu.Content align="end">
              <AxoDropdownMenu.RadioGroup
                value={
                  // If it's Presentation we want to still show Speaker as selected
                  callViewMode === CallViewMode.Presentation
                    ? CallViewMode.Speaker
                    : callViewMode
                }
                onValueChange={handleViewModeChange}
              >
                <AxoDropdownMenu.RadioItem
                  value={CallViewMode.Paginated}
                  symbol="grid"
                >
                  {i18n('icu:calling__view_mode--paginated')}
                </AxoDropdownMenu.RadioItem>
                <AxoDropdownMenu.RadioItem
                  value={CallViewMode.Sidebar}
                  symbol="grid-sidebar"
                >
                  {i18n('icu:calling__view_mode--overflow')}
                </AxoDropdownMenu.RadioItem>
                <AxoDropdownMenu.RadioItem
                  value={CallViewMode.Speaker}
                  symbol="sidebar"
                >
                  {i18n('icu:calling__view_mode--speaker')}
                </AxoDropdownMenu.RadioItem>
              </AxoDropdownMenu.RadioGroup>
            </AxoDropdownMenu.Content>
          </AxoDropdownMenu.Root>
        )}
      <AxoIconButton.Root
        variant="floating-secondary"
        size="lg"
        iconWeight={300}
        symbol="settings"
        label={i18n('icu:callingDeviceSelection__settings')}
        onClick={toggleSettings}
      />
      {togglePip && (
        <AxoIconButton.Root
          variant="floating-secondary"
          size="lg"
          iconWeight={300}
          symbol="pip"
          label={i18n('icu:calling__pip--on')}
          onClick={togglePip}
        />
      )}
      {onCancel && (
        <AxoIconButton.Root
          variant="floating-secondary"
          size="lg"
          iconWeight={300}
          symbol="x"
          label={i18n('icu:cancel')}
          onClick={onCancel}
        />
      )}
    </div>
  );
}

export function getCallViewModeIcon(mode: CallViewMode): AxoSymbolIconName {
  switch (mode) {
    case CallViewMode.Paginated:
      return 'grid';
    case CallViewMode.Sidebar:
      return 'grid-sidebar';
    case CallViewMode.Presentation:
    case CallViewMode.Speaker:
      return 'sidebar';
    default:
      throw missingCaseError(mode);
  }
}
