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
const wlc_device_inventory = "/restconf/data/Cisco-IOS-XE-device-hardware-oper:device-hardware-data/device-hardware/device-inventory"
const wlc_software_version = "/restconf/data/Cisco-IOS-XE-device-hardware-oper:device-hardware-data/device-hardware/device-system-data/software-version"
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
			this.Service = this.api.hap.Service
  		this.Characteristic = this.api.hap.Characteristic
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
				this.log.info('Restoring accessory from cache:', accessory.displayName)

				// create the accessory handler
				// this is imported from `c9000platformAccessory.js`
				new C9800PlatformAccessory(this, accessory)

				// add the restored accessory to the accessories cache so we can track if it has already been registered
				this.accessories.push(accessory)
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
			var wlcDevice = {
				"displayName": device.displayName,
				"ipAddress": device.ipAddress,
				"username": device.username,
				"password": device.password,
				"model": "",
				"serial": "",
				"firmware": "0.1",
				"wlanCount": 0,
				"wlanList": [],
				"ssidList": []
			}
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
			this.session.get('https://'+device.ipAddress+wlc_device_inventory, webConfig)
				.then(response => {
					var wlcModel = response.data["Cisco-IOS-XE-device-hardware-oper:device-inventory"][0]["part-number"]
					var wlcSerial = response.data["Cisco-IOS-XE-device-hardware-oper:device-inventory"][0]["serial-number"]
					this.log('WLC model: %s, serial: %s',wlcModel,wlcSerial)
			
					wlcDevice.model = wlcModel === "" ? "C9800" : wlcModel
					wlcDevice.serial = wlcSerial === "" ? "DummySerial" : wlcSerial

					this.session.get('https://'+device.ipAddress+wlc_software_version, webConfig)
						.then(resp2 => {
							var wlcFirmware = resp2.data["Cisco-IOS-XE-device-hardware-oper:software-version"]
							wlcFirmware = wlcFirmware.substring((wlcFirmware.search("Version ")+8))
							wlcFirmware = wlcFirmware.substring(0,wlcFirmware.search(","))
							this.log('WLC firmware: %s',wlcFirmware)
			
							wlcDevice.firmware = wlcFirmware === "" ? "0.1" : wlcFirmware

							this.session.get('https://'+device.ipAddress+wlan_cfg_entries, webConfig)
								.then(resp3 => {
									wlcDevice.wlanCount = Object.keys(resp3.data["Cisco-IOS-XE-wireless-wlan-cfg:wlan-cfg-entries"]["wlan-cfg-entry"]).length
									this.log("WLC response: " + wlcDevice.wlanCount + " WLAN(s).")
									const wlans = resp3.data["Cisco-IOS-XE-wireless-wlan-cfg:wlan-cfg-entries"]["wlan-cfg-entry"]
									for (var i = 0; i < wlcDevice.wlanCount; i++) {
										if (this.debug) {
											this.log(i, wlans[i]["profile-name"] + " = " + wlans[i]["apf-vap-id-data"]["ssid"])
										}
										var wlan = wlans[i]["profile-name"]
										var ssid = wlans[i]["apf-vap-id-data"]["ssid"]
										wlcDevice.wlanList[i]=wlan
										wlcDevice.ssidList[i]=ssid
										this.log(`SSID ${ssid}`, i)
									}

									// generate a unique id for the accessory this should be generated from
									// something globally unique, but constant, for example, the device serial
									// number or MAC address
									const uuid = this.api.hap.uuid.generate(device.ipAddress);

									// check that the device has not already been registered by checking the
									// cached devices we stored in the `configureAccessory` method above
									if (!this.accessories.find(accessory => accessory.UUID === uuid)) {
										this.log.info('Registering new accessory:', device.displayName, uuid)

										// create a new accessory
										const accessory = new this.api.platformAccessory(device.displayName, uuid)

										// store a copy of the device object in the `accessory.context`
										// the `context` property can be used to store any data about the accessory you may need
										accessory.context.device = wlcDevice
						
										for (let i=0; i<accessory.context.device.wlanCount; i++){
											if (this.debug) {this.log.info(i, accessory.context.device.wlanList[i] + " = " + accessory.context.device.ssidList[i])}
										}

										// create the accessory handler
										// this is imported from `platformAccessory.js`
										new C9800PlatformAccessory(this, accessory)

										// link the accessory to your platform
										this.api.registerPlatformAccessories(PluginName, PlatformName, [accessory])

										// push into accessory cache
										this.accessories.push(accessory)
										this.log.info('New accessory:', accessory.displayName)

										// it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
										// this.api.unregisterPlatformAccessories(PluginName, PlatformName, [accessory]);
									}
								})
								.catch(err => {
									this.log.error(err.stack)
								})
						})
						.catch(err => {
							this.log.error(err.stack)
						})
				})
				.catch(err => {
					this.log.error(err.stack)
				})
		}
	}
}

module.exports=C9800Platform;