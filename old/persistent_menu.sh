curl -X POST -H "Content-Type: application/json" -d '{
  "setting_type" : "call_to_actions",
  "thread_state" : "existing_thread",
  "call_to_actions":[
    {
      "type":"postback",
      "title":"Help",
      "payload": "/help"
    },
    {
      "type":"postback",
      "title":"Start/Stop Review",
      "payload":"/review_switch"
    },
    {
      "type":"web_url",
      "title":"View Website",
      "url":"http://petersapparel.parseapp.com/"
    }
  ]
}' "https://graph.facebook.com/v2.6/me/thread_settings?access_token=EAACqEHdW5usBACQXK37Tk5P2ZAus2tjJ7GntWuPQuDJzyATyZB3CmS6W783HY1ZCDhRcHysAjq0aNEDjCOCC6jRwHGDNGmtfyZClkIAObXxH9dCKBKmfrK5pD7vKJoRnoOMcJbavrqyZCGARBZAdf0uTiVfCqseQSpnIJsT0KX7wZDZD"