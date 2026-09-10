// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta } from '@storybook/react';
import type { ReactNode } from 'react';
import { AxoContainer } from './AxoContainer.dom.tsx';
import { tw } from './tw.dom.tsx';

export default {
  title: 'Axo/AxoContainer',
} satisfies Meta;

export function Basic(): ReactNode {
  return (
    <AxoContainer.Root>
      <p className={tw('mb-2.5')}>
        Lorem ipsum dolor sit amet, consectetur adipisicing elit. Doloribus at
        suscipit provident minus totam, eos veritatis laudantium quidem
        reprehenderit blanditiis inventore et in dolorum porro unde eum
        voluptates, voluptatum magnam.
      </p>
      <p className={tw('mb-2.5')}>
        Ipsum ad facilis atque nobis temporibus odit cum tempora voluptatum
        maxime quo suscipit aut ab excepturi fuga ullam reiciendis repellat
        repudiandae, sed nam quibusdam doloribus nulla! Incidunt dicta quisquam
        dolores.
      </p>
      <p className={tw('mb-2.5')}>
        Alias fuga, sit et placeat debitis modi accusantium possimus eveniet vel
        voluptatum obcaecati ad nulla nam atque, repudiandae, in animi quidem
        odio recusandae! Quo, nesciunt. Rerum sapiente exercitationem officiis
        ullam.
      </p>
    </AxoContainer.Root>
  );
}
