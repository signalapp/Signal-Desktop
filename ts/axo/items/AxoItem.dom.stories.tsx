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

export default {
  title: 'Axo/Items/AxoItem',
} satisfies Meta;

export function Title(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Title of item</AxoItem.Title>
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
              <AxoItem.Title>Another title</AxoItem.Title>
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
              <AxoItem.Title>Yet another title</AxoItem.Title>
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
              <AxoItem.Title>Title of item</AxoItem.Title>
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
              <AxoItem.Title>Another title</AxoItem.Title>
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
              <AxoItem.Title>Yet another title</AxoItem.Title>
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
    </div>
  );
}

export function Icon(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Icon symbol="settings" />
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Title of item</AxoItem.Title>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Icon symbol="appearance" />
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Another title</AxoItem.Title>
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
              <AxoItem.Title>Item without icon</AxoItem.Title>
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

export function Value(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Title of item</AxoItem.Title>
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
              <AxoItem.Title>Another title</AxoItem.Title>
              <AxoItem.Value>Jamie-MacBook-Pro.local</AxoItem.Value>
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
              <AxoItem.Title>Yet another title</AxoItem.Title>
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
    </div>
  );
}

export function Arrow(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Icon symbol="settings" />
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Title of item</AxoItem.Title>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
          <AxoItem.Arrow />
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Icon symbol="appearance" />
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Another title</AxoItem.Title>
              <AxoItem.Value>Jamie-MacBook-Pro.local</AxoItem.Value>
              <AxoItem.Description>
                Description with more detail about the item
              </AxoItem.Description>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
          </AxoItem.Content>
          <AxoItem.Arrow />
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Yet another title</AxoItem.Title>
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
          <AxoItem.Arrow />
        </AxoItem.Root>
      </AxoItem.Group>
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
              <AxoItem.Title>Title of item</AxoItem.Title>
            </AxoItem.Body>
            <AxoItem.Accessory>
              <AxoItem.Action variant="subtle-secondary">Action</AxoItem.Action>
            </AxoItem.Accessory>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Title of item</AxoItem.Title>
              <AxoItem.Description>Description of the item</AxoItem.Description>
            </AxoItem.Body>
            <AxoItem.Accessory>
              <AxoItem.Action variant="subtle-secondary">Action</AxoItem.Action>
            </AxoItem.Accessory>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Another title</AxoItem.Title>
              <AxoItem.Description>
                Description with more detail about the item
              </AxoItem.Description>
            </AxoItem.Body>
            <AxoItem.Accessory>
              <AxoItem.Action symbol="phone-fill" variant="strong-affirmative">
                Join
              </AxoItem.Action>
            </AxoItem.Accessory>
          </AxoItem.Content>
        </AxoItem.Root>
      </AxoItem.Group>
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
              <AxoItem.Title>Title of item</AxoItem.Title>
            </AxoItem.Body>
            <AxoItem.Accessory>
              <DownloadIconAction />
            </AxoItem.Accessory>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Another title</AxoItem.Title>
              <AxoItem.Description>
                Description with more detail about the item
              </AxoItem.Description>
            </AxoItem.Body>
            <AxoItem.Accessory>
              <MoreIconActionWithMenu />
            </AxoItem.Accessory>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Yet another title</AxoItem.Title>
              <AxoItem.Description>
                Description that explains what this means
              </AxoItem.Description>
            </AxoItem.Body>
            <AxoItem.Accessory>
              <DownloadIconAction />
              <MoreIconActionWithMenu />
            </AxoItem.Accessory>
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

export function Accessories(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Title of item</AxoItem.Title>
            </AxoItem.Body>
            <AxoItem.Accessory>
              <Switch />
            </AxoItem.Accessory>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Another title</AxoItem.Title>
            </AxoItem.Body>
            <AxoItem.Accessory>
              <Select />
            </AxoItem.Accessory>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Title of item</AxoItem.Title>
              <AxoItem.Description>Description of the item</AxoItem.Description>
            </AxoItem.Body>
            <AxoItem.Accessory>
              <Switch />
            </AxoItem.Accessory>
          </AxoItem.Content>
        </AxoItem.Root>

        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Another title</AxoItem.Title>
              <AxoItem.Description>
                Description with more detail about the item
              </AxoItem.Description>
            </AxoItem.Body>
            <AxoItem.Accessory>
              <Select />
            </AxoItem.Accessory>
          </AxoItem.Content>
        </AxoItem.Root>
      </AxoItem.Group>
    </div>
  );
}

function Header(props: { children: ReactNode }): ReactNode {
  return <h2 className={tw('type-title-small')}>{props.children}</h2>;
}

