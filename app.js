/*
 * Copyright 2016-present, TeachMe Team.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* jshint node: true, devel: true */
// 'use strict';

const 
  bodyParser = require('body-parser'),
  config = require('config'),
  crypto = require('crypto'),
  express = require('express'),
  https = require('https'),  
  _ = require('underscore'),
  request = require('request');

var User = require('./libs/user');
var UsersRepository = require('./libs/users.repository');

var app = express();
app.set('port', process.env.PORT || 5000);
app.set('view engine', 'ejs');
app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(express.static('public'));

/*
 * Be sure to setup your config values before running this code. You can 
 * set them using environment variables or modifying the config file in /config.
 *
 */

// App Secret can be retrieved from the App Dashboard
const APP_SECRET = (process.env.MESSENGER_APP_SECRET) ? 
  process.env.MESSENGER_APP_SECRET :
  config.get('appSecret');

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
  (process.env.MESSENGER_VALIDATION_TOKEN) :
  config.get('validationToken');

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
  (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
  config.get('pageAccessToken');

// URL where the app is running (include protocol). Used to point to scripts and 
// assets located at this address. 
const SERVER_URL = (process.env.SERVER_URL) ?
  (process.env.SERVER_URL) :
  config.get('serverURL');

// URL where the app is running (include protocol). Used to point to scripts and 
// assets located at this address. 
var endpoint = (process.env.ENDPOINT) ?
  (process.env.ENDPOINT) :
  config.get('endpoint');



if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
  console.error("Missing config values");
  process.exit(1);
}

/*
 * Use your own validation token. Check that the token used in the Webhook 
 * setup is the same token used here.
 *
 */
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }  
});


/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page. 
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 *
 */
app.post('/webhook', function (req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.optin) {
          receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent);
        } else if (messagingEvent.read) {
          receivedMessageRead(messagingEvent);
        } else if (messagingEvent.account_linking) {
          receivedAccountLink(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've 
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

/*
 * This path is used for account linking. The account linking call-to-action
 * (sendAccountLinking) is pointed to this URL. 
 * 
 */
app.get('/authorize', function(req, res) {
  var accountLinkingToken = req.query['account_linking_token'];
  var redirectURI = req.query['redirect_uri'];

  // Authorization Code should be generated per user by the developer. This will 
  // be passed to the Account Linking callback.
  var authCode = "1234567890";

  // Redirect users to this URI on successful login
  var redirectURISuccess = redirectURI + "&authorization_code=" + authCode;

  res.render('authorize', {
    accountLinkingToken: accountLinkingToken,
    redirectURI: redirectURI,
    redirectURISuccess: redirectURISuccess
  });
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from 
 * the App Dashboard, we can verify the signature that is sent with each 
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an 
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

/*
 * Authorization Event
 *
 * The value for 'optin.ref' is defined in the entry point. For the "Send to 
 * Messenger" plugin, it is the 'data-ref' field. Read more at 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/authentication
 *
 */
function receivedAuthentication(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfAuth = event.timestamp;

  // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
  // The developer can set this to an arbitrary value to associate the 
  // authentication callback with the 'Send to Messenger' click event. This is
  // a way to do account linking when the user clicks the 'Send to Messenger' 
  // plugin.
  var passThroughParam = event.optin.ref;

  console.log("Received authentication for user %d and page %d with pass " +
    "through param '%s' at %d", senderID, recipientID, passThroughParam, 
    timeOfAuth);

  // When an authentication is received, we'll send a message back to the sender
  // to let them know it was successful.
  sendTextMessage(senderID, "Authentication successful");
}


/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message' 
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 *
 * For this example, we're going to echo any text that we get. If we get some 
 * special keywords ('button', 'generic', 'receipt'), then we'll send back
 * examples of those bubbles to illustrate the special message bubbles we've 
 * created. If we receive a message with an attachment (image, video, audio), 
 * then we'll simply confirm that we've received the attachment.
 * 
 */
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;
  var appId = message.app_id;
  var metadata = message.metadata;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;
  var quickReply = message.quick_reply;

  if (quickReply) {
    var quickReplyPayload = quickReply.payload;
    console.log("Quick reply for message %s with payload %s",
      messageId, quickReplyPayload);

    sendTextMessage(senderID, "Quick reply tapped");
    return;
  }

  if (messageText) {
    var user = UsersRepository.get(senderID);

    // If we receive a text message, check to see if it matches any special
    // keywords and send back the corresponding example. Otherwise, just echo
    // the text we received.
    switch (messageText.toLowerCase()) {
      case 'help':
        sendHelp(senderID);
        break;
      case 'start review':
        if (user.reviewOn) sendTextMessage(senderID, 'You are already in review mode.');
        else turnOnReview(senderID);
        break;
      case 'stop review':
        if (!user.reviewOn) sendTextMessage(senderID, 'You are not in review mode.');
        else turnOffReview(senderID);
        break;
      default:
        if (!user.reviewOn) translateAndSend(senderID, messageText);
        else if (messageText.toLowerCase() === user.correctAnswer.toLowerCase())
          receivedRightAnswer(senderID);
        else receivedWrongAnswer(senderID);
        break;
    }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}


/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about 
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
 *
 */
function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log("Received delivery confirmation for message ID: %s", 
        messageID);
    });
  }

  console.log("All message before %d were delivered.", watermark);
}


