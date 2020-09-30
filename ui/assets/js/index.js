const millisOneDay = 86400000;
const millisOneHour = millisOneDay / 24;
const millisOneMinute = millisOneHour / 60;
const millisOneSecond = millisOneMinute / 60;
const millisThirtyDays = millisOneDay * 30;

var clock;
var delegateAddress;
var bakerRegistry;

const performanceField = [
  "Cycle",
  "Blocks Baked",
  "Blocks Missed",
  "Blocks Stolen",
  "Endorsements",
  "Endorsements Missed",
];

const rewardField = [
  "Cycle",
  "Total Rewards",
  "Rewards Expected",
  "Rewards Received",
  "Advertised Fee",
  "Fee Taken",
];

// function changeURL(baker) {
//     var path = 
//     console.log(path)
//     // return  theURL.replace(/, '/baker');
//}

function UTCToDateTime(timestamp) {
  const dateNow = new Date(timestamp);
  const date =
    dateNow.getMonth() +
    1 +
    "-" +
    dateNow.getDate() +
    "-" +
    dateNow.getFullYear();
  const time =
    dateNow.getHours() +
    ":" +
    (dateNow.getMinutes() < 10
      ? "0" + dateNow.getMinutes()
      : dateNow.getMinutes()) +
    ":" +
    dateNow.getSeconds();
  return date + " " + time;
}

async function updatePayoutInfo(baker) {
  payout_response = (
    await getBakerInfo(
      "baker_payouts",
      ["payout"],
      [{ field: "baker", op: "eq", value: [baker] }]
    )
  )[0];
  document.getElementById("payout").value = payout_response
    ? payout_response.payout
    : "";
  let bakerInfo = !!payout_response.payout
    ? JSON.parse(await httpGet(`https://api.baking-bad.org/v2/bakers/${baker}`))
    : {
        fee: 0,
        payoutDelay: 0,
      };
  document.getElementById("fee").value = bakerInfo.fee;
  document.getElementById("payout_delay").value = bakerInfo.payoutDelay;
}

/**
 * This function is called on the onClick of the "Calculate Rewards!" button. It brings together, parses and
 * displays the data for the last 10 cycles onto a heatTable.
 * @todo refactor function into several smaller more manageable ones
 */
