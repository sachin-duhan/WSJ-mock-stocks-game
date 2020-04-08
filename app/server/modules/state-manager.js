/**
 * State management module.
 *
 * This module is reponsible for managing and updating the state of the market
 * based on the transactions done by the players. The responsibilities include
 *   # Validating transactions.
 *   # Executing transactions (ACID, if possible).
 *   # Reporting errors/incorrect transactions.
 * TODO: Make sure transactions are atomic (or some other safe measure).
 */
var crypto = require('crypto');
var MongoDB = require('mongodb').Db;
var Server = require('mongodb').Server;
var moment = require('moment');

var RM = require("./round-manager.js");
var AM = require("./account-manager.js");

/*
   ESTABLISH DATABASE CONNECTION
*/

var dbName = process.env.DB_NAME || 'market';
var dbHost = process.env.DB_HOST || 'localhost';
var dbPort = process.env.DB_PORT || 27017;

var db = new MongoDB(dbName, new Server(dbHost, dbPort,
  {auto_reconnect : true}), {w : 1});

db.open(function(e, d) {
  if (e) {
    console.log(e);
  } else {
    if (process.env.NODE_ENV == 'live') {
      db.authenticate(process.env.DB_USER, process.env.DB_PASS,
        function(e, res) {
          if (e) {
            console.log('mongo :: error: not authenticated', e);
          } else {
            console.log(
              'mongo :: authenticated and connected to database :: "' +
              dbName + '"');
          }
        });
    } else {
      console.log('mongo :: connected to database :: "' + dbName + '"');
    }
  }
});

var getObjectId = function(id) { return new require('mongodb').ObjectID(id); };
var state = db.collection('state');
var companies = db.collection('companies');

exports.share_names = [
  "BHARTIARTL", "HCLTECH", "HEROMOTOCO", "ICICIBANK", "IDEA", "INFY", "ITC",
  "MARUTI", "ONGC", "RCOM", "SBIN", "TATAMOTORS", "TCS", "MCDOWELL-N", "WIPRO"
];

// NOTE: This is the initial number of shares in order of the share names above.
// Needs to change with the model.
exports.num_shares = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
  100, 100, 100, 100]

// NOTE: Change this according to the model.
exports.start_balance = 10000;

// Get user portfolio state.
exports.getUserById = function(user_id, round, callback) {
  state.findOne({"user_id" : getObjectId(user_id), "round" : round},
    function(err, res) {
      if (err || res == null) {
        callback(err);
      } else {
        callback(null, res);
      }
    });
}

// Set up initial round portfolio for each user.
exports.initial_state = function(round, callback) {
  // Remove all states for this round.
  state.remove({"round" : round + 0});

  // If this is the first round, take the default state, otherwise carry over
  // from the previous round.
  if (round == "1") {
    // Remove company data.

    var default_state = {};

    for (var i = 0, len = exports.share_names.length; i < len; i++) {
      default_state[exports.share_names[i]] = 0;
    }
    AM.getAllRecords(function(e, res) {
      if (e || res == null)
        callback(e);
      else {
        for (var i = 0, len = res.length; i < len; i++) {
          state.insert({
            "user_id" : res[i]["_id"],
            "shares" : default_state,
            "round" : round,
            "balance" : exports.start_balance
          });
        }
      }
    });
    // Set up initial state for the companies.
    companies.remove({});
    for (var i = 0, len = exports.num_shares.length; i < len; i++) {
      companies.insert({
        "id":i,
        "name":exports.share_names[i],
        "num_shares":exports.num_shares[i]
      });
    }
    callback(null);
  } else {
    state.find({"round" : round - 1}).toArray().then(function(data) {
      for (var i = 0, len = data.length; i < len; i++) {
        state.insert({
          "user_id" : data[i]['user_id'],
          "shares" : data[i]['shares'],
          "round" : round,
          "balance" : data[i]['balance']
        });
      }
      callback(null);
    });
  }
}

