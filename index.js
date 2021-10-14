//
//	We are going to use axios with SSL for our RESTconf calls to the WLC,
//	so we'll need these node-modules

const https = require('https');
const axios = require('axios');
axios.defaults.withCredentials = true;

//
//	Setting up a few constant variables for reference

const wlan_cfg_path = "/restconf/data/Cisco-IOS-XE-wireless-wlan-cfg:wlan-cfg-data/wlan-cfg-entries/wlan-cfg-entry=";
const timeout = 10000;
const debug = false;

//
//	Standard homebridge setup here...

var Service;
var Characteristic;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-c9800", "Cisco 9800", C9800);
};

//
//	Setup our instance variables based on the homebridge config.json entries

function C9800(log, config) {
    this.log = log;
    this.ipAddress = config["ipAddress"];
    this.username = config["username"];
    this.password = config["password"];

//
//	Authorization and headers to be used with our axios requests

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

//
//	Setup an axios session with our timeout value, ignoring any SSL certificate issues

		this.api = axios.create({
			timeout: this.timeout,
			httpsAgent: new https.Agent({  
    		rejectUnauthorized: false
		  }),
		});

}

//
//	Define the prototype functions for getServices, getPowerState & setPowerState 

C9800.prototype = {

	//
	//	This will use axios to send a RESTconf GET request to the WLC to find the state of the WLAN

	getPowerState: function (callback) {
			let powerState;
			
			this.api.get("https://" + this.ipAddress + wlan_cfg_path + this.wlan, this.webConfig)
				.then(resp => {
					if (this.debug) {
						this.log("https://" + this.ipAddress + wlan_cfg_path + this.wlan);
					}
					powerState = resp["data"]["Cisco-IOS-XE-wireless-wlan-cfg:wlan-cfg-entry"]["apf-vap-id-data"]["wlan-status"];
					this.log("WLC response: " + powerState + " = " + (powerState === true));
					callback(null, powerState === true);
				})
				.catch(err => {
					callback(err)
				});
	},

	//
	//	This will use axios to send a RESTconf PATCH request to the WLC to set the state of the WLAN

	setPowerState: function(powerOn, callback) {
			let newData;

			newData = {"Cisco-IOS-XE-wireless-wlan-cfg:wlan-status": powerOn};
			this.api.patch("https://" + this.ipAddress + wlan_cfg_path + this.wlan 
				+ "/apf-vap-id-data/wlan-status", newData, this.webConfig)
				.then(resp => {
					if (this.debug) {						
						this.log("https://" + this.ipAddress + wlan_cfg_path + this.wlan
							+ "/apf-vap-id-data/wlan-status, Cisco-IOS-XE-wireless-wlan-cfg:wlan-status: "
							+ powerOn);
					}
					this.log("Patched " + this.wlan + " on WLC to " + powerOn);
					callback();
				})
				.catch(err => {
					callback(err)
				})
				
	},

	//
	//	This registers our getPowerState & setPowerState services and a few characteristics with homebridge

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