async function calculateRewardsForDelegate() {
  const head = await getBlock("head");
  const lastFullCycle = head.meta_cycle - 1;

  const delegator = document.getElementById("delegator").value;
  const fee = document.getElementById("fee").value;
  const payoutDelay = parseInt(document.getElementById("payout_delay").value);
  const payout = document.getElementById("payout").value;

  const undelegatedMsg =
    "You are not qualified for rewards from this baker at this cycle";
  const inProgressMsg = "Rewards payouts are still in progress for this cycle";
  tableHeader("rewards_table_header", rewardField, [
    false,
    false,
    false,
    false,
    false,
    false,
  ]);
  // Query snapshot_info for the proper staking balances
  let rewards = await getBakerInfo(
    "snapshot_info",
    ["cycle", "snapshot_block_level", "staking_balance"],
    [
      {
        field: "cycle",
        op: "between",
        value: [lastFullCycle - 9, lastFullCycle],
      },
      { field: "baker", op: "eq", value: [delegateAddress] },
    ]
  );

  // rewards.forEach((r) => (r.rewards = parseFloat(r.rewards.toFixed(6))));

  // Attain the rewards actually paid out using the payout structs
  calcRewards = await getBakerRewards(
    delegateAddress,
    lastFullCycle - 9,
    lastFullCycle
  );

  // Sum all of the fields in each payout scheme returned by getBakerRewards
  for (let i = 0; i < calcRewards.length; i++) {
    rewards[i]["rewards"] = Object.values(calcRewards[i]).reduce(
      (acc, curr) => parseFloat((acc + curr).toFixed(6)),
      0
    );
  }

  // Slice the rewards to only have the rows in which data was available for
  rewards = rewards.slice(0, calcRewards.length);

  // Get the delegations rights for the last 10 cycles
  const delegations = await getBakerInfo(
    "delegate_history",
    ["cycle", "baker"],
    [
      { field: "delegator", op: "eq", value: [delegator] },
      {
        field: "cycle",
        op: "between",
        value: [lastFullCycle - 9, lastFullCycle],
      },
      { field: "baker", op: "eq", value: [delegateAddress] },
    ],
    { field: "cycle", dir: "asc" }
  );
  const delegation_cycles = delegations ? delegations.map((d) => d.cycle) : [];

  const ifFeesDeducted = await getIfFeesDeducted(delegateAddress,
						 (lastFullCycle - 9) + payoutDelay,
						 lastFullCycle + payoutDelay)
  // Populate rewards with additional fields which are needed in the table
  for (d of rewards) {
    let delegateBalance = await getBalanceAtLevel(
      delegator,
      d.snapshot_block_level - 1
    );
    const deductFees = ifFeesDeducted.find(entry => entry.cycle == d.cycle + payoutDelay).value
    let paymentSent = await tezTransferedBetween(
      payout,
      delegator,
      d.cycle + payoutDelay
    );
    const rewardsReceived = paymentSent.sum_amount + (deductFees ? paymentSent.sum_fee : 0)
    d["advertised_fee"] = parseFloat((fee * 100).toFixed(2));

    // if the delegator has rewards rights in the cycle, make the necessary calculations
    if (delegation_cycles.includes(d.cycle)) {
      d["delegator_rewards"] = (
        d.rewards *
        (1 - fee) *
        (delegateBalance / d.staking_balance)
      ).toFixed(6);

      // If the delegator isn't expected to have made payouts yet, display message
      if (lastFullCycle + 1 < payoutDelay + d.cycle && !rewardsReceived) {
        d["delegator_rewards_received"] = "...";
        d["actual_fee"] = "...";
      } else {
        d["delegator_rewards_received"] = convertFromUtezToTez(rewardsReceived);
        d["actual_fee"] = parseFloat(
          (
            -1 *
            ((convertFromUtezToTez(rewardsReceived) / d.rewards) *
              (d.staking_balance / delegateBalance) -
              1) *
            100
          ).toFixed(2)
        );
      }
    } else {
      d["delegator_rewards"] = "*";
      d["delegator_rewards_received"] = "*";
      d["actual_fee"] = "*";
    }
  }

  // The first object in the array is used for the titles of columns. Since rewards array is reversed later
  // the last item becomes the first
  rewards.push({
    cycle: "Cycle",
    rewards: "Total Baker Rewards Earned",
    staking_balance: "Staking Balance",
    delegator_rewards: "Delegator Rewards",
    delegator_rewards_received: "Payments Received",
    advertised_fee: "Advertised Fee",
    actual_fee: "Actual Fee Taken",
  });

  heatTableFields = [
    "cycle",
    "rewards",
    "delegator_rewards",
    "delegator_rewards_received",
    "advertised_fee",
    "actual_fee",
  ];

  const colorMappings = {
    delegator_rewards: TEAL[7],
    rewards: TEAL[7],
  };

  heatTable(
    "rewards_table",
    rewards.reverse(),
    heatTableFields,
    colorMappings,
    [
      ["delegator_rewards", "delegator_rewards_received"],
      ["advertised_fee", "actual_fee", "inverse"],
    ],
    [
      { identifier: "*", message: undelegatedMsg },
      { identifier: "...", message: inProgressMsg },
    ]
  );
}

/**
 * Used to update the countdown timers found on the page and update the page when it reaches 0
 *
 * @param {number} timestamp - the timestamp to count down to
 * @param {string} baker - the address of the current baker being displayed
 */

