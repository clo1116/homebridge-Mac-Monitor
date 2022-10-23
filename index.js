const exec = require("child_process").exec;
const execSync = require("child_process").execSync;
const request = require("request");

module.exports = (api) => {
    api.registerPlatform("Mac-Monitor", MacMonitor);
}

class MacMonitor {
    constructor(log, config, api) {
        this.Characteristic = api.hap.Characteristic;
        this.Service = api.hap.Service;
        this.log = log;
        this.name = config["name"];

        this.televisionAccessory = new api.platformAccessory(this.name, api.hap.uuid.generate(this.name));
        this.televisionAccessory.category = api.hap.Categories.TELEVISION;
        this.televisionAccessory.getService(this.Service.AccessoryInformation)
            .setCharacteristic(this.Characteristic.Manufacturer, "cloStudio")
            .setCharacteristic(this.Characteristic.SerialNumber, "1116")
            .setCharacteristic(this.Characteristic.Model, "Mac-Monitor(Television)")
            .setCharacteristic(this.Characteristic.FirmwareRevision, "1.0");

        this.televisionService = this.televisionAccessory.addService(this.Service.Television);
        this.televisionService.getCharacteristic(this.Characteristic.Active)
            .onGet(this.getActiveOn.bind(this))
            .onSet(this.setActiveOn.bind(this));

        this.lightbulbService = this.televisionAccessory.addService(this.Service.Lightbulb);
        this.lightbulbService.getCharacteristic(this.Characteristic.On)
            .onGet(this.getActiveOn.bind(this))
            .onSet(this.setActiveOn.bind(this));
        this.lightbulbService.getCharacteristic(this.Characteristic.Brightness)
            .onGet(this.getBrightness.bind(this))
            .onSet(this.setBrightness.bind(this));

        setInterval(this.updateActiveOnBrightness.bind(this), 5000);

        api.publishExternalAccessories("homebridge-Mac-Monitor", [this.televisionAccessory]);
    }

    getActiveOn() {
        var length = execSync("system_profiler SPDisplaysDataType").length;
        if(length==744 || length==499) {
            return true;
        } else {
            return false;
        }
    }

    setActiveOn(activeOn) {
        if (activeOn) {
            exec("caffeinate -u -t 1500");
        } else {
            execSync("pmset displaysleepnow");
        }
        this.lightbulbService.getCharacteristic(this.Characteristic.On).updateValue(activeOn);
        this.log(this.name, "setActiveOn:", activeOn);
    }

    getBrightness() {
        const result = execSync("brightness -l|grep brightness");
        return 100*result[22]+10*result[24]+result[25]-5328;
    }

    setBrightness(brightness) {
        execSync("brightness " + String(brightness/100));
        if(brightness) {
            this.televisionService.getCharacteristic(this.Characteristic.Active).updateValue(this.Characteristic.Active.ACTIVE);
        } else {
            this.televisionService.getCharacteristic(this.Characteristic.Active).updateValue(this.Characteristic.Active.INACTIVE);
        }
        this.log(this.name, "setBrightness:", brightness);
    }

    updateActiveOnBrightness() {
        const activeOn = this.getActiveOn();
        const brightness = this.getBrightness();
        const vnc = execSync("ps -ef|grep screensharingd").length>200;
        if(activeOn==true && this.activeOn==false) {
            if(brightness==100) {
                exec("sleep 1.5; brightness 0.99; sleep 0.5; brightness 1");
            }
            if(vnc) {
                this.lock = true;
                request("https://api.day.app/yp3fBFeaAqDJSxeFqa66XD/Homebridge/Screen is being shared?url=http://clo1116.tech:7777/&icon=https://s3.bmp.ovh/imgs/2022/06/17/464916511362deb9.png"); 
            }
        }
        if(vnc==false && this.vnc==true && this.lock==true) {
            execSync("pmset displaysleepnow");
            this.lock = false;    
        }
        this.activeOn = activeOn;
        this.vnc = vnc;
        this.televisionService.getCharacteristic(this.Characteristic.Active).updateValue(activeOn);
        this.lightbulbService.getCharacteristic(this.Characteristic.On).updateValue(activeOn);
        this.lightbulbService.getCharacteristic(this.Characteristic.Brightness).updateValue(brightness);
    }
}