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
var clock

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
    }
		      )
}

function updateCountdown(timestamp, baker) {
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

async function numBlocksBakedFrom(timestamp) {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(query, 'hash');
    query = conseiljs.ConseilQueryBuilder.addAggregationFunction(query, 'hash', 'count');	 
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'timestamp', conseiljs.ConseilOperator.AFTER, [timestamp], false);	 
    const numBlocks = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'blocks', query);
    return numBlocks[0].count_hash
}

async function numBlocksBakedBy(baker, cycle="none") {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(query, 'hash');
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'baker', conseiljs.ConseilOperator.EQ, [baker], false);
    query = conseiljs.ConseilQueryBuilder.addAggregationFunction(query, 'hash', 'count');	 
    if (cycle != "none")
	query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'meta_cycle', conseiljs.ConseilOperator.EQ, [cycle], false);

    const numBlocks = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'blocks', query);
    return numBlocks[0].count_hash;
}

async function numBlocksStolenBy(baker, cycle) {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(query, 'hash');
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'baker', conseiljs.ConseilOperator.EQ, [baker], false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'meta_cycle', conseiljs.ConseilOperator.EQ, [cycle], false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'priority', conseiljs.ConseilOperator.GT, ["0"], false);
    query = conseiljs.ConseilQueryBuilder.addAggregationFunction(query, 'hash', 'count')
    const result = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'blocks', query);
    return result[0].count_hash
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
    const bakingRights = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'baking_rights', query);
    return bakingRights[0]
}

async function getBakerAccount(pkh="all") {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    if (pkh != "all") 
	query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'pkh', conseiljs.ConseilOperator.EQ, [pkh], false);	 
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

async function getTotalRewardsForBlocks(blockids) {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(query,'fee');
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'block_hash', conseiljs.ConseilOperator.IN, blockids, false);
    query = conseiljs.ConseilQueryBuilder.addAggregationFunction(query, 'fee', 'sum')
    const result = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'operations', query);
    const totalFees = result[0].sum_fee
    const totalRewards = totalFees + 16000000 * blockids.length
    return totalRewards
}

async function getRewardsInCycle(baker, cycle) {
    const rewards = await getTotalRewardsForBlocks(await blocksBakedInCycleBy(baker, cycle))
    return rewards
}

async function numBlocksMissedBy(baker, cycle) {
    const levels = await bakingSlotLevelsInCycle(baker, cycle)
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'level', conseiljs.ConseilOperator.IN, levels, false);
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'baker', conseiljs.ConseilOperator.EQ, [baker], true);
    const result = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'blocks', query);
    return result.length
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

async function updateBakerInfo(baker) {
    const head = await getBlock("head");
    const timeNow = head.timestamp;
    const lastFullCycle = head.meta_cycle - 1;
    let stakingBalance = 0;
    let numBlocksBaked = 0;
    let numBlocksBakedLastCycle = 0;
    let bakerRegistry = JSON.parse(await httpGet(`https://api.baking-bad.org/v2/bakers`));
    let searchRegistry = pkh => bakerRegistry.find(baker => baker.address == pkh) || {"name":pkh};
    httpGet(`https://api.baking-bad.org/v2/bakers/${baker}`)
	.then(d => d == "" ? set("baker_name", baker) : set("baker_name", JSON.parse(d).name));

    const createGraphTimestamps = ((n) => Array.from(Array(n).keys())
				   .map((i) => (millisThirtyDays / (n-1)) * (n-1-i))
				   .map((i) => (timeNow - i)))

    blocksBakedPerHour(baker,createGraphTimestamps(16)).then(d => linegraph("chart", d, {x:"timestamp", y:"blocksPerHour"}));
    lastBlockBakedBy(baker)
	.then(d => {
	    set("baker_last_bake", `Time of last bake: ${UTCToDateTime(d.timestamp)}`);
	    set("baker_last_bake_level", `Level of last bake: ${d.level}`);
	});
    getBakerAccount()
	.then(async function(d) { 
	    let topTen = d.slice(0,10)
	    topTen.forEach((baker, i) => {
		baker["name"] = searchRegistry(baker.pkh).name
		baker["staking_balance"] = convertFromUtezToTez(baker.staking_balance),
		baker["rank"] = i+1
	    });
	    if (!topTen.map(d => d.pkh).includes(baker)) {
		let bakerAcc = await getBakerAccount(baker);
		bakerAcc.name = `You (${searchRegistry(bakerAcc.pkh).name})`;
		bakerAcc.staking_balance = convertFromUtezToTez(bakerAcc.staking_balance);
		bakerAcc["rank"] = d.findIndex(baker => baker.pkh == bakerAcc.pkh) + 1
		topTen.push(bakerAcc);
	    }
	    let sum = d3.sum(topTen, d => d.staking_balance)
	    let other = ({"name":"Other", "staking_balance":(await getRollsStaked()) * tezPerRoll - sum, "rank":""})
	    topTen.push(other)
	    sum += other.staking_balance;
	    topTen.forEach(d => d["percent"] = d.staking_balance/sum)
	    stackedBarGraph(`chart2`, topTen, {x:"percent", y:"name"});
	});
    getBakerAccount(baker)
	.then(d => {
	    stakingBalance = convertFromUtezToTez(d.staking_balance).toFixed(2)
	    set("baker_amount_staked", `Amount staked: ${stakingBalance} XTZ`);
	    set("baker_amount_delegated", `Amount delegated: ${convertFromUtezToTez(d.delegated_balance).toFixed(2)} XTZ`);
	    return numBlocksBakedBy(baker)
	})
    	.then(d => {
	    set("baker_blocks_baked", `Lifetime blocks baked: ${d}`);
	    set("baker_blocks_per_stake", `Blocks per XTZ: ${d / stakingBalance}`);
	});
    getDelegators(baker)
	.then(d => set("baker_num_delegators", `Number of delegators: ${Object.keys(d).length}`));
    nextBake(baker)
	.then(d => {
	    clearTimeout(clock)
	    updateCountdown(d.estimated_time, baker)
	    set("baker_next_bake_level", `Level of next bake: ${d.level}`);
	});
    getRewardsInCycle(baker, lastFullCycle)
	.then(d => set("baker_rewards",
		       `Rewards made in cycle ${lastFullCycle}: ${convertFromUtezToTez(d).toFixed(2)} XTZ`));
    numBlocksMissedBy(baker, lastFullCycle)
	.then(d => set("baker_blocks_missed", `Blocks missed in cycle ${lastFullCycle}: ${d}`));
    numBlocksStolenBy(baker, lastFullCycle)
	.then(d => set("baker_blocks_stolen", `Blocks stolen in cycle ${lastFullCycle}: ${d}`));
    numBlocksBakedBy(baker, lastFullCycle)
	.then(async function(d) {
	    const percentStaked = await getRollsStaked(baker)/ await getRollsStaked()
	    const percentBaked = d / blocksPerCycle
	    set("baker_luck",
		`Luck in current cycle: ${(percentStaked-percentBaked < 0) ? "You've been lucky!" : "You've been unlucky!"}`)
	    set("baker_blocks_baked_last_cycle", `Blocks baked in cycle ${lastFullCycle}: ${d}`);
	});

    //set("time", timings)
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
