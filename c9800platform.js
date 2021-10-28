'use strict'

//
//	We are going to use axios with SSL for our RESTconf calls to the WLC,
//	so we'll need these node-modules

const https = require('https')
const axios = require('axios')
axios.defaults.withCredentials = true
const packageJson=require('./package')
const C9800PlatformAccessory=require('./c9800platformAccessory')

//
//	Setting up a few constant variables for reference

const wlan_cfg_entries = "/restconf/data/Cisco-IOS-XE-wireless-wlan-cfg:wlan-cfg-data/wlan-cfg-entries"
const wlan_cfg_path = wlan_cfg_entries + "/wlan-cfg-entry="
const timeout = 10000
const	PluginName = packageJson.name
//const	PlatformName = PLATFORM_NAME

class C9800Platform {

	//
	//	Setup our instance variables based on the homebridge config.json entries

	constructor(log, config, api) {

		this.log = log
		this.config = config
		this.name = config["name"]
		this.timeout = config["timeout"] === undefined ? timeout : config["timeout"]
		this.debug = config["debug"] === undefined ? false : config["debug"]
		this.accessories = []
		this.session = axios.create({
			timeout: this.timeout,
			httpsAgent: new https.Agent({  
				rejectUnauthorized: false
				}),
		})

		if(api){
			this.api=api
			this.Service = this.api.hap.Service;
  		this.Characteristic = this.api.hap.Characteristic;
			this.api.on("didFinishLaunching", function(){
				//Get devices
				this.getC9800Devices()
			}.bind(this))
		}
	}
	
	identify(){
		this.log('Identify the WLC')
	}
	
	configureAccessory(accessory) {
    if (this.config.wlcs.find( (wlc) => wlc.ipAddress === accessory.context.device.ipAddress ))  {
			if (!this.accessories.find( (anAccessory) => anAccessory.context.device.ipAddress === accessory.context.device.ipAddress ))  {
				this.log.info('Restoring accessory from cache:', accessory.displayName);

				// create the accessory handler
				// this is imported from `c9000platformAccessory.ts`
				new C9800PlatformAccessory(this, accessory);

				// add the restored accessory to the accessories cache so we can track if it has already been registered
				this.accessories.push(accessory);
			}
    }
	}
	
	getC9800Devices(){

		//
    // Check for a blank config and return without registering accessories

		if(!this.config){
			this.log.warn('Ignoring C9800 Platform setup because it is not configured')
			return
		}
		
    // loop over the discovered devices and register each one if it has not already been registered
		for (const device of this.config.wlcs){
			this.log.debug('Getting WLAN list')
			var wlanList = []
			var ssidList = []
			const webConfig = {
				data: {},
				auth: {
					username: device.username,
					password: device.password
				},
				headers: {
					'Accept': 'application/yang-data+json',
					'Content-Type': 'application/yang-data+json'
				},
			};
			this.session.get('https://'+device.ipAddress+wlan_cfg_entries, webConfig)
				.then(response => {
					const wlanCount = Object.keys(response.data["Cisco-IOS-XE-wireless-wlan-cfg:wlan-cfg-entries"]["wlan-cfg-entry"]).length
					this.log("WLC response: " + wlanCount + " WLAN(s).")
					const wlans = response.data["Cisco-IOS-XE-wireless-wlan-cfg:wlan-cfg-entries"]["wlan-cfg-entry"]
					for (var i = 0; i < wlanCount; i++) {
						if (this.debug) {
							this.log(i, wlans[i]["profile-name"] + " = " + wlans[i]["apf-vap-id-data"]["ssid"])
						}
						var wlan = wlans[i]["profile-name"]
						var ssid = wlans[i]["apf-vap-id-data"]["ssid"]
						wlanList[i]=wlan
						ssidList[i]=ssid
						this.log(`SSID ${ssid}`, i)
					}
					var wlanInfo = {wlanCount,wlanList,ssidList}
					
					device.model = device.model === undefined ? "C9800" : device.model
					device.serial = device.serial === undefined ? "DummySerial" : device.serial

					// generate a unique id for the accessory this should be generated from
					// something globally unique, but constant, for example, the device serial
					// number or MAC address
					const uuid = this.api.hap.uuid.generate(device.serial);

					// check that the device has not already been registered by checking the
					// cached devices we stored in the `configureAccessory` method above
					if (!this.accessories.find(accessory => accessory.UUID === uuid)) {
						this.log.info('Registering new accessory:', device.displayName, uuid);

						// create a new accessory
						const accessory = new this.api.platformAccessory(device.displayName, uuid);

						// store a copy of the device object in the `accessory.context`
						// the `context` property can be used to store any data about the accessory you may need
						accessory.context.device = device;

						accessory.context.wlanInfo = wlanInfo
						
						for (let i=0; i<accessory.context.wlanInfo.wlanCount; i++){
							if (this.debug) {this.log.info(i, accessory.context.wlanInfo.wlanList[i] + " = " + accessory.context.wlanInfo.ssidList[i])}
						}

						// create the accessory handler
						// this is imported from `platformAccessory.ts`
						new C9800PlatformAccessory(this, accessory);

						// link the accessory to your platform
						this.api.registerPlatformAccessories(PluginName, PlatformName, [accessory]);

						// push into accessory cache
						this.accessories.push(accessory);

						// it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
						// this.api.unregisterPlatformAccessories(PluginName, PlatformName, [accessory]);
				}
			})
			.catch(err => {
				this.log.error(err.stack)
			})
		}
	}
}

module.exports=C9800Platform;