// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './ContactName.dom.js';
import { ContactName } from './ContactName.dom.js';
import { ContactNameColors } from '../../types/Colors.std.js';

export default {
  title: 'Components/Conversation/ContactName',
} satisfies Meta<PropsType>;

export function FirstNameAndTitleTitlePreferred(): React.JSX.Element {
  return <ContactName firstName="Ignored" title="Someone 🔥 Somewhere" />;
}

export function FirstNameAndTitleFirstNamePreferred(): React.JSX.Element {
  return (
    <ContactName
      firstName="Someone 🔥 Somewhere"
      title="Ignored"
      preferFirstName
    />
  );
}

export function WithLongLabel(): React.JSX.Element {
  return (
    <div style={{ maxWidth: '400px', overflow: 'hidden' }}>
      <ContactName
        title="Troublemaker"
        contactLabel={{
          labelEmoji: '✅',
          labelString:
            "this is a long label. really long. why don't we see what happens?",
        }}
        contactNameColor="140"
      />
    </div>
  );
}

export function WithLabelWithBigUnicode(): React.JSX.Element {
  return (
    <div style={{ maxWidth: '400px', overflow: 'hidden' }}>
      <ContactName
        title="Troublemaker"
        contactLabel={{
          labelEmoji: '✅',
          labelString: '𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫𒐫',
        }}
        contactNameColor="140"
      />
    </div>
  );
}

export function Colors(): React.JSX.Element {
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

export function ColorsWithLabels(): React.JSX.Element {
  return (
    <>
      {ContactNameColors.map(color => (
        <div key={color}>
          <ContactName
            title={`Hello ${color}`}
            contactNameColor={color}
            contactLabel={{ labelEmoji: '✅', labelString: 'Task Wrangler' }}
          />
        </div>
      ))}
    </>
  );
}

export function ColorsWithNoLabelEmoji(): React.JSX.Element {
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

export function ColorsWithInvalidLabelEmoji(): React.JSX.Element {
  return (
    <>
      {ContactNameColors.map(color => (
        <div key={color}>
          <ContactName
            title={`Hello ${color}`}
            contactNameColor={color}
            contactLabel={{
              labelEmoji: '&',
              labelString: 'Task Wrangler',
            }}
          />
        </div>
      ))}
    </>
  );
}
