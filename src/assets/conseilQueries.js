const conseilServer = { url: 'https://conseil-prod1.cryptonomic-infra.tech:443', apiKey: 'galleon' };
const platform = "tezos"
const network = "mainnet"
const blocksPerCycleValues = {"mainnet" : 4096,
			      "babylonnet" : 2048,
			      "carthagenet" : 2048,
			      "zeronet" : 128}
const blocksPerCycle = blocksPerCycleValues[network]
const tezPerRoll = 8000
const millisOneDay = 86400000
const millisOneHour = millisOneDay/24
const millisThirtyDays = millisOneDay * 30
const CYCLES_PRESERVED = 5;
const CYCLES_PENDING = 2;
var clock
var delegateAddress
/* ==== === various utility functions =======*/

function convertFromUtezToTez(amountInUtez) {
    const tezAmount = amountInUtez / 1000000
    return tezAmount
}

function emphasize(toEmphasize) {
    return "<strong>" + toEmphasize + "</strong>"
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
    const url = `http://localhost:8080/info`;
    let query = { "table": table, "fields": fields };
    if (predicates) query["predicates"] = predicates;
    if (orderby) query["orderby"] = orderby;
    const result = await httpPost(url, JSON.stringify(query));
    return JSON.parse(result)
}

async function continueRewardSearch() {
    document.getElementById("calculate_rewards_button").style.display = "block";
    document.getElementById("payout").value = (await getBakerInfo("baker_payouts", ["payout_account"],
								  [`baker='${delegateAddress}'`]))[0].payout_account
    document.getElementById("fee").value = JSON.parse(await httpGet(`https://api.baking-bad.org/v2/bakers/${delegateAddress}`)).fee;
    document.getElementById("payout_delay").value = JSON.parse(
	await httpGet(`https://api.baking-bad.org/v2/bakers/${delegateAddress}`)
    ).payoutDelay;
}

async function calculateRewardsForDelegate() {
    const head = await getBlock("head");
    const lastFullCycle = head.meta_cycle - 1;
    const delegator = document.getElementById("delegator").value
    const fee = document.getElementById("fee").value
    const payoutDelay = document.getElementById("payout_delay").value
    const payout = document.getElementById("payout").value
    const undelegatedMsg = "You were not qualified for rights at this cycle"
    let rewards = await getBakerInfo("snapshot_info",
				     ["cycle", "rewards", "snapshot_block_level", "staking_balance"],
				     [`cycle BETWEEN ${lastFullCycle-9} AND ${lastFullCycle}`,
				      `baker='${delegateAddress}'`]);

    const delegations = await getBakerInfo("delegate_history", ["cycle", "baker"],
					   [`delegator='${delegator}'`,
					    `cycle BETWEEN ${lastFullCycle-16} AND ${lastFullCycle-7}`,
					    `baker='${delegateAddress}'`],
					   ["cycle", "ASC"])

    const delegation_cycles = delegations ? delegations.map(d => d.cycle): []

    for (d of rewards) {
	let delegateBalance = await getBalanceAtLevel(delegator, d.snapshot_block_level - 1)
	console.log(d.cycle - parseInt(payoutDelay))
	let rewardsReceived = await tezTransferedBetween(payout, delegator, d.cycle+parseInt(payoutDelay)); 
	
	if (delegation_cycles.includes(d.cycle - CYCLES_PRESERVED - CYCLES_PENDING)) {
	
	    d["delegator_rewards"] = delegateBalance ? convertFromUtezToTez(d.rewards * (1 - fee) *
									    (delegateBalance/d.staking_balance)).toFixed(6) : "--"
	    d["delegator_rewards_received"] = convertFromUtezToTez(rewardsReceived)
	    d["advertised_fee"] = parseFloat((fee * 100).toFixed(2))
	    d["actual_fee"] = parseFloat(((-1) * ((rewardsReceived/d.rewards)*
						  (d.staking_balance/delegateBalance) - 1) * 100)
					 .toFixed(2))
	}
	else {
	    d["delegator_rewards"] =  "*"
	    d["delegator_rewards_received"] = "*"
	    d["advertised_fee"] = parseFloat((fee * 100).toFixed(2))
	    d["actual_fee"] = "*"
	}
    }	
    rewards.forEach(d => d.rewards = convertFromUtezToTez(d.rewards).toFixed(2));
    rewards.push({cycle:"Cycle", rewards:"Total Baker Rewards Earned",
    		  staking_balance:"Staking Balance", delegator_rewards:"Delegator Rewards",
		  delegator_rewards_received:"Payments Received", advertised_fee:"Advertised Fee",
		  actual_fee:"Actual Fee Taken"});
    heatTable("rewardsTable",
	      rewards.reverse(),
	      ["cycle", "rewards", "delegator_rewards", "delegator_rewards_received", "advertised_fee", "actual_fee"],
	      "rewards",
	      [["delegator_rewards", "delegator_rewards_received"], ["advertised_fee", "actual_fee", "inverse"]],
	      [{identifier:"*", message: undelegatedMsg}, {identifier:"--", message:""}]);
}