/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message. 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 * 
 */
function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  var payload = event.postback.payload;
  switch (payload) {
    case '/help':
      sendHelp(senderID);
      break;
    case '/review_switch':
      var user = UsersRepository.get(senderID);
      if (user.reviewOn) turnOffReview(senderID);
      else turnOnReview(senderID);
      break;
    case '/wrong-answer':
      receivedWrongAnswer(senderID);
      break;
    case '/right-answer':
      receivedRightAnswer(senderID);
      break;
    default:
      break;
  }
  console.log("Received postback for user %d and page %d with payload '%s' " + 
    "at %d", senderID, recipientID, payload, timeOfPostback);
}

/*
 * Message Read Event
 *
 * This event is called when a previously-sent message has been read.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read
 * 
 */
function receivedMessageRead(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  // All messages before watermark (a timestamp) or sequence have been seen.
  var watermark = event.read.watermark;
  var sequenceNumber = event.read.seq;

  console.log("Received message read event for watermark %d and sequence " +
    "number %d", watermark, sequenceNumber);
}

/*
 * Account Link Event
 *
 * This event is called when the Link Account or UnLink Account action has been
 * tapped.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/account-linking
 * 
 */
function receivedAccountLink(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  var status = event.account_linking.status;
  var authCode = event.account_linking.authorization_code;

  console.log("Received account link event with for user %d with status %s " +
    "and auth code %s ", senderID, status, authCode);
}

/*
 * Send a Gif using the Send API.
 *
 */
function sendGifMessage(recipientId) {
  var user = UsersRepository.get(recipientId);
  var level = (user.getLevel() % 5) + 1;
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: SERVER_URL + "/assets/level_up_"+level+".gif"
        }
      }
    }
  };
  sendTextMessage(recipientId, 'Congras. Your level is up. And now is: ' + user.getLevel());
  callSendAPI(messageData);
}

/*
 * Send a text message using the Send API.
 *
 */
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText,
      metadata: "DEVELOPER_DEFINED_METADATA"
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a button message using the Send API.
 *
 */
function sendButtonMessage(recipientId, text, buttons) {
  console.log(buttons);
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: text,
          buttons:buttons
        }
      }
    }
  };  

  callSendAPI(messageData);
}

/*
 * Send a message with Quick Reply buttons.
 *
 */
// function sendQuickReply(recipientId) {
//   var messageData = {
//     recipient: {
//       id: recipientId
//     },
//     message: {
//       text: "What's your favorite movie genre?",
//       metadata: "DEVELOPER_DEFINED_METADATA",
//       quick_replies: [
//         {
//           "content_type":"text",
//           "title":"Action",
//           "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_ACTION"
//         },
//         {
//           "content_type":"text",
//           "title":"Comedy",
//           "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_COMEDY"
//         },
//         {
//           "content_type":"text",
//           "title":"Drama",
//           "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_DRAMA"
//         }
//       ]
//     }
//   };

//   callSendAPI(messageData);
// }


function turnOnReview(userId) {
  sendTextMessage(userId, 'Let\'s start review your cards!');
    var qs = {
        uid: userId
    };
    request.get(endpoint+'u', {qs: qs, json: true}, function (err, res, data) {
      console.log(data.length);
      var user = UsersRepository.get(userId);
      user.setQuestions(data);
      user.turnOnReview();

      if (user.getAnswerList().length < 4) {
        sendTextMessage(userId, 'Not enough words for you to learn. Stop review words.');
        user.turnOffReview();
        return;
      }

      sendQuestion(userId);
  });
}

