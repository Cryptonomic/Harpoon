const conseilServer = {"url": "<conseil_host>", "apiKey": "<api_key>"}
const platform = 'tezos'
const network = 'mainnet'
const microseilServer = `http://localhost:8080/info`;

// Tezos constants
const blocksPerCycleValues = {"mainnet" : 4096,
			      "babylonnet" : 2048,
			      "carthagenet" : 2048,
			      "zeronet" : 128}
const blocksPerCycle = blocksPerCycleValues[network]
const tezPerRoll = 8000
const CYCLES_PRESERVED = 5;
const CYCLES_PENDING = 2
