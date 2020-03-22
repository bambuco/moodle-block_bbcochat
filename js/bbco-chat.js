/**
 *
 * @author: Jesus Otero, David Herney
 */
(function($) {
    var AUTH_URL = window.BBCO_CHAT_AUTH_URL || 'https://${URL_MOODLE}/local/tepuy/components/socket/index.php?uid=${MANIFEST_ID}&courseid=${COURSE_ID}';
    var CHATPAGESIZE = 10;
    var ERROR = 'error';
    var INFO = 'info';
    var MODEDEBUG = false;
    var actions = {
        CHATMSG: 'chatmsg',
        CHATHISTORY: 'chathistory',
        PLAYERCONNECTED: 'playerconnected',
        PLAYERDISCONNECTED: 'playerdisconnected'
    };
    var socket;
    var socketLog = false;
    var connectD;
    var connected = false;
    var manifestId;
    var courseId;
    var sessionData;
    var socketUrl;
    var oldestChatId = '';
    var $chatCnr;
    var $chatHist;
    var actionHandlers = {};
    var reConnectTimeout = 1000;
    var reConnectTimeoutLapsed;
    var reConnectTimer;
    var authReady;
    actionHandlers[actions.CHATMSG] = onChatMessage;
    actionHandlers[actions.CHATHISTORY] = onChatHistory;
    actionHandlers[actions.PLAYERCONNECTED] = onPlayerConnected;
    actionHandlers[actions.PLAYERDISCONNECTED] = onPlayerDisconnected;

    var defaultLang = 'es';
    var lang = defaultLang;

    var i18n_strings = {
        es: {
            'chat.error_connecting': 'Hubo un error en la conexión. Reintentando en <strong class="reconnect-timeout"><span>${timeout}</span> seg</strong>.',
            'chat.try_connect': '<a class="btn reconnect">Reconectar ahora</a>'
        }
    }

    function i18n(key, params) {
        var text = i18n_strings[lang][key];
        if (params) {
            text = i18nFormat(text, params);
        }
        return text;
    }

    function i18nFormat(string, params) {
        for (var key in params) string = string.replace('${'+key+'}', params[key]);
        return string;
    }

    function padNumber(number) {
        var str = '0'+number;
        return str.substring(str.length-2);
    }

    function toDateTime(timestamp, options) {
        options = options || {};
        var date = new Date(timestamp * 1000),
            year = date.getFullYear(),
            month = padNumber(date.getMonth()+1),
            day = padNumber(date.getDate()),
            hours = padNumber(date.getHours()),
            minutes = padNumber(date.getMinutes()),
            seconds = padNumber(date.getSeconds());
        var segments = [year, '-', month, '-', day, ' ', hours, ':', minutes];

        if (!(options.seconds === false)) {
            segments.push(':', seconds);
        }

        return segments.join('');
    }

    function toDate(timestamp, options) {
        return toDateTime(timestamp, options).substring(0, 10);
    }

    function getAuthUrl() {
        if (MODEDEBUG) {
            return getAuthUrlFake();
        }

        var params = {
            MANIFEST_ID: $('body').data().manifestId || '',
            COURSE_ID: parent && parent.window.scormplayerdata ? parent.window.scormplayerdata.courseid : '',
            URL_MOODLE: window.location.host
        };
        return i18nFormat(AUTH_URL, params);
    }

    function getAuthUrlFake() {
        var vars = [], hash;
        var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
        for(var i = 0; i < hashes.length; i++)
        {
            hash = hashes[i].split('=');
            vars.push(hash[0]);
            vars[hash[0]] = hash[1];
        }
        return "json/fakeauth_"+(vars['id']||'2')+".json";
    }
    /**
     * Handler to when a websocket connection has been acquired.
     * @param {jQuery object} $el Selection activity container for the Camea 40 questionaire.
     * @param {object} e Activity results.
     */
    function getAuth() {
        var d = $.Deferred();
        $.getJSON(getAuthUrl())
            .done(function(data) {
                d.resolve(data);
            })
            .fail(function(error){
                d.reject(error);
            });
        authReady = d.promise();
        return authReady;
    }

    function prepareHtml() {

        var template = [
            '<div class="bbco-chat-container">',
                '<svg width="0" height="0" style="position:absolute;">',
                    '<symbol viewBox="0 0 512 512" id="ion-android-send">',
                        '<path d="M48 448l416-192L48 64v149.333L346 256 48 298.667z"/>',
                    '</symbol>',
                    '<symbol viewBox="0 0 512 512" id="ion-android-remove">',
                        '<path d="M96 235h320v42H96z"/>',
                    '</symbol>',
                    '<symbol viewBox="0 0 512 512" id="ion-android-checkbox-outline-blank">',
                        '<path d="M405.333 106.667v298.666H106.667V106.667h298.666m0-42.667H106.667C83.198 64 64 83.198 64 106.667v298.666C64 428.802 83.198 448 106.667 448h298.666C428.802 448 448 428.802 448 405.333V106.667C448 83.198 428.802 64 405.333 64z"/>',
                    '</symbol>',
                '</svg>',
                '<div class="bbco-chat-container-wrapper">',
                    '<div class="chat-header">',
                        '<div class="avatar"></div>',
                        '<div class="username"></div>',
                        '<svg class="ion ion-android-remove minimize window-action">',
                            '<use xlink:href="#ion-android-remove"></use>',
                        '</svg>',
                        '<svg class="ion ion-android-checkbox-outline-blank maximize window-action">',
                            '<use xlink:href="#ion-android-checkbox-outline-blank"></use>',
                        '</svg>',
                    '</div>',
                    '<ul class="chat-history"></ul>',
                    '<div class="chat-box">',
                        '<div class="chat-input" contenteditable="true"></div>',
                        '<button class="btn send">',
                            '<svg class="ion ion-android-send"> ',
                                '<use xlink:href="#ion-android-send"></use>',
                            '</svg>',
                        '</button>',
                    '</div>',
                '</div>',
            '</div>',
        ].join('');
        $('body').append(template);
    }

    function connect() {
        connectD = $.Deferred();
        getAuth().then(function(data){
            sessionData = data;
            connectD.resolve(data);
        }, function(err) {
            connectD.reject(err);
        });
        return connectD.promise();
    }

    function openSocket() {
        connectD = $.Deferred();
        var socketUrl;

        if (MODEDEBUG) {
            socketUrl = 'ws://' + sessionData.serverurl + "?skey="+sessionData.skey;
        }
        else {
            socketUrl = (sessionData.secure === false ? 'ws://' : 'wss://') +
                sessionData.serverurl + "?skey="+sessionData.skey;
        }

        $chatCnr.addClass('loading');

        socket = new WebSocket(socketUrl);
        socket.onopen = function() {
            connected = true;
            $chatCnr.removeClass('loading');
            connectD.resolve(socket);
        }
        socket.onerror = function(error) {
            $chatCnr.removeClass('loading');
            connectD.reject(error);
        }
        return connectD.promise();
    }

    function bindSocket(socket) {
        socket.onmessage = onSocketMessage;
        socket.onclose = onSocketClose;
        socket.onerror = onSocketError;

        if (sessionData.userpicture) {
            $('<img src="'+sessionData.userpicture+'" alt="" />').appendTo($chatCnr.find('.chat-header .avatar').empty());
        }
        $chatHist.empty();
        loadChatHistory();
    }

    function reConnect() {
        connectD = $.Deferred();
        openSocket();
        connectD.then(function(socket){
            /*var $alert = $chatHist.find('.btn.reconnect').closest('.message.system');
            $alert.prev().remove();
            $alert.remove();*/
            reConnectTimeoutLapsed = 0;
            reConnectTimeout = 1000;
            bindSocket(socket);
        }, function (){
            reConnectTimeout *= 2;
            if (reConnectTimeout / 1000 > 512) return;
            //reConnectTimer = setTimeout(reConnect, reConnectTimeout);
            reConnectTimeoutLapsed = 0;
            reConnectCountdown();
        });
    }

    function reConnectNow() {
        if (connected) return;
        clearTimeout(reConnectTimer);
        if (reConnectTimeout > 1000) reConnectTimeout /= 2; //So if not able to connect it will attemp to reconnect within the same time before the reconnect now
        reConnect();
    }

    function onSocketClose(e) {
        if (e.wasClean) return;
        connected = false;
        addChatLog({ msg: i18n('chat.error_connecting', { timeout: reConnectTimeout / 1000 }), issystem: 1});
        addChatLog({ msg: i18n('chat.try_connect'), issystem: 1});
        //Attempt to reconnect
        //reConnectTimer = setTimeout(reConnect, reConnectTimeout);
        reConnectTimeoutLapsed = 0;
        reConnectCountdown();
    }

    function onSocketError(e) {
        if (socket.readystate == 1) return; //1 = OPEN, 0 = CONNECTING, 2 = CLOSING, 3 = CLOSED
        //reConnectTimer = setTimeout(reConnect, reConnectTimeout);
        reConnectTimeoutLapsed = 0;
        reConnectCountdown();
    }

    function reConnectCountdown() {
        var remaining = (reConnectTimeout - reConnectTimeoutLapsed) / 1000;
        $chatHist.find('.reconnect-timeout span').text(remaining);
        if (remaining == 0) {
            reConnect();
            return;
        }
        reConnectTimeoutLapsed += 1000;
        reConnectTimer = setTimeout(reConnectCountdown, 1000);
    }

    function onSocketMessage(e) {
        try {
            var msg = JSON.parse(e.data);

            if (handleSocketError(msg)) return;
            if (socketLog) {
                console.log(msg);
            }
            var method = actionHandlers[msg.action];
            method && method.apply(this, [msg]);
        }
        catch(err) {
            console.log(err);
        }
    }

    function socketSendMsg(msg) {
        if (!connected) return;
        socket.send(JSON.stringify(msg));
    }

    function handleSocketError(msg) {
        return false;
    }

    function onChatMessage(msg) {
        addChatLog(msg.data);
    }

    function onChatHistory(msg) {
        if (!sessionData.user && msg.user && msg.user.id == sessionData.userid) {
            sessionData.user = msg.user;
            $('.chat-header .username').html('<strong>'+msg.user.name+'</strong>');
        }
        var msgs = msg.data;
        var lastid;
        $loader = $chatHist.find('.loader').remove();

        $.each(msgs, function(i, chatmsg) {
            chatmsg.prepend = true;
            addChatLog(chatmsg);
            lastid = chatmsg.id;
        });

        if (msg.data.length == CHATPAGESIZE) {
            $loader = $('<div class="loader">Ver mas</div>');
            $loader.on('click', function() {
                socketSendMsg({
                    action: actions.CHATHISTORY,
                    data: {
                        n: CHATPAGESIZE,
                        s: lastid
                    }});
            })
            $loader.prependTo($chatHist);
        }
    }

    function onPlayerConnected(msg) {
    }

    function onPlayerDisconnected(msg) {
    }

    function sendChatMsg() {
        if (!connected) return;
        var text = $('.bbco-chat-container .chat-input').html();
        if (text == '') return;

        var msg = {
            action: actions.CHATMSG,
            data: text
        };

        socketSendMsg(msg);
        addChatLog({ user: sessionData.user, msg: msg.data });
        $('.bbco-chat-container .chat-input').empty();
    }

    function addChatLog(message) {

        var $mess = $('<li class="message"></li>'),
            $text = $('<p></p>'),
            me = (message.user == undefined || message.user.id == sessionData.userid);
        var txt = message.msg;
        var date = new Date(message.timestamp * 1000).toLocaleString();

        var usertxt = !me ? message.user.name : '';

        if (message.issystem === "1" || message.issystem === 1) {
            $mess.addClass('system');
            usertxt = '<span>(' + date + ')</span> ' + usertxt;
        }

        $text.html(txt);

        if (!me) {
            $text.prepend($('<label class="title"></label>').html(usertxt))
        }
        $mess.append($text);

        if (me) {
            $mess.addClass('sent');
        }

        if (message.prepend) {
            $mess.prependTo($chatHist);
        }
        else {
            $mess.appendTo($chatHist);
            $chatHist.stop().animate({ scrollTop: $chatHist[0].scrollHeight }, 400);
        }
    }

    function findById(id) {
        return function(it) { return it.id == id; };
    }

    function loadChatHistory() {
        var msg = {
            action: actions.CHATHISTORY,
            data: {
                n: CHATPAGESIZE,
                s: oldestChatId
            }
        };
        socketSendMsg(msg);
    }

    function btnSendOnClick(event) {
        sendChatMsg();
    }

    function chatInputOnEnter(event) {
        if (event.keyCode === 13) {
            setTimeout(sendChatMsg, 0);
            return false;
        }
    }

    function onChatHistScroll(e) {
    }

    function onChatWindowStateChange(e) {
        if ($(this).is('.minimize')) {
            $chatCnr.addClass('collapsed');
        }
        else {
            $chatCnr.removeClass('collapsed');
        }
    }

    /**
     * To handle when an activity has been rendered. It will hide verify button on 1-camea form.
     * @param {event} event
     * @param {JQuery object} $el
     * @param {object} args
     */
    function initialize(socket) {
        $chatCnr = $(".bbco-chat-container");
        $chatHist = $(".bbco-chat-container .chat-history");
        //bind event handlers
        $chatHist.on('click', '.btn.reconnect', reConnectNow)
        $('.bbco-chat-container .btn.send').on('click', btnSendOnClick);
        $('.bbco-chat-container .chat-input').keydown(chatInputOnEnter);
        $chatCnr.find('.chat-header').on('click', '.window-action', onChatWindowStateChange);
        $chatHist.on('scroll', onChatHistScroll);

        $chatCnr.data('bbcoChat', {
            close: chatClose,
            open: chatOpen,
        })
    }

    function chatClose() {

    }

    function chatOpen() {

    }

    /**
     * Runs when all dom objects have been rendered.
     */
    $.fn.bbcochat = function(options) {

        // This is the easiest way to have default options.
        var settings = $.extend({
            // These are the defaults.
            authurl: ''
        }, options );

        AUTH_URL = settings.authurl;

        connect().then(function() {
            prepareHtml();
            initialize();

            openSocket().then(function(socket) {
                bindSocket(socket);
            }, function(err) {
                console.log('Error connecting to socket');
                console.log(err);
            });

        }, function(err) {
            console.log('Error loading bbcochat');
            console.log(err);
        });

        return this;
    };

}(jQuery));