function turnOffReview(userId) {
  var user = UsersRepository.get(userId);
  user.turnOffReview();
  sendTextMessage(userId, 'Review finished! Type a word to create your flashcard!');
}

function sendQuestion(userId) {
  var user = UsersRepository.get(userId);
  var question = user.getAQuestionAndRemoveOutOfStack();

  if (!question) {
    turnOffReview(userId);
    return;
  }

  sendTextMessage(userId, 'What is the correct translation of this word?');
  
  var originalWord = question.word;
  var arrAnswers = user.getAnswerList();
  var buttons = [];
  arrAnswers = _.shuffle(arrAnswers);

  for(var i = 0; i < arrAnswers.length; i++)
  {
      if (arrAnswers[i] === user.correctAnswer) {
          continue;
      }
      buttons.push({
        type: "postback",
        title: arrAnswers[i],
        payload: '/wrong-answer'
      });
      if( buttons.length === 2){
          break;
      }
  }

  for(i = 0; i < arrAnswers.length; i++)
  {
      if (arrAnswers[i] !== user.correctAnswer) {
          continue;
      }
      buttons.push({
        type: "postback",
        title: arrAnswers[i],
        payload: '/right-answer'
      });
      break;
  }

  buttons = _.shuffle(buttons);
  
  console.log(buttons);
  sendButtonMessage(userId, originalWord, JSON.stringify(buttons));
}

function receivedRightAnswer(userId) {
  var user = UsersRepository.get(userId);
  translateAndSend(userId, user.originalWord);
  sendTextMessage(userId, 'Yes, that\'s correct! Great job!!');
  
  setTimeout( function() {
    sendQuestion(userId);
  }, 2000);

  var qs = {
      uid: userId,
      q: user.originalWord,
      answer: 'right'
  };
  request.get(endpoint+'a', {qs:qs, json: true}, function (err, res, data){});
}

function receivedWrongAnswer(userId) {
  var user = UsersRepository.get(userId);
  sendTextMessage(userId, 'Oh no... It is not correct. Let\'s see what the correct meaning of' + user.originalWord + 'is.');
  translateAndSend(userId, user.originalWord);

  setTimeout( function() {
    sendQuestion(userId);
  }, 2000);
  
  var qs = {
    uid: userId,
    q: user.originalWord,
    answer: 'wrong'
  };
  request.get(endpoint+'a', {qs:qs, json: true}, function (err, res, data){});
}

/*
 * Call Google API to translate a word
 */
function translateAndSend(recipientId, original) {
    var qs = {
        q: original,
        uid: recipientId
    };
    request.get(endpoint+'t', {qs: qs, json: true}, function (err, res, data) {
       
        var messageData = null;
        try {
            var elements = [];
            if( data.sentenses && data.sentenses.length ){
                for (var i = 0; i < data.sentenses.length; i++)
                {
                    elements.push({
                        title: data.translated,
                        subtitle: data.sentenses[i].source,
                        image_url: data.image
                    });
                }
            } else {
                element = {
                    title: data.query,
                    subtitle: data.translated
                };
                if( data.image ){
                    element.image_url = data.image; 
                }
                elements.push(element);
            }
            messageData = {
                recipient: {
                    id: recipientId
                },
                message: {
                    attachment: {
                        type: "template",
                        payload: {
                            template_type: "generic",
                            elements: elements
                        }
                    }
                }
            };
        } catch(e){
            sendTextMessage(recipientId, 'Can not translated.');
            return;
        }
        
        var user = UsersRepository.get(recipientId);
        user.reqIncr();

        callSendAPI(messageData);
        
        if (user.meetLevelUp()) {
            sendGifMessage(recipientId);
        }
    });
}

function sendHelp(recipientID) {
    var messageText = 'Hi! I\'m your personal language learning assistant.\n You can:\n\
                    - Type a word for me to translate and create flashcard for you, or\n\
                    - Turn on Review Mode from menu to review your cards.';
    sendTextMessage(recipientID, messageText);
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 *
 */
function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      if (messageId) {
        console.log("Successfully sent message with id %s to recipient %s", 
          messageId, recipientId);
      } else {
      console.log("Successfully called Send API for recipient %s", 
        recipientId);
      }
    } else {
      console.error(response.error);
    }
  });  
}

// Start server
// Webhooks must be available via SSL with a certificate signed by a valid 
// certificate authority.
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

module.exports = app;

