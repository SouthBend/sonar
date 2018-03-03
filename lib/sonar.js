//311 Bot Main Function.
//Prathm Juneja. Summer 2017. South Bend Office of Innovation
//Aidan Lewis
// To update the test version of the bot, type in "npm run update" in powershell at the root directory of the project.
// To reconfigure, look at the claudijs deployment instructions online. Run "npm run install" in the powershell at the root directory of the project.
// Add flags occordingly for facebook/twillio/alexa/groupme/slack etc...
const botBuilder = require('claudia-bot-builder')
const fbTemplate = botBuilder.fbTemplate;
const parseIntent = require('./parse_intent')
const getData = require('./get_data')
const getPopulation = require('./get_population')
const getCrime = require('./get_crime')
//const email311 = require('./email')
const getMap = require('./get_map')
const layerMap = require('./layer_map')
const ping = require('./ping')
const notes = require('./notes')
const hal = require('./hal')
const help = require('./help')
const Q = require('q');
const nodemailer = require('nodemailer');
var AWS = require('aws-sdk');
var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');

const dynamodb = new AWS.DynamoDB.DocumentClient();
AWS.config.setPromisesDependency(Q.Promise);

var SCOPES = [
    'https://mail.google.com/',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.send'
];

var DATASETS = {
    "fire": "GetData",
    "trash": "GetData",
    "map": "GetMap",
    "about": "Help",
    "other": "Search",
    "311": "Email"
}

var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'gmail-nodejs-quickstart.json';

function restoreCtx(sender)//Function will be used later to restore database information for the user that accesses the bot.
{
  console.log("Trying to restore context for sender", sender);

  var params = {
    TableName: '311-bot-db',
    Key: {
      'UserID': sender
    }
  };

  return dynamodb.get(params).promise();
}

function persistCtx(sender, state) // This is used later to repopulate the database with user information
{
  console.log("Persisting context for sender", sender);

  var params = {
      TableName: '311-bot-db',
      Item:{
          'UserID': sender,
          'State': state // this is used for persistence. The bot interacts differently with users depending on whether their state is start or fire/trash/map
      }
  };

  return dynamodb.put(params).promise();
}

function uploadInstance(timeInMs, senderTime, reqCommand, reqLocation, platform) //Very similar to the persist function, but used to log each user interaction
{
  var params = {
      TableName: '311-bot-log',
      Item:{
          'UserID+Timestamp': senderTime,
          'Time': timeInMs,
          'Request Type': reqCommand,
          'Request Location': reqLocation,
          'Platform': platform
      }
  };

  return dynamodb.put(params).promise();
}

// check if element in array
Array.prototype.contains = function(element){
    return this.indexOf(element) > -1;
};


