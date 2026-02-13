// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import type { JSX, ReactNode } from 'react';
import React from 'react';
import { action } from '@storybook/addon-actions';
import { AxoAvatar } from './AxoAvatar.dom.js';
import { tw } from './tw.dom.js';
import { BADGES_FIXTURE } from './_internal/storybook-fixtures.std.js';
import { _getAllAxoSymbolIconNames } from './_internal/AxoSymbolDefs.generated.std.js';
import { AxoTokens } from './AxoTokens.std.js';

export default {
  title: 'Axo/AxoAvatar',
} satisfies Meta;

function Stack(props: { children: ReactNode }) {
  return <div className={tw('flex flex-col gap-4')}>{props.children}</div>;
}

function Row(props: { children: ReactNode }) {
  return (
    <div className={tw('flex flex-wrap items-end gap-2')}>{props.children}</div>
  );
}

function Cell(props: { children: ReactNode; label: ReactNode }) {
  return (
    <div className={tw('flex flex-col items-center gap-2')}>
      {props.children}
      <span className={tw('font-mono type-caption text-label-secondary')}>
        {props.label}
      </span>
    </div>
  );
}

function SizesTemplate(props: {
  children: (size: AxoAvatar.Size) => ReactNode;
}) {
  const sizes = AxoAvatar._getAllSizes();
  return (
    <Row>
      {sizes.map(size => {
        return (
          <Cell key={size} label={size}>
            {props.children(size)}
          </Cell>
        );
      })}
    </Row>
  );
}

export function Colors(): JSX.Element {
  const colors = AxoTokens.Avatar.getAllColorNames();
  return (
    <Row>
      <Cell label="Default">
        <AxoAvatar.Root size={64}>
          <AxoAvatar.Content label={null}>
            <AxoAvatar.Icon symbol="palette" />
          </AxoAvatar.Content>
        </AxoAvatar.Root>
      </Cell>
      {colors.map(color => {
        return (
          <Cell key={color} label={color}>
            <AxoAvatar.Root size={64}>
              <AxoAvatar.Content label={null}>
                <AxoAvatar.Initials initials="JK" color={color} />
              </AxoAvatar.Content>
            </AxoAvatar.Root>
          </Cell>
        );
      })}
    </Row>
  );
}

export function Gradients(): JSX.Element {
  const gradientsCount = AxoTokens.Avatar.getGradientsCount();
  return (
    <Row>
      {Array.from({ length: gradientsCount }, (_, index) => {
        return (
          <Cell label="">
            <AxoAvatar.Root size={64}>
              <AxoAvatar.Content label={null}>
                <AxoAvatar.Gradient identifierHash={index} />
              </AxoAvatar.Content>
            </AxoAvatar.Root>
          </Cell>
        );
      })}
    </Row>
  );
}

export function Images(): JSX.Element {
  return (
    <SizesTemplate>
      {size => (
        <AxoAvatar.Root size={size}>
          <AxoAvatar.Content label={null}>
            <AxoAvatar.Image
              src="/fixtures/kitten-3-64-64.jpg"
              srcWidth={64}
              srcHeight={64}
              blur={false}
              fallbackIcon="person"
              fallbackColor="A100"
            />
          </AxoAvatar.Content>
        </AxoAvatar.Root>
      )}
    </SizesTemplate>
  );
}

export function BrokenImage(): JSX.Element {
  return (
    <Row>
      <Cell label="Shows fallback icon">
        <AxoAvatar.Root size={64}>
          <AxoAvatar.Content label={null}>
            <AxoAvatar.Image
              src="/fake-path-should-not-exist.png"
              srcWidth={64}
              srcHeight={64}
              blur={false}
              fallbackIcon="person"
              fallbackColor="A100"
            />
          </AxoAvatar.Content>
        </AxoAvatar.Root>
      </Cell>
      <Cell label="Stays blurred">
        <AxoAvatar.Root size={64}>
          <AxoAvatar.Content label={null}>
            <AxoAvatar.Image
              src="/fake-path-should-not-exist.png"
              srcWidth={64}
              srcHeight={64}
              blur
              fallbackIcon="person"
              fallbackColor="A100"
            />
          </AxoAvatar.Content>
        </AxoAvatar.Root>
      </Cell>
    </Row>
  );
}

export function Initials(): JSX.Element {
  return (
    <Stack>
      <SizesTemplate>
        {size => (
          <AxoAvatar.Root size={size}>
            <AxoAvatar.Content label={null}>
              <AxoAvatar.Initials initials="JK" color="A100" />
            </AxoAvatar.Content>
          </AxoAvatar.Root>
        )}
      </SizesTemplate>
      <SizesTemplate>
        {size => (
          <AxoAvatar.Root size={size}>
            <AxoAvatar.Content label={null}>
              <AxoAvatar.Initials initials="WW" color="A100" />
            </AxoAvatar.Content>
          </AxoAvatar.Root>
        )}
      </SizesTemplate>
    </Stack>
  );
}

export function Icons(): JSX.Element {
  const icons = _getAllAxoSymbolIconNames();
  return (
    <SizesTemplate>
      {size => (
        <AxoAvatar.Root size={size}>
          <AxoAvatar.Content label={null}>
            <AxoAvatar.Icon symbol={icons[size % icons.length]} />
          </AxoAvatar.Content>
        </AxoAvatar.Root>
      )}
    </SizesTemplate>
  );
}

