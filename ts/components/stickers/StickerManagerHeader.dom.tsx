// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, type JSX } from 'react';

import { tw } from '../../axo/tw.dom.tsx';
import { ExperimentalAxoSegmentedControl } from '../../axo/AxoSegmentedControl.dom.tsx';
import { AxoSelect } from '../../axo/menus/AxoSelect.dom.tsx';
import type { LocalizerType } from '../../types/Util.std.ts';
import type { StickerManagerTabType } from '../../types/Stickers.preload.ts';

// Provided by smart layer
export type Props = Readonly<{
  i18n: LocalizerType;
  tab: StickerManagerTabType;
  setTab: (newTab: StickerManagerTabType) => void;
}>;

const TabValue = {
  All: 'all',
  MyStickers: 'my-stickers',
} as const satisfies Record<string, StickerManagerTabType>;

export function StickerManagerHeader({
  i18n,
  tab,
  setTab,
}: Props): JSX.Element {
  const setSelectedTabWithDefault = useCallback(
    (value: string | null) => {
      switch (value) {
        case 'my-stickers':
          setTab(value);
          break;
        case null:
          break;
        default:
          setTab('all');
          break;
      }
    },
    [setTab]
  );

  return (
    <div
      className={tw('@container', 'grow', 'flex flex-row justify-center-safe')}
    >
      <div className={tw('grow')} />

      <div className={tw('hidden max-w-60 grow @min-[200px]:block')}>
        <ExperimentalAxoSegmentedControl.Root
          variant="track"
          width="full"
          itemWidth="equal"
          value={tab}
          onValueChange={setSelectedTabWithDefault}
        >
          <ExperimentalAxoSegmentedControl.Item value={TabValue.All}>
            <ExperimentalAxoSegmentedControl.ItemText>
              {i18n('icu:stickers--StickerManagerHeader--All')}
            </ExperimentalAxoSegmentedControl.ItemText>
          </ExperimentalAxoSegmentedControl.Item>
          <ExperimentalAxoSegmentedControl.Item value={TabValue.MyStickers}>
            <ExperimentalAxoSegmentedControl.ItemText>
              {i18n('icu:stickers--StickerManagerHeader--MyStickers')}
            </ExperimentalAxoSegmentedControl.ItemText>
          </ExperimentalAxoSegmentedControl.Item>
        </ExperimentalAxoSegmentedControl.Root>
      </div>

      <div className={tw('block @min-[200px]:hidden')}>
        <AxoSelect.Root value={tab} onValueChange={setSelectedTabWithDefault}>
          <AxoSelect.Trigger
            variant="elevated"
            width="fit"
            placeholder=""
            chevron="always"
          />
          <AxoSelect.Content position="dropdown">
            <AxoSelect.Item value={TabValue.All}>
              <AxoSelect.ItemText>
                {i18n('icu:stickers--StickerManagerHeader--All')}
              </AxoSelect.ItemText>
            </AxoSelect.Item>
            <AxoSelect.Item value={TabValue.MyStickers}>
              <AxoSelect.ItemText>
                {i18n('icu:stickers--StickerManagerHeader--MyStickers')}
              </AxoSelect.ItemText>
            </AxoSelect.Item>
          </AxoSelect.Content>
        </AxoSelect.Root>
      </div>

      <div className={tw('grow')} />

      <div className={tw('min-w-4.5')} />
    </div>
  );
}
