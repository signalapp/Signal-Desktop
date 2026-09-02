// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { action } from '@storybook/addon-actions';
import { AxoItem } from './AxoItem.dom.tsx';
import { tw } from '../tw.dom.tsx';
import { AxoSwitch } from '../AxoSwitch.dom.tsx';
import { AxoSelect } from '../AxoSelect.dom.tsx';
import { AxoDropdownMenu } from '../AxoDropdownMenu.dom.tsx';
import { Story } from '../_storybook-helpers/Story.dom.tsx';

export default {
  title: 'Axo/Items/AxoItem',
} satisfies Meta;

const LONG_TEXT = (
  <>
    Lorem ipsum dolor sit amet consectetur adipisicing elit. Ipsa magni rerum
    consequatur vero enim, laborum ullam voluptate expedita tempora amet natus
    nisi praesentium alias earum accusantium ex doloribus et quidem.
  </>
);

const LONG_LABEL = <>Very long label: {LONG_TEXT}</>;
const LONG_VALUE = <>Very long value: {LONG_TEXT}</>;
const LONG_DESCRIPTION = <>Very long description: {LONG_TEXT}</>;

export function Label(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Label of item</AxoItem.Label>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Another label</AxoItem.Label>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>{LONG_LABEL}</AxoItem.Label>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>
      </AxoItem.Group>
    </div>
  );
}

export function Description(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Label of item</AxoItem.Label>
              <AxoItem.Description>Description of the item</AxoItem.Description>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Another label</AxoItem.Label>
              <AxoItem.Description>
                Description with more detail about the item
              </AxoItem.Description>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Yet another label</AxoItem.Label>
              <AxoItem.Description>{LONG_DESCRIPTION}</AxoItem.Description>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>
      </AxoItem.Group>
    </div>
  );
}

export function Icon(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Leading>
            <AxoItem.Icon symbol="settings" />
          </AxoItem.Leading>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Label of item</AxoItem.Label>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Leading>
            <AxoItem.Icon symbol="appearance" />
          </AxoItem.Leading>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Another label</AxoItem.Label>
              <AxoItem.Description>{LONG_DESCRIPTION}</AxoItem.Description>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Item without icon</AxoItem.Label>
              <AxoItem.Description>
                Notice it stays aligned with the other items
              </AxoItem.Description>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>
      </AxoItem.Group>
    </div>
  );
}

function IconAvatarTemplate(props: { size: AxoItem.IconAvatarSize }) {
  return (
    <Story.Legend label={`size=${props.size}`}>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Leading>
            <AxoItem.IconAvatar symbol="settings" size={props.size} />
          </AxoItem.Leading>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Label of item</AxoItem.Label>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Leading>
            <AxoItem.IconAvatar symbol="appearance" size={props.size} />
          </AxoItem.Leading>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Another label</AxoItem.Label>
              <AxoItem.Description>{LONG_DESCRIPTION}</AxoItem.Description>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Item without icon avatar</AxoItem.Label>
              <AxoItem.Description>
                Notice it stays aligned with the other items
              </AxoItem.Description>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>
      </AxoItem.Group>
    </Story.Legend>
  );
}

export function IconAvatar(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <IconAvatarTemplate size={32} />
      <IconAvatarTemplate size={36} />
      <IconAvatarTemplate size={38} />
      <IconAvatarTemplate size={48} />
    </div>
  );
}

export function Value(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Label of item</AxoItem.Label>
              <AxoItem.Value>+1 555 555-5555</AxoItem.Value>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Another label</AxoItem.Label>
              <AxoItem.Value>Jamie-MacBook-Pro.local</AxoItem.Value>
              <AxoItem.Description>{LONG_DESCRIPTION}</AxoItem.Description>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Yet another label</AxoItem.Label>
              <AxoItem.Value>System Language</AxoItem.Value>
              <AxoItem.Description>
                Description that explains what this means
              </AxoItem.Description>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>
      </AxoItem.Group>

      <Story.Callout>
        <strong>Note:</strong> If you have a value, you cannot have any other
        type of accessory.
      </Story.Callout>
    </div>
  );
}

export function Arrow(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Label of item</AxoItem.Label>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
            <AxoItem.Trailing>
              <AxoItem.Arrow />
            </AxoItem.Trailing>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Another label</AxoItem.Label>
              <AxoItem.Description>{LONG_DESCRIPTION}</AxoItem.Description>
              <AxoItem.Value>Item value</AxoItem.Value>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
            <AxoItem.Trailing>
              <AxoItem.Arrow />
            </AxoItem.Trailing>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Item without arrow</AxoItem.Label>
              <AxoItem.Description>{LONG_DESCRIPTION}</AxoItem.Description>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>
      </AxoItem.Group>

      <Story.Callout>
        <strong>Note:</strong> Arrows should only be used when the item is
        clickable and needs an extra hint.
      </Story.Callout>

      <Story.Callout>
        <strong>Note:</strong> Arrows should not be used with any accessories
        except for values.
      </Story.Callout>
    </div>
  );
}

