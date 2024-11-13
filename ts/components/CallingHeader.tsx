// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import React from 'react';
import type { LocalizerType } from '../types/Util';
import { CallViewMode } from '../types/Calling';
import { Tooltip } from './Tooltip';
import { Theme } from '../util/theme';
import { ContextMenu } from './ContextMenu';

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
  return (
    <div className="module-calling-tools">
      {isGroupCall &&
        participantCount > 2 &&
        callViewMode &&
        changeCallView && (
          <div className="module-calling-tools__button">
            <ContextMenu
              ariaLabel={i18n('icu:calling__change-view')}
              i18n={i18n}
              menuOptions={[
                {
                  icon: 'CallSettingsButton__Icon--PaginatedView',
                  label: i18n('icu:calling__view_mode--paginated'),
                  onClick: () => changeCallView(CallViewMode.Paginated),
                  value: CallViewMode.Paginated,
                },
                {
                  icon: 'CallSettingsButton__Icon--SidebarView',
                  label: i18n('icu:calling__view_mode--overflow'),
                  onClick: () => changeCallView(CallViewMode.Sidebar),
                  value: CallViewMode.Sidebar,
                },
                {
                  icon: 'CallSettingsButton__Icon--SpeakerView',
                  label: i18n('icu:calling__view_mode--speaker'),
                  onClick: () => changeCallView(CallViewMode.Speaker),
                  value: CallViewMode.Speaker,
                },
              ]}
              theme={Theme.Dark}
              popperOptions={{
                placement: 'bottom',
                strategy: 'absolute',
              }}
              value={
                // If it's Presentation we want to still show Speaker as selected
                callViewMode === CallViewMode.Presentation
                  ? CallViewMode.Speaker
                  : callViewMode
              }
            >
              <Tooltip
                content={i18n('icu:calling__change-view')}
                className="CallingButton__tooltip"
                theme={Theme.Dark}
              >
                <div className="CallSettingsButton__Button">
                  <span
                    className={classNames(
                      'CallSettingsButton__Icon',
                      getCallViewIconClassname(callViewMode)
                    )}
                  />
                </div>
              </Tooltip>
            </ContextMenu>
          </div>
        )}
      <div className="module-calling-tools__button">
        <Tooltip
          content={i18n('icu:callingDeviceSelection__settings')}
          className="CallingButton__tooltip"
          theme={Theme.Dark}
        >
          <button
            aria-label={i18n('icu:callingDeviceSelection__settings')}
            className="CallSettingsButton__Button"
            onClick={toggleSettings}
            type="button"
          >
            <span className="CallSettingsButton__Icon CallSettingsButton__Icon--Settings" />
          </button>
        </Tooltip>
      </div>
      {togglePip && (
        <div className="module-calling-tools__button">
          <Tooltip
            content={i18n('icu:calling__pip--on')}
            className="CallingButton__tooltip"
            theme={Theme.Dark}
          >
            <button
              aria-label={i18n('icu:calling__pip--on')}
              className="CallSettingsButton__Button"
              onClick={togglePip}
              type="button"
            >
              <span className="CallSettingsButton__Icon CallSettingsButton__Icon--Pip" />
            </button>
          </Tooltip>
        </div>
      )}
      {onCancel && (
        <div className="module-calling-tools__button">
          <Tooltip
            content={i18n('icu:cancel')}
            theme={Theme.Dark}
            className="CallingButton__tooltip"
          >
            <button
              aria-label={i18n('icu:cancel')}
              className="CallSettingsButton__Button CallSettingsButton__Button--Cancel"
              onClick={onCancel}
              type="button"
            >
              <span className="CallSettingsButton__Icon CallSettingsButton__Icon--Cancel" />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

const CALL_VIEW_MODE_ICON_CLASSNAMES: Record<CallViewMode, string> = {
  [CallViewMode.Sidebar]: 'CallSettingsButton__Icon--SidebarView',
  [CallViewMode.Paginated]: 'CallSettingsButton__Icon--PaginatedView',
  [CallViewMode.Speaker]: 'CallSettingsButton__Icon--SpeakerView',
  [CallViewMode.Presentation]: 'CallSettingsButton__Icon--SpeakerView',
};
export function getCallViewIconClassname(viewMode: CallViewMode): string {
  return CALL_VIEW_MODE_ICON_CLASSNAMES[viewMode];
}
