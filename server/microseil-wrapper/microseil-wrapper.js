"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.delegatorsExpectingRewardsFrom = exports.endorsementBreakDownInCycle = exports.blockBreakDownInCycle = exports.feeBreakDownInCycle = exports.rewardsMadeInCycle = exports.doubleEndorsingLossesInCycle = exports.doubleBakingLossesInCycle = exports.bakerPayoutInCycle = exports.bakerGradeInCycle = void 0;
var node_fetch_1 = require("node-fetch");
var Operation;
(function (Operation) {
    Operation["Equals"] = "eq";
    Operation["LessThan"] = "lt";
    Operation["GreaterThan"] = "gt";
    Operation["Between"] = "between";
})(Operation || (Operation = {}));
var server = "https://harpoon.arronax.io/info";
var httpPost = function (url, payload) { return __awaiter(void 0, void 0, void 0, function () {
    var response, data;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, node_fetch_1["default"](url, {
                    method: "POST",
                    body: JSON.stringify(payload),
                    headers: { "Content-Type": "application/json" }
                })];
            case 1:
                response = _a.sent();
                return [4 /*yield*/, response.json()];
            case 2:
                data = _a.sent();
                return [2 /*return*/, data];
        }
    });
}); };
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
function getBakerInfo(microseilServer, table, fields, predicates, orderby) {
    if (orderby === void 0) { orderby = null; }
    return __awaiter(this, void 0, void 0, function () {
        var query, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = { table: table, fields: fields };
                    if (predicates)
                        query["predicates"] = predicates;
                    if (orderby)
                        query["orderby"] = orderby;
                    return [4 /*yield*/, httpPost(microseilServer, query)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result];
            }
        });
    });
}
// Returns baker's grade in a particular cycles
var bakerGradeInCycle = function (baker, cycle) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getBakerInfo(server, "baker_performance", ["grade"], [
                    { field: "cycle", op: Operation.Equals, value: [cycle] },
                    { field: "baker", op: Operation.Equals, value: [baker] },
                ])];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
exports.bakerGradeInCycle = bakerGradeInCycle;
// Payout is inferred from transaction data and may not always be 100% correct
var bakerPayoutInCycle = function (baker, cycle) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getBakerInfo(server, "baker_payouts", ["payout"], [
                    { field: "cycle", op: Operation.Equals, value: [cycle] },
                    { field: "baker", op: Operation.Equals, value: [baker] },
                ])];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
exports.bakerPayoutInCycle = bakerPayoutInCycle;
// Breakdown of tez lost by a baker due to double baking in a given cycle
var doubleBakingLossesInCycle = function (baker, cycle) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getBakerInfo(server, "accusations", [
                    "double_baking_lost_fees",
                    "double_baking_lost_deposits",
                    "double_baking_lost_rewards",
                ], [
                    { field: "cycle", op: Operation.Equals, value: [cycle] },
                    { field: "baker", op: Operation.Equals, value: [baker] },
                ])];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
exports.doubleBakingLossesInCycle = doubleBakingLossesInCycle;
// Breakdown of tez lost by a baker due to double endorsing in a given cycle
var doubleEndorsingLossesInCycle = function (baker, cycle) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getBakerInfo(server, "accusations", ["double_endorsement_lost_deposits", "double_endorsement_lost_rewards"], [
                    { field: "cycle", op: Operation.Equals, value: [cycle] },
                    { field: "baker", op: Operation.Equals, value: [baker] },
                ])];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
exports.doubleEndorsingLossesInCycle = doubleEndorsingLossesInCycle;
// Total tez made in rewards and fees by a baker in a given cycle from both
// baking and enorsing
var rewardsMadeInCycle = function (baker, cycle) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getBakerInfo(server, "snapshot_info", ["rewards"], [
                    { field: "cycle", op: Operation.Equals, value: [cycle] },
                    { field: "baker", op: Operation.Equals, value: [baker] },
                ])];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
exports.rewardsMadeInCycle = rewardsMadeInCycle;
// Break down of tez earned from fees and potential earnings from fees that were
// missed
var feeBreakDownInCycle = function (baker, cycle) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getBakerInfo(server, "baker_performance", [
                    "fees_in_baked",
                    "fees_in_stolen",
                    "fees_in_missed",
                    "fees_in_not_revealed",
                ], [
                    { field: "cycle", op: Operation.Equals, value: [cycle] },
                    { field: "baker", op: Operation.Equals, value: [baker] },
                ])];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
exports.feeBreakDownInCycle = feeBreakDownInCycle;
// Break down of blocks baked/missed/stolen
var blockBreakDownInCycle = function (baker, cycle) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getBakerInfo(server, "baker_performance", ["num_baked", "num_missed", "num_stolen"], [
                    { field: "cycle", op: Operation.Equals, value: [cycle] },
                    { field: "baker", op: Operation.Equals, value: [baker] },
                ])];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
exports.blockBreakDownInCycle = blockBreakDownInCycle;
// Break down of endorsements made/missed
var endorsementBreakDownInCycle = function (baker, cycle) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getBakerInfo(server, "baker_performance", [
                    "high_priority_endorsements",
                    "low_priority_endorsements",
                    "missed_endorsements",
                ], [
                    { field: "cycle", op: Operation.Equals, value: [cycle] },
                    { field: "baker", op: Operation.Equals, value: [baker] },
                ])];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
exports.endorsementBreakDownInCycle = endorsementBreakDownInCycle;
// List of delegators who delegated to the bake before the snapshot was taken at
// a certain cycle and are thus entitled to rewards
var delegatorsExpectingRewardsFrom = function (baker, cycle) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getBakerInfo(server, "delegate_history", ["delegator"], [
                    { field: "cycle", op: Operation.Equals, value: [cycle] },
                    { field: "baker", op: Operation.Equals, value: [baker] },
                ])];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
exports.delegatorsExpectingRewardsFrom = delegatorsExpectingRewardsFrom;
function test() {
    var baker = "tz1Ldzz6k1BHdhuKvAtMRX7h5kJSMHESMHLC";
    var cycle = 300;
    exports.bakerGradeInCycle(baker, cycle).then(function (data) { return console.log("Grade:", data); });
    exports.bakerPayoutInCycle(baker, cycle).then(function (data) { return console.log("Payout:", data); });
    exports.doubleBakingLossesInCycle(baker, cycle).then(function (data) {
        return console.log("Double baking losses:", data);
    });
    exports.doubleEndorsingLossesInCycle(baker, cycle).then(function (data) {
        return console.log("Double endorsing losses:", data);
    });
    exports.rewardsMadeInCycle(baker, cycle).then(function (data) {
        return console.log("Rewards:", data);
    });
    exports.delegatorsExpectingRewardsFrom(baker, cycle).then(function (data) {
        return console.log("Delegators:", data);
    });
    exports.feeBreakDownInCycle(baker, cycle).then(function (data) { return console.log("Fees:", data); });
    exports.blockBreakDownInCycle(baker, cycle).then(function (data) {
        return console.log("Blocks:", data);
    });
    exports.endorsementBreakDownInCycle(baker, cycle).then(function (data) {
        return console.log("Endorsements:", data);
    });
}
test();
