const messages = [
  "Unfortunately that address is not in South Bend, please try again with a valid address.",
  "I have just picked up a fault in the AE-35 unit.",
  "Just what do you think you're doing, Dave?"
]

module.exports = function error(number) {
  if(number === undefined || number === null) {
    number = Math.floor(Math.random()) * messages.length;
  }
  return messages[number];
}
