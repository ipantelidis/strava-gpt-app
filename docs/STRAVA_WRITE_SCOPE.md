# Strava Write Scope Update

## Change Summary

Updated Strava OAuth scope to include `activity:write` permission, which is required for the `export_route_to_strava` tool.

## Previous Scope
```
read,activity:read_all
```

## New Scope
```
read,activity:read_all,activity:write
```

## Permissions Breakdown

| Scope | Purpose | Required For |
|-------|---------|--------------|
| `read` | Basic profile access | All features |
| `activity:read_all` | Read all activity data | Fetching runs, analysis, training summaries |
| `activity:write` | Upload activities and routes | **NEW**: Export routes to Strava |

## Impact

### For Existing Users
- **Action Required**: Users who previously authorized the app will need to **re-authorize** to grant the new `activity:write` permission
- The app will prompt for re-authorization when they try to use `export_route_to_strava`
- All existing read functionality continues to work with old tokens

### For New Users
- New authorizations will automatically include all three scopes
- No additional steps needed

## Files Updated

1. **`server/src/server.ts`** - OAuth authorization URL
2. **`server/src/index.ts`** - OAuth metadata and scope defaults
3. **`EXECUTIVE_SUMMARY.md`** - Documentation
4. **`SPEC.md`** - API documentation
5. **`SETUP.md`** - Setup instructions

## Testing

To test the new scope:

1. Clear any existing Strava authorization
2. Use the `connect_strava` widget to get a new authorization URL
3. Authorize on Strava - you should see the new permission request
4. Verify the token includes `activity:write` in the scope
5. Test `export_route_to_strava` tool

## Strava API Documentation

- [Strava OAuth Scopes](https://developers.strava.com/docs/authentication/#details-about-requesting-access)
- [Upload Activity Endpoint](https://developers.strava.com/docs/reference/#api-Uploads-createUpload)

## Security Note

The `activity:write` scope allows the app to:
- ✅ Upload new activities (routes, GPX files)
- ✅ Create planned activities
- ❌ Does NOT allow modifying or deleting existing activities
- ❌ Does NOT allow posting to athlete's feed

This is the minimum permission needed for route export functionality.
