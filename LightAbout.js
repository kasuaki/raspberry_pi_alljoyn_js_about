var AJ = require('AllJoyn');
var IO = require('IO');

var SERVICE_NAME           = "org.alljoyn.SensorLightCamera";
var INTERFACE_NAME_SENSOR  = "org.alljoyn.SensorLightCamera.Sensor";
var SERVICE_PATH_SENSOR    = "/org/alljoyn/SensorLightCamera/Sensor";
var INTERFACE_NAME_LIGHT = "org.alljoyn.SensorLightCamera.Light";
var SERVICE_PATH_LIGHT     = "/org/alljoyn/SensorLightCamera/Light";

var pin = '18';

// gpio18がなければ設定.
var listBuf = IO.system('sudo ls /sys/class/gpio/');
var listStr = listBuf.toString('UTF-8');
var list = listStr.split('\n');

if (list.indexOf('gpio' + pin) < 0) {
	IO.system('sudo echo ' + pin + ' > /sys/class/gpio/export');
	IO.system('sudo echo out > /sys/class/gpio/gpio' + pin + '/direction');
}
//IO.system('sudo echo ' + pin + ' > /sys/class/gpio/unexport');

AJ.interfaceDefinition[INTERFACE_NAME_LIGHT] =
{
	lit:{ type:AJ.SIGNAL, args:["b"]},
	light:{ type:AJ.PROPERTY, signature:'b', access: "R" },
	always_light:{ type:AJ.PROPERTY, signature:'b', access: "RW" },
};

properties = {
	light: false,
	always_light: false,
};

AJ.objectDefinition[SERVICE_PATH_LIGHT] = {
	interfaces:[INTERFACE_NAME_LIGHT]
};

var sensorService;
AJ.onAttach = function()
{
	print("AJ.onAttach");

	AJ.findService(INTERFACE_NAME_SENSOR, function(svc) {

		sensorService = svc;
		print(JSON.stringify(svc));
		print(JSON.stringify(AJ.load("AppName")));

		AJ.objectDefinition[svc.path] = {
			interfaces:svc.interfaces
		};
		AJ.addMatch(INTERFACE_NAME_SENSOR, 'sensed');

		AJ.advertiseName(SERVICE_NAME);
	});

//	AJ.findServiceByName(SERVICE_NAME, {
//		interfaces: [INTERFACE_NAME_SENSOR],
//		path: SERVICE_PATH_SENSOR,
//		port: 25,
//	}, function(svc) {
//		print(JSON.stringify(svc));
//	});
}

AJ.onPeerConnected = function(svc)
{
	print("onPeerConnected.svc: ", JSON.stringify(svc));
};

AJ.onDetach = function()
{
	print("AJ.onDetach");
}

AJ.onPropGet = function(iface, prop)
{
	if (iface == INTERFACE_NAME_LIGHT) {
		this.reply(properties[prop]);
	} else {
		throw('rejected');
	}
}

AJ.onSignal = function() {

	print("Object path: ", this.path);
	print("Interface: ", this.iface);
	print("Member: ", this.member);
	print("Arguments: ", JSON.stringify(arguments));

	switch(this.member) {
		case "sensed":
			onSensed(arguments);
			break;
		default:
			break;
	}
}

function onSensed(arguments) {

	var val = arguments["0"];
	print(IO.system('date') + " : sense: " + val);

	// bool => int;
    val = val ? 1 : 0;

	print("always_light: ", properties["always_light"]);
	if (properties["always_light"] == false) {

		// 日中はライトは付けない.
		var hour = IO.system('date +%H');
		if ((hour >= 7) && (hour <= 17)) {
			val = 0;
		}
	}

	print(IO.system('date'));
	print("light: " + val);


	// 異なっている場合のみ実施.
	if (properties["light"] != val) {

		properties["light"] = val;
		IO.system('sudo echo ' + val + ' > /sys/class/gpio/gpio' + pin + '/value');

		var signal = AJ.signal(SERVICE_PATH_LIGHT, {lit:INTERFACE_NAME_LIGHT});
		signal.sessionless = true;
		signal.timeToLive = 0;
		signal.send(val);
		print("signal: ", JSON.stringify(signal));
	}
}
