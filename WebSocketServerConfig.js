const { WebSocketServer } = require('ws');
var fs = require('fs');

const gLMTFilePath = 'LMT.json';
const gConnectionsFilePath = 'Connections.json';

/** The command name for getValueRequest JSon message */
const GET_CONFIG_REQUEST_NAME = "getConfigRequest";

var gMissionList = [];
var gStationList = [];
var gConnectionList = [];

function loadLMTFile(lmtFilePath) {
  try {
    // Load configuration file
    console.log(`Loading LMT file '${lmtFilePath}'`);
    let configurationRawData = fs.readFileSync(lmtFilePath);
    let lmtConfig = JSON.parse(configurationRawData);

    if (lmtConfig != null)
    {
      if (lmtConfig.hasOwnProperty("stations")) {
        console.error(`Stations:`);
        lmtConfig.stations.forEach((station, index) => {
          console.error(`${index}: ${JSON.stringify(station)}.`);
          gStationList.push(station);
        });
      } else {
        console.error("ERROR: LMT config file does not contain the 'stations' member.");
      }

      if (lmtConfig.hasOwnProperty("missions")) {
        console.error(`Missions:`);
        lmtConfig.missions.forEach((mission, index) => {
          console.error(`${index}: ${JSON.stringify(mission)}.`);
          gMissionList.push(mission);
        });
      } else {
        console.error("ERROR: LMT config file does not contain the 'missions' member.");
      }
    }
    else {
      console.error("ERROR: LMT config file cannot be read. File path: " + lmtFilePath);
    }
  } catch (err) {
    console.error(`ERROR: An exception occured while loading the LMT config file ('${lmtFilePath}'). Make sure it is available and valid.`);
    console.error(`Exception message: ${err}`);
    throw err; // We want the application to fail if there is a problem with the configuration file so we throw the error.
  }
}

function loadConnectionsFile(connectionsFilePath) {
  try {
    // Load configuration file
    console.log(`Loading Connections file '${connectionsFilePath}'`);
    let configurationRawData = fs.readFileSync(connectionsFilePath);
    let connectionsConfig = JSON.parse(configurationRawData);

    if (connectionsConfig != null)
    {
      console.error(`Connections:`);
      if (Array.isArray(connectionsConfig)) {
        connectionsConfig.forEach((station, index) => {
          console.error(`${index}: ${JSON.stringify(station)}.`);
          gConnectionList.push(station);
        });
      }
      else {
        console.error("ERROR: Connections config file should contain an array.");
      }
    }
    else {
      console.error("ERROR: Connections config file cannot be read. File path: " + connectionsFilePath);
    }
  } catch (err) {
    console.error(`ERROR: An exception occured while loading the Connections config file ('${connectionsFilePath}'). Make sure it is available and valid.`);
    console.error(`Exception message: ${err}`);
    throw err; // We want the application to fail if there is a problem with the configuration file so we throw the error.
  }
}

/**
 * Generates a random string of the length passed in parameter.
 * @param length The length of the string to generate.
 * @returns Returns a random string of the length passed in parameter.
 */
 function generateRandomString(length) {
  var result           = '';
  var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;

  for ( var i = 0; i < length; i++ ) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}

/**
 * Generates a new client identifier that will be used in the logs.
 * @returns Returns a new client identifier.
 */
 function generateClientId() {
  return generateRandomString(10);
}

// Load LMT config file
loadLMTFile(gLMTFilePath);

// Load Connections config file
loadConnectionsFile(gConnectionsFilePath);

//DBG
const d = new Date();
//console.log('DBG time: ', d.getHours(), ':', d.getMinutes(), ':', d.getSeconds(), '.', d.getMilliseconds());
console.log(`Time: ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}.${d.getMilliseconds()}`);

//DBG

const configServer = new WebSocketServer({ port: 21003 });

configServer.on('connection', function connection(ws) {
  console.debug("wssWebConfig: A client has connected...");
  ws.clientId = generateClientId();
  ws.on('message', function onMessage(message) {
    console.debug("wssWebConfig: Message received on wssWebConfig (webDDR) service. ClientId: " + ws.clientId + ", Message: " + message);

    var parsedObject = JSON.parse(message);

    if (parsedObject.hasOwnProperty(GET_CONFIG_REQUEST_NAME))
    {
        if (parsedObject[GET_CONFIG_REQUEST_NAME].hasOwnProperty("xpath")) {
          if (parsedObject[GET_CONFIG_REQUEST_NAME].xpath == '/LMTType/StationList/Station') {
            let stations = {
              "xpath" : "/LMTType/StationList/Station",
               "config" : gStationList
            }
            const jsonValue = JSON.stringify({"getConfigResponse" : stations});
            ws.send(jsonValue);
          } else if (parsedObject[GET_CONFIG_REQUEST_NAME].xpath == '/LMTType/MissionList/Mission') {
            let missions = {
              "xpath" : "/LMTType/MissionList/Mission",
               "config" : gMissionList
            }
            const jsonValue = JSON.stringify({"getConfigResponse" : missions});
            ws.send(jsonValue);
          } else if (parsedObject[GET_CONFIG_REQUEST_NAME].xpath == '/StationConnections/Station') {
            let connections = {
              "xpath" : "/StationConnections/Station",
              "config" : gConnectionList
            }
            const jsonValue = JSON.stringify({"getConfigResponse" : connections});
            ws.send(jsonValue);
          }
        }
    }
    else
    {
      console.warn("wssWebConfig: Ignoring request: " + parsedObject);
    }
  });
});

module.exports = {configServer};