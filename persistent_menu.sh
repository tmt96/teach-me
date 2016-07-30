curl -X POST -H "Content-Type: application/json" -d '{
  "setting_type" : "call_to_actions",
  "thread_state" : "existing_thread",
  "call_to_actions":[
    {
      "type":"postback",
      "title":"Help",
      "payload":"TeachMe is your personal language learning assistant. You can:\n- Add a word in English to have the bot translate and create a new flashcard, or\n- Turn on Review Mode from menu to review your cards."
    },
    {
      "type":"postback",
      "title":"Start a New Order",
      "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_START_ORDER"
    },
    {
      "type":"web_url",
      "title":"View Website",
      "url":"http://petersapparel.parseapp.com/"
    }
  ]
}' "https://graph.facebook.com/v2.6/me/thread_settings?access_token=EAACqEHdW5usBACQXK37Tk5P2ZAus2tjJ7GntWuPQuDJzyATyZB3CmS6W783HY1ZCDhRcHysAjq0aNEDjCOCC6jRwHGDNGmtfyZClkIAObXxH9dCKBKmfrK5pD7vKJoRnoOMcJbavrqyZCGARBZAdf0uTiVfCqseQSpnIJsT0KX7wZDZD"