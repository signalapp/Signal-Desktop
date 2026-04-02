// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { explodePromise } from './explodePromise.std.ts';

export type IController = {
  abort(): void;
};

export class AbortableProcess<Result> implements IController {
  readonly #name: string;
  readonly #controller: IController;

  readonly #abortReject: (error: Error) => void;

  public readonly resultPromise: Promise<Result>;

  constructor(
    name: string,
    controller: IController,
    resultPromise: Promise<Result>
  ) {
    this.#name = name;
    this.#controller = controller;

    const { promise: abortPromise, reject: abortReject } =
      explodePromise<Result>();

    this.#abortReject = abortReject;
    this.resultPromise = Promise.race([abortPromise, resultPromise]);
  }

  public abort(): void {
    this.#controller.abort();
    this.#abortReject(new Error(`Process "${this.#name}" was aborted`));
  }

  public getResult(): Promise<Result> {
    return this.resultPromise;
  }
}
