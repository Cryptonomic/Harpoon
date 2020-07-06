const millisOneDay = 86400000
const millisOneHour = millisOneDay/24
const millisThirtyDays = millisOneDay * 30
var clock
var delegateAddress

function convertFromUtezToTez(amountInUtez) {
    const tezAmount = amountInUtez / 1000000
    return tezAmount
}

function UTCToDateTime(timestamp) {
    const dateNow = new Date(timestamp);
    const date  = dateNow.getMonth()+1 + "-" + dateNow.getDate() + "-" + dateNow.getFullYear();
    const time = dateNow.getHours() +
	  ":" + ((dateNow.getMinutes() < 10) ? "0" + dateNow.getMinutes() : dateNow.getMinutes()) +
	  ":" + dateNow.getSeconds();
    return date + " " + time
}

async function httpGet(theUrl) {
    return new Promise( function(resolve, reject) {
	var xmlHttp = new XMLHttpRequest();
	xmlHttp.onreadystatechange = function() { 
	    if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
		resolve(xmlHttp.responseText);
	    else if(xmlHttp.readyState == 4 && xmlHttp.status == 204) {
		resolve("")
	    }
	}
	xmlHttp.open("GET", theUrl, true); // true for asynchronous 
	xmlHttp.send(null);
    });
}

async function httpPost(theUrl, params) {
    return new Promise( function(resolve, reject) {
	var xmlHttp = new XMLHttpRequest();
	xmlHttp.onreadystatechange = function() { 
	    if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
		resolve(xmlHttp.responseText);
	    else if(xmlHttp.readyState == 4 && xmlHttp.status == 204) {
		resolve("")
	    }
	}
	xmlHttp.open("POST", theUrl, true); // true for asynchronous 
	xmlHttp.setRequestHeader('Content-type', 'application/json;charset=UTF-8');
	xmlHttp.send(params);
    });
}

async function getBakerInfo(table, fields, predicates, orderby) {
    let query = { "table": table, "fields": fields };
    if (predicates) query["predicates"] = predicates;
    if (orderby) query["orderby"] = orderby;
    const result = await httpPost(microseilServer, JSON.stringify(query));
    return JSON.parse(result)
}

async function updatePayoutInfo(baker) {
    payout_response = (await getBakerInfo("baker_payouts",
				 ["payout"],
				 [{"field":"baker", "op":"eq", "value":[baker]}]
				))[0]
    document.getElementById("payout").value = payout_response ? payout_response.payout : ""
    document.getElementById("fee").value = JSON.parse(await httpGet(`https://api.baking-bad.org/v2/bakers/${baker}`)).fee;
    document.getElementById("payout_delay").value = JSON.parse(
	await httpGet(`https://api.baking-bad.org/v2/bakers/${baker}`)
    ).payoutDelay;
}

