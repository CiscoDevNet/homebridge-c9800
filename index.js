const axios = require('axios');
axios.defaults.withCredentials = true;

const https = require('https');

const query_path = "/restconf/data/Cisco-IOS-XE-wireless-wlan-cfg:wlan-cfg-data/wlan-cfg-entries/wlan-cfg-entry=";

const timeout = 10000;

const debug = false;

var Service;
var Characteristic;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-c9800", "Cisco 9800", C9800);
};


function C9800(log, config) {
    this.log = log;
    this.ipAddress = config["ipAddress"];
    this.username = config["username"];
    this.password = config["password"];
    this.webConfig = {
			data: {},
			auth: {
				username: this.username,
				password: this.password
			},
			headers: {
				Accept: "application/yang-data+json",
				"Content-Type": "application/yang-data+json"
			},
		};
    this.wlan = config["wlanName"];
    this.model = config["model"] === undefined ? "" : config["model"];
    this.serial = config["serial"] === undefined ? "" : config["serial"];
    this.name = config["name"];
    this.timeout = config["timeout"] === undefined ? timeout : config["timeout"];
    this.debug = config["debug"] === undefined ? debug : config["debug"];
		this.api = axios.create({
			timeout: this.timeout,
			httpsAgent: new https.Agent({  
    		rejectUnauthorized: false
		  }),
		});

}

C9800.prototype = {

  	getPowerState: function (callback) {
       
				this.api.get('https://' + this.ipAddress + query_path + this.wlan, this.webConfig)
					.then(resp => {
					  if (this.debug) {
							this.log("https://" + this.ipAddress + query_path + this.wlan);
							this.log("WLC response: " + resp["data"]["Cisco-IOS-XE-wireless-wlan-cfg:wlan-cfg-entry"]["apf-vap-id-data"]["wlan-status"] + " = " + (resp["data"]["Cisco-IOS-XE-wireless-wlan-cfg:wlan-cfg-entry"]["apf-vap-id-data"]["wlan-status"] === true));
        		}

						callback(null, resp["data"]["Cisco-IOS-XE-wireless-wlan-cfg:wlan-cfg-entry"]["apf-vap-id-data"]["wlan-status"] === true);
					})
					.catch(err => {
						callback(err)
					});
    },

    setPowerState: function(powerOn, callback) {
				let newData;
				this.api.get('https://' + this.ipAddress + query_path + this.wlan, this.webConfig)
					.then(resp => {
						newData = {"Cisco-IOS-XE-wireless-wlan-cfg:wlan-status": powerOn};
					  if (this.debug) {
							this.log("https://" + this.ipAddress + query_path + this.wlan);
							this.log("WLC response: " + resp["data"]["Cisco-IOS-XE-wireless-wlan-cfg:wlan-cfg-entry"]["apf-vap-id-data"]["wlan-status"]);
							this.log (newData)
						}
						this.api.patch('https://' + this.ipAddress + query_path + this.wlan + "/apf-vap-id-data/wlan-status", newData, this.webConfig)
							.then(resp => {
							  if (this.debug) {						
									this.log("Patched SSID on WLC to " + powerOn);
								}
							})
						callback();
					})
					.catch(err => {
						callback(err)
					})
					
    },

    getServices: function () {
        const informationService = new Service.AccessoryInformation();

        informationService
            .setCharacteristic(Characteristic.Manufacturer, "Cisco")
            .setCharacteristic(Characteristic.Model, this.model)
            .setCharacteristic(Characteristic.SerialNumber, this.serial);

        switchService = new Service.Switch(this.name);
        switchService
            .getCharacteristic(Characteristic.On)
                .on('get', this.getPowerState.bind(this))
                .on('set', this.setPowerState.bind(this));

        this.informationService = informationService;
        this.switchService = switchService;
        return [informationService, switchService];
    }
};
