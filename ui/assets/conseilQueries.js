function convertFromUtezToTez(amountInUtez) {
    const tezAmount = amountInUtez / 1000000
    return tezAmount
}

function convertFromTezToUtez(amountInTez) {
    const uTezAmount = amountInTez * 1000000
    return uTezAmount
}

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
    const result = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'bakers', query);
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
    const account = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'bakers', query);
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
    const result = await conseiljs.ConseilDataClient.executeEntityQuery(conseilServer, platform, network, 'bakers', query);
    return result[0].delegated_balance
}

async function getRewardStructs(baker, start_cycle, end_cycle) {
    const response = await httpGet(`https://api.baking-bad.org/v2/bakers/${baker}?configs=true`)
    const defaultStruct = 16383
    let structs = []

    if (response=="") {
	for (let i = start_cycle; i <= end_cycle; i++) 
	    structs.push({"cycle":i, "value":defaultStruct})
	return structs
    }
    
    const responseStructs = JSON.parse(response).config.rewardStruct

    let i = end_cycle
    responseStructs.forEach(entry => {
	for (;i >= start_cycle; i--) {
	    if (entry.cycle <= i) {
		structs.push({"cycle":i, "value":entry.value})
	    }
	    else return;
	}
    });
    return structs
}

async function getBakerRewards(baker, start_cycle, end_cycle) {
    const structs = await getRewardStructs(baker, start_cycle, end_cycle)
    const fields = ['num_endorsements_in_baked', 'num_endorsements_in_stolen', 'num_endorsements_in_missed',
		    'fees_in_baked', 'fees_in_stolen', 'high_priority_endorsements', 'low_priority_endorsements',
		    'missed_endorsements', 'num_revelations_in_baked', 'num_revelations_in_stolen', 'num_revelations_in_missed',
		    'endorsements_in_not_revealed', 'fees_in_not_revealed']

    const rewardsInfo = await getBakerInfo('baker_performance', fields,
					   [{field:'baker', op:'eq', value:[baker]},
					    {field:'cycle', op:'between', value:[start_cycle, end_cycle]}],
					   {field:'cycle', dir:'asc'})

    const accusationInfo = await getAccusationInfo(baker, start_cycle, end_cycle)
    const rewards = []
    for (let i = 0; i <= end_cycle - start_cycle; i++) { 
	const bakerStats = rewardsInfo[i]
	const accusationStats = accusationInfo[i]
    	const rewardStruct = structs[i].value
    	const cycle = structs[i].cycle
    	let extRewardStruct = {
    	    blocks: (rewardStruct & 1) > 0 ? bakerStats.num_endorsements_in_baked * BAKING_REWARD_PER_ENDORSEMENT[0] : 0,
    	    endorses: (rewardStruct & 2) > 0 ? bakerStats.high_priority_endorsements * REWARD_PER_ENDORSEMENT[0] : 0,
    	    fees: (rewardStruct & 4) > 0 ? convertFromUtezToTez(bakerStats.fees_in_baked) : 0,
    	    accusationRewards: (rewardStruct & 8) > 0 ?
		accusationStats.double_baking_accusation_rewards + accusationStats.double_endorsement_accusation_rewards : 0,
    	    accusationLostDeposits: ((rewardStruct & 16) > 0 ? -1 : 0) * 
		accusationStats.double_baking_lost_deposits + accusationStats.double_endorsement_lost_deposits,
    	    accusationLostRewards:  ((rewardStruct & 32) > 0 ? -1 : 0) * 
		accusationStats.double_baking_lost_rewards + accusationStats.double_endorsement_lost_rewards,
    	    accusationLostFees:  ((rewardStruct & 64) > 0 ? -1 : 0) * 
		accusationStats.double_baking_lost_fees + accusationStats.double_endorsement_lost_fees,
    	    revelationRewards: (rewardStruct & 128) > 0 ?
    		(bakerStats.num_revelations_in_baked + bakerStats.num_revelations_in_stolen) * REWARD_PER_REVELATION : 0,
    	    revelationLostRewards: !((rewardStruct & 256) > 0) ?
		bakerStats.endorsements_in_not_revealed * REWARD_PER_REVELATION : 0,
  	    revelationLostFees: !((rewardStruct & 512) > 0) ? convertFromUtezToTez(bakerStats.fees_in_not_revealed) : 0,
    	    missedBlocks: !((rewardStruct & 1024) > 0) ? bakerStats.num_endorsements_in_missed * BAKING_REWARD_PER_ENDORSEMENT[0] : 0,
    	    stolenBlocks: (rewardStruct & 2048) > 0 ? bakerStats.num_endorsements_in_stolen * BAKING_REWARD_PER_ENDORSEMENT[1] +
    		convertFromUtezToTez(bakerStats.fees_in_stolen) : 0,
    	    missedEndorses: !((rewardStruct & 4096) > 0) ? bakerStats.missed_endorsements * REWARD_PER_ENDORSEMENT[0]: 0,
    	    lowPriorityEndorses: !((rewardStruct & 8192) > 0) ?
		bakerStats.low_priority_endorsements * REWARD_PER_ENDORSEMENT[0] :
		bakerStats.low_priority_endorsements * REWARD_PER_ENDORSEMENT[1],
    	}
    	rewards.push(extRewardStruct)
    }
    console.log(Object.values(rewards[0]).reduce(((acc, curr) => acc + curr), 0))
    return rewards
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


async function getBlockFees(baker, cycle, type) {
    const typeToPriority = {"baked":0, "stolen":1, "misssed":1}
    const response = (await getBakerInfo("baker_performance", [`fees_in_${type}`],
    					 [{field:"cycle", op:"eq", value:[cycle]},
    					  {field:"baker", op:"eq", value:[baker]}]))[0]

    const sumFees = response[`fees_in_${type}`]
    return sumFees ? sumFees : 0
}

async function getBlockRewards(baker, cycle, type) {
    const typeToPriority = {"baked":0, "stolen":1, "misssed":1}
    const rewardPerEndorsement = BAKING_REWARD_PER_ENDORSEMENT[typeToPriority[type]]
    const blocks = (await getBakerInfo("baker_performance", [`num_endorsements_in_${type}`],
    				       [{field:"cycle", op:"eq", value:[cycle]},
    					{field:"baker", op:"eq", value:[baker]}]))[0]

    const sumBlockPower = blocks[`num_endorsements_in_${type}`]
    const rewards = convertFromTezToUtez(rewardPerEndorsement * sumBlockPower)
    return rewards ? rewards : 0
}

async function getEndorsementRewards(baker, cycle, type) {
    const table = 0
    const priority_ind = 1
    typeData = {"low": ["low_priority_endorsements", 1],
		"high": ["high_priority_endorsements", 0],
		"missed": ["missed_endorsements", 0]}
    endorsementType = typeData[type]

    rewardPerEndorsement = REWARD_PER_ENDORSEMENT[endorsementType[priority_ind]]
    response = (await getBakerInfo("baker_performance", [endorsementType[table]],
    				   [{field:"cycle", op:"eq", value:[cycle]},
    				    {field:"baker", op:"eq", value:[baker]}]))[0]

    sumEndorsements = response[endorsementType[table]]
    rewards = convertFromTezToUtez(sumEndorsements * rewardPerEndorsement)
    return rewards ? rewards : 0
}

function blank_query(fields) {
    ret = {}
    fields.forEach(field => ret[field] = 0)
    return ret
}

async function getAccusationInfo(baker, start_cycle, end_cycle) {
    const fields = ['cycle',
		    'double_baking_accusation_rewards', 'double_endorsement_accusation_rewards',
		    'double_baking_lost_fees', 'double_endorsement_lost_fees',
		    'double_baking_lost_deposits', 'double_endorsement_lost_deposits',
		    'double_baking_lost_rewards', 'double_endorsement_lost_rewards']

    const accusationInfo = await getBakerInfo('accusations', fields,
					      [{field:'baker', op:'eq', value:[baker]},
					       {field:'cycle', op:'between', value:[start_cycle, end_cycle]}]);

    let curr = 0;
    for (let i=start_cycle; i <= end_cycle; i++, curr++) {
	if (curr + 1 > accusationInfo.length || accusationInfo[curr].cycle > i) {
	    blank = blank_query(fields)
	    blank.cycle = i
	    accusationInfo.splice(curr, 0, blank)
	}
    }

    return accusationInfo
}

