// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, type JSX, type ReactNode } from 'react';

import type { LocalizerType } from '../../../types/Util.std.ts';
import type { AxoSymbol } from '../../../axo/AxoSymbol.dom.tsx';
import { AxoItem } from '../../../axo/items/AxoItem.dom.tsx';
import { AxoList } from '../../../axo/items/AxoList.dom.tsx';
import { AxoSwitch } from '../../../axo/AxoSwitch.dom.tsx';
import { tw } from '../../../axo/tw.dom.tsx';
import type {
  NotifyWhileMuted,
  NotifyWhileMutedKey,
} from '../../../util/notifyWhileMuted.std.ts';

export type PropsType = {
  i18n: LocalizerType;
  // Mentions and replies only apply to groups.
  isGroup: boolean;
  notifyWhileMuted: NotifyWhileMuted;
  setNotifyWhileMuted: (key: NotifyWhileMutedKey, value: boolean) => unknown;
};

export function WhileMutedSettings({
  i18n,
  isGroup,
  notifyWhileMuted,
  setNotifyWhileMuted,
}: PropsType): JSX.Element {
  return (
    <div className={tw('mx-auto flex w-full max-w-[750px] flex-col gap-4')}>
      <AxoList.Root accessibilityLabel={i18n('icu:WhileMuted__title')}>
        <AxoList.Body>
          <AxoItem.Group>
            <WhileMutedSwitch
              settingKey="calls"
              symbol="phone"
              label={i18n('icu:WhileMuted__calls__title')}
              description={i18n('icu:WhileMuted__calls__description')}
              checked={notifyWhileMuted.calls}
              setNotifyWhileMuted={setNotifyWhileMuted}
            />
            {isGroup && (
              <>
                <WhileMutedSwitch
                  settingKey="mentions"
                  symbol="at"
                  label={i18n('icu:WhileMuted__mentions__title')}
                  description={i18n('icu:WhileMuted__mentions__description')}
                  checked={notifyWhileMuted.mentions}
                  setNotifyWhileMuted={setNotifyWhileMuted}
                />
                <WhileMutedSwitch
                  settingKey="replies"
                  symbol="reply"
                  label={i18n('icu:WhileMuted__replies__title')}
                  description={i18n('icu:WhileMuted__replies__description')}
                  checked={notifyWhileMuted.replies}
                  setNotifyWhileMuted={setNotifyWhileMuted}
                />
              </>
            )}
          </AxoItem.Group>
        </AxoList.Body>
      </AxoList.Root>
    </div>
  );
}

type WhileMutedSwitchProps = Readonly<{
  settingKey: NotifyWhileMutedKey;
  symbol: AxoSymbol.Name;
  label: string;
  description: string;
  checked: boolean;
  setNotifyWhileMuted: PropsType['setNotifyWhileMuted'];
}>;

function WhileMutedSwitch({
  settingKey,
  symbol,
  label,
  description,
  checked,
  setNotifyWhileMuted,
}: WhileMutedSwitchProps): ReactNode {
  const handleCheckedChange = useCallback(
    (value: boolean) => {
      setNotifyWhileMuted(settingKey, value);
    },
    [settingKey, setNotifyWhileMuted]
  );

  return (
    <AxoItem.Root>
      <AxoItem.Icon symbol={symbol} />
      <AxoItem.Content>
        <AxoItem.Body>
          <AxoItem.Label>{label}</AxoItem.Label>
          <AxoItem.Description>{description}</AxoItem.Description>
        </AxoItem.Body>
        <AxoItem.Accessory>
          <label>
            <span className={tw('sr-only')}>{label}</span>
            <AxoSwitch.Root
              checked={checked}
              onCheckedChange={handleCheckedChange}
            />
          </label>
        </AxoItem.Accessory>
      </AxoItem.Content>
    </AxoItem.Root>
  );
}
