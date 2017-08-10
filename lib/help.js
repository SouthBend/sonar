const datasets = require('./datasets')

function help(text) {
  var response;
  if(text === undefined || text === null) {
    text = ""
  }
  switch(text.toLowerCase()) {
    case 'hello':
      response = helpHello();
      break;

    case 'data':
      response = helpData();
      break;
    case 'adding notes':
      response = helpAddNote();
      break;
    case 'notes':
      response = helpAddNote();
      break;
    default:
      response = helpOverview();
  }

  return Promise.resolve(response)
}

function helpData() {
  var response = "Hello! I am the South Bend 311 Bot, and my purpose is to help answer questions that would normally require you to call about 311. I know about several things nearby. I can give you information about when your trash pickup is, tell you what the closest fire hydrants to an address are, and I can give you a map of anywhere in the South Bend area. If you have any more questions, feel free to call 311. If you have any problems with the bot, contact pjuneja@southbendin.gov";
  // var list = Object.keys(datasets().list();
  // for(var i=0; i<list.length; i++) {
  //   response += list[i] + ", ";
  // }
  response += "'";
  return response;
}

function helpAddNote() {
  var response = "Let me know if you would like to 'Add a note about a topic at a Location.'";
  return response;
}

function helpHello() {
  var response = "Hi, how can I help you?"
  return response;
}

function helpOverview() {
  var response = "I can tell you more about Local Data, Adding Notes, or Your Neighbors"
  return response;
}

module.exports = help