function updateCountdown(timestamp, baker) {
  if (timestamp == "none") {
    set("baker_next_bake", `Some time ...`);
    return;
  }
  let timeLeft = timestamp - Date.now();

  // If the timer reaches 0, update the page
  if (timeLeft <= 0) {
    updateBakerInfo(baker);
    updateNetworkInfo();
    return;
  }

  const days = Math.floor(timeLeft / millisOneDay);
  timeleft = timeLeft % millisOneDay;
  const hours = Math.floor(timeLeft / millisOneHour);
  timeLeft = timeLeft % millisOneHour;
  const minutes = Math.floor(timeLeft / millisOneMinute);
  timeLeft = timeLeft % millisOneMinute;
  const seconds = Math.floor(timeLeft / millisOneSecond);

  // modified
  set("baker_next_bake", `${UTCToDateTime(timestamp)}`);
  clock = setTimeout(updateCountdown, 1000, timestamp, baker);
}

/**
 * A helper function to get the max/min of a list of fees
 *
 * @param {Array.<Object>} bakers - a list of baker objects
 * @param {function(number, number)} predicate - a comparing function to use in the search
 * @todo replace all usage of this with .filter() instead
 */
function getFee(bakers, predicate) {
  let king = bakers[0];
  for (let i = 1; i < bakers.length; i++) {
    king = predicate(bakers[i].fee, king.fee) == king.fee ? king : bakers[i];
  }
  return king;
}

function updateNextBakeStats(baker) {
  nextBake(baker).then((d) => {
    clearTimeout(clock);
    updateCountdown(d.estimated_time, baker);
    set("baker_next_bake_level", `${d.level}`);
  });
}

function set(id, value) {
  document.getElementById(id).innerHTML = value;
}

let getMean = function (data) {
  return (
    data.reduce(function (a, b) {
      return Number(a) + Number(b);
    }, "") / data.length
  );
};

let getSD = function (data) {
  let m = getMean(data);
  return Math.sqrt(
    data.reduce(function (sq, n) {
      return sq + Math.pow(n - m, 2);
    }, 0) /
      (data.length - 1)
  );
};

const onSearch = () => {
  const val = document.getElementById("baker").value;
  updateBakerInfo(val);
}

/**
 * Updates all of the panels except for "Network Info" on the page
 * @params {string} baker - the baker to display all of the information for
 */

