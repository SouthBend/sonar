const getIntent = function (alexaPayload) {
 'use strict';
 return alexaPayload &&
   alexaPayload.request &&
   alexaPayload.request.type === 'IntentRequest' &&
   alexaPayload.request.intent;
}

const getIntentName = function (alexaPayload) {
 'use strict';
 return alexaPayload &&
   alexaPayload.request &&
   alexaPayload.request.type === 'IntentRequest' &&
   alexaPayload.request.intent &&
   alexaPayload.request.intent.name;
}

// const intentNames ={
//   "hello": {
//     "name": "Hello",
//     "match": "hello"
//   },
//   "help": {
//     "name": "Help",
//     "match": "help ?(.*)?"
//   },
//   "ping": {
//     "name": "Ping",
//     "match": "ping ?(.*)?"
//   },
//   "open": {
//     "name": "Hal",
//     "match": "open the pod bay doors"
//   },
//   "add": {
//     "name": "AddNote",
//     "match": "add note (.*) at (.*)"
//   },
//   "notes": {
//     "name": "AddNote",
//     "match": "notes (.*) at (.*)"
//   },
//   "what": {
//     "name": "GetData",
//     "match": "what are the (.*) at (.*)"
//   },
//   "ask": {
//     "name": "GetData",
//     "match": "ask about (.*) at (.*)"
//   },
//   "tell": {
//     "name": "GetData",
//     "match": "tell me about (.*) at (.*)"
//   },
//   "population": {
//     "name": "GetPopulation",
//     "match": "(.*) of (.*)"
//   },
//   "safety": {
//     "name": "GetCrime",
//     "match": "safety (.*) (.*)"
//   },
//   "map": {
//     "name": "GetMap",
//     "match": "(.*) of (.*)"
//   },
//   "see": {
//     "name": "LayerMap",
//     "match": "see (.*) at (.*)"
//   }
// }

module.exports = function parseIntents(dataset, topic, loc, request, originalRequest) {

    var intentName = getIntentName(originalRequest.body);
    var slots = {};

    if ((intentName === undefined || intentName === null || intentName == false) && request.text) {

        var intent = {"name": dataset};

        if (intent === undefined || intent === null) {
            return {intent: "error"}
        }

        slots["Dataset"] = topic;
        slots["Location"] = loc;

    }
    else {
        console.log("Inside the wrong if statement.");
        var intent = getIntent(originalRequest.body)
        var keys = Object.keys(intent.slots);
        // console.log("request: " + originalRequest.body)
        // console.log("Alexa intent: " + JSON.stringify(intent))
        // console.log("Alexa slots: " + JSON.stringify(intent.slots))

        for(var i=0; i<keys.length; i++) {
            slots[keys[i]] = intent.slots[keys[i]].value;
        }

        // console.log("Processed slots: " + JSON.stringify(slots))

    }

    return {intent: intent.name, slots: slots};
}
