'use strict';
function ServerListener(url, onconnect, ondata, onerror) {
    this.timeoutTimer = null;
    this.socket = null;
    this.url = url;

    var self = this;

    this.seq = 0;

    this.decodeData = function(data) {
        var view = new DataView(data);
        var q = view.getUint8(0);
        var coords = {};
        if (q === 0) {
            coords = {
                lat: view.getFloat32(2, false),
                lon: view.getFloat32(6, false),
                spd: view.getUint8(10),
                q: q,
                seq: self.seq
            };
        } else {
            coords = {
                lat: null,
                lon: null,
                spd: null,
                q: q,
                seq: self.seq
            };
        }
        var state = {
            updated: new Date(),
            isValid: coords.q === 0,
            isAgentOnline: coords.q === 0 || coords.q === 1
        };
        var parsedData = {
            coords: coords,
            state: state
        };
        return parsedData;
    };

    this.clearNoDataTimeout = function() {
        if (self.timeoutTimer) {
            clearTimeout(self.timeoutTimer);
        }
    };

    this.setNoDataTimeout = function() {
        self.clearNoDataTimeout();
        self.timeoutTimer = setTimeout(function() { self.socket.close(); }, 12500);
    };

    this.connect = function() {
        self.socket = new WebSocket(self.url);
        self.socket.binaryType = 'arraybuffer';

        self.socket.onopen = function() {
            console.log('Connection established');
            onconnect();
            self.setNoDataTimeout();
        };

        self.socket.onclose = function(event) {
            if (event.wasClean) {
                console.log('Graceful connection shutdown');
            } else {
                console.log('Connection was interrupted');
            }
            console.log('Code: ' + event.code + ' reason: ' + event.reason);
            onerror();
            setTimeout(self.connect, 1000);
            self.clearNoDataTimeout();
        };

        self.socket.onmessage = function(event) {
            var data = self.decodeData(event.data);
            console.log(JSON.stringify(data));
            self.setNoDataTimeout();
            ondata(data);
            self.seq++;
        };
    };
};
