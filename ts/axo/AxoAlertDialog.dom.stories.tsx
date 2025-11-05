// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import React, { useState } from 'react';
import { AxoAlertDialog } from './AxoAlertDialog.dom.js';
import { AxoButton } from './AxoButton.dom.js';

export default {
  title: 'Axo/AxoAlertDialog',
} satisfies Meta;

const EXAMPLE_TITLE = <>Exporting chat</>;
const EXAMPLE_TITLE_LONG = (
  <>
    Lorem ipsum dolor, sit amet consectetur adipisicing elit. Est vel
    repudiandae magnam tempora temporibus nihil repellendus ullam. Ex veniam
    ipsa voluptate, quae ullam qui eius enim explicabo laborum modi minima!
  </>
);

const EXAMPLE_DESCRIPTION = (
  <>
    Your chat will be downloaded in the background. You can continue to use
    Signal during this process.
  </>
);
const EXAMPLE_DESCRIPTION_LONG = (
  <>
    Lorem ipsum dolor sit amet consectetur adipisicing elit. Nobis, amet aut
    quasi possimus repudiandae accusamus dolore. Iure, ad neque qui recusandae
    quod asperiores! Facere nulla illum suscipit dolores sint libero! Quibusdam
    hic, facilis soluta quae voluptatum eius voluptates alias ipsa, autem sed
    tempore atque nesciunt illum blanditiis tempora fugiat. Quidem odit optio
    sint! Iste rerum, molestias doloremque asperiores ipsa nostrum! Provident
    impedit quam aspernatur libero veniam sint et tempore maiores! Porro
    incidunt numquam sapiente deserunt id possimus atque at. Repudiandae
    recusandae blanditiis autem ad numquam animi omnis eos perspiciatis harum!
    Accusantium nesciunt eligendi laboriosam ipsam reprehenderit voluptate,
    minima necessitatibus molestias reiciendis repellendus maiores assumenda
    alias atque odit, voluptatum facere voluptas excepturi, nostrum quidem
    beatae quasi quis? Provident, quaerat autem! Numquam. Laborum, aut quidem
    molestias beatae eius, id molestiae officiis, dolores perspiciatis ratione
    doloremque eligendi? Aut facilis temporibus inventore beatae nihil dolores
    quidem alias ab expedita, quas fugit recusandae at dignissimos. Ullam
    veritatis eligendi dicta asperiores minus quisquam! Odit dolorem ipsum
    repudiandae enim excepturi omnis quisquam molestias ullam placeat delectus
    necessitatibus eligendi illo, pariatur mollitia, alias sit ad amet eveniet
    tenetur. Rem debitis, aperiam iusto officia fugiat consectetur hic voluptate
    reprehenderit. Est quisquam, saepe fuga odit ex recusandae vero earum
    asperiores aspernatur at, fugit temporibus eligendi tempore nemo obcaecati
    libero dolore. Tenetur illum facere delectus sapiente architecto, minima
    accusamus officia sed quos. Ipsum odit exercitationem ullam iure deleniti ea
    eius, quia illum debitis cum quae pariatur assumenda officia dolores. Quasi,
    temporibus? Distinctio iure quis nihil eaque ut cum quibusdam officiis,
    eveniet maxime, debitis eos asperiores itaque voluptatem aliquam expedita?
    Sint, animi eos. Repudiandae deleniti beatae quam dolores optio ipsa totam
    perferendis. Nulla nostrum laudantium provident est itaque inventore neque,
    eveniet facere vero voluptatibus alias nisi repellat placeat ipsa ea, amet
    numquam iusto voluptates dolorem, sint odit optio quam. Dolores, molestiae!
    Dolorem?
  </>
);

const EXAMPLE_ACTION = <>OK</>;
const EXAMPLE_ACTION_LONG = <>Consectetur adipisicing elit</>;
const EXAMPLE_CANCEL = <>Cancel</>;
const EXAMPLE_CANCEL_LONG = <>Lorem ipsum dolor sit amet</>;

function Template(props: {
  visuallyHiddenTitle?: boolean;
  requireExplicitChoice?: boolean;
  extraLongText?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <AxoAlertDialog.Root open={open} onOpenChange={setOpen}>
      <AxoAlertDialog.Trigger>
        <AxoButton.Root variant="subtle-primary" size="md">
          Open
        </AxoButton.Root>
      </AxoAlertDialog.Trigger>
      <AxoAlertDialog.Content
        escape={
          props.requireExplicitChoice
            ? 'cancel-is-destructive'
            : 'cancel-is-noop'
        }
      >
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Title screenReaderOnly={props.visuallyHiddenTitle}>
            {props.extraLongText ? EXAMPLE_TITLE_LONG : EXAMPLE_TITLE}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {props.extraLongText
              ? EXAMPLE_DESCRIPTION_LONG
              : EXAMPLE_DESCRIPTION}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoAlertDialog.Cancel>
            {props.extraLongText ? EXAMPLE_CANCEL_LONG : EXAMPLE_CANCEL}
          </AxoAlertDialog.Cancel>
          <AxoAlertDialog.Action
            variant="primary"
            symbol={props.extraLongText ? 'check' : undefined}
            arrow={props.extraLongText}
            onClick={action('Action clicked')}
          >
            {props.extraLongText ? EXAMPLE_ACTION_LONG : EXAMPLE_ACTION}
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}

export function Basic(): JSX.Element {
  return <Template />;
}

export function VisuallyHiddenTitle(): JSX.Element {
  return <Template visuallyHiddenTitle />;
}

export function RequireExplicitChoice(): JSX.Element {
  return <Template requireExplicitChoice />;
}

export function ExtraLongText(): JSX.Element {
  return <Template extraLongText />;
}