async function calculateRewardsForDelegate() {
    const head = await getBlock("head");
    const lastFullCycle = head.meta_cycle - 1;
    const delegator = document.getElementById("delegator").value
    const fee = document.getElementById("fee").value
    const payoutDelay = parseInt(document.getElementById("payout_delay").value)
    const payout = document.getElementById("payout").value
    const undelegatedMsg = "You were not qualified for rights at this cycle"
    const inProgressMsg = "Rewards payouts are still in progress for this cycle"

    let rewards = await getBakerInfo("snapshot_info",
				     ["cycle", "rewards", "snapshot_block_level", "staking_balance"],
				     [{"field":"cycle", "op":"between", "value":[lastFullCycle-9,lastFullCycle]},
				      {"field":"baker", "op":"eq", "value":[delegateAddress]}]);
    console.log(rewards)
    const delegations = await getBakerInfo("delegate_history", ["cycle", "baker"],
					   [{"field":"delegator", "op":"eq", "value":[delegator]},
					    {"field":"cycle", "op":"between", "value":[lastFullCycle-7, lastFullCycle]},
					    {"field":"baker", "op":"eq", "value":[delegateAddress]}],
					   {"field":"cycle", "dir":"asc"});

    const delegation_cycles = delegations ? delegations.map(d => d.cycle): []
    console.log("hi")
    console.log(delegation_cycles)
    console.log(lastFullCycle)
    for (d of rewards) {
	let delegateBalance = await getBalanceAtLevel(delegator, d.snapshot_block_level - 1)
	let rewardsReceived = await tezTransferedBetween(payout, delegator, d.cycle+payoutDelay); 
	console.log(payoutDelay)
	console.log(rewardsReceived)
	console.log(payout)
	d["advertised_fee"] = parseFloat((fee * 100).toFixed(2))
	
	if (delegation_cycles.includes(d.cycle)) {
	    d["delegator_rewards"] = delegateBalance ? convertFromUtezToTez(d.rewards * (1 - fee) *
									    (delegateBalance/d.staking_balance)).toFixed(6) : "--"

	    if (lastFullCycle > payoutDelay + d.cycle && !rewardsReceived) {
		d["delegator_rewards_received"] = "..."
		d["actual_fee"] = "..."
	    }
	    else {
		d["delegator_rewards_received"] = convertFromUtezToTez(rewardsReceived)
		d["actual_fee"] = parseFloat(((-1) * ((rewardsReceived/d.rewards)*
						      (d.staking_balance/delegateBalance) - 1) * 100)
					     .toFixed(2))
	    }
	}
	else {
	    d["delegator_rewards"] =  "*"
	    d["delegator_rewards_received"] = "*"
	    d["actual_fee"] = "*"
	}
    }	
    rewards.forEach(d => d.rewards = convertFromUtezToTez(d.rewards).toFixed(2));
    rewards.push({cycle:"Cycle", rewards:"Total Baker Rewards Earned",
    		  staking_balance:"Staking Balance", delegator_rewards:"Delegator Rewards",
		  delegator_rewards_received:"Payments Received", advertised_fee:"Advertised Fee",
		  actual_fee:"Actual Fee Taken"});
    heatTable("rewards_table",
	      rewards.reverse(),
	      ["cycle", "rewards", "delegator_rewards", "delegator_rewards_received", "advertised_fee", "actual_fee"],
	      "rewards",
	      [["delegator_rewards", "delegator_rewards_received"], ["advertised_fee", "actual_fee", "inverse"]],
	      [{identifier:"*", message: undelegatedMsg},
	       {identifier:"...", message:inProgressMsg}]);
}

async function getBakerConfig(baker) {
    const rewardStruct = JSON.parse(await httpGet(`https://api.baking-bad.org/v2/bakers/${delegateAddress}`)).config.rewardStruct
    let extRewardStruct = {
	blocks: (rewardStruct & 1) > 0,
	endorses: (rewardStruct & 2) > 0,
	fees: (rewardStruct & 4) > 0,
	accusationRewards: (rewardStruct & 8) > 0,
	accusationLostDeposits: (rewardStruct & 16) > 0,
	accusationLostRewards: (rewardStruct & 32) > 0,
	accusationLostFees: (rewardStruct & 64) > 0,
	revelationRewards: (rewardStruct & 128) > 0,
	revelationLostRewards: (rewardStruct & 256) > 0,
	revelationLostFees: (rewardStruct & 512) > 0,
	missedBlocks: (rewardStruct & 1024) > 0,
	stolenBlocks: (rewardStruct & 2048) > 0,
	missedEndorses: (rewardStruct & 4096) > 0,
	lowPriorityEndorses: (rewardStruct & 8192) > 0,
    }
}

