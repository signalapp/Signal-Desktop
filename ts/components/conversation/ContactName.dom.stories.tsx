// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import type { Meta } from '@storybook/react';
import type { PropsType } from './ContactName.dom.tsx';
import { ContactName } from './ContactName.dom.tsx';
import { ContactNameColors } from '../../types/Colors.std.ts';
import { Emoji } from '../../axo/emoji.std.ts';

export default {
  title: 'Components/Conversation/ContactName',
} satisfies Meta<PropsType>;

export function FirstNameAndTitleTitlePreferred(): JSX.Element {
  return <ContactName firstName="Ignored" title="Someone 🔥 Somewhere" />;
}

export function FirstNameAndTitleFirstNamePreferred(): JSX.Element {
  return (
    <ContactName
      firstName="Someone 🔥 Somewhere"
      title="Ignored"
      preferFirstName
    />
  );
}

export function WithLongLabel(): JSX.Element {
  return (
    <div style={{ maxWidth: '400px', overflow: 'hidden' }}>
      <ContactName
        title="Troublemaker"
        contactLabel={{
          labelEmoji: Emoji.CHECKMARK,
          labelString:
            "this is a long label. really long. why don't we see what happens?",
        }}
        contactNameColor="140"
      />
    </div>
  );
}

export function WithLabelWithBigUnicode(): JSX.Element {
  return (
    <div style={{ maxWidth: '400px', overflow: 'hidden' }}>
      <ContactName
        title="Troublemaker"
        contactLabel={{
          labelEmoji: Emoji.CHECKMARK,
          labelString: '𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫',
        }}
        contactNameColor="140"
      />
    </div>
  );
}

export function Colors(): JSX.Element {
  return (
    <>
      {ContactNameColors.map(color => (
        <div key={color}>
          <ContactName title={`Hello ${color}`} contactNameColor={color} />
        </div>
      ))}
    </>
  );
}

export function ColorsWithLabels(): JSX.Element {
  return (
    <>
      {ContactNameColors.map(color => (
        <div key={color}>
          <ContactName
            title={`Hello ${color}`}
            contactNameColor={color}
            contactLabel={{
              labelEmoji: Emoji.CHECKMARK,
              labelString: 'Task Wrangler',
            }}
          />
        </div>
      ))}
    </>
  );
}

export function ColorsWithNoLabelEmoji(): JSX.Element {
  return (
    <>
      {ContactNameColors.map(color => (
        <div key={color}>
          <ContactName
            title={`Hello ${color}`}
            contactNameColor={color}
            contactLabel={{
              labelEmoji: undefined,
              labelString: 'Task Wrangler',
            }}
          />
        </div>
      ))}
    </>
  );
}

export function ColorsWithInvalidLabelEmoji(): JSX.Element {
  return (
    <>
      {ContactNameColors.map(color => (
        <div key={color}>
          <ContactName
            title={`Hello ${color}`}
            contactNameColor={color}
            contactLabel={{
              labelEmoji: Emoji.unsafeCastMaybeInvalidStringToVariant('&'),
              labelString: 'Task Wrangler',
            }}
          />
        </div>
      ))}
    </>
  );
}