async function updateBakerInfo(baker, delegator=null) {
  const head = await getBlock("head");
  const timeNow = head.timestamp;
  const lastFullCycle = head.meta_cycle - 1;
  let stakingBalance = 0;
  let numBlocksBaked = 0;
  let numBlocksBakedLastCycle = 0;

  // Use Baking Bad to convert address into a name if it exists
  // let bakerRegistry = JSON.parse(
  //   await httpGet(`https://api.baking-bad.org/v2/bakers`)
  // );
  let searchRegistry = (pkh) =>
    bakerRegistry.find((baker) => baker.address == pkh) || { name: pkh };
  let getAddressFromName = (name) =>
    bakerRegistry.find(
      (baker) => baker.name.toLowerCase() == name.toLowerCase()
    ) || { address: '' };

  const isBakerAddress = await isBaker(baker).catch(() => false);
  if(!baker.toLowerCase().startsWith('tz') && !baker.toLowerCase().startsWith('kt')) {
    baker = getAddressFromName(baker).address;
  } else if(!isBakerAddress && !delegator) {
    updateBakerInfo(await lastDelegateFor(baker), baker)
    return;
  } // else if(!isBakerAddress && !!delegator) {
  //   updateBakerInfo((await getBlock("head")).baker)
  //   return;
  // }
    
  if( baker.length !== 36 ) {
    updateBakerInfo((await getBlock("head")).baker)
    return;
  }
  history.pushState(null, '', `/${baker}`);    
   
  // if ((baker.charAt(0) != "t" && baker.charAt(0) != "K") || baker.length != 36)	return;

  // Check to see if the address is a regular account. If it is, show the page for
  // that account's delegate

  // If delegator is set, autofill the field, else clear it
  document.getElementById("delegator").value = delegator ? delegator : ""

  delegateAddress = baker;
  updatePayoutInfo(baker);

  // Creates n equally spaced timestamps in the last month. This is then used to get the data points
  // for the blocks per hour graph
  const createGraphTimestamps = (n) =>
    Array.from(Array(n).keys())
      .map((i) => (millisThirtyDays / (n - 1)) * (n - 1 - i))
      .map((i) => timeNow - i);

  blocksBakedPerHour(baker, createGraphTimestamps(16)).then((d) =>
    linegraph(
      "blocks_per_hour_graph",
      d,
      { x: "timestamp", y: "blocksPerHour" },
      [0, Math.max(...d.map((r) => r.blocksPerHour))],
      true,
      true
    )
  );

  const bakerPerformanceFields = [
    "cycle",
    "num_baked",
    "num_missed",
    "num_stolen",
    "high_priority_endorsements",
    "low_priority_endorsements",
    "missed_endorsements",
  ];

  // Set the baker name/address on top and anchor
  httpGet(`https://api.baking-bad.org/v2/bakers/${baker}`).then((d) =>
    d == ""
      ? (set("baker_name", "Baker"), set("baker_hash", baker))
      : (set("baker_name", JSON.parse(d).name), set("baker_hash", baker))
  );

  // Create the block performance heat table
  getBakerInfo("baker_performance", bakerPerformanceFields, [
    {
      field: "cycle",
      op: "between",
      value: [lastFullCycle - 9, lastFullCycle],
    },
    { field: "baker", op: "eq", value: [baker] },
  ]).then((d) => {
    const columnTitles = {
      cycle: "Cycle",
      num_baked: "Blocks Baked",
      num_missed: "Blocks Missed",
      num_stolen: "Blocks Stolen",
      endorsements: "Endorsements",
      missed_endorsements: "Endorsements Missed",
    };
    d.forEach(
      (entry) =>
        (entry["endorsements"] =
          entry.high_priority_endorsements + entry.low_priority_endorsements)
    );
    d.push(columnTitles);
    const colorMappings = {
      num_baked: TEAL[7],
      num_missed: BRICK_RED[7],
      num_stolen: DARK_BLUE[7],
      endorsements: TEAL[7],
      missed_endorsements: BRICK_RED[7],
    };

    heatTable(
      "performance_table",
      d.reverse(),
      [
        "cycle",
        "num_baked",
        "num_missed",
        "num_stolen",
        "endorsements",
        "missed_endorsements",
      ],
      colorMappings
    );
  });

  // Create the rewards heat table
  tableHeader(
    "rewards_table_header",
    rewardField,
    [false, false, false, false, false, false],
    [false, false, true, true, true, true]
  );

  heatTableFields = [
    "cycle",
    "rewards",
    "snapshot_index",
    "snapshot_block_level",
    "staking_balance",
    "delegated_balance",
  ];

  getBakerInfo(
    "snapshot_info",
    ["cycle", "rewards"],
    [
      {
        field: "cycle",
        op: "between",
        value: [lastFullCycle - 9, lastFullCycle],
      },
      { field: "baker", op: "eq", value: [baker] },
    ]
  ).then((d) => {
    set(
      "baker_rewards",
      `${convertFromUtezToTez(d[d.length - 1].rewards).toFixed(2)} XTZ`
    );
    set("baker_rewards_title", `Rewards Made in Cycle ${lastFullCycle}`);
    d.forEach((r) => (r.rewards = convertFromUtezToTez(r.rewards)));
    linegraph(
      "rewards_chart",
      d,
      { x: "cycle", y: "rewards" },
      [0, Math.max(...d.map((r) => r.rewards))],
      false
    );
    d.push({
      cycle: "Cycle",
      rewards: "Total Rewards",
      snapshot_index: "Rewards Expected",
      snapshot_block_level: "Rewards Received",
      staking_balance: "Advertised Fee",
      delegated_balance: "Actual Fee Taken",
    });

    heatTable("rewards_table", d.reverse(), heatTableFields, {
      rewards: TEAL[7],
    });
  });

  // Set the baker grade for baker
  getBakerInfo(
    "baker_performance",
    ["baker", "grade", "cycle"],
    [{"field":"cycle", "op":"lt", "value":[lastFullCycle+1]}],
		 {"field":"cycle", "dir":"desc"}
  ).then((d) => {
    const cycle = d[0]["cycle"]
	  let values = d.filter(item => item.cycle == cycle)
		.map(item => item.grade)
		.sort((a, b) => a - b)
    const fivePercent = Math.round(values.length * 0.05);
    values = values.slice(fivePercent, values.length - fivePercent);
    const standardDeviation = getSD(values);
    const avg = getMean(values);
    const bakerGrade = (d.find((entry) => entry.baker == baker) || { grade: 0 })
      .grade;
    const numDeviations = (bakerGrade - avg) / standardDeviation;
    let letterGrade = "F";
    if (numDeviations > 2) letterGrade = "A+";
    else if (numDeviations > 1) letterGrade = "A";
    else if (numDeviations > 0.5) letterGrade = "B+";
    else if (numDeviations > 0) letterGrade = "B";
    else if (numDeviations > -1) letterGrade = "C";
    else if (numDeviations > -1.5) letterGrade = "D";
    else letterGrade = "F";
    set("baker_grade", `${letterGrade}`);
  });

  // Set last baked fields
  lastBlockBakedBy(baker).then((d) => {
    set("baker_last_bake", `${d ? UTCToDateTime(d.timestamp) : "Never baked"}`);
    set("baker_last_bake_level", `${d ? d.level : "Never baked"}`);
  });

  // Populate the "Bakers by Staking Balances" stacked bar chart
  getBakerAccount().then(async function (d) {
    // only use top 100 bakers
    let topHundred = d.slice(0, 100);

    // Label each of the bakers
    // the label is of the form "#<number> <name> (<address>)"
    topHundred.forEach((baker, i) => {
      baker["name"] = `#${i + 1} ${searchRegistry(baker.pkh).name}`;
      baker["staking_balance"] = convertFromUtezToTez(baker.staking_balance);
      baker["name"] += ` (${baker.staking_balance.toFixed(2)} XTZ)`;
    });

    // If the current baker isn't in the top 100, then add it to the list and label it
    // Also flag the current baker as the default
    if (!topHundred.map((d) => d.pkh).includes(baker)) {
      let bakerAcc = await getBakerAccount(baker);
      bakerAcc.name =
        `#${d.findIndex((baker) => baker.pkh == bakerAcc.pkh) + 1} ` +
        searchRegistry(bakerAcc.pkh).name;
      bakerAcc.staking_balance = convertFromUtezToTez(bakerAcc.staking_balance);

      // Flag baker as the default (stackedBarGraph uses this for the visualization)
      bakerAcc["default"] = "true";
      topHundred.push(bakerAcc);
    } else topHundred.find((d) => d.pkh == baker)["default"] = "true";

    // Create the stacked bar graph
    stackedBarGraph(
      `staking_balances_chart`,
      topHundred,
      { x: "staking_balance", y: "name" },
      10,
      "anchor_balances",
      (d) => updateBakerInfo(d.pkh)
    );
    // stackedBarGraph(`staking_balances_chart`, topHundred, {x:"staking_balance", y:"name"}, 10, d => updateBakerInfo(d.pkh));
  });

  // Populate the "Bakers by Blocks Baked" stacked bar chart
  numBlocksBakedBy("all", lastFullCycle).then((d) => {
    // If the baker isn's in the array, add it with 0 blocks baked
    if (!d.map((d) => d.baker).includes(baker))
      d.push({ name: baker, baker: baker, count_hash: 0 });

    // Label the bakers. Labels are of the form "#<number> <name> (<address>)"
    d.forEach((baker, i) => {
      baker["name"] = `#${i + 1} ${searchRegistry(baker.baker).name}`;
      baker["name"] += ` (${baker.count_hash})`;
    });

    // Flag baker as the default (stackedBarGraph uses this for the visualization)
    d.find((d) => d.baker == baker)["default"] = "true";
    stackedBarGraph(
      `num_blocks_baked_chart`,
      d,
      { x: "count_hash", y: "name" },
      10,
      "anchor_baked",
      (d) => updateBakerInfo(d.baker)
    );
  });

  // Set balance data of the baker
  getBakerAccount(baker)
    .then((d) => {
      stakingBalance = convertFromUtezToTez(d.staking_balance).toFixed(2);
      set("baker_amount_staked", `${stakingBalance} XTZ`);
      set(
        "baker_amount_delegated",
        `${convertFromUtezToTez(d.delegated_balance).toFixed(2)} XTZ`
      );
      return numBlocksBakedBy(baker);
    })
    .then((d) => {
      set(
        "baker_blocks_baked",
        `${d ? d.count_hash + " Blocks" : "never baked"}`
      );
      set("baker_blocks_per_stake", `${d ? d.count_hash / stakingBalance : 0}`);
    });

  // Set delegator data of the baker
  getDelegators(baker).then((d) =>
    set("baker_num_delegators", `${Object.keys(d).length} Delegators`)
  );

  // Start the countdown until the next block baked
  nextBake(baker).then((d) => {
    clearTimeout(clock);
    updateCountdown(d ? d.estimated_time : "none", baker);
    set("baker_next_bake_level", `${d ? d.level : "Some time ..."}`);
  });

  // Create the blocks missed chainmap (bar graph)
  blocksMissedBy(baker, lastFullCycle).then((d) => {
    d.forEach((block) => (block["label"] = `Level: ${block.meta_level}`));
    chainmap(
      "blocks_missed_chart",
      d,
      { x: "meta_cycle_position", y: "label" },
      blocksPerCycle,
      BRICK_RED,
      " Block(s) missed",
      true,
      "baker_blocks_missed"
    );
  });

  // Create the blocks baked chainmap (bar graph)
  blocksStolenBy(baker, lastFullCycle).then((d) => {
    d.forEach((block) => (block["label"] = `Level: ${block.meta_level}`));
    set("baker_production", `Block Production In Cycle ${lastFullCycle}`);
    chainmap(
      "blocks_stolen_chart",
      d,
      { x: "meta_cycle_position", y: "label" },
      blocksPerCycle,
      DARK_BLUE,
      " Block(s) stolen",
      true,
      "baker_blocks_stolen"
    );
  });

  // Create the blocks missed chainmap (bar graph)
  blocksBakedBy(baker, lastFullCycle).then(async function (d) {
    const percentStaked =
      (await getRollsStaked(baker)) / (await getRollsStaked());
    const percentBaked = d.length / blocksPerCycle;
    d.forEach((block) => (block["label"] = `${block.meta_level}`));
    chainmap(
      "blocks_baked_chart",
      d,
      { x: "meta_cycle_position", y: "label" },
      blocksPerCycle,
      TEAL,
      " Block(s) baked",
      true,
      "baker_blocks_baked_last_cycle"
    );
  });
}

