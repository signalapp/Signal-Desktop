// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import { useMemo, useCallback } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoIconButton } from '../axo/AxoIconButton.dom.tsx';
import { AxoDropdownMenu } from '../axo/AxoDropdownMenu.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';

export type MediaQualitySelectorProps = Readonly<{
  conversationId: string;
  i18n: LocalizerType;
  isHighQuality: boolean;
  onSelectQuality: (conversationId: string, isHighQuality: boolean) => unknown;
}>;

enum MediaQuality {
  Standard = 'standard',
  High = 'high',
}

export function MediaQualitySelector({
  conversationId,
  i18n,
  isHighQuality,
  onSelectQuality,
}: MediaQualitySelectorProps): JSX.Element {
  const value = useMemo(() => {
    return isHighQuality ? MediaQuality.High : MediaQuality.Standard;
  }, [isHighQuality]);

  const handleValueChange = useCallback(
    (selected: string) => {
      onSelectQuality(conversationId, selected === MediaQuality.High);
    },
    [conversationId, onSelectQuality]
  );

  return (
    <AxoDropdownMenu.Root>
      <AxoDropdownMenu.Trigger>
        <AxoIconButton.Root
          variant="borderless-secondary"
          size="md"
          symbol={isHighQuality ? 'hd' : 'hd-slash'}
          iconWeight={300}
          label={i18n('icu:MediaQualitySelector--button')}
          tooltip={false}
        />
      </AxoDropdownMenu.Trigger>
      <AxoDropdownMenu.Content>
        <AxoDropdownMenu.RadioGroup
          value={value}
          onValueChange={handleValueChange}
        >
          <AxoDropdownMenu.Label>
            {i18n('icu:MediaQualitySelector--title')}
          </AxoDropdownMenu.Label>
          <AxoDropdownMenu.RadioItem
            value={MediaQuality.Standard}
            symbol="hd-slash"
          >
            {i18n('icu:MediaQualitySelector--standard-quality-title')}
            <div className={tw('type-body-small text-label-secondary')}>
              {i18n('icu:MediaQualitySelector--standard-quality-description')}
            </div>
          </AxoDropdownMenu.RadioItem>
          <AxoDropdownMenu.RadioItem value={MediaQuality.High} symbol="hd">
            {i18n('icu:MediaQualitySelector--high-quality-title')}
            <div className={tw('type-body-small text-label-secondary')}>
              {i18n('icu:MediaQualitySelector--high-quality-description')}
            </div>
          </AxoDropdownMenu.RadioItem>
        </AxoDropdownMenu.RadioGroup>
      </AxoDropdownMenu.Content>
    </AxoDropdownMenu.Root>
  );
}