async function getBakerConfig(baker) {
    let rewardStruct = httpGet
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

/* ======= Conseil Queries =======*/

async function getBlock(blockid) {
    block = (blockid == "head") ? 
	await conseiljs.TezosConseilClient.getBlockHead(conseilServer, network) :
	await conseiljs.TezosConseilClient.getBlock(conseilServer, network, blockid)
    return block
}

async function getTezInCirculation() {
    let balanceQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    balanceQuery = conseiljs.ConseilQueryBuilder.addFields(balanceQuery, 'balance');
    balanceQuery = conseiljs.ConseilQueryBuilder.addAggregationFunction(balanceQuery, 'balance', 'sum');
    const totalTez = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'accounts', balanceQuery);
    return totalTez[0].sum_balance
}

async function getActiveDelegationsBetween(account, start_cycle, end_cycle) {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(query, 'delegate', 'cycle');
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'kind', conseiljs.ConseilOperator.EQ, ["delegation"], false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'source', conseiljs.ConseilOperator.EQ, [account], false);
    query = conseiljs.ConseilQueryBuilder.addOrdering(query, 'block_level', conseiljs.ConseilSortDirection.DESC);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'cycle', conseiljs.ConseilOperator.LT, [start_cycle, end_cycle], false);
    const result = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'operations', query);
    ret = []
    for (let i = start_cycle; i <= end_cycle; i++) 
	ret.push({"cycle":i})
    if (result) {

    }
    return result[0]
}

async function tezTransferedBetween(from, to, cycle) {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(query, 'amount');
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'cycle', conseiljs.ConseilOperator.EQ, [cycle], false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'source', conseiljs.ConseilOperator.EQ, [from], false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'destination', conseiljs.ConseilOperator.EQ, [to], false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'kind', conseiljs.ConseilOperator.EQ, ["transaction"], false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'status', conseiljs.ConseilOperator.EQ, ["applied"], false);
    query = conseiljs.ConseilQueryBuilder.addAggregationFunction(query, 'amount', 'sum');	 
    const result = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'operations', query);
    return result[0] ? result[0].sum_amount : 0
}

async function getRollsStaked(baker="none") {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    let field = ""
    query = conseiljs.ConseilQueryBuilder.addFields(query, 'staking_balance');
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'deactivated', conseiljs.ConseilOperator.EQ, ["false"], false);	 
    if (baker == "none"){
	query = conseiljs.ConseilQueryBuilder.addAggregationFunction(query, 'staking_balance', 'sum');	 
	field = "sum_staking_balance"
    }
    else {
	query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'pkh', conseiljs.ConseilOperator.EQ, [baker], false);	 
	field = "staking_balance"
    }
    const result = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'delegates', query);
    const tezStaked = convertFromUtezToTez(result[0][field]);
    return Math.floor(tezStaked/tezPerRoll)
}

async function getBalanceAtLevel(address, level) {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(query, 'balance');
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'block_level', conseiljs.ConseilOperator.LT, [level], false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'account_id', conseiljs.ConseilOperator.EQ, [address], false);
    query = conseiljs.ConseilQueryBuilder.addOrdering(query, 'block_level', conseiljs.ConseilSortDirection.DESC);
    const result = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'accounts_history', query);
    return result[0] ? result[0].balance : 0
}

async function numBlocksBakedFrom(timestamp) {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(query, 'hash');
    query = conseiljs.ConseilQueryBuilder.addAggregationFunction(query, 'hash', 'count');	 
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'timestamp', conseiljs.ConseilOperator.AFTER, [timestamp], false);
    query = conseiljs.ConseilQueryBuilder.setLimit(query, blocksPerCycle);
    const numBlocks = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'blocks', query);
    return numBlocks[0].count_hash
}

async function numBlocksBakedBy(baker, cycle="none") {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(query, 'hash');
    query = conseiljs.ConseilQueryBuilder.addFields(query, 'baker');
    query = conseiljs.ConseilQueryBuilder.addOrdering(query, 'count_hash', conseiljs.ConseilSortDirection.DESC);
    query = conseiljs.ConseilQueryBuilder.setLimit(query, 100000000)
    if (baker != "all") 
	query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'baker', conseiljs.ConseilOperator.EQ, [baker], false);
    query = conseiljs.ConseilQueryBuilder.addAggregationFunction(query, 'hash', 'count');	 
    if (cycle != "none")
	query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'meta_cycle', conseiljs.ConseilOperator.EQ, [cycle], false);

    const numBlocks = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'blocks', query);
    return (baker == "all" ? numBlocks: numBlocks[0])
}

