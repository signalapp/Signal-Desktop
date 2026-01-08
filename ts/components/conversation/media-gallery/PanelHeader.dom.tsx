// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';

import { tw } from '../../../axo/tw.dom.js';
import { ExperimentalAxoSegmentedControl } from '../../../axo/AxoSegmentedControl.dom.js';
import { AxoSelect } from '../../../axo/AxoSelect.dom.js';
import { AxoDropdownMenu } from '../../../axo/AxoDropdownMenu.dom.js';
import { AxoIconButton } from '../../../axo/AxoIconButton.dom.js';
import type { LocalizerType } from '../../../types/Util.std.js';
import type {
  MediaTabType,
  MediaSortOrderType,
} from '../../../types/MediaItem.std.js';

// Provided by smart layer
export type Props = Readonly<{
  i18n: LocalizerType;
  tab: MediaTabType;
  setTab: (newTab: MediaTabType) => void;
  sortOrder: MediaSortOrderType;
  setSortOrder: (newOrder: MediaSortOrderType) => void;
}>;

export function PanelHeader({
  i18n,
  tab,
  setTab,
  sortOrder,
  setSortOrder,
}: Props): React.JSX.Element {
  const setSelectedTabWithDefault = useCallback(
    (value: string | null) => {
      switch (value) {
        case 'media':
        case 'audio':
        case 'documents':
        case 'links':
          setTab(value);
          break;
        case null:
          break;
        default:
          setTab('media');
          break;
      }
    },
    [setTab]
  );

  const isNonDefaultSorting = sortOrder !== 'date';

  return (
    <div
      className={tw('@container', 'grow', 'flex flex-row justify-center-safe')}
    >
      <div className={tw('grow')} />

      <div className={tw('hidden max-w-[320px] grow @min-[260px]:block')}>
        <ExperimentalAxoSegmentedControl.Root
          variant="no-track"
          width="full"
          itemWidth="equal"
          value={tab}
          onValueChange={setSelectedTabWithDefault}
        >
          <ExperimentalAxoSegmentedControl.Item value="media">
            <ExperimentalAxoSegmentedControl.ItemText>
              {i18n('icu:media')}
            </ExperimentalAxoSegmentedControl.ItemText>
          </ExperimentalAxoSegmentedControl.Item>
          <ExperimentalAxoSegmentedControl.Item value="audio">
            <ExperimentalAxoSegmentedControl.ItemText>
              {i18n('icu:MediaGallery__tab__audio')}
            </ExperimentalAxoSegmentedControl.ItemText>
          </ExperimentalAxoSegmentedControl.Item>
          <ExperimentalAxoSegmentedControl.Item value="links">
            <ExperimentalAxoSegmentedControl.ItemText>
              {i18n('icu:MediaGallery__tab__links')}
            </ExperimentalAxoSegmentedControl.ItemText>
          </ExperimentalAxoSegmentedControl.Item>
          <ExperimentalAxoSegmentedControl.Item value="documents">
            <ExperimentalAxoSegmentedControl.ItemText>
              {i18n('icu:MediaGallery__tab__files')}
            </ExperimentalAxoSegmentedControl.ItemText>
          </ExperimentalAxoSegmentedControl.Item>
        </ExperimentalAxoSegmentedControl.Root>
      </div>

      <div className={tw('block @min-[260px]:hidden')}>
        <AxoSelect.Root value={tab} onValueChange={setSelectedTabWithDefault}>
          <AxoSelect.Trigger
            variant="floating"
            width="fit"
            placeholder=""
            chevron="always"
          />
          <AxoSelect.Content position="dropdown">
            <AxoSelect.Item value="media">
              <AxoSelect.ItemText>{i18n('icu:media')}</AxoSelect.ItemText>
            </AxoSelect.Item>
            <AxoSelect.Item value="audio">
              <AxoSelect.ItemText>
                {i18n('icu:MediaGallery__tab__audio')}
              </AxoSelect.ItemText>
            </AxoSelect.Item>
            <AxoSelect.Item value="links">
              <AxoSelect.ItemText>
                {i18n('icu:MediaGallery__tab__links')}
              </AxoSelect.ItemText>
            </AxoSelect.Item>
            <AxoSelect.Item value="documents">
              <AxoSelect.ItemText>
                {i18n('icu:MediaGallery__tab__files')}
              </AxoSelect.ItemText>
            </AxoSelect.Item>
          </AxoSelect.Content>
        </AxoSelect.Root>
      </div>

      <div className={tw('grow')} />

      <AxoDropdownMenu.Root>
        <AxoDropdownMenu.Trigger>
          <AxoIconButton.Root
            variant={isNonDefaultSorting ? 'primary' : 'borderless-secondary'}
            size="md"
            symbol="sort-vertical"
            aria-label={i18n('icu:MediaGallery__sort')}
          />
        </AxoDropdownMenu.Trigger>
        <AxoDropdownMenu.Content>
          <AxoDropdownMenu.Label>
            {i18n('icu:MediaGallery__sort--header')}
          </AxoDropdownMenu.Label>
          <AxoDropdownMenu.CheckboxItem
            checked={sortOrder === 'date'}
            onCheckedChange={() => setSortOrder('date')}
          >
            {i18n('icu:MediaGallery__sort__date')}
          </AxoDropdownMenu.CheckboxItem>
          <AxoDropdownMenu.CheckboxItem
            checked={sortOrder === 'size'}
            onCheckedChange={() => setSortOrder('size')}
          >
            {i18n('icu:MediaGallery__sort__size')}
          </AxoDropdownMenu.CheckboxItem>
        </AxoDropdownMenu.Content>
      </AxoDropdownMenu.Root>

      <div className={tw('min-w-4.5')} />
    </div>
  );
}