/**
 * Updates the Network Info" on the page
 */

 // should be modified
async function updateNetworkInfo() {
  const response = await httpGet(
    "https://min-api.cryptocompare.com/data/price?fsym=XTZ&tsyms=USD"
  );
  const conversionRate = JSON.parse(response).USD;
  getTezInCirculation().then((totalTez) => {});

  getBlock("head")
    .then((head) => {
      set("current_cycle", `Current Cycle: ${head.meta_cycle}`);
      set("net_level", `Current level: ${head.level}`);
      return numBlocksBakedFrom(head.timestamp - millisOneHour);
    })
    .then((blocksLastHour) => {});

  httpGet("https://api.baking-bad.org/v2/bakers").then((data) => {
    const bakerRegistry = JSON.parse(data);
    const maxFeeBaker = getFee(bakerRegistry, Math.max);
    const minFeeBaker = getFee(bakerRegistry, Math.min);
    const averageFee = (
      bakerRegistry.map(({ fee }) => fee).reduce((a, b) => a + b, 0) /
      bakerRegistry.length
    ).toFixed(2);
  });
}

const tableHeader = (id, tableField, info = [], disable = []) => {
  let headerList = "";
  tableField.forEach((field, index) => {
    headerList += `<p class="middle-middle subtitle-text weight-500 ${
      !!info[index] ? "info-cell" : ""
    } ${!!disable[index] ? "disabled-cell" : ""}">${field}</p>`;
  });
  document.getElementById(id).innerHTML = headerList;
};

