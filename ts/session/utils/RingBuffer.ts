/**
 * This ringbuffer class can be used to keep a list of at most a size and removing old items first when the size is exceeded.
 * Internally, it uses an array to keep track of the order, so two times the same item can exist in it.
 *
 */
export class RingBuffer<T> {
  private buffer: Array<T> = [];
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public getLength(): number {
    return this.buffer.length;
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
