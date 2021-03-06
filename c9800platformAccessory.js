'use strict'
const wlan_cfg_entries = "/restconf/data/Cisco-IOS-XE-wireless-wlan-cfg:wlan-cfg-data/wlan-cfg-entries"
const wlan_cfg_path = wlan_cfg_entries + "/wlan-cfg-entry="

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
class C9800PlatformAccessory {
//private service: Service;

  constructor(platform,accessory){
  	this.platform = platform
  	this.accessory = accessory
  	this.services = []
  	  	
    for (let i = 0; i < this.accessory.context.device.wlanCount; i++) {
	    const iString = i.toString()
	    
	    const switchService = this.accessory.getService(iString) ?? this.accessory.addService(this.platform.Service.Switch, this.accessory.context.device.ssidList[i], iString)
      // To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
      // when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
      // this.accessory.getService('NAME') ?? this.accessory.addService(this.platform.Service.Switch, 'NAME', 'USER_DEFINED_SUBTYPE');

      // register handlers for the On/Off Characteristic
      switchService.getCharacteristic(this.platform.Characteristic.On)
        .on('set', this.setPowerState.bind(this, i))   // SET - bind to the `setPowerState` method below
    }
 
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Cisco')
      .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.device.model)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.context.device.serial)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, this.accessory.context.device.firmware)
		this.timer = setTimeout(this.poll.bind(this), this.platform.refreshInterval)
		this.poll()

	}

	async setPowerState(index, state, callback) {
		const context = this.accessory.context
		try {
			this.platform.log('Setting WLAN state for %s = %s', this.accessory.context.device.ssidList[index], state)
			const response = await this.platform.session({
				method: 'patch',
				url: 'https://'+context.device.ipAddress+wlan_cfg_path+this.accessory.context.device.wlanList[index]+'/apf-vap-id-data/wlan-status',
				data: {"Cisco-IOS-XE-wireless-wlan-cfg:wlan-status": state},
				auth: {
					username: context.device.username,
					password: context.device.password
				},
				headers: {
					'Accept': 'application/yang-data+json',
					'Content-Type': 'application/yang-data+json'
				},
				timeout: this.platform.timeout
			}).catch(err => {
					this.platform.log.error('Error setting WLAN state %s',err)
					this.platform.log.warn(err.response.data.errors)
			})
			callback (null)
		}catch(err) {
			this.platform.log.error('Error setting WLAN state %s', err)
			callback (err)
		}
	}

	
	async poll() {
		if(this.timer) clearTimeout(this.timer)
		this.timer = null
		for (let i = 0; i < this.accessory.context.device.wlanCount; i++) {
			try {
				const response = await this.platform.session({
					method: 'get',
					url: 'https://' + this.accessory.context.device.ipAddress+wlan_cfg_path + this.accessory.context.device.wlanList[i]+'/apf-vap-id-data/wlan-status',
					data: {},
					auth: {
						username: this.accessory.context.device.username,
						password: this.accessory.context.device.password
					},
					headers: {
						'Accept': 'application/yang-data+json',
						'Content-Type': 'application/yang-data+json'
					},
					timeout: this.platform.timeout
				}).catch(err => {
						this.platform.log.error('Error getting WLAN state %s',err)
				})
				const powerState = response["data"]["Cisco-IOS-XE-wireless-wlan-cfg:wlan-status"];
				this.platform.log('Get WLAN state for %s = %s',  this.accessory.context.device.ssidList[i], (powerState === true))
				this.accessory.services[i+1].getCharacteristic(Characteristic.On).updateValue(powerState === true)
			}catch(err) {
				this.platform.log.error('Error getting WLAN state %s', err)
			}
		}
		this.timer = setTimeout(this.poll.bind(this), this.platform.refreshInterval)	
	}
}
module.exports=C9800PlatformAccessory;