const api = botBuilder(function (request, originalRequest) { // Claudia JS main function

   var city = "South Bend, IN";
    var possibleStates = ["fire", "map", "trash", "other", "311", "about"];

    var sender = request.type + '.' + request.sender; // Platform of the sender + the unique sender id
    var retext;
    return restoreCtx(sender).then(function(existingCtx){ // Restore information based on that sender id to grab their state
            console.log("At the function");
        var state;
        if(existingCtx.Item){ // If that person did exist, then reinstate their state. If not just leave the state blank.
            state = existingCtx.Item.State;
        }

        if (possibleStates.includes(request.text)) { // If they have already seen the welcome message, their request will be one of these

            state = request.text; // Grab their request and make it the users state

            if(state == 'other') { // If they chose the 'other' section, you are now talking about knowledge articles instead of data like fire/trash
                return persistCtx(sender, state).then(function(result){ // You want to add that they are no longer in the welcome state, but have rather been asked for more information
                    const Q2 = new fbTemplate.Text('Okay. What would you like me to search for?'); // see ClaudiaJS fbTemplate. Just a nice way of using FB messenger features
                    return Q2
                        .get();
                });
            }
            if(state == '311') { // If they chose the 'other' section, you are now talking about knowledge articles instead of data like fire/trash
                  return persistCtx(sender, state).then(function(result){ // You want to add that they are no longer in the welcome state, but have rather been asked for more information
                      const Q2 = new fbTemplate.Text('What would you like to e-mail 311? Please include your e-mail or phone number in the message'); // see ClaudiaJS fbTemplate. Just a nice way of using FB messenger features
                      return Q2
                          .get();
                  });
            }

            else if (state != "about") {
                return persistCtx(sender, state).then(function(result){ // You want to restore that their state is now fire/trash/map and they are being asked about their location
                    const Q2 = new fbTemplate.Text('Great, at what location?');
                    return Q2
                        //.addQuickReplyLocation()
                        .get();

                });
            }
        }

        var dataset = "error";

        if (possibleStates.includes(state)) {

                if (state in DATASETS) {
                    dataset = DATASETS[state];
                    originalRequest.body.entry[0].messaging[0].message.text = request.text;
                }

                var loc = request.text + " " + city; // the location should be the new response
                var inputs = parseIntent(dataset, state, loc, request, originalRequest); // send the new statement that we constructed to the sonar parsing algorithm

                switch(inputs.intent) { // That request will send us an intent for this switch statement

                    case 'AddNote':
                        retext = notes(inputs.slots.Dataset, inputs.slots.Location, originalRequest.env);
                        break;

                    case 'Email':
                        retext = "Great, your message has been sent";
                        break;

                    case 'ExitApp':
                        // return a JavaScript object to set advanced response params
                        // this prevents any packaging from bot builder and is just
                        // returned to Alexa as you specify
                        retext = {
                            response: {
                                outputSpeech: {
                                    type: 'PlainText',
                                    text: 'Bye from Sonar!'
                                },
                                shouldEndSession: true
                            }
                        };
                        break;

                    case 'GetCrime':
                        retext = getCrime(inputs.slots.Location);
                        break;

                    case 'GetData': // We will almost always end up at this case.
                        retext = getData(inputs.slots.Dataset, inputs.slots.Location, originalRequest.env); // the getData function will grab the dataset that we want in the location we requested
                        break;

                    case 'GetMap':
                        retext = getMap(inputs.slots.Location);
                        break;

                    case 'GetPopulation':
                        retext = getPopulation(inputs.slots.Location, originalRequest.env);
                        break;

                    case 'Hal':
                        retext = hal.sorry();
                        break;

                    case 'Hello':
                        retext = help("hello");
                        break;

                    case 'Help':
                        retext = help(inputs.slots.Dataset);
                        break;

                    case 'LayerMap':
                        retext = layerMap(inputs.slots.Dataset, inputs.slots.Location);
                        break;

                    case 'Ping':
                        retext = ping(inputs.slots.Dataset);
                        break;

                    case 'Search':
                        retext = "This is what I could find on " + request.text + ":\n" + "http://data-southbend.opendata.arcgis.com/datasets?q=" + request.text.replace(/ /g,"+");
                        break;

                    case 'SummarizeData':
                        retext = "Summarize not yet implemented."
                        break;

                    default:
                        retext = Promise.resolve("Sorry, there was an error in Sonar.");
                }
                state = "start";
                var timeInMs = Date.now(); // for the log
                senderTime = sender + '.' + timeInMs; // the log needs a unique key for every single instance, so we append the time to the username
                return persistCtx(sender, state).then(function(result){ // persist the state for the user
                  return uploadInstance(timeInMs, senderTime, state, loc, request.type).then(function(result){ //upload the log instance
                    return retext; // return the answer we got from the switch statement
                  });
                });

        }
        else { // This is the case where the user does not type fire/map/trash or not a location. This means they are just trying to start the program.
            //if(state != "start"){
                state = "start"; // set them to the start state
                return persistCtx(sender, state).then(function(result){ // upload their new state
                // Everything below is simply a nice way of sending quick replies to facebook and allowing the user to quickly choose an option to interact with
                const Q1 = new fbTemplate.Text('Hello! Welcome to South Bend\'s 311-Bot. What can I help you with today?' );
                return Q1
                    .addQuickReply('Trash Pickup Day', 'trash') // If they click the one that says "Trash Pickup Day" it actually returns "trash" for the new request.text
                    .addQuickReply('Fire Hydrant', 'fire')
                    .addQuickReply('Map Display', 'map')
                    .addQuickReply('E-mail 311', '311')
                    .addQuickReply('Other Information', 'other') // This is commented out currently because Michael hasn't finished the knowledge articles (classic)
                    .addQuickReply('About 311bot', 'about')
                    .get();
                });
        }
});}, { platforms: ['alexa', 'slackSlashCommand', 'facebook'] });

module.exports = api;
