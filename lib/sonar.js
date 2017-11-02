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
const getMap = require('./get_map')
const layerMap = require('./layer_map')
const ping = require('./ping')
const notes = require('./notes')
const hal = require('./hal')
const help = require('./help')
const Q = require('q');
var AWS = require('aws-sdk');
const nodemailer = require('nodemailer');
var xoauth2 = require('xoauth2');

const dynamodb = new AWS.DynamoDB.DocumentClient();
AWS.config.setPromisesDependency(Q.Promise);


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

const api = botBuilder(function (request, originalRequest) { // Claudia JS main function
   /* if(request.attachments){


    }*/
    console.log("At the beginning");
    console.log(originalRequest.body.entry[0].messaging[0].message.text);
    var sender = request.type + '.' + request.sender; // Platform of the sender + the unique sender id
    var retext;
    return restoreCtx(sender).then(function(existingCtx){ // Restore information based on that sender id to grab their state
            console.log("At the function");
        var state;
        if(existingCtx.Item){ // If that person did exist, then reinstate their state. If not just leave the state blank.
            state = existingCtx.Item.State;
        }
        if(request.text == 'fire' || request.text == 'map' || request.text == 'trash' || request.text == 'other' || request.text == '311'){ // If they have already seen the welcome message, their request will be one of these
            console.log("Inside the original successful response if statement.");
            state = request.text; // Grab their request and make it the users state
            if(state == 'other'){ // If they chose the 'other' section, you are now talking about knowledge articles instead of data like fire/trash
                return persistCtx(sender, state).then(function(result){ // You want to add that they are no longer in the welcome state, but have rather been asked for more information
                    const Q2 = new fbTemplate.Text('Okay. What would you like me to search for?'); // see ClaudiaJS fbTemplate. Just a nice way of using FB messenger features
                    return Q2
                        .get();
                });
            }
            if(state == '311'){ // If they chose the 'other' section, you are now talking about knowledge articles instead of data like fire/trash
                  return persistCtx(sender, state).then(function(result){ // You want to add that they are no longer in the welcome state, but have rather been asked for more information
                      const Q2 = new fbTemplate.Text('Okay. What would you like to e-mail 311? Please include your e-mail or phone number in the message'); // see ClaudiaJS fbTemplate. Just a nice way of using FB messenger features
                      return Q2
                          .get();
                  });
            }

            else{
                return persistCtx(sender, state).then(function(result){ // You want to restore that their state is now fire/trash/map and they are being asked about their location
                    //return('Great, at what location?');
                    const Q2 = new fbTemplate.Text('Great, at what location?');
                    return Q2
                        //.addQuickReplyLocation()
                        .get();

                });
            }

        }
        if(state == 'fire' || state == 'map' || state == 'trash' || state == 'other' || state == '311' || request.text == 'about'){// This is now the second time the program is run. Since the person has selected an option, and is now responding with a location
                console.log("Inside the fire/map/trash state if statement");
                var loc = request.text; // the location should be the new response
                var reqLocation = loc; // save this for the log
                var reqCommand = state; // save this for the log
                if(state == 'fire'){
                        request.text = "tell me about fire hydrants at " + loc + " South Bend, IN"; // simply get this in the statement that the Sonar parser is made for
                        originalRequest.body.entry[0].messaging[0].message.text = request.text; // This should help with the Amazon Alexa stuff.. still pending
                }
                if(state == 'trash'){
                        request.text = "tell me about trash at " + loc + " South Bend, IN";
                        originalRequest.body.entry[0].messaging[0].message.text = request.text;
                }
                if(state == 'map'){
                        request.text = "map of " + loc + " South Bend, IN";
                        originalRequest.body.entry[0].messaging[0].message.text = request.text;
                }
                if(request.text == 'about'){
                        request.text = "help data";
                        originalRequest.body.entry[0].messaging[0].message.text = request.text;
                }
                var inputs = parseIntent(request, originalRequest); // send the new statement that we constructed to the sonar parsing algorithm
                switch(inputs.intent) { // That request will send us an intent for this switch statement
                    case 'error':
                      // Search the knowledge database:
                      if(state == 'other'){
                        retext = "This is what I could find on " + request.text + ":\n" + "https://southbendinkm.microsoftcrmportals.com/search/?logicalNames=&q=" + request.text.replace(/ /g,"+");
                      }
                      else if(state == '311')
                      {
                        //insert e-mail code here

                        nodemailer.createTestAccount((err, account) => {

                            // ID: 971391464527-ru8esksk1euser8qlisq1qcjjj28926a.apps.googleusercontent.com
                            // secret: rQ4W8mHY0HEFAGKuFnauEK-i
                            // refresh: 1/RIruIl7pFwtF9LdQ1ebTpqVW9L8ueIBPBhoahA7nuP4
                            // access: ya29.Glv3BF-hpZxcGbwplRbt4Y7if6GAOI-uX8yIr9uyifuFdbJykX2RSpuvSXQcdSxbjygk67qCPdyeCVSIU8r9zIHcqM4S0ir1ZgMK3_FZExMUSr7pdhBSq7vwRdsc

                            let transporter = nodemailer.createTransport({
                                host: 'smtp.gmail.com',
                                port: 465,
                                secure: true,
                                auth: {
                                    type: 'OAuth2',
                                    user: 'sbelitestpage@gmail.com',
                                    accessToken: 'ya29.Glv3BF-hpZxcGbwplRbt4Y7if6GAOI-uX8yIr9uyifuFdbJykX2RSpuvSXQcdSxbjygk67qCPdyeCVSIU8r9zIHcqM4S0ir1ZgMK3_FZExMUSr7pdhBSq7vwRdsc'
                                }
                            });

                            // setup email data with unicode symbols
                            let mailOptions = {
                                from: 'sbelitestpage@gmail.com', // sender address
                                to: 'alewis9@nd.edu', // list of receivers
                                subject: '311 Request', // Subject line
                                text: 'Request here' // plain text body
                            };

                            // send mail with defined transport object
                            transporter.sendMail(mailOptions, (error, info) => {
                                if (error) {
                                    return console.log(error);
                                }
                            });
                        });

                        retext = "Great, your message has been sent!";
                      }
                      break;

                    case 'Hello':
                      retext = help("hello");
                      break;

                    case 'Help':
                      retext = help(inputs.slots.Dataset);
                      break;

                    case 'Hal':
                      retext = hal.sorry();
                      break;

                    case 'Ping':
                      retext = ping(inputs.slots.Dataset);
                      break;

                    case 'GetData': // We will almost always end up at this case.
                      retext = getData(inputs.slots.Dataset, inputs.slots.Location, originalRequest.env); // the getData function will grab the dataset that we want in the location we requested
                      break;

                    case 'GetPopulation':
                      retext = getPopulation(inputs.slots.Location, originalRequest.env);
                      break;

                    case 'GetMap':
                      retext = getMap(inputs.slots.Location);
                      break;

                    case 'LayerMap':
                      retext = layerMap(inputs.slots.Dataset, inputs.slots.Location);
                      break;

                    case 'SummarizeData':
                      retext = "Summarize not yet implemented."
                      break;

                    case 'AddNote':
                      retext = notes(inputs.slots.Dataset, inputs.slots.Location, originalRequest.env);
                      break;

                    case 'GetCrime':
                      retext = getCrime(inputs.slots.Location);
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
                    default:
                      retext = Promise.resolve("Sorry, there was an error in Sonar.");
                }
                state = "start";
                var timeInMs = Date.now(); // for the log
                senderTime = sender + '.' + timeInMs; // the log needs a unique key for every single instance, so we append the time to the username
                return persistCtx(sender, state).then(function(result){ // persist the state for the user
                  return uploadInstance(timeInMs, senderTime, reqCommand, reqLocation, request.type).then(function(result){ //upload the log instance
                    return retext; // return the answer we got from the switch statement
                  // return loc;
                  });
                });

        }
        else{ // This is the case where the user does not type fire/map/trash or not a location. This means they are just trying to start the program.
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
            //}
        ///
        }
});}, { platforms: ['alexa', 'slackSlashCommand', 'facebook'] });

module.exports = api;
