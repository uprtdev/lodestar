function DataUpdater(map, infoDiv) {
    this.lastData = {};
    this.isFresh = false;
    this.isShowing = false;
    this.map = map;
    this.infoDiv = infoDiv;
    this.silenceTimer = null;

    var self = this;

    this.showConnected = function() {
        infoDiv.innerHTML = 'Connection established';
    };

    this.showConnectError = function() {
        infoDiv.innerHTML = 'Something went wrong, connection error';
    };

    this.markInactive = function() {
        self.isFresh = false;
        self.updateData();
    };

    this.restartSilenceTimer = function() {
        if (self.silenceTimer) {
            clearTimeout(self.silenceTimer);
        }
        self.silenceTimer = setTimeout(self.silenceTimerStep1, 3000);
    };

    this.silenceTimerStep1 = function() {
        self.isFresh = false;
        self.updateData();
        self.silenceTimer = setTimeout(self.silenceTimerStep2, 7000);
    };

    this.silenceTimerStep2 = function() {
        self.isShowing = false;
        self.updateData();
    };

    this.updateData = function(newData) {
        if (newData) {
            self.lastData.state = newData.state;
            if (newData.state.isValid) {
                self.lastData.coords = newData.coords;
                self.isFresh = true;
                self.isShowing = true;
                self.restartSilenceTimer();
            }
        }

        var fromUpd = self.lastData.state.updated.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1");

        if (self.isShowing) {
            if (self.isFresh) {
                map.markerG.setLatLng([0, 0]);
                if (self.lastData.coords) {
                    map.marker.setLatLng([self.lastData.coords.lon, self.lastData.coords.lat]);
                }
            } else {
                map.marker.setLatLng([0, 0]);
                if (self.lastData.coords) {
                    map.markerG.setLatLng([self.lastData.coords.lon, self.lastData.coords.lat]);
                }
            }
            if (self.lastData.state.isValid) {
                self.infoDiv.innerHTML = "- longitude: " + Math.round(self.lastData.coords.lon * 100000) / 100000 + ", <br/>- latitude: " + Math.round(self.lastData.coords.lat * 100000) / 100000 + ", <br/><!-- - speed: " + self.lastData.coords.spd + " км/ч, <br/> -->- updated: " + fromUpd;
                self.map.map.setView([self.lastData.coords.lon, self.lastData.coords.lat], map.map.getZoom());
            }

        } else {
            self.map.marker.setLatLng([0, 0]);
            self.map.markerG.setLatLng([0, 0]);
            if (self.lastData && self.lastData.state.isAgentOnline) {
                self.infoDiv.innerHTML = "Waiting for geoposition data from the object...<br/><br/><br/>";
            } else {
                self.infoDiv.innerHTML = "Waiting for connection with the object...<br/><br/><br/>";
            }
        }
    };
};