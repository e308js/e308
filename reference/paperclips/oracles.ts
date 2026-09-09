export function manufactureLedger(wire: number, inventory: number, rate: number, seconds: number) {
  const made = Math.min(wire, rate * seconds);
  return { wire: wire - made, inventory: inventory + made };
}

export function saleLedger(inventory: number, cash: number, price: number, demand: number) {
  const sold = Math.min(inventory, Math.floor(demand));
  return { inventory: inventory - sold, cash: cash + sold * price, sold };
}

export function industryLedger(matter: number, wire: number, allocatedPower: number) {
  const executions = Math.min(matter, allocatedPower * 2);
  return { matter: matter - executions, wire: wire + executions * 3 };
}
