import { advanceProducerChain, type Transaction } from "../../packages/core/src/index.js";
import { type ArrayQuantity, add, arrayNumbers, div, mul, pow, q, required } from "./math.js";
import { arrayGenerators, arrayResources, aUpgradeBuyables, boosterator } from "./model.js";

type Tx = Transaction<ArrayQuantity>;

export function updateArrayEconomy(transaction: Tx, seconds: number): void {
  advanceA(transaction, seconds);
  if (!transaction.hasProgress("milestone", "array-b-unlocked")) return;
  keepBPositive(transaction);
  if (transaction.hasProgress("upgrade", "passive-b")) {
    transaction.add(arrayResources.B, mul(arrayBReward(transaction), q(String(seconds / 5))));
  }
  advanceB(transaction, seconds);
  advanceBoosters(transaction, seconds);
}

function advanceA(transaction: Tx, seconds: number): void {
  advanceProducerChain(transaction, {
    output: arrayResources.A,
    tiers: arrayGenerators.A.amounts,
    seconds,
    rate: ({ index, amount }) => aGeneratorRate(transaction, index, amount),
  });
}

function advanceB(transaction: Tx, seconds: number): void {
  advanceProducerChain(transaction, {
    output: required(arrayGenerators.A.amounts[4], "A-5 generator"),
    tiers: arrayGenerators.B.amounts,
    seconds,
    rate: ({ index, amount }) => generatorBaseRate(transaction, "B", index, amount),
  });
}

function aGeneratorRate(transaction: Tx, index: number, amount: ArrayQuantity): ArrayQuantity {
  let rate = generatorBaseRate(transaction, "A", index, amount);
  rate = mul(
    rate,
    add(q("1"), mul(q("0.1"), pow(transaction.get(arrayResources.boosters), q("0.5")))),
  );
  if (transaction.hasProgress("upgrade", "b-count-boosts-a")) {
    const paired = required(arrayGenerators.B.buyables[index], `B-${index + 1} buyable`);
    rate = mul(rate, add(q("1"), transaction.getPurchase(paired.id)));
  }
  if (index === 0) {
    rate = mul(
      rate,
      pow(q("2"), transaction.getPurchase(required(aUpgradeBuyables[0], "A upgrade 1").id)),
    );
    rate = mul(rate, add(q("1"), mul(q("0.6"), pow(transaction.get(arrayResources.B), q("0.4")))));
  }
  if (index === 1) {
    rate = mul(
      rate,
      pow(q("2"), transaction.getPurchase(required(aUpgradeBuyables[1], "A upgrade 2").id)),
    );
  }
  return rate;
}

function generatorBaseRate(
  transaction: Tx,
  family: "A" | "B",
  index: number,
  amount: ArrayQuantity,
): ArrayQuantity {
  let rate = index === 0 ? amount : div(amount, q("10"));
  const buyable = required(
    arrayGenerators[family].buyables[index],
    `${family}-${index + 1} buyable`,
  );
  const bought = transaction.getPurchase(buyable.id);
  if (arrayNumbers.cmp(bought, q("20")) > 0) {
    const exponent =
      family === "A" && transaction.hasProgress("upgrade", "stronger-a-count")
        ? q("0.6")
        : q("0.2");
    rate = mul(rate, pow(arrayNumbers.sub(bought, q("19")), exponent));
  }
  if (family === "B" && transaction.hasProgress("upgrade", "hundredfold-b"))
    rate = mul(rate, q("100"));
  return rate;
}

function advanceBoosters(transaction: Tx, seconds: number): void {
  const count = transaction.getPurchase(boosterator.id);
  const stronger = transaction.hasProgress("upgrade", "stronger-boosterators");
  const base = stronger ? q("21") : q("11");
  const divisor = stronger ? q("20") : q("10");
  let rate = div(arrayNumbers.sub(pow(base, pow(count, q("0.8"))), q("1")), divisor);
  if (transaction.hasProgress("upgrade", "b1-boosters")) {
    const b1 = required(arrayGenerators.B.buyables[0], "B-1 buyable");
    rate = mul(rate, add(q("1"), transaction.getPurchase(b1.id)));
  }
  transaction.add(arrayResources.boosters, mul(rate, q(String(seconds))));
}

function keepBPositive(transaction: Tx): void {
  if (arrayNumbers.cmp(transaction.get(arrayResources.B), q("1")) < 0)
    transaction.set(arrayResources.B, q("1"));
}

export function arrayBReward(transaction: Pick<Tx, "get" | "getPurchase">): ArrayQuantity {
  const logarithm = arrayNumbers.transcendental?.log;
  if (!logarithm) throw new TypeError("Array Game requires logarithms");
  const base = div(logarithm(add(transaction.get(arrayResources.A), q("1")), q("10")), q("10"));
  let reward = arrayNumbers.floor(pow(base, q("2")));
  const upgrade = required(aUpgradeBuyables[2], "A upgrade 3");
  reward = mul(reward, pow(q("3"), transaction.getPurchase(upgrade.id)));
  return arrayNumbers.floor(reward);
}