function updateCountdown(timestamp, baker) {
    if (timestamp == "none") {
	set("baker_next_bake", `Time until next bake: Some time in the distant future...`);
	return;
    }
    let timeLeft = timestamp - Date.now()
    if (timeLeft <= 0) {
	updateBakerInfo(baker);
	updateNetworkInfo();
	return;
    }
    const millisOneDay = 86400000
    const millisOneHour = millisOneDay/24
    const millisOneMinute = millisOneHour/60
    const millisOneSecond = millisOneMinute/60

    const days = Math.floor(timeLeft/millisOneDay)
    timeleft = timeLeft % millisOneDay
    const hours = Math.floor(timeLeft / millisOneHour)
    timeLeft = timeLeft % millisOneHour
    const minutes = Math.floor(timeLeft / millisOneMinute)
    timeLeft = timeLeft % millisOneMinute
    const seconds = Math.floor(timeLeft / millisOneSecond)

    set("baker_next_bake", `Time until next bake: ${days} days ${hours} hours ${minutes} minutes ${seconds} seconds`)
    clock = setTimeout(updateCountdown, 1000, timestamp, baker)
}

function getFee(bakers, predicate) {
    let king = bakers[0]
    for (let i=1; i < bakers.length; i++) {
	king = (predicate(bakers[i].fee, king.fee) == king.fee) ?
	    king :
	    bakers[i]
    }
    return king
}

function updateNextBakeStats(baker) {
    nextBake(baker)
	.then(d => {
	    clearTimeout(clock)
	    updateCountdown(d.estimated_time, baker)
	    set("baker_next_bake_level", `Level of next bake: ${d.level}`);
	});
}
function set(id, value) {
    document.getElementById(id).innerHTML = value
}

let getMean = function (data) {
    return data.reduce(function (a, b) {
        return Number(a) + Number(b);
    }) / data.length;
};

let getSD = function (data) {
    let m = getMean(data);
    return Math.sqrt(data.reduce(function (sq, n) {
            return sq + Math.pow(n - m, 2);
        }, 0) / (data.length - 1));
};

