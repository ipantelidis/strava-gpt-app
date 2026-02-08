# GPX Download Guide

## Quick Start

The `download_route_gpx` tool generates a downloadable GPX file from any generated route. This is perfect for demos and quick exports without needing Strava authentication.

## Usage

### 1. Generate a Route

```
User: "Generate a 10k route in Paris"
```

The system will call `generate_running_route` and show 2-3 options.

### 2. Download as GPX

```
User: "Download option 1 as GPX"
```

The system will call `download_route_gpx` and provide:
- ✅ Complete GPX file content
- ✅ Suggested filename
- ✅ File size
- ✅ Upload instructions

### 3. Use the GPX File

The GPX content can be:
- **Copied and saved** as a `.gpx` file
- **Uploaded to Strava** manually (strava.com → Upload → Manual Upload)
- **Imported to Garmin Connect** or other GPS platforms
- **Loaded onto GPS devices** (Garmin, Suunto, etc.)

## Example Output

```
✅ GPX File Ready!

Route: Paris 10k Loop
Distance: 10.2km
Elevation Gain: 45m
File Size: 12KB

📥 Download Instructions:
1. Copy the GPX content below
2. Save it as `paris_10k_loop.gpx`
3. Import into Strava, Garmin Connect, or your GPS device

GPX Content:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Strava Running Coach" ...>
  ...
</gpx>
```

💡 Tip: You can also upload this file directly to Strava by going to 
strava.com → Upload → Manual Upload
```

## Why This Approach?

### Advantages
- ✅ **No authentication needed** - Works without Strava login
- ✅ **Reliable** - No API rate limits or connection issues
- ✅ **Universal** - Works with any GPS platform
- ✅ **Demo-friendly** - Perfect for presentations
- ✅ **Transparent** - User sees exactly what's being generated

### Comparison to Direct Upload

| Feature | GPX Download | Direct Upload |
|---------|-------------|---------------|
| Authentication | Not required | Required |
| Reliability | 100% | Depends on API |
| Platforms | All GPS devices | Strava only |
| Demo-friendly | ✅ Yes | ❌ Complex |
| User control | ✅ Full | ⚠️ Limited |

## Technical Details

### GPX Format
- **Version**: GPX 1.1
- **Includes**: Track points, elevation, metadata
- **Compatible with**: Strava, Garmin, Suunto, Wahoo, etc.

### File Structure
```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Strava Running Coach">
  <metadata>
    <name>Route Name</name>
    <desc>Route description</desc>
    <author><name>Strava Running Coach</name></author>
    <time>2024-01-15T10:30:00Z</time>
  </metadata>
  <trk>
    <name>Route Name</name>
    <trkseg>
      <trkpt lat="48.8566" lon="2.3522">
        <ele>35</ele>
      </trkpt>
      <!-- More track points -->
    </trkseg>
  </trk>
</gpx>
```

## Manual Strava Upload

### Steps
1. Go to [strava.com](https://www.strava.com)
2. Click **Upload** (top right)
3. Select **File** tab
4. Choose **Manual Upload**
5. Paste GPX content or upload file
6. Click **Upload**

### What Strava Does
- Parses the GPX file
- Creates a route in your account
- Makes it available for navigation
- Shows elevation profile
- Displays on map

## Future Enhancement

If direct Strava upload is needed later, the `export_route_to_strava` tool can be re-enabled by:
1. Ensuring proper OAuth scopes (`activity:write`)
2. Testing Strava API upload endpoint
3. Handling upload status polling
4. Managing rate limits

For now, the GPX download approach provides the best balance of simplicity and reliability.