export function Presets(): JSX.Element {
  const contactPresets = AxoTokens.Avatar.getAllContactPresetNames();
  const groupPresets = AxoTokens.Avatar.getAllGroupPresetNames();
  return (
    <Stack>
      <Row>
        {contactPresets.map(preset => {
          return (
            <Cell key={preset} label={preset}>
              <AxoAvatar.Root size={64}>
                <AxoAvatar.Content label={null}>
                  <AxoAvatar.Preset preset={preset} />
                </AxoAvatar.Content>
              </AxoAvatar.Root>
            </Cell>
          );
        })}
      </Row>
      <Row>
        {groupPresets.map(preset => {
          return (
            <Cell key={preset} label={preset}>
              <AxoAvatar.Root size={64}>
                <AxoAvatar.Content label={null}>
                  <AxoAvatar.Preset preset={preset} />
                </AxoAvatar.Content>
              </AxoAvatar.Root>
            </Cell>
          );
        })}
      </Row>
    </Stack>
  );
}

function ActionsTemplate(props: { ring: boolean }) {
  const ring = props.ring ? 'unread' : null;
  return (
    <Row>
      <Cell label="Default">
        <AxoAvatar.Root size={48} ring={ring}>
          <AxoAvatar.Content
            label="View Jamie's Profile"
            onClick={action('onClick')}
          >
            <AxoAvatar.Initials initials="JK" color="A100" />
          </AxoAvatar.Content>
        </AxoAvatar.Root>
      </Cell>
      <Cell label="Static badge">
        <AxoAvatar.Root size={48} ring={ring}>
          <AxoAvatar.Content
            label="View Jamie's profile"
            onClick={action('onClick')}
          >
            <AxoAvatar.Initials initials="JK" color="A100" />
          </AxoAvatar.Content>
          <AxoAvatar.Badge
            label={BADGES_FIXTURE.planet.name}
            svgs={BADGES_FIXTURE.planet.svgs}
          />
        </AxoAvatar.Root>
      </Cell>
      <Cell label="Clickable badge">
        <AxoAvatar.Root size={48} ring={ring}>
          <AxoAvatar.Content
            label="View Jamie's profile"
            onClick={action('onClick')}
          >
            <AxoAvatar.Initials initials="JK" color="A100" />
          </AxoAvatar.Content>
          <AxoAvatar.Badge
            label={BADGES_FIXTURE.planet.name}
            svgs={BADGES_FIXTURE.planet.svgs}
            onClick={action('onClick')}
          />
        </AxoAvatar.Root>
      </Cell>
    </Row>
  );
}

export function Actions(): JSX.Element {
  return (
    <Stack>
      <ActionsTemplate ring={false} />
      <h2>With focus ring</h2>
      <ActionsTemplate ring />
    </Stack>
  );
}

export function Badges(): JSX.Element {
  return (
    <Stack>
      {Object.values(BADGES_FIXTURE).map(badge => {
        return (
          <SizesTemplate key={badge.id}>
            {size => (
              <AxoAvatar.Root size={size}>
                <AxoAvatar.Content label={null}>
                  <AxoAvatar.Initials initials={`${size}`} color="A140" />
                </AxoAvatar.Content>
                <AxoAvatar.Badge
                  label={badge.name}
                  svgs={badge.svgs}
                  onClick={action('onClick')}
                />
              </AxoAvatar.Root>
            )}
          </SizesTemplate>
        );
      })}
    </Stack>
  );
}

export function Stories(): JSX.Element {
  return (
    <Stack>
      <SizesTemplate>
        {size => (
          <AxoAvatar.Root size={size} ring="unread">
            <AxoAvatar.Content
              label="View Jamie's stories"
              onClick={action('onClick')}
            >
              <AxoAvatar.Initials initials="JK" color="A100" />
            </AxoAvatar.Content>
            <AxoAvatar.Badge
              label={BADGES_FIXTURE.rocket.name}
              svgs={BADGES_FIXTURE.rocket.svgs}
            />
          </AxoAvatar.Root>
        )}
      </SizesTemplate>
      <SizesTemplate>
        {size => (
          <AxoAvatar.Root size={size} ring="read">
            <AxoAvatar.Content
              label="View Jamie's stories"
              onClick={action('onClick')}
            >
              <AxoAvatar.Initials initials="JK" color="A100" />
            </AxoAvatar.Content>
          </AxoAvatar.Root>
        )}
      </SizesTemplate>
    </Stack>
  );
}

export function ClickToView(): JSX.Element {
  const sizes = AxoAvatar._getAllSizes().filter(size => {
    return size >= AxoAvatar.MIN_CLICK_TO_VIEW_SIZE;
  });

  return (
    <Row>
      {sizes.map(size => {
        return (
          <Cell key={size} label={size}>
            <AxoAvatar.Root size={size}>
              <AxoAvatar.Content
                label="Click to view Kitten's profile photo"
                onClick={action('onClick')}
              >
                <AxoAvatar.Image
                  src="/fixtures/kitten-3-64-64.jpg"
                  srcWidth={64}
                  srcHeight={64}
                  blur
                  fallbackIcon="person"
                  fallbackColor="A140"
                />
                <AxoAvatar.ClickToView label="View" />
              </AxoAvatar.Content>
            </AxoAvatar.Root>
          </Cell>
        );
      })}
    </Row>
  );
}
