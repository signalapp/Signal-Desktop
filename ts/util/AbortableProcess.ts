// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-restricted-syntax */

import { explodePromise } from './explodePromise';

export interface IController {
  abort(): void;
}

export class AbortableProcess<Result> implements IController {
  #abortReject: (error: Error) => void;

  public readonly resultPromise: Promise<Result>;

  constructor(
    private readonly name: string,
    private readonly controller: IController,
    resultPromise: Promise<Result>
  ) {
    const { promise: abortPromise, reject: abortReject } =
      explodePromise<Result>();

    this.#abortReject = abortReject;
    this.resultPromise = Promise.race([abortPromise, resultPromise]);
  }

  public abort(): void {
    this.controller.abort();
    this.#abortReject(new Error(`Process "${this.name}" was aborted`));
  }

  public getResult(): Promise<Result> {
    return this.resultPromise;
  }
}
