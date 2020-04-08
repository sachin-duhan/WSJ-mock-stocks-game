// Helpers
var ts = timesync.create({server : '/timesync', interval : 2000});

function dateDiff(timestamp) {
    var d = Math.abs(timestamp - ts.now()) / 1000;
    var r = {};
    var s = {
        year : 31536000,
        month : 2592000,
        week : 604800, // uncomment row to ignore
        day : 86400,   // feel free to add your own row
        hour : 3600,
        minute : 60,
        second : 1
    };

    Object.keys(s).forEach(function(key) {
        r[key] = Math.floor(d / s[key]);
        d -= r[key] * s[key];
    });

    return r;
};

const zeroPads =
    Array.from({length : 2}, (_, v) => '0'.repeat(v))

        function zeroPad(num, len) {
            const numStr = String(num);
            return (zeroPads[len - numStr.length] + numStr)
        }

    function
    update_time() {
        var remain = dateDiff(end_time);
        $('#time-info span')
            .text(zeroPad(remain['minute'], 2) + " : " +
                  zeroPad(remain['second'], 2));
    }

    // State
    var share_names = [
        "BHARTIARTL", "HCLTECH", "HEROMOTOCO", "ICICIBANK", "IDEA", "INFY",
        "ITC", "MARUTI", "ONGC", "RCOM", "SBIN", "TATAMOTORS", "TCS",
        "MCDOWELL-N", "WIPRO"
    ];

var live = false;
var start_time, end_time;

function sync_state() {
    $.ajax('/syncstate').done(function(msg) {
        var data = JSON.parse(msg);
        if (data != null) {
            if (data["live"] == true) {
                live = true;

                $('#round-info').text("Round : ");
                $('#round-info').append(data["index"]);
                $('#round-info').removeClass("btn-warning");
                $('#round-info').addClass("btn-success");

                start_time = data["start_time"];
                end_time = data["end_time"];
                var line, news_lines = data["news"];
                var stock_prices = data["prices"];

                $('#news-lines').text("");

                for (line of news_lines) {
                    $("#news-lines").append("<li>" + line + "</li>");
                }
                $('#price-lines').text("");
                $('#price-lines')
                    .append(
                        "<li><span class='stock-names' style='text-align:center;'><b>Stock name</span><span class='stock-prices' style='text-align:center;'>Prices</span></b></li>");
                for (var stock in stock_prices) {
                    $('#price-lines')
                        .append("<li><span class='stock-names'>" + stock +
                                "</span> <span class='stock-prices'>" +
                                stock_prices[stock] + "</span></li>");
                }
                update_time();
            } else {
                live = false;
                $('#round-info').removeClass("btn-success");
                $('#round-info').addClass("btn-warning");
                $('#news-lines').text("");
                $('#price-lines').text("");
            }
        } else {
            live = false;
            $('#round-info').removeClass("btn-success");
            $('#round-info').addClass("btn-warning");
            $('#news-lines').text("");
            $('#price-lines').text("");
        }
    });
}

function update_account() {
    $.ajax({url : 'syncaccount', method : 'POST'}).done(function(msg) {
        if (msg == '') {
            console.log("Account failed to update");
        } else {
            var data = JSON.parse(msg);
            // console.log(data["success"]);
            if (data["success"] == true) {
                // console.log("here");
                $('#account-info ul').text('');
                $('#balance').text('');
                $('#balance')
                    .append("Account balance : <b>" + data["balance"] + "</b>");
                var stock_profile = data["shares"];
                $('#account-info ul')
                    .append(
                        "<li><span class='stock-names' style='text-align:center;'><b>Stock name</span><span class='stock-qty' style='text-align:center;'>Quantity</span></b></li>");
                for (var stock in stock_profile) {
                    $('#account-info ul')
                        .append("<li><span class='stock-names'>" + stock +
                                "</span> <span class='stock-qty'>" +
                                stock_profile[stock] + "</span></li>");
                }
            }
        }
    });
}

$(document)
    .ready(function() {

        var hc = new HomeController();
        var av = new AccountValidator();

        for (var i = 0; i < share_names.length; ++i) {
            $('#stocks')
                .append("<option value='" + i + "'>" + share_names[i] +
                        "</option>")
        }

        $('#account-form')
            .ajaxForm({
                beforeSubmit : function(formData, jqForm, options) {
                    if (av.validateForm() == false) {
                        return false;
                    } else {
                        // push the disabled username field onto the form data
                        // array //
                        formData.push(
                            {name : 'user', value : $('#user-tf').val()});
                        return true;
                    }
                },
                success : function(responseText, status, xhr, $form) {
                    if (status == 'success')
                        hc.onUpdateSuccess();
                },
                error : function(e) {
                    if (e.responseText == 'email-taken') {
                        av.showInvalidEmail();
                    } else if (e.responseText == 'username-taken') {
                        av.showInvalidUserName();
                    }
                }
            });

        $('#transaction-form')
            .ajaxForm({
                url : "transact",
                type : "POST",
                success : function(resp) {
                    update_account();
                }
            });
        sync_state();
        update_account();
    });

var socket = io(window.location.host);

socket.on('round_start', function() {
    sync_state();
    update_account();
});

socket.on('round_end', function() {
    sync_state();
    update_account();
});

setInterval(function() {
    if (live) {
        update_time();
    }
}, 1000);
