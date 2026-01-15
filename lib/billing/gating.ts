export function needsHardGate(balance: number, cost: number) {
  return balance <= 0 || balance < cost;
}

export function shouldSoftGate(balance: number, cost: number) {
  return balance >= cost && cost > 0;
}

export function formatCreditCost(cost: number) {
  return cost === 1 ? "1 credit" : `${cost} credits`;
}
