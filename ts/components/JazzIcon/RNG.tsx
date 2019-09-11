export class RNG {
  private _seed: number;
  constructor(seed: number) {
    this._seed = seed % 2147483647;
    if (this._seed <= 0) {
      this._seed += 2147483646;
    }
  }

  public next() {
    return (this._seed = (this._seed * 16807) % 2147483647);
  }

  public nextFloat() {
    return (this.next() - 1) / 2147483646;
  }

  public random() {
    return this.nextFloat();
  }
}