async function initialize() {
  bakerRegistry = JSON.parse(
    await httpGet(`https://api.baking-bad.org/v2/bakers`)
  );
  updateNetworkInfo();
  tableHeader("performance_table_header", performanceField);
  tableHeader(
    "rewards_table_header",
    rewardField,
    [],
    [false, false, true, true, true, true]
  );

  const path = window.location.pathname.split('/');
  if (path[path.length-1] != "")
    updateBakerInfo(path[path.length-1]);
  else
    getBlock("head").then((head) => updateBakerInfo(head.baker));
  setTimeout(updateNetworkInfo, 60000);
}

const copyToClipBoard = (copyPanel) => {
  let str = document.querySelector(`.${copyPanel}`).textContent;
  const el = document.createElement("textarea");
  el.value = str;
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
};

const debounce = (func, wait, immediate)=> {
  let timeout;

  return function executedFunction() {
    let context = this;
    let args = arguments;
        
    const later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };

    const callNow = immediate && !timeout;
    
    clearTimeout(timeout);

    timeout = setTimeout(later, wait);
    
    if (callNow) func.apply(context, args);
  };
};

function autocomplete(inp) {
  /*the autocomplete function takes two arguments,
  the text field element and an array of possible autocompleted values:*/
  let currentFocus;
  const getAccountsFromServer = async (val, isName) => {
    const arr = bakerRegistry.filter((item) => {
      return item.address.toLowerCase().startsWith(val) || item.name.toLowerCase().includes(val)
    })
    // const arr = await getAccounts(val).catch(() => []);
    currentFocus = -1;
      /*create a DIV element that will contain the items (values):*/
      const a = document.createElement("DIV");
      a.setAttribute("id", "autocomplete-list");
      a.setAttribute("class", "autocomplete-items");
      /*append the DIV element as a child of the autocomplete container:*/
      const parentInput = document.getElementById("search-container");
      parentInput.appendChild(a);
      /*for each item in the array...*/
      for (let i = 0; i < arr.length; i++) {
        /*check if the item starts with the same letters as the text field value:*/
        // if (arr[i].address.substr(0, val.length).toUpperCase() == val.toUpperCase()) {
          /*create a DIV element for each matching element:*/
          const b = document.createElement("DIV");
          /*make the matching letters bold:*/
          if(!isName) {
            b.innerHTML = "<strong>" + arr[i].address.substr(0, val.length) + "</strong>";
            b.innerHTML += `${arr[i].address.substr(val.length)} (${arr[i].name})`;
          } else {
            b.innerHTML = "<strong>" + arr[i].name.substr(0, val.length) + "</strong>";
            b.innerHTML += `${arr[i].name.substr(val.length)} (${arr[i].address})`;
          }
         
          /*insert a input field that will hold the current array item's value:*/
          b.innerHTML += "<input type='hidden' value='" + arr[i].address + "'>";
          /*execute a function when someone clicks on the item value (DIV element):*/
          b.addEventListener("click", (e) => {
              /*insert the value for the autocomplete text field:*/
              inp.value = arr[i].address;
              updateBakerInfo(arr[i].address)
              /*close the list of autocompleted values,
              (or any other open lists of autocompleted values:*/
              closeAllLists();
              currentFocus = -1;
          });
          a.appendChild(b);
        // }
      }
  };
  const autocompleteSearchDebounce = debounce(getAccountsFromServer, 300);
  /*execute a function when someone writes in the text field:*/
  inp.addEventListener("input", (e) => {
      let val = document.getElementById("baker").value;
      /*close any already open lists of autocompleted values*/
      closeAllLists();
      const isCheck = val.toLowerCase().startsWith('tz');
      if(!val || val.length < 3 || val.length < 5 && isCheck) {
        return false;
      }
      autocompleteSearchDebounce(val.toLowerCase(), !isCheck);
  });
  /*execute a function presses a key on the keyboard:*/
  inp.addEventListener("keydown", function(e) {
    let x = document.getElementById("autocomplete-list");
    if (x) x = x.getElementsByTagName("div");
    if (e.keyCode == 40) {
      /*If the arrow DOWN key is pressed,
      increase the currentFocus variable:*/
      currentFocus++;
      /*and and make the current item more visible:*/
      addActive(x);
    } else if (e.keyCode == 38) { //up
      /*If the arrow UP key is pressed,
      decrease the currentFocus variable:*/
      currentFocus--;
      /*and and make the current item more visible:*/
      addActive(x);
    } else if (e.keyCode == 13) {
      /*If the ENTER key is pressed, prevent the form from being submitted,*/
      e.preventDefault();
      if (currentFocus > -1) {
        /*and simulate a click on the "active" item:*/
        if (x) x[currentFocus].click();
      } else {
        let val = document.getElementById("baker").value;
        updateBakerInfo(val);
      }
    }
  });
  function addActive(x) {
    /*a function to classify an item as "active":*/
    if (!x) return false;
    /*start by removing the "active" class on all items:*/
    removeActive(x);
    if (currentFocus >= x.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (x.length - 1);
    /*add class "autocomplete-active":*/
    x[currentFocus].classList.add("autocomplete-active");
  }
  function removeActive(x) {
    /*a function to remove the "active" class from all autocomplete items:*/
    for (let i = 0; i < x.length; i++) {
      x[i].classList.remove("autocomplete-active");
    }
  }
  function closeAllLists(elmnt) {
    /*close all autocomplete lists in the document,
    except the one passed as an argument:*/
    const x = document.getElementsByClassName("autocomplete-items");
    for (let i = 0; i < x.length; i++) {
      if (elmnt != x[i] && elmnt != inp) {
        x[i].parentNode.removeChild(x[i]);
      }
    }
  }

  
  /*execute a function when someone clicks in the document:*/
  document.addEventListener("click", function (e) {
      closeAllLists(e.target);
  });
}

autocomplete(document.getElementById("baker"));
const link1 = `https://arronax.io/tezos/mainnet/bakers/query/eyJmaWVsZHMiOlsicGtoIiwiYmFsYW5jZSIsImRlbGVnYXRlZF9iYWxhbmNlIiwic3Rha2luZ19iYWxhbmNlIiwiY3ljbGUiXSwicHJlZGljYXRlcyI6W3siZmllbGQiOiJkZWFjdGl2YXRlZCIsIm9wZXJhdGlvbiI6ImVxIiwic2V0IjpbImZhbHNlIl0sImludmVyc2UiOmZhbHNlfSx7ImZpZWxkIjoicm9sbHMiLCJvcGVyYXRpb24iOiJndCIsInNldCI6WzBdLCJpbnZlcnNlIjpmYWxzZX1dLCJvcmRlckJ5IjpbeyJmaWVsZCI6InN0YWtpbmdfYmFsYW5jZSIsImRpcmVjdGlvbiI6ImRlc2MifV0sImFnZ3JlZ2F0aW9uIjpbXSwibGltaXQiOjEwMDB9`;

const gotoArronax1 = () => {
  window.open(link1);
}

async function gotoArronax2() {
  const head = await getBlock("head");
  const lastFullCycle = head.meta_cycle - 1;
  const link2 = makeLink(lastFullCycle);
  window.open(link2);
}

const periLink1 = 'https://periscope.arronax.io/bakers?q=topStakers';
const periLink2 = 'https://periscope.arronax.io/bakers?q=topBlockers';
const gotoPeri1 = () => {
  window.open(periLink1);
}

const gotoPeri2 = () => {
  window.open(periLink2);
}

const gotoCryptonomic = () => {
  window.open('https://cryptonomic.tech/')
}
