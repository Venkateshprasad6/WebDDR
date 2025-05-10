const { WebSocketServer } = require('ws');
var fs = require('fs');

// Request names
/** The command name for subscribeVariablesRequest JSon message */
const SUBSCRIBE_VARIABLES_REQUEST_NAME = 'subscribeVariablesRequest';

/** The command name for getValueRequest JSon message */
const GET_VALUE_REQUEST_NAME = 'getValueRequest';

/** The command name for setVariableValueRequest JSon message */
const SET_VARIABLE_VALUE_REQUEST_NAME = 'setVariableValueRequest';

/** The command name for getVariableCountRequest JSon message */
const GET_VARIABLE_COUNT_REQUEST_NAME = 'getVariableCountRequest';

/** The command name for getVariableDefinitionsRequest JSon message */
const GET_VARIABLE_DEFINITIONS_REQUEST_NAME = 'getVariableDefinitionsRequest';

const gConfigurationFilePath = 'variables.json';

let gDDRDictionary = [];

function loadConfiguration(configurationFilePath) {
  try {
    // Load configuration file
    console.log(`Loading configuration file '${configurationFilePath}'`);
    let configurationRawData = fs.readFileSync(configurationFilePath);
    let configuration = JSON.parse(configurationRawData);
    console.log('configuration Variable.json', configuration);

    if (configuration != null) {
      // Load the variables with their default value
      if (configuration.hasOwnProperty('variables')) {
        configuration.variables.forEach(function variablesEnumerator(variable) {
          if (
            variable.hasOwnProperty('variableName') &&
            variable.hasOwnProperty('defaultValue')
          ) {
            console.log(
              'Setting variable ' +
                variable.variableName +
                ' to default value: ' +
                variable.defaultValue
            );
            setVariableValue(variable.variableName, variable.defaultValue);
          } else {
            console.error(
              "ERROR: Configuration file has an error in the variables section. 'variableName' and/or 'defaultValue' is missing for one of the variable items."
            );
          }
        });
      } else {
        console.error(
          "ERROR: Configuration file does not contain the 'variables' member."
        );
      }
    } else {
      console.error(
        'ERROR: Configuration file cannot be read. File path: ' +
          configurationFilePath
      );
    }
  } catch (err) {
    console.error(
      `ERROR: An exception occured while loading the configuration file. Make sure it is available and valid. Configuration file: '${configurationFilePath}'`
    );
    console.error(`Exception message: ${err}`);
    throw err; // We want the application to fail if there is a problem with the configuration file so we throw the error.
  }
}

function setVariableValue(variableName, variableValue) {
  // Update the internal value
  gDDRDictionary[variableName] = variableValue;
}

/**
 * Gets the variable value of the internal DDR server for the variable name passed in the parameter.
 * @param variableName The variable name to get the value.
 * @returns Returns the variable value of the internal DDR server for the variable name passed in the parameter.
 */
function getVariableValue(variableName) {
  var variableValue = null;

  // Check if the variable exists and get it's value
  if (gDDRDictionary.hasOwnProperty(variableName)) {
    variableValue = gDDRDictionary[variableName];
  }

  return variableValue;
}

/**
 * Generates a random string of the length passed in parameter.
 * @param length The length of the string to generate.
 * @returns Returns a random string of the length passed in parameter.
 */