async function updateBakerInfo(baker) {
    const head = await getBlock("head");
    const timeNow = head.timestamp;
    const lastFullCycle = head.meta_cycle - 1;
    let stakingBalance = 0;
    let numBlocksBaked = 0;
    let numBlocksBakedLastCycle = 0;
    let bakerRegistry = JSON.parse(await httpGet(`https://api.baking-bad.org/v2/bakers`));
    let searchRegistry = pkh => bakerRegistry.find(baker => baker.address == pkh) || {"name":pkh};
    let getAddressFromName = name => bakerRegistry.find(baker => baker.name.toLowerCase() == name.toLowerCase()) || {"address": name}
    const createGraphTimestamps = ((n) => Array.from(Array(n).keys())
				   .map((i) => (millisThirtyDays / (n-1)) * (n-1-i))
				   .map((i) => (timeNow - i)))
    baker = getAddressFromName(baker).address
    if (baker.charAt(0) != "t") return;
    delegateAddress = baker
    updatePayoutInfo(baker)
    httpGet(`https://api.baking-bad.org/v2/bakers/${baker}`)
	.then(d => d == "" ? set("baker_name", baker) : set("baker_name",
							    JSON.parse(d).name + `<h5 style="margin-top:10"> (${baker}) </h5>`)
	     );
    getBakerInfo("baker_performance", ["cycle","num_baked", "num_missed", "num_stolen"],
		 [{"field":"cycle", "op":"between", "value":[lastFullCycle-9, lastFullCycle]},
		  {"field":"baker", "op":"eq", "value":[baker]}])
    	.then(d => {
	    d.push({"cycle":"Cycle", "num_baked":"Blocks Baked",
		    "num_missed":"Blocks Missed", "num_stolen":"Blocks Stolen"})
	    heatTable("performance_table", d.reverse(), ["cycle", "num_baked", "num_missed", "num_stolen"], "num_baked");
    	});
    getBakerInfo("snapshot_info", ["cycle", "rewards"],
		 [{"field":"cycle", "op":"between", "value":[lastFullCycle-9, lastFullCycle]},
		  {"field":"baker", "op":"eq", "value":[baker]}])
    	.then(d => {
    	    set( "baker_rewards",
		 `Rewards made in cycle ${lastFullCycle}: ${convertFromUtezToTez(d[d.length-1].rewards).toFixed(2)} XTZ`)
	    d.forEach(r => r.rewards = convertFromUtezToTez(r.rewards));
	    linegraph("rewards_chart", d, {x:"cycle", y:"rewards"}, [0, Math.max(...d.map(r =>r.rewards))], false);
	    d.push({cycle:"Cycle", rewards:"Rewards Earned", staking_balance:"Staking Balance"});
	    heatTable("rewards_table", d.reverse(), ["cycle", "rewards"], "rewards");
    	});
    getBakerInfo("baker_performance", ["baker", "grade"], [{"field":"cycle", "op":"eq", "value":[lastFullCycle]}])
    	.then(d => {
	    let values = d.map(item => item.grade).sort((a, b) => a - b)
	    const fivePercent = Math.round(values.length * 0.05);
	    values = values.slice(fivePercent, values.length-fivePercent);
	    const standardDeviation = getSD(values);
	    const avg = getMean(values);
	    const bakerGrade = (d.find(entry => entry.baker == baker) || {"grade":0}).grade
	    const numDeviations = (bakerGrade - avg) / standardDeviation
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
	      
    blocksBakedPerHour(baker,createGraphTimestamps(16)).then(d => linegraph("blocks_per_hour_graph", d,
									    {x:"timestamp", y:"blocksPerHour"},
									    [0, Math.max(...d.map(r =>r.blocksPerHour))],
									    true, true));
    lastBlockBakedBy(baker)
	.then(d => {
	    set("baker_last_bake", `Time of last bake: ${d ? UTCToDateTime(d.timestamp) : "Never baked"}`);
	    set("baker_last_bake_level", `Level of last bake: ${d ? d.level: "Never baked"}`);
	});
    getBakerAccount()
	.then(async function(d) { 
	    let topTen = d.slice(0,100)
	    topTen.forEach((baker, i) => {
		baker["name"] = `#${i+1} ${searchRegistry(baker.pkh).name}`
		baker["staking_balance"] = convertFromUtezToTez(baker.staking_balance)
		baker["name"] += ` (${baker.staking_balance.toFixed(2)} XTZ)`
	    });
	    if (!topTen.map(d => d.pkh).includes(baker)) {
		let bakerAcc = await getBakerAccount(baker);
		bakerAcc.name = `#${d.findIndex(baker => baker.pkh == bakerAcc.pkh)+1} ` +
		    searchRegistry(bakerAcc.pkh).name;
		bakerAcc.staking_balance = convertFromUtezToTez(bakerAcc.staking_balance);
		bakerAcc["default"] = "true";
		topTen.push(bakerAcc);
	    } else 
		topTen.find(d => d.pkh == baker)["default"] = "true";
	    stackedBarGraph(`staking_balances_chart`, topTen, {x:"staking_balance", y:"name"}, 8, d => updateBakerInfo(d.pkh));
	});
    numBlocksBakedBy("all", lastFullCycle)
	.then(d => {
	    if (!d.map(d => d.baker).includes(baker))
		d.push(({"name":baker, "baker":baker, "count_hash":0}))
	    d.forEach((baker, i) => {
		baker["name"] = `#${i+1} ${searchRegistry(baker.baker).name}`;
		baker["name"] += ` (${baker.count_hash})`;
	    });
	    d.find(d => d.baker == baker)["default"] = "true";
	    stackedBarGraph(`num_blocks_baked_chart`, d, {x:"count_hash", y:"name"}, 7, d => updateBakerInfo(d.baker));
	});
    getBakerAccount(baker)
	.then(d => {
	    stakingBalance = convertFromUtezToTez(d.staking_balance).toFixed(2)
	    set("baker_amount_staked", `Amount staked: ${stakingBalance} XTZ`);
	    set("baker_amount_delegated", `Amount delegated: ${convertFromUtezToTez(d.delegated_balance).toFixed(2)} XTZ`);
	    return numBlocksBakedBy(baker)
	})
    	.then(d => {
	    set("baker_blocks_baked", `Lifetime blocks baked: ${d ? d.count_hash : "never baked"}`);
	    set("baker_blocks_per_stake", `Blocks per XTZ: ${d ? d.count_hash / stakingBalance : 0}`);
	});
    getDelegators(baker)
	.then(d => set("baker_num_delegators", `Number of delegators: ${Object.keys(d).length}`));
    nextBake(baker)
	.then(d => {
	    clearTimeout(clock)
	    updateCountdown((d ? d.estimated_time : "none"), baker);
	    set("baker_next_bake_level", `Level of next bake: ${d ? d.level : "Some time in the distant future..."}`);
	});
    blocksMissedBy(baker, lastFullCycle)
	.then(d => {
	    set("baker_blocks_missed", `Blocks missed in cycle ${lastFullCycle}: ${d.length}`);
	    d.forEach(block => block["label"] = `Level: ${block.meta_level}`);
	    chainmap("blocks_missed_chart", d, {x:"meta_cycle_position", y:"label"},
		     blocksPerCycle, "red", "Blocks missed ", true);
	});
    blocksStolenBy(baker, lastFullCycle)
	.then(d => {
	    set("baker_blocks_stolen", `Blocks stolen in cycle ${lastFullCycle}: ${d.length}`)
	    d.forEach(block => block["label"] = `Level: ${block.meta_level}`);
	    chainmap("blocks_stolen_chart", d, {x:"meta_cycle_position", y:"label"},
		     blocksPerCycle, "green", "Blocks stolen ", false);
	});
    blocksBakedBy(baker, lastFullCycle)
	.then(async function(d) {
	    const percentStaked = await getRollsStaked(baker)/ await getRollsStaked()
	    const percentBaked = d.length / blocksPerCycle 
	    set("baker_luck",
		`Luck in current cycle: ${(percentStaked-percentBaked < 0) ? "You've been lucky!" : "You've been unlucky!"}`)
	    set("baker_blocks_baked_last_cycle", `Blocks baked in cycle ${lastFullCycle}: ${d.length}`);
	    d.forEach(block => block["label"] = `${block.meta_level}`);
	    chainmap("blocks_baked_chart", d, {x:"meta_cycle_position", y:"label"},
		     blocksPerCycle, "#eb7610", "Blocks baked ", false);
	});
    
}

async function updateNetworkInfo() {
    const response = await httpGet("https://min-api.cryptocompare.com/data/price?fsym=XTZ&tsyms=USD")
    const conversionRate = JSON.parse(response).USD 
    getTezInCirculation()
	.then(totalTez =>
	      set("net_market_cap", `Market cap: $${(convertFromUtezToTez(totalTez) * conversionRate).toFixed(2)}`));

    getBlock("head")
	.then(head => {
	    set("net_level", `Current level: ${head.level}`);
	    set("net_last_block", `Latest block: ${head.hash}`);
	    set("net_last_baker", `Latest baker: ${head.baker}`);
	    return numBlocksBakedFrom(head.timestamp - millisOneHour)
	})
	.then(blocksLastHour =>
	      set("net_blocks_last_hour", `#Blocks baked last hour: ${blocksLastHour}`));

    httpGet("https://api.baking-bad.org/v2/bakers")
	.then(data => {
	    const bakerRegistry = JSON.parse(data)
	    const maxFeeBaker = getFee(bakerRegistry, Math.max);
	    const minFeeBaker = getFee(bakerRegistry, Math.min);
	    const averageFee = (bakerRegistry.map(({fee}) => fee)
				.reduce((a,b) => a + b, 0) / bakerRegistry.length).toFixed(2);
	    set("net_min_baker_fee",
		`Min baker fee: ${Math.floor(minFeeBaker.fee * 100)}%  ${minFeeBaker.name},`);
	    set("net_max_baker_fee",
		`Max baker fee: ${Math.floor(maxFeeBaker.fee * 100)}%  ${maxFeeBaker.name},`);
	    set("net_avg_baker_fee",
		`Avg baker fee: ${Math.floor(averageFee * 100)}%`);
	});
}

function initialize() {
    updateNetworkInfo();
    getBlock("head").then(head => updateBakerInfo(head.baker));
    setTimeout(updateNetworkInfo, 60000);
}