export function Action(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Label of item</AxoItem.Label>
              <AxoItem.Accessory>
                <AxoItem.Action variant="subtle-secondary">
                  Action
                </AxoItem.Action>
              </AxoItem.Accessory>
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Label of item</AxoItem.Label>
              <AxoItem.Description>Description of the item</AxoItem.Description>
              <AxoItem.Accessory>
                <AxoItem.Action variant="subtle-secondary">
                  Action
                </AxoItem.Action>
              </AxoItem.Accessory>
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Another label</AxoItem.Label>
              <AxoItem.Description>{LONG_DESCRIPTION}</AxoItem.Description>
              <AxoItem.Accessory>
                <AxoItem.Action
                  symbol="phone-fill"
                  variant="strong-affirmative"
                >
                  Join
                </AxoItem.Action>
              </AxoItem.Accessory>
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>
      </AxoItem.Group>

      <Story.Callout>
        <strong>Note:</strong> There should only be one text action at a time,
        if you need more than one action you can use an icon action or menu.
      </Story.Callout>

      <Story.Callout>
        <strong>Note:</strong> Items with actions should not be clickable
      </Story.Callout>
    </div>
  );
}

function MoreIconActionWithMenu() {
  return (
    <AxoDropdownMenu.Root>
      <AxoDropdownMenu.Trigger>
        <AxoItem.IconAction
          variant="implied-secondary"
          symbol="more"
          label="More"
          tooltip={false}
        />
      </AxoDropdownMenu.Trigger>
      <AxoDropdownMenu.Content>
        <AxoDropdownMenu.Item onSelect={action('onFoo')}>
          Foo
        </AxoDropdownMenu.Item>
        <AxoDropdownMenu.Item onSelect={action('onBar')}>
          Bar
        </AxoDropdownMenu.Item>
      </AxoDropdownMenu.Content>
    </AxoDropdownMenu.Root>
  );
}

function DownloadIconAction() {
  return (
    <AxoItem.IconAction
      variant="implied-secondary"
      symbol="arrow-down"
      label="Download"
      onClick={action('onDownload')}
    />
  );
}

export function IconActions(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Label of item</AxoItem.Label>
            </AxoItem.Body>
            <AxoItem.Trailing>
              <DownloadIconAction />
            </AxoItem.Trailing>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Another label</AxoItem.Label>
              <AxoItem.Description>{LONG_DESCRIPTION}</AxoItem.Description>
            </AxoItem.Body>
            <AxoItem.Trailing>
              <MoreIconActionWithMenu />
            </AxoItem.Trailing>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Yet another label</AxoItem.Label>
              <AxoItem.Description>{LONG_DESCRIPTION}</AxoItem.Description>
            </AxoItem.Body>
            <AxoItem.Trailing>
              <DownloadIconAction />
              <MoreIconActionWithMenu />
            </AxoItem.Trailing>
          </AxoItem.Content>
        </AxoItem.Root>
      </AxoItem.Group>
    </div>
  );
}

function Switch() {
  const [checked, setChecked] = useState(false);
  return <AxoSwitch.Root checked={checked} onCheckedChange={setChecked} />;
}

function Select() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <AxoSelect.Root value={value} onValueChange={setValue}>
      <AxoSelect.Trigger placeholder="Select an option" />
      <AxoSelect.Content>
        <AxoSelect.Item value="option1">
          <AxoSelect.ItemText>Option 1</AxoSelect.ItemText>
        </AxoSelect.Item>
        <AxoSelect.Item value="option2">
          <AxoSelect.ItemText>Option 2</AxoSelect.ItemText>
        </AxoSelect.Item>
        <AxoSelect.Item value="option3">
          <AxoSelect.ItemText>Really really long item</AxoSelect.ItemText>
        </AxoSelect.Item>
      </AxoSelect.Content>
    </AxoSelect.Root>
  );
}

export function OtherAccessories(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Label of item</AxoItem.Label>
            </AxoItem.Body>
            <AxoItem.Trailing>
              <Switch />
            </AxoItem.Trailing>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Another label</AxoItem.Label>
              <AxoItem.Accessory>
                <Select />
              </AxoItem.Accessory>
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Label of item</AxoItem.Label>
              <AxoItem.Description>Description of the item</AxoItem.Description>
            </AxoItem.Body>
            <AxoItem.Trailing>
              <Switch />
            </AxoItem.Trailing>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Another label</AxoItem.Label>
              <AxoItem.Description>{LONG_DESCRIPTION}</AxoItem.Description>
              <AxoItem.Accessory>
                <Select />
              </AxoItem.Accessory>
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>
      </AxoItem.Group>
    </div>
  );
}

