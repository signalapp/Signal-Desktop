export class RingBuffer<T> {
  private buffer: Array<T> = [];
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public add(item: T) {
    this.buffer.push(item);
    this.crop();
  }

  public has(item: T) {
    return this.buffer.includes(item);
  }

  public clear() {
    this.buffer = [];
  }

  private crop() {
    while (this.buffer.length > this.capacity) {
      this.buffer.shift();
    }
  }
}