function generateRandomString(length) {
  var result = '';
  var characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;

  for (var i = 0; i < length; i++) {
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

/**
 * Processes the subscribeVariables() request.
 * @param ws The web socket connection object.
 * @param subscribeVariablesRequest The subscribe variables request object.
 */
function processSubscribeVariablesRequest(ws, subscribeVariablesRequest) {
  for (const variableName of subscribeVariablesRequest) {
    console.debug('wssWebDDR: Subscribing to variable: ' + variableName);

    // Subscribe to the variable
    // Check if the subscribedVariables property exists and create it if not
    if (!ws.hasOwnProperty('subscribedVariables')) {
      ws.subscribedVariables = [];
    }

    // Check if the variable name was subscribed to and subscribe to it
    if (!ws.subscribedVariables.hasOwnProperty(variableName)) {
      ws.subscribedVariables[variableName] = true;
    }

    // Notify client of initial value
    notifyClientVariableValueChange(
      ws,
      variableName,
      getVariableValue(variableName)
    );
  }
}

/**
 * Processes the setVariableValue() request.
 * @param ws The web socket client object.
 * @param setVariableValueRequest The set value variable request object.
 */
function processSetVariableValueRequest(ws, setVariableValueRequest) {
  // Get the variable name requested:
  var variableName = setVariableValueRequest.variableName;
  var variableValue = setVariableValueRequest.variableValue;
  console.debug(
    'wssWebDDR: processSetVariableValueRequest(): Set Variable Value : ' +
      variableName +
      '=' +
      variableValue
  );

  // Set the variable value
  setVariableValue(variableName, variableValue);
  console.debug(
    'wssWebDDR: processSetVariableValueRequest(): Variable ' +
      variableName +
      ' value set to: ' +
      variableValue
  );

  // Send response to client
  console.debug('wssWebDDR: processSetVariableValueRequest(): Notify clients');
  notifyClientsVariableValueChange(variableName, variableValue);
  console.debug(
    'wssWebDDR: processSetVariableValueRequest(): Clients notified'
  );
}

/**
 * Used to notify a client of a variable value change.
 * @param ws The web socket client connection.
 * @param variableName The variable name.
 * @param variableValue The variable value.
 */
function notifyClientVariableValueChange(ws, variableName, variableValue) {
  // Prepare the object:
  let onVariableValueChangedNotification = {
    onVariableValueChangedNotification: {
      variableName: variableName,
      variableValue: variableValue,
    },
  };

  // Send the message to the client
  const jsonValue = JSON.stringify(onVariableValueChangedNotification);
  console.debug(
    'wssWebDDR: notifyClientVariableValueChange(): Send notification'
  );
  ws.send(jsonValue);
  console.debug(
    'wssWebDDR: notifyClientVariableValueChange(): Notification sent'
  );
}

/**
 * Used to notify all registered clients of a variable value change.
 * @param ws The web socket client connection.
 * @param variableName The variable name.
 * @param variableValue The variable value.
 */
function notifyClientsVariableValueChange(variableName, variableValue) {
  // Go through all connected clients to see if they are subscribed to that variable.
  ddrServer.clients.forEach(function clientEnumerator(ws) {
    // Check if the client has a list of subscribed variables
    console.debug(
      'wssWebDDR: notifyClientVariableValueChange(): Check if the client has a list of subscribed variables'
    );
    if (ws.hasOwnProperty('subscribedVariables')) {
      // Check if variable name was subscribed to
      console.debug(
        'wssWebDDR: notifyClientVariableValueChange(): Check if variable name was subscribed to'
      );
      if (ws.subscribedVariables.hasOwnProperty(variableName)) {
        console.debug(
          'wssWebDDR: notifyClientVariableValueChange(): Notify client'
        );
        notifyClientVariableValueChange(ws, variableName, variableValue);
      }
    }
  });
}

/**
 * Used to get a client of a variable value change.
 * @param ws The web socket client connection.
 * @param variableName The variable name.
 * @param variableValue The variable value.
 */

function processGetValueRequest(ws, variableName) {
  let variableValue = null;

  // Check if the variable exists and get it's value
  if (gDDRDictionary.hasOwnProperty(variableName)) {
    variableValue = gDDRDictionary[variableName];
  }

  let getVariableValue = {
    getValueResponse: {
      variableName: variableName,
      variableValue: variableValue,
    },
  };

  // Send the message to the client
  const jsonValue = JSON.stringify(getVariableValue);
  console.debug('wssWebDDR: getVariableValue(): Send notification', jsonValue);
  ws.send(jsonValue);
  console.debug('wssWebDDR: getVariableValue(): Notification sent');
}

// Load configuration file
loadConfiguration(gConfigurationFilePath);

const ddrServer = new WebSocketServer({ port: 20002 });

ddrServer.on('connection', function connection(ws) {
  console.debug('wssWebDDR: A client has connected...');
  ws.clientId = generateClientId();
  ws.on('message', function onMessage(message) {
    console.debug(
      'wssWebDDR: Message received on wssWebDDR (webDDR) service. ClientId: ' +
        ws.clientId +
        ', Message: ' +
        message
    );

    var parsedObject = JSON.parse(message);
    console.log('*** parsedObject ***\n', parsedObject);

    if (parsedObject.hasOwnProperty(SUBSCRIBE_VARIABLES_REQUEST_NAME)) {
      processSubscribeVariablesRequest(
        ws,
        parsedObject[SUBSCRIBE_VARIABLES_REQUEST_NAME]
      );
    } else if (parsedObject.hasOwnProperty(GET_VALUE_REQUEST_NAME)) {
      console.log('GET_VALUE_REQUEST_NAME ***', GET_VALUE_REQUEST_NAME);
      processGetValueRequest(ws, parsedObject[GET_VALUE_REQUEST_NAME]);
    } else if (parsedObject.hasOwnProperty(SET_VARIABLE_VALUE_REQUEST_NAME)) {
      processSetVariableValueRequest(
        ws,
        parsedObject[SET_VARIABLE_VALUE_REQUEST_NAME]
      );
    } else if (parsedObject.hasOwnProperty(GET_VARIABLE_COUNT_REQUEST_NAME)) {
      //processGetVariableCountRequest(ws, parsedObject[GET_VARIABLE_COUNT_REQUEST_NAME]);
    } else if (
      parsedObject.hasOwnProperty(GET_VARIABLE_DEFINITIONS_REQUEST_NAME)
    ) {
      //processGetVariableDefinitionsRequest(ws, parsedObject[GET_VARIABLE_DEFINITIONS_REQUEST_NAME]);
    } else {
      console.warn('wssWebDDR: Ignoring request: ' + parsedObject);
    }
  });

  //ws.send('something');
});

module.exports = { ddrServer };
