//
//	Standard homebridge platform setup here...

const C9800Platform = require('./c9800platform')
const packageJson = require('./package')

module.exports = (homebridge) => {
	PlatformAccessory = homebridge.PlatformAccessory
	Service = homebridge.hap.Service
	Characteristic = homebridge.hap.Characteristic
	UUIDGen = homebridge.hap.uuid
	PluginName = packageJson.name
	PlatformName = 'Cisco 9800'
	
	homebridge.registerPlatform(PluginName, PlatformName, C9800Platform, true)
}
