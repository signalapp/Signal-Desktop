// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';

import { tw } from '../../../axo/tw.dom.js';
import { ExperimentalAxoSegmentedControl } from '../../../axo/AxoSegmentedControl.dom.js';
import { AxoSelect } from '../../../axo/AxoSelect.dom.js';
import type { LocalizerType } from '../../../types/Util.std.js';
import type { MediaTabType } from '../../../types/MediaItem.std.js';

// Provided by smart layer
export type Props = Readonly<{
  i18n: LocalizerType;
  tab: MediaTabType;
  setTab: (newTab: MediaTabType) => void;
}>;

export function PanelHeader({ i18n, tab, setTab }: Props): JSX.Element {
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

  return (
    <div
      className={tw(
        '@container',
        'grow',
        'flex flex-row justify-center-safe',
        // This matches the width of back button so that tabs are centered
        'pe-[50px]'
      )}
    >
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
    </div>
  );
}
