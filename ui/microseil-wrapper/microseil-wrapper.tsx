import fetch from "node-fetch";

enum Operation {
  Equals = "eq",
  LessThan = "lt",
  GreaterThan = "gt",
  Between = "between",
}

enum Direction {
  Ascending = "asc",
  Descending = "desc",
}

type predicate = {
  field: string;
  op: Operation;
  value: string[] | number[];
};

type orderby = {
  field: string;
  dir: Direction;
};

const server = "https://harpoon.arronax.io/info";
const httpPost = async (url: string, payload: any) => {
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
  const data = await response.json();
  return data;
};

/**
 * Function used to build and send queries to the postgresql server running on
 * the backend (server host "microseilServer" is defined in networkConstant.js).
 *
 * @params {string} table - name of the table to query
 * @params {string[]} fields - array of fields to add to query
 * @params {predicate[]} predicates - array of predicate objects to apply
 * to query
 * @params {orderby} orderby - object representing an optional orderby
 * statement for query
 * @returns an array of json objects which have the specified fields
 */
async function getBakerInfo(
  microseilServer: string,
  table: string,
  fields: string[],
  predicates: predicate[],
  orderby: orderby | null = null
) {
  let query = { table: table, fields: fields };
  if (predicates) query["predicates"] = predicates;
  if (orderby) query["orderby"] = orderby;
  const result = await httpPost(microseilServer, query);
  return result;
}

export const getBakerStats = async (baker: string) => {
  const name = (
    await fetch(`https://api.baking-bad.org/v2/bakers/${baker}`)
      .then((res) => res.text())
      .then((text) => JSON.parse(text))
  ).name;

  const bakerInfo = (
    await getBakerInfo(
      server,
      "baker_performance",
      ["baker", "grade"],
      [{ field: "baker", op: Operation.Equals, value: [baker] }],
      { field: "cycle", dir: Direction.Ascending }
    )
  )[0];

  return { ...bakerInfo, name };
};

// Returns baker's grade in a particular cycles
export const bakerGradeInCycle = async (baker: string, cycle: number) => {
  return await getBakerInfo(
    server,
    "baker_performance",
    ["grade"],
    [
      { field: "cycle", op: Operation.Equals, value: [cycle] },
      { field: "baker", op: Operation.Equals, value: [baker] },
    ]
  );
};

// Payout is inferred from transaction data and may not always be 100% correct
export const bakerPayoutInCycle = async (baker: string, cycle: number) => {
  return await getBakerInfo(
    server,
    "baker_payouts",
    ["payout"],
    [
      { field: "cycle", op: Operation.Equals, value: [cycle] },
      { field: "baker", op: Operation.Equals, value: [baker] },
    ]
  );
};

// Breakdown of tez lost by a baker due to double baking in a given cycle
export const doubleBakingLossesInCycle = async (
  baker: string,
  cycle: number
) => {
  return await getBakerInfo(
    server,
    "accusations",
    [
      "double_baking_lost_fees",
      "double_baking_lost_deposits",
      "double_baking_lost_rewards",
    ],
    [
      { field: "cycle", op: Operation.Equals, value: [cycle] },
      { field: "baker", op: Operation.Equals, value: [baker] },
    ]
  );
};

// Breakdown of tez lost by a baker due to double endorsing in a given cycle
export const doubleEndorsingLossesInCycle = async (
  baker: string,
  cycle: number
) => {
  return await getBakerInfo(
    server,
    "accusations",
    ["double_endorsement_lost_deposits", "double_endorsement_lost_rewards"],
    [
      { field: "cycle", op: Operation.Equals, value: [cycle] },
      { field: "baker", op: Operation.Equals, value: [baker] },
    ]
  );
};

// Total tez made in rewards and fees by a baker in a given cycle from both
// baking and enorsing
export const rewardsMadeInCycle = async (baker: string, cycle: number) => {
  return await getBakerInfo(
    server,
    "snapshot_info",
    ["rewards"],
    [
      { field: "cycle", op: Operation.Equals, value: [cycle] },
      { field: "baker", op: Operation.Equals, value: [baker] },
    ]
  );
};

// Break down of tez earned from fees and potential earnings from fees that were
// missed
export const feeBreakDownInCycle = async (baker: string, cycle: number) => {
  return await getBakerInfo(
    server,
    "baker_performance",
    [
      "fees_in_baked",
      "fees_in_stolen",
      "fees_in_missed",
      "fees_in_not_revealed",
    ],
    [
      { field: "cycle", op: Operation.Equals, value: [cycle] },
      { field: "baker", op: Operation.Equals, value: [baker] },
    ]
  );
};

// Break down of blocks baked/missed/stolen
export const blockBreakDownInCycle = async (baker: string, cycle: number) => {
  return await getBakerInfo(
    server,
    "baker_performance",
    ["num_baked", "num_missed", "num_stolen"],
    [
      { field: "cycle", op: Operation.Equals, value: [cycle] },
      { field: "baker", op: Operation.Equals, value: [baker] },
    ]
  );
};

// Break down of endorsements made/missed
export const endorsementBreakDownInCycle = async (
  baker: string,
  cycle: number
) => {
  return await getBakerInfo(
    server,
    "baker_performance",
    [
      "high_priority_endorsements",
      "low_priority_endorsements",
      "missed_endorsements",
    ],
    [
      { field: "cycle", op: Operation.Equals, value: [cycle] },
      { field: "baker", op: Operation.Equals, value: [baker] },
    ]
  );
};

// List of delegators who delegated to the bake before the snapshot was taken at
// a certain cycle and are thus entitled to rewards
export const delegatorsExpectingRewardsFrom = async (baker, cycle) => {
  return await getBakerInfo(
    server,
    "delegate_history",
    ["delegator"],
    [
      { field: "cycle", op: Operation.Equals, value: [cycle] },
      { field: "baker", op: Operation.Equals, value: [baker] },
    ]
  );
};

function test() {
  const baker = "tz1Ldzz6k1BHdhuKvAtMRX7h5kJSMHESMHLC";
  const cycle = 300;

  bakerGradeInCycle(baker, cycle).then((data) => console.log("Grade:", data));
  bakerPayoutInCycle(baker, cycle).then((data) => console.log("Payout:", data));
  doubleBakingLossesInCycle(baker, cycle).then((data) =>
    console.log("Double baking losses:", data)
  );
  doubleEndorsingLossesInCycle(baker, cycle).then((data) =>
    console.log("Double endorsing losses:", data)
  );
  rewardsMadeInCycle(baker, cycle).then((data) =>
    console.log("Rewards:", data)
  );
  delegatorsExpectingRewardsFrom(baker, cycle).then((data) =>
    console.log("Delegators:", data)
  );
  feeBreakDownInCycle(baker, cycle).then((data) => console.log("Fees:", data));
  blockBreakDownInCycle(baker, cycle).then((data) =>
    console.log("Blocks:", data)
  );
  endorsementBreakDownInCycle(baker, cycle).then((data) =>
    console.log("Endorsements:", data)
  );
  getBakerStats(baker).then((d) => console.log("Stats: ", d));
}

test();
