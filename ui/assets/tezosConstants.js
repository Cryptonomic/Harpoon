const blocksPerCycleValues = {"mainnet" : 4096,
			      "babylonnet" : 2048,
			      "carthagenet" : 2048,
			      "zeronet" : 128}
const blocksPerCycle = blocksPerCycleValues[network]
const CYCLES_PRESERVED = 5;
const CYCLES_PENDING = 2;
const tezPerRoll = 8000
const BAKING_REWARD_PER_ENDORSEMENT = [1.250, 0.1875]
const REWARD_PER_ENDORSEMENT = [1.250, 0.833333]
const REWARD_PER_REVELATION = 0.125
