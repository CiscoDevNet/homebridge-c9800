[![published](https://static.production.devnetcloud.com/codeexchange/assets/images/devnet-published.svg)](https://developer.cisco.com/codeexchange/github/repo/CiscoDevNet/homebridge-c9800)

# A [Cisco](https://www.cisco.com) Wireless LAN Controller plugin for [Homebridge](https://github.com/nfarina/homebridge).  

---

# Purpose

The purpose of this code is to create a Homebridge plugin to allow a wireless administrator to enable or disable a WLAN through a Light Switch control in Apple’s homekit or through Siri.

![alt text](example.png "Dashboard Example Screenshot")

# Intended Audience

This code was originally designed for my personal use at home, to allow me to toggle my guest wireless network on and off as needed.  This example could be helpful for those who are:

- Wishing to learn how to use RESTCONF
- Considering methods of automating configuration changes on the C9800 WLC
- Interested in integrating Cisco gear into their home automation

# How This Code Works

This NodeJS code will accomplish the following tasks:
1. Creates a Light Switch accessory in Homebridge, to be shared with Apple homekit
2. Exposes two functions to Homebridge – one to interrogate the WLAN status, the other to set the status
3. Provides any error back to Homebridge for logging


# Installation Steps
Run these commands:

    sudo npm install -g homebridge
    sudo npm install -g homebridge-c9800


NOTE: If you install homebridge like this:

    sudo npm install -g --unsafe-perm homebridge

Then all subsequent plugin installations must be like this:

    sudo npm install -g --unsafe-perm homebridge-c9800

# Configuration
Example accessory config (needs to be added to the homebridge config.json):
```
		"accessories": [
			{
				"name": "Guest WiFi",
				"ipAddress": "192.168.1.115",
				"username": "admin",
				"password": "password",
				"wlanName": "guest",
				"model": "C9800CL",
				"serial": "myserialno",
				"timeout": 10000,
				"debug": false,
				"accessory": "Cisco 9800"
			}
		]
```

### Config Explanation:

Field           						| Description
----------------------------|------------
**accessory**   						| (required) Must always be "Cisco 9800".
**name**										| (required) The name you want to use for the light switch widget.
**ipAddress**								| (required) The IP address of the WLC (should be static, not DHCP).
**username**								| (required) The username used to access the WLC.
**password**								| (required) The password used to access the WLC.
**wlanName**								| (required) The WLAN Name associated with the SSID on the WLC.
**model**										| (optional) This shows up in the homekit accessory Characteristics.
**serial**									| (optional) This shows up in the homekit accessory Characteristics.
**timeout**									| (optional) The timeout duration in ms for the web API calls.
**debug**										| (optional) Enables additional logging.

To make your WLC work with the plugin:

1. Connect your WLC to your network.
2. Configure your WLC.
3. Enable restconf on the WLC.
4. Write down the IP address of the WLC.
5. Create your config file according to the above example (or using the Homebridge UI).

# FAQ
1. What is the purpose of each file?
   - [index.js](index.js) - Contains the NodeJS Homebridge plugin
   - [config.schema.json](config.schema.json) - Contains the schema to allow configuration of the plugin through the Homebridge UI
2. Does this code use NETCONF, RESTCONF, or both?
   - This code leverages RESTCONF APIs and YANG data models only. NETCONF is not used.
3. How do I enable RESTCONF on my Catalyst 9800 WLC?
   - From a command prompt, type:
      ```console
      WLC(config)# restconf
      ```
   - More information can be found [here](https://developer.cisco.com/docs/ios-xe/#!enabling-restconf-on-ios-xe/authentication)
4. How do I properly modify the Homebridge config.json file with the appropriate information?
   - See the config explanation section above.
5. Will this work with my model of Wireless LAN Controller?
   - This was tested to work with the Cisco Catalyst 9800CL. It should work with any other model of Cisco Catalyst 9800.
   - It has not been tested on the Cisco Embedded Wireless LAN Controller on the C9100-series access points.


# More information
Check out https://github.com/nfarina/homebridge for more information about Homebridge.

