
var CT = require('./modules/country-list');
var AM = require('./modules/account-manager');
var EM = require('./modules/email-dispatcher');
var RM = require('./modules/round-manager.js');
var SM = require('./modules/state-manager.js');

module.exports = function(app) {

    // main login page //
    app.get('/', function(req, res) {
        // check if the user's credentials are saved in a cookie //
        if (req.cookies.user == undefined || req.cookies.pass == undefined) {
            res.render('login',
                       {title : 'Hello - Please Login To Your Account'});
        } else {
            // attempt automatic login //
            AM.autoLogin(req.cookies.user, req.cookies.pass, function(o) {
                if (o != null) {
                    req.session.user = o;
                    res.redirect('/home');
                } else {
                    res.render(
                        'login',
                        {title : 'Hello - Please Login To Your Account'});
                }
            });
        }
    });

    app.post('/', function(req, res) {
        AM.manualLogin(req.body['user'], req.body['pass'], function(e, o) {
            if (!o) {
                res.status(400).send(e);
            } else {
                req.session.user = o;
                if (req.body['remember-me'] == 'true') {
                    res.cookie('user', o.user, {maxAge : 900000});
                    res.cookie('pass', o.pass, {maxAge : 900000});
                }
                res.status(200).send(o);
            }
        });
    });

    // logged-in user homepage //

    app.get('/home', function(req, res) {
        if (req.session.user == null) {
            // if user is not logged-in redirect back to login page //
            res.redirect('/');
        } else {
            res.render('home', {
                title : 'Control Panel',
                countries : CT,
                udata : req.session.user
            });
        }
    });

    app.post('/home', function(req, res) {
        if (req.session.user == null) {
            res.redirect('/');
        } else {
            AM.updateAccount(
                {
                  id : req.session.user._id,
                  name : req.body['name'],
                  email : req.body['email'],
                  pass : req.body['pass'],
                  country : req.body['country']
                },
                function(e, o) {
                    if (e) {
                        res.status(400).send('error-updating-account');
                    } else {
                        req.session.user = o;
                        // update the user's login cookies if they exists //
                        if (req.cookies.user != undefined &&
                            req.cookies.pass != undefined) {
                            res.cookie('user', o.user, {maxAge : 900000});
                            res.cookie('pass', o.pass, {maxAge : 900000});
                        }
                        res.status(200).send('ok');
                    }
                });
        }
    });

    app.post(
           '/logout',
           function(req, res) {
               res.clearCookie('user');
               res.clearCookie('pass');
               req.session.destroy(function(e) { res.status(200).send('ok'); });
           })

        // creating new accounts //

        app.get('/signup', function(req, res) {
            res.render('signup', {title : 'Signup', countries : CT});
        });

    app.post('/signup', function(req, res) {
        AM.addNewAccount({
            name : req.body['name'],
            email : req.body['email'],
            user : req.body['user'],
            pass : req.body['pass'],
            country : req.body['country']
        },
                         function(e) {
                             if (e) {
                                 res.status(400).send(e);
                             } else {
                                 res.status(200).send('ok');
                             }
                         });
    });

    // password reset //

    app.post('/lost-password', function(req, res) {
        // look up the user's account via their email //
        AM.getAccountByEmail(req.body['email'], function(o) {
            if (o) {
                EM.dispatchResetPasswordLink(o, function(e, m) {
                    // this callback takes a moment to return //
                    // TODO add an ajax loader to give user feedback //
                    if (!e) {
                        res.status(200).send('ok');
                    } else {
                        for (k in e)
                            console.log('ERROR : ', k, e[k]);
                        res.status(400).send(
                            'unable to dispatch password reset');
                    }
                });
            } else {
                res.status(400).send('email-not-found');
            }
        });
    });

    app.get('/reset-password', function(req, res) {
        var email = req.query["e"];
        var passH = req.query["p"];
        AM.validateResetLink(email, passH, function(e) {
            if (e != 'ok') {
                res.redirect('/');
            } else {
                // save the user's email in a session instead of sending to the
                // client //
                req.session.reset = {email : email, passHash : passH};
                res.render('reset', {title : 'Reset Password'});
            }
        })
    });

    app.post('/reset-password', function(req, res) {
        var nPass = req.body['pass'];
        // retrieve the user's email from the session to lookup their account
        // and reset password //
        var email = req.session.reset.email;
        // destory the session immediately after retrieving the stored email //
        req.session.destroy();
        AM.updatePassword(email, nPass, function(e, o) {
            if (o) {
                res.status(200).send('ok');
            } else {
                res.status(400).send('unable to update password');
            }
        })
    });

    app.get('/syncstate', function(req, res) {
        if (req.session.user == null) {
            res.send("error");
        } else {
            RM.getCurrentRound(function(e, data) {
                if (e) {
                    res.send("");
                } else {
                    var roundData;
                    if (data != null) {
                        roundData = {
                            "index" : data["index"],
                            "news" : data["news"],
                            "prices" : data["prices"],
                            "start_time" : RM.start_time,
                            "end_time" : RM.end_time,
                            "live" : RM.live
                        };
                    } else {
                        roundData = null;
                    }
                    res.send(JSON.stringify(roundData));
                }
            });
        }
    });

    app.post('/transact', function(req, res) {
        var success = true;
        if (req.session.user == null || !RM.live) {
            success = false;
        } else {
            var id = req.session.user['_id'];
            var qty = req.body.qty;
            var shareId = req.body.stock;
            var action = req.body.action;
            if (qty > 0 && shareId >= 0 && shareId <= 14 && action >= 0 &&
                action < 3) {
                switch (action) {
                case "0":
                    SM.sell(id, shareId, qty, RM.index, function(e) {
                        if (e)
                            success = false;
                    });
                    break;
                case "1":
                    SM.shortSell(id, shareId, qty, RM.index, function(e) {
                        if (e)
                            success = false;
                    });
                    break;
                case "2":
                    SM.buy(id, shareId, qty, RM.index, function(e) {
                        if (e)
                            success = false;
                    });
                    break;
                }
            } else {
                success = false;
            }
        }
        if (success) {
            res.send("{'success':true}");
        } else {
            res.send("{'success':false}");
        }
    });

    app.post('/syncaccount', function(req, res) {
        var success = false;
        if (req.session.user == null) {
            res.send("{'success':false}");
        } else {
            var id = req.session.user['_id'];
            SM.getUserById(id, RM.index, function(err, data) {
                if (err || data == null) {
                    res.send("{'success':false}");
                } else {
                    var respData = {};
                    respData["shares"] = data["shares"];
                    respData["balance"] = data["balance"];
                    respData["success"] = true;
                    res.send(JSON.stringify(respData));
                }
            });
        }
    });

    app.get('*', function(req, res) {
        res.render('404', {title : 'Page Not Found'});
    });
};