async function blocksBakedBy(baker, cycle) {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'baker', conseiljs.ConseilOperator.EQ, [baker], false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'meta_cycle', conseiljs.ConseilOperator.EQ, [cycle], false);
    query = conseiljs.ConseilQueryBuilder.setLimit(query, blocksPerCycle)
    const result = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'blocks', query);
    return  result
}

async function blocksStolenBy(baker, cycle) {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'baker', conseiljs.ConseilOperator.EQ, [baker], false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'meta_cycle', conseiljs.ConseilOperator.EQ, [cycle], false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'priority', conseiljs.ConseilOperator.GT, ["0"], false);
    query = conseiljs.ConseilQueryBuilder.setLimit(query, blocksPerCycle)
    const result = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'blocks', query);
    return  result
}

async function lastBlockBakedBy(baker) {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'baker', conseiljs.ConseilOperator.EQ, [baker], false);
    query = conseiljs.ConseilQueryBuilder.addOrdering(query, 'timestamp', conseiljs.ConseilSortDirection.DESC);
    const lastBlock = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'blocks', query);
    return lastBlock[0];
}

async function nextBake(baker) {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(query, 'delegate', 'estimated_time', 'level', 'priority');
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'delegate', conseiljs.ConseilOperator.EQ, [baker], false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'priority', conseiljs.ConseilOperator.EQ, [0], false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'estimated_time', conseiljs.ConseilOperator.AFTER, [Date.now()], false);
    query = conseiljs.ConseilQueryBuilder.addOrdering(query, 'estimated_time', conseiljs.ConseilSortDirection.ASC);
    const bakingRights = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'baking_rights', query)
    return bakingRights[0]
}

async function getBakerAccount(pkh="all") {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    if (pkh != "all") {
	query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'pkh', conseiljs.ConseilOperator.EQ, [pkh], false);

    }
    query = conseiljs.ConseilQueryBuilder.setLimit(query, 100000000)
    query = conseiljs.ConseilQueryBuilder.addOrdering(query, 'staking_balance', conseiljs.ConseilSortDirection.DESC);
    const account = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'delegates', query);
    return (pkh=="all") ? account : account[0]
}

async function getDelegators(baker) {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(query, 'account_id', 'balance');
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'delegate_value', conseiljs.ConseilOperator.EQ, [baker], false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'balance', conseiljs.ConseilOperator.GT, [0], false);
    query = conseiljs.ConseilQueryBuilder.setLimit(query, 100000000)
    const result = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'accounts', query);

    let ret = {}
    for (let entry of result) {
	if (entry.account_id != baker) ret[entry.account_id] = entry.balance;
    }
    return ret
}

async function blocksBakedInCycleBy(baker, cycle) {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(query, 'hash');
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'baker', conseiljs.ConseilOperator.EQ, [baker], false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'meta_cycle', conseiljs.ConseilOperator.EQ, [cycle], false);
    query = conseiljs.ConseilQueryBuilder.setLimit(query, 4096)
    const result = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'blocks', query);

    let ret = []
    for (let entry of result) ret.push(entry.hash);
    return ret
}

async function blocksBakedInTimestampBy(baker, start, end) {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(query, 'hash');
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'baker', conseiljs.ConseilOperator.EQ, [baker], false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'timestamp', conseiljs.ConseilOperator.BETWEEN, [start, end], false);
    query = conseiljs.ConseilQueryBuilder.setLimit(query, 10000000)
    const result = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'blocks', query);
    let ret = []
    for (let entry of result) ret.push(entry.hash);
    return ret
}

async function blocksBakedPerHour(baker, timestamps) {
    let ret = []
    let delta = 0
    for (let i = 0; i < timestamps.length-1; i++) {
	delta = (timestamps[i+1] - timestamps[i])/millisOneHour
	ret.push({"timestamp": new Date(timestamps[i]),
		  "blocksPerHour": ((await blocksBakedInTimestampBy(baker, timestamps[i], timestamps[i+1])).length/delta)
		  .toFixed(2)})
    }
    return ret
}

async function bakingSlotLevelsInCycle(baker, cycle) {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(query, 'level')
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'delegate', conseiljs.ConseilOperator.EQ, [baker], false)
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'cycle', conseiljs.ConseilOperator.EQ, [cycle], false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'priority', conseiljs.ConseilOperator.EQ, ["0"], false);
    query = conseiljs.ConseilQueryBuilder.setLimit(query, 4096)
    const result = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'baking_rights', query);
    let ret = []
    for (let entry of result) ret.push(entry.level);
    return ret
}

