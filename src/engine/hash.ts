// FNV-1a 64-bit hash to produce deterministic seeds
export function fnv1a64(input: string): bigint {
  const FNV_OFFSET = BigInt("14695981039346656037");
  const FNV_PRIME = BigInt("1099511628211");
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * FNV_PRIME) & BigInt("0xFFFFFFFFFFFFFFFF");
  }
  return hash;
}

// Convert bigint to unsigned decimal string for safe JSON
export function u64ToString(x: bigint): string {
  return (x & BigInt("0xFFFFFFFFFFFFFFFF")).toString(10);
}

// SplitMix64 RNG (deterministic)
export class SeededRng {
  private state: bigint;

  constructor(seed: bigint) {
    this.state = seed === BigInt(0) ? BigInt("0xdeadbeefcafebabe") : seed;
  }

  nextU64(): bigint {
    this.state = (this.state + BigInt("0x9E3779B97F4A7C15")) & BigInt("0xFFFFFFFFFFFFFFFF");
    let z = this.state;
    z = (z ^ (z >> BigInt(30))) * BigInt("0xBF58476D1CE4E5B9") & BigInt("0xFFFFFFFFFFFFFFFF");
    z = (z ^ (z >> BigInt(27))) * BigInt("0x94D049BB133111EB") & BigInt("0xFFFFFFFFFFFFFFFF");
    return (z ^ (z >> BigInt(31))) & BigInt("0xFFFFFFFFFFFFFFFF");
  }

  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    const v = Number(this.nextU64() % BigInt(maxExclusive));
    return v;
  }

  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  pick<T>(arr: T[]): T {
    return arr[this.nextInt(arr.length)];
  }
}
