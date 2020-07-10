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
