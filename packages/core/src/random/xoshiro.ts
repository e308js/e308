import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";

export interface RandomState {
  readonly words: readonly [number, number, number, number];
  readonly draws: bigint;
}

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function validateWords(
  words: readonly number[],
): asserts words is readonly [number, number, number, number] {
  if (
    words.length !== 4 ||
    words.some((word) => !Number.isInteger(word) || word < 0 || word > 0xffffffff)
  ) {
    throw new TypeError("xoshiro state must contain four uint32 words");
  }
  if (words.every((word) => word === 0)) throw new TypeError("xoshiro state cannot be all zero");
}

export class Xoshiro128 {
  #words: [number, number, number, number];
  #draws: bigint;

  constructor(state: RandomState) {
    validateWords(state.words);
    if (state.draws < 0n) throw new TypeError("draw count cannot be negative");
    this.#words = [...state.words];
    this.#draws = state.draws;
  }

  nextUint32(): number {
    const [s0, s1, s2, s3] = this.#words;
    const result = Math.imul(rotateLeft(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
    const shifted = (s1 << 9) >>> 0;
    const next2 = (s2 ^ s0) >>> 0;
    const next3 = (s3 ^ s1) >>> 0;
    const next1 = (s1 ^ next2) >>> 0;
    const next0 = (s0 ^ next3) >>> 0;
    this.#words = [next0, next1, (next2 ^ shifted) >>> 0, rotateLeft(next3, 11)];
    this.#draws += 1n;
    return result;
  }

  uniform(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }

  bounded(bound: number): number {
    if (!Number.isSafeInteger(bound) || bound < 1 || bound > 0x1_0000_0000) {
      throw new TypeError("bound must be an integer from 1 through 2^32");
    }
    const limit = Math.floor(0x1_0000_0000 / bound) * bound;
    let value = this.nextUint32();
    while (value >= limit) value = this.nextUint32();
    return value % bound;
  }

  snapshot(): RandomState {
    return Object.freeze({
      words: Object.freeze([...this.#words]),
      draws: this.#draws,
    }) as RandomState;
  }
}

export function deriveRandomState(rootSeed: string, streamPath: readonly string[]): RandomState {
  if (!/^(?:[0-9a-f]{2})+$/.test(rootSeed))
    throw new TypeError("root seed must be lowercase even-length hex");
  if (streamPath.some((part) => part.length === 0))
    throw new TypeError("stream path parts cannot be empty");
  const digest = sha256(utf8ToBytes(JSON.stringify(["e308-rng-v1", rootSeed, streamPath])));
  const view = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
  const words = [0, 4, 8, 12].map((offset) => view.getUint32(offset, true)) as [
    number,
    number,
    number,
    number,
  ];
  if (words.every((word) => word === 0)) words[0] = 1;
  validateWords(words);
  return Object.freeze({ words: Object.freeze([...words]), draws: 0n }) as RandomState;
}

export class RandomStreams {
  readonly #rootSeed: string;
  readonly #streams = new Map<string, Xoshiro128>();

  constructor(rootSeed: string) {
    deriveRandomState(rootSeed, ["validation"]);
    this.#rootSeed = rootSeed;
  }

  open(path: readonly string[]): Xoshiro128 {
    const key = JSON.stringify(path);
    let stream = this.#streams.get(key);
    if (!stream) {
      stream = new Xoshiro128(deriveRandomState(this.#rootSeed, path));
      this.#streams.set(key, stream);
    }
    return stream;
  }
}
