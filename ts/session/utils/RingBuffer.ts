/**
 * This ringbuffer class can be used to keep a list of at most a size and removing old items first when the size is exceeded.
 * Internally, it uses an array to keep track of the order, so two times the same item can exist in it.
 *
 */
export class RingBuffer<T> {
  private newest = -1;
  private oldest = 0;
  private buffer: Array<T> = [];
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public getLength(): number {
    if (this.isEmpty()) {
      return 0;
    }

    // When only one item was added, newest = 0 and oldest = 0.
    // When more than one item was added, but less than capacity, newest = nbItemsAdded & oldest = 0.
    // As soon as we overflow, oldest is incremented to oldest+1 and newest rolls back to 0,
    // so this test fails here and we have to extract the length based on the two parts instead.
    if (this.newest >= this.oldest) {
      return this.newest + 1;
    }
    const firstPart = this.capacity - this.oldest;
    const secondPart = this.newest + 1;
    return firstPart + secondPart;
  }

  public insert(item: T) {
    // see comments in `getLength()`
    this.newest = (this.newest + 1) % this.capacity;
    if (this.buffer.length >= this.capacity) {
      this.oldest = (this.oldest + 1) % this.capacity;
    }
    this.buffer[this.newest] = item;
  }

  public has(item: T) {
    // no items at all
    if (this.isEmpty()) {
      return false;
    }
    return this.toArray().includes(item);
  }

  public isEmpty() {
    return this.newest === -1;
  }

  public clear() {
    this.buffer = [];
    this.newest = -1;
    this.oldest = 0;
  }

  public toArray(): Array<T> {
    if (this.isEmpty()) {
      return [];
    }

    if (this.newest >= this.oldest) {
      return this.buffer.slice(0, this.newest + 1);
    }
    const firstPart = this.buffer.slice(this.oldest, this.capacity);
    const secondPart = this.buffer.slice(0, this.newest + 1);
    return [...firstPart, ...secondPart];
  }
}