export function StressTests(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <Header>Kitchen Sink</Header>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Icon symbol="settings" />
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Title</AxoItem.Title>
              <AxoItem.Value>Value</AxoItem.Value>
              <AxoItem.Description>Description</AxoItem.Description>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
            <AxoItem.Accessory>
              <DownloadIconAction />
            </AxoItem.Accessory>
          </AxoItem.Content>
          <AxoItem.Arrow />
        </AxoItem.Root>
        <AxoItem.Root>
          <AxoItem.Icon symbol="settings" />
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Title</AxoItem.Title>
              <AxoItem.Value>Value</AxoItem.Value>
              <AxoItem.Description>Description</AxoItem.Description>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
            <AxoItem.Accessory>
              <DownloadIconAction />
              <MoreIconActionWithMenu />
            </AxoItem.Accessory>
          </AxoItem.Content>
          <AxoItem.Arrow />
        </AxoItem.Root>
        <AxoItem.Root>
          <AxoItem.Icon symbol="settings" />
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Title</AxoItem.Title>
              <AxoItem.Value>Value</AxoItem.Value>
              <AxoItem.Description>Description</AxoItem.Description>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
            <AxoItem.Accessory>
              <AxoItem.Action variant="subtle-secondary">Action</AxoItem.Action>
            </AxoItem.Accessory>
          </AxoItem.Content>
          <AxoItem.Arrow />
        </AxoItem.Root>
        <AxoItem.Root>
          <AxoItem.Icon symbol="settings" />
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Title</AxoItem.Title>
              <AxoItem.Value>Value</AxoItem.Value>
              <AxoItem.Description>Description</AxoItem.Description>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
            <AxoItem.Accessory>
              <AxoItem.Action variant="subtle-secondary">Action</AxoItem.Action>
              <AxoItem.Action variant="subtle-secondary">Action</AxoItem.Action>
            </AxoItem.Accessory>
          </AxoItem.Content>
          <AxoItem.Arrow />
        </AxoItem.Root>
        <AxoItem.Root>
          <AxoItem.Icon symbol="settings" />
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Title</AxoItem.Title>
              <AxoItem.Value>Value</AxoItem.Value>
              <AxoItem.Description>Description</AxoItem.Description>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
            <AxoItem.Accessory>
              <Switch />
            </AxoItem.Accessory>
          </AxoItem.Content>
          <AxoItem.Arrow />
        </AxoItem.Root>
        <AxoItem.Root>
          <AxoItem.Icon symbol="settings" />
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Title</AxoItem.Title>
              <AxoItem.Value>Value</AxoItem.Value>
              <AxoItem.Description>Description</AxoItem.Description>
              <AxoItem.HiddenTrigger
                label="Trigger"
                onClick={action('onClick')}
              />
            </AxoItem.Body>
            <AxoItem.Accessory>
              <Select />
            </AxoItem.Accessory>
          </AxoItem.Content>
          <AxoItem.Arrow />
        </AxoItem.Root>
      </AxoItem.Group>

      <Header>Long Title: Title should be clamped to two lines</Header>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>
                Lorem ipsum dolor sit amet consectetur adipisicing elit. Odio
                pariatur ipsum non officia laboriosam amet omnis autem
                architecto, expedita dolores officiis laborum iste cum porro,
                fugiat sapiente sequi dolor. Excepturi.
              </AxoItem.Title>
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>
      </AxoItem.Group>

      <Header>Long Title: Value should be forced to the next line</Header>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>
                Lorem ipsum dolor sit amet consectetur adipisicing elit. Odio
                pariatur ipsum non officia laboriosam amet omnis autem
                architecto, expedita dolores officiis laborum iste cum porro,
                fugiat sapiente sequi dolor. Excepturi.
              </AxoItem.Title>
              <AxoItem.Value>Value</AxoItem.Value>
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>
      </AxoItem.Group>

      <Header>
        Long Title: Wrapped value should be on separate line from description
      </Header>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>
                Lorem ipsum dolor sit amet consectetur adipisicing elit. Odio
                pariatur ipsum non officia laboriosam amet omnis autem
                architecto, expedita dolores officiis laborum iste cum porro,
                fugiat sapiente sequi dolor. Excepturi.
              </AxoItem.Title>
              <AxoItem.Value>Value</AxoItem.Value>
              <AxoItem.Description>Description</AxoItem.Description>
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>
      </AxoItem.Group>

      <Header>
        Long Title: Actions and arrow should stay on the same line
      </Header>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>
                Lorem ipsum dolor sit amet consectetur adipisicing elit. Odio
                pariatur ipsum non officia laboriosam amet omnis autem
                architecto, expedita dolores officiis laborum iste cum porro,
                fugiat sapiente sequi dolor. Excepturi.
              </AxoItem.Title>
            </AxoItem.Body>
            <AxoItem.Accessory>
              <DownloadIconAction />
              <MoreIconActionWithMenu />
            </AxoItem.Accessory>
          </AxoItem.Content>
          <AxoItem.Arrow />
        </AxoItem.Root>
      </AxoItem.Group>

      <Header>Long Value: Value should be forced to next line</Header>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Title</AxoItem.Title>
              <AxoItem.Value>
                Lorem ipsum dolor sit amet consectetur adipisicing elit. Odio
                pariatur ipsum non officia laboriosam amet omnis autem
                architecto, expedita dolores officiis laborum iste cum porro,
                fugiat sapiente sequi dolor. Excepturi.
              </AxoItem.Value>
            </AxoItem.Body>
          </AxoItem.Content>
        </AxoItem.Root>
      </AxoItem.Group>

      <Header>
        Long Value: Actions and arrow should stay on the same line
      </Header>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Body>
              <AxoItem.Title>Title</AxoItem.Title>
              <AxoItem.Value>
                Lorem ipsum dolor sit amet consectetur adipisicing elit. Odio
                pariatur ipsum non officia laboriosam amet omnis autem
                architecto, expedita dolores officiis laborum iste cum porro,
                fugiat sapiente sequi dolor. Excepturi.
              </AxoItem.Value>
            </AxoItem.Body>
            <AxoItem.Accessory>
              <DownloadIconAction />
              <MoreIconActionWithMenu />
            </AxoItem.Accessory>
          </AxoItem.Content>
          <AxoItem.Arrow />
        </AxoItem.Root>
      </AxoItem.Group>
    </div>
  );
}
