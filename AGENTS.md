Before writing code, first explore the project structure, then invoke the chatgpt-app-builder skill for documentation.

## Strava Token Persistence

When using the Strava Running Coach app:

1. **Always start with `connect_strava`** - This checks if the user is already authenticated
2. **Remember tokens across the conversation** - If you receive an access token from `exchange_strava_code`, store it in your conversation context and use it for ALL subsequent Strava tool calls by passing `token="<the_token>"` as a parameter
3. **Don't repeatedly ask for authentication** - If you successfully fetched data in a previous message, the token is still valid. Use it for the next request.
4. **Token lifetime** - Strava tokens are valid for 6 hours. Within a single conversation, assume the token is still valid unless you receive an authentication error.

Example flow:
```
User: "Show me my training"
→ connect_strava() // Check auth first
→ If authenticated: get_training_summary()
→ If not: user authorizes, exchange_strava_code(code) returns token
→ STORE TOKEN: "abc123..."

User: "Now show me my pace patterns"  
→ analyze_pace_patterns(token="abc123...") // Use stored token, don't re-authenticate!
```