// Execute a buy transaction.
// NOTE
// Checks : 
//     1. Balance.
//     2. Market availability.
// Updates : 
//     1. Portfolio (balance + shares)
//     2. Market availability.
exports.buy = function(user_id, shareId, qty, round, callback) {
  RM.getCurrentRound(function(e, res) {
    if (e || res == null)
      callback(e);
    else {
      // Sanitize input.
      shareId = parseInt(shareId, 10);
      qty = parseInt(qty, 10);

      var share = exports.share_names[shareId];
      var amt_deducted = res["prices"][share] * qty;
      companies.find()
      exports.getUserById(user_id, round, function(err, res) {
        if (err || res == null) {
          callback(err);
        } else {
          if (res["balance"] < amt_deducted) {
            callback("balance");
          } else {
            var balance = res["balance"] - amt_deducted;
            var shares = res["shares"];
            shares[share] += qty;

            companies.findOne({"id": shareId}, function(err, doc) {
              if(err || doc == null) {
                callback(err);
              } else {
                if(doc["num_shares"] < qty) {
                  callback("market");
                } else {
                  // FIXME: If possible!
                  companies.updateOne(doc, {$inc: {"num_shares": -qty}});
                  state.updateOne(
                    {"user_id" : getObjectId(user_id), "round" : round},
                    {$set : {"balance" : balance, "shares" : shares}});

                  callback(null, true);
                }
              }
            });
          }
        }
      });
    }
  })
}

// Execute a sell transaction.
// NOTE
// Checks : 
//     1. Portfolio shares
// Updates : 
//     1. Portfolio (balance + shares)
//     2. Market availability.
exports.sell = function(user_id, shareId, qty, round, callback) {
  RM.getCurrentRound(function(e, res) {
    if (e || res == null)
      callback(e);
    else {
      shareId = parseInt(shareId, 10);
      qty = parseInt(qty, 10);

      var share = exports.share_names[shareId];
      var amt_credited = res["prices"][share] * qty;
      exports.getUserById(user_id, round, function(err, res) {
        if (err || res == null)
          callback(err);
        else {
          if (qty > res["shares"][share]) {
            callback(err);
          } else {
            var balance = res["balance"] + amt_credited;
            var shares = res["shares"];
            shares[share] -= qty;

            // FIXME : If possible!
            companies.findAndModify(
              {"id": shareId, "name":exports.share_names[shareId]}, 
              [['id', 'asc']],
              {"$inc" : {"num_shares": qty}},
              {"upsert": true},
              function(err, doc) {
                if(err || doc == null) {
                  callback(err);
                } else {
                  state.updateOne({"user_id" : getObjectId(user_id), "round" :
                    round}, {$set : {"balance" : balance, "shares" : shares}});
                  callback(null, true);
                }
              });
          }
        }
      });
    }
  });
}

// Execute a short sell transaction.
// NOTE
// Checks : 
//     1. Market availability.
// Updates : 
//     1. Portfolio (balance + shares)
//     2. Market availability.
//
// TODO: Establish shortsell limits.
exports.shortSell = function(user_id, shareId, qty, round, callback) {
  RM.getCurrentRound(function(e, res) {
    if (e || res == null)
      callback(e);
    else {
      qty = parseInt(qty, 10);
      shareId = parseInt(shareId, 10);

      var share = exports.share_names[shareId];
      var amt_credited = res["prices"][share] * qty;

      exports.getUserById(user_id, round, function(err, res) {
        if (err || res == null) {
          callback(err);
        } else {
          var balance = res["balance"] + amt_credited;
          var shares = res["shares"];
          shares[share] -= qty;

          companies.findOne({"id": shareId}, function(err, doc) {
            if(err || doc == null) {
              callback(err);
            } else {
              if(doc['num_shares'] < qty) {
                callback("market");
              } else {
                // FIXME: If possible!
                companies.updateOne(doc, {$inc: {"num_shares": -qty}});
                state.updateOne(
                  {"user_id" : getObjectId(user_id), "round" : round},
                  {$set : {"balance" : balance, "shares" : shares}});

                callback(null, true);
              }
            }
          });
        }
      });
    }
  });
}
