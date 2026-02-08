# Map Zoom Fix - Route Visualization

## Problem

The route overlay on the map widget wasn't scaling properly when zooming in/out. The route path, markers, and POIs remained the same size regardless of the map zoom level.

## Root Cause

The original implementation used an OpenStreetMap iframe embed with an SVG overlay positioned absolutely on top. The issue was:

1. **Iframe and SVG are separate**: The iframe has its own zoom controls, but the SVG overlay doesn't respond to those zoom changes
2. **No synchronization**: There's no way to synchronize the iframe's zoom level with the SVG overlay
3. **Fixed viewBox**: The SVG viewBox was static and didn't adjust to zoom changes

## Solution

Replaced the iframe-based map with a pure SVG visualization that properly scales:

### Key Changes

1. **Removed iframe embed**: No longer using OpenStreetMap iframe
2. **Pure SVG approach**: Everything is now rendered in SVG with proper viewBox
3. **Responsive scaling**: The SVG uses `preserveAspectRatio="xMidYMid meet"` to scale correctly
4. **Gradient background**: Added a subtle gradient background for visual appeal
5. **Grid pattern**: Added a grid pattern for spatial reference
6. **Glow effects**: Added glow effects to the route path for better visibility

### Technical Details

```tsx
<svg
  width="100%"
  height="100%"
  viewBox={`${minLng} ${minLat} ${lngDiff} ${latDiff}`}
  preserveAspectRatio="xMidYMid meet"
  style={{
    transform: "scaleY(-1)", // Flip Y axis for correct orientation
  }}
>
  {/* Route path with glow */}
  <polyline
    points={route.path.map(p => `${p.lng},${p.lat}`).join(" ")}
    stroke="#4facfe"
    strokeWidth={lngDiff / 200}
    // ... scales with viewBox
  />
</svg>
```

### Benefits

✅ **Proper scaling**: Route, markers, and POIs now scale correctly with the container
✅ **Responsive**: Works on all screen sizes
✅ **No external dependencies**: No need for iframe or external map tiles
✅ **Consistent rendering**: Same appearance across all browsers
✅ **Better performance**: Pure SVG is faster than iframe + overlay

### Trade-offs

- ❌ **No street-level detail**: Lost the detailed street map from OpenStreetMap
- ❌ **No interactive zoom**: Users can't zoom/pan the map interactively
- ✅ **Simpler implementation**: Easier to maintain and debug
- ✅ **Better for route visualization**: Focus is on the route, not the map details

## Future Enhancements

If interactive map features are needed in the future, consider:

1. **Leaflet.js**: Lightweight mapping library with full zoom/pan support
2. **Mapbox GL JS**: Professional mapping with custom styling
3. **Google Maps API**: Full-featured but requires API key
4. **Static map tiles**: Use static tile images as background

For now, the pure SVG approach provides the best balance of simplicity and functionality for route visualization.

## Testing

To test the fix:

1. Generate a route with `generate_running_route`
2. Visualize it with `render_route_map`
3. Resize the browser window - route should scale proportionally
4. Check that start/end markers and POIs are visible and properly positioned

## Files Modified

- `web/src/widgets/render_route_map.tsx` - Complete map visualization rewrite