async function blocksMissedBy(baker, cycle) {
    const levels = await bakingSlotLevelsInCycle(baker, cycle)
    if (levels.length == 0) return []
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    if (levels.length > 1)
	query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'level', conseiljs.ConseilOperator.IN, levels, false);
    else 
	query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'level', conseiljs.ConseilOperator.EQ, levels, false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'baker', conseiljs.ConseilOperator.EQ, [baker], true);
    query = conseiljs.ConseilQueryBuilder.setLimit(query, blocksPerCycle)
    const result = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'blocks', query);
    return result
}

async function getDelegatedBalance(baker) {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(query,'delegated_balance');
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'pkh', conseiljs.ConseilOperator.EQ, [baker], false);
    const result = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'delegates', query);
    return result[0].delegated_balance
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
    httpGet(`https://api.baking-bad.org/v2/bakers/${baker}`)
	.then(d => d == "" ? set("baker_name", baker) : set("baker_name",
							    JSON.parse(d).name + `<h5 style="margin-top:10"> (${baker}) </h5>`)
	     );
    getBakerInfo("snapshot_info", ["cycle", "rewards"], [`cycle BETWEEN ${lastFullCycle-9} AND ${lastFullCycle}`,
							 `baker='${baker}'`])
    	.then(d => {
    	    set( "baker_rewards",
		 `Rewards made in cycle ${lastFullCycle}: ${convertFromUtezToTez(d[d.length-1].rewards).toFixed(2)} XTZ`)
	    d.forEach(r => r.rewards = convertFromUtezToTez(r.rewards));
	    linegraph("rewardsChart", d, {x:"cycle", y:"rewards"}, [0, Math.max(...d.map(r =>r.rewards))], false);
	    d.push({cycle:"Cycle", rewards:"Rewards Earned", staking_balance:"Staking Balance"});
	    heatTable("rewardsTable", d.reverse(), ["cycle", "rewards"], "rewards");
    	});
    getBakerInfo("baker_grades", ["address", "grade"], [`cycle=${lastFullCycle}`])
	.then(d => {
	    let values = d.map(item => item.grade).sort((a, b) => a - b)
	    const fivePercent = Math.round(values.length * 0.05);
	    values = values.slice(fivePercent, values.length-fivePercent);
	    const standardDeviation = getSD(values);
	    const avg = getMean(values);
	    const bakerGrade = (d.find(entry => entry.address == baker) || {"grade":0}).grade
	    const numDeviations = (bakerGrade - avg) / standardDeviation
	    let letterGrade = "F";
	    if (numDeviations > 2) letterGrade = "A+";
	    else if (numDeviations > 1) letterGrade = "A";
	    else if (numDeviations > 0.5) letterGrade = "B+";
	    else if (numDeviations > 0) letterGrade = "B";
	    else if (numDeviations > -1) letterGrade = "C";
	    else if (numDeviations > -1.5) letterGrade = "D";
	    else letterGrade = "F";
	    console.log(baker);
	    console.log(bakerGrade);
	    console.log(avg);
	    console.log(standardDeviation);
	    set("baker_grade", `${letterGrade}`);
	});
	      
    blocksBakedPerHour(baker,createGraphTimestamps(16)).then(d => linegraph("chart", d,
									    {x:"timestamp", y:"blocksPerHour"},
									    [0, Math.max(...d.map(r =>r.blocksPerHour))],
									    false, true));
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
	    // let sum = d3.sum(topTen, d => d.staking_balance)
	    // let other = ({"name":"Other", "staking_balance":(await getRollsStaked()) * tezPerRoll - sum})
	    // topTen.push(other)
	    stackedBarGraph(`chart2`, topTen, {x:"staking_balance", y:"name"}, 8, d => updateBakerInfo(d.pkh));
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
	    stackedBarGraph(`chart3`, d, {x:"count_hash", y:"name"}, 7, d => updateBakerInfo(d.baker));
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
	    chainmap("chart6", d, {x:"meta_cycle_position", y:"label"},
		     blocksPerCycle, "red", "Blocks missed ", true);
	});
    blocksStolenBy(baker, lastFullCycle)
	.then(d => {
	    set("baker_blocks_stolen", `Blocks stolen in cycle ${lastFullCycle}: ${d.length}`)
	    d.forEach(block => block["label"] = `Level: ${block.meta_level}`);
	    chainmap("chart5", d, {x:"meta_cycle_position", y:"label"},
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
	    chainmap("chart4", d, {x:"meta_cycle_position", y:"label"},
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
