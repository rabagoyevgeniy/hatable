import { runFirstSol, runStabilizeCoupling, FIRST_SOL_CHAIN } from "../src/systems/firstSol.js";

try {
  const first = runFirstSol();
  console.log(`first-sol ok  ${first.done.join(" → ")}`);
  const stab = runStabilizeCoupling();
  console.log(`stabilize ok  ${stab.notes.join(" → ")}`);
  if (first.done.join() !== FIRST_SOL_CHAIN.join()) {
    throw new Error("first-sol chain mismatch");
  }
} catch (err) {
  console.error(`FAIL ${err.message}`);
  process.exit(1);
}
