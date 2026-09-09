export function quantumOperationYield(clock: number, activeChips: number): number {
  let waveSum = 0;
  for (let index = 1; index <= activeChips; index += 1) {
    waveSum += Math.sin(clock * index * 0.1);
  }
  return Math.ceil(waveSum * 360);
}