function StressTest(props: {
  label: ReactNode;
  value?: ReactNode;
  description?: ReactNode;
}): ReactNode {
  return (
    <AxoItem.Group>
      <AxoItem.Root>
        <AxoItem.Leading>
          <AxoItem.Icon symbol="settings" />
        </AxoItem.Leading>
        <AxoItem.Content>
          <AxoItem.Body>
            <AxoItem.Label>{props.label}</AxoItem.Label>
            {props.value != null && (
              <AxoItem.Value>{props.value}</AxoItem.Value>
            )}
            {props.description != null && (
              <AxoItem.Description>{props.description}</AxoItem.Description>
            )}
            <AxoItem.HiddenTrigger
              label="Trigger"
              onClick={action('onClick')}
            />
          </AxoItem.Body>
          <AxoItem.Trailing>
            <AxoItem.Arrow />
          </AxoItem.Trailing>
        </AxoItem.Content>
      </AxoItem.Root>
    </AxoItem.Group>
  );
}

export function StressTests(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <Story.Callout>These should all fit in their normal place.</Story.Callout>

      <Story.Legend label="Baseline">
        <StressTest label="Label" />
        <StressTest label="Label" value="Value" />
        <StressTest label="Label" description="Description" />
        <StressTest label="Label" value="Value" description="Description" />
      </Story.Legend>

      <Story.Legend label="Long label">
        <Story.Callout>
          These should all break into a stacked layout.
        </Story.Callout>

        <StressTest label={LONG_LABEL} />
        <StressTest label={LONG_LABEL} value="Value" />
        <StressTest label={LONG_LABEL} description="Description" />
        <StressTest
          label={LONG_LABEL}
          value="Value"
          description="Description"
        />
      </Story.Legend>

      <Story.Legend label="Long value">
        <Story.Callout>
          These should all break into a stacked layout.
        </Story.Callout>

        <StressTest label="Label" value={LONG_VALUE} />
        <StressTest
          label="Label"
          value={LONG_VALUE}
          description="Description"
        />
      </Story.Legend>

      <Story.Legend label="Long description">
        <Story.Callout>
          Long descriptions should <em>not</em> break into a stacked layout.
        </Story.Callout>

        <StressTest label="Label" description={LONG_DESCRIPTION} />
        <StressTest
          label="Label"
          value="Value"
          description={LONG_DESCRIPTION}
        />
      </Story.Legend>

      <Story.Legend label="Long label + value">
        <Story.Callout>
          These should all break into a stacked layout.
        </Story.Callout>

        <StressTest label={LONG_LABEL} value={LONG_VALUE} />
        <StressTest
          label={LONG_LABEL}
          value={LONG_VALUE}
          description="Description"
        />
      </Story.Legend>

      <Story.Legend label="Long everything">
        <Story.Callout>
          These should all break into a stacked layout.
        </Story.Callout>

        <StressTest
          label={LONG_LABEL}
          value={LONG_VALUE}
          description={LONG_DESCRIPTION}
        />
      </Story.Legend>
    </div>
  );
}

export function Disabled(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoItem.Group>
        <AxoItem.Root disabled>
          <AxoItem.Leading>
            <AxoItem.Icon symbol="settings" />
          </AxoItem.Leading>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Title of item</AxoItem.Label>
              <AxoItem.Description>Description of the item</AxoItem.Description>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
            <AxoItem.Trailing>
              <AxoItem.Arrow />
            </AxoItem.Trailing>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root disabled>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Another title</AxoItem.Label>
              <AxoItem.Value>Value of the item</AxoItem.Value>
              <AxoItem.Accessory>
                <AxoSwitch.Root
                  disabled
                  checked
                  onCheckedChange={action('onCheckedChange')}
                />
              </AxoItem.Accessory>
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root disabled>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Label>Yet another title</AxoItem.Label>
              <AxoItem.Description>
                Description that explains what this means
              </AxoItem.Description>
              <AxoItem.Accessory>
                <AxoSelect.Root
                  disabled
                  value="option1"
                  onValueChange={action('onValueChange')}
                >
                  <AxoSelect.Trigger placeholder="Select an option" />
                  <AxoSelect.Content>
                    <AxoSelect.Item value="option1">
                      <AxoSelect.ItemText>Option 1</AxoSelect.ItemText>
                    </AxoSelect.Item>
                  </AxoSelect.Content>
                </AxoSelect.Root>
              </AxoItem.Accessory>
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>
      </AxoItem.Group>
    </div>
  );
}
