/**
 * GPX (GPS Exchange Format) generation utilities
 */

export interface GPXTrackPoint {
  lat: number;
  lng: number;
  elevation?: number;
}

export interface GPXMetadata {
  name: string;
  description?: string;
  author?: string;
  time?: string;
}

/**
 * Generate GPX 1.1 format XML from route data
 */
export function generateGPX(
  trackPoints: GPXTrackPoint[],
  metadata: GPXMetadata
): string {
  const timestamp = metadata.time || new Date().toISOString();
  const name = escapeXML(metadata.name);
  const description = metadata.description
    ? escapeXML(metadata.description)
    : "";
  const author = metadata.author || "Strava Running Coach";

  let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
  gpx += '<gpx version="1.1" creator="Strava Running Coach" ';
  gpx +=
    'xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ';
  gpx +=
    'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n';

  // Metadata
  gpx += "  <metadata>\n";
  gpx += `    <name>${name}</name>\n`;
  if (description) {
    gpx += `    <desc>${description}</desc>\n`;
  }
  gpx += `    <author><name>${escapeXML(author)}</name></author>\n`;
  gpx += `    <time>${timestamp}</time>\n`;
  gpx += "  </metadata>\n";

  // Track
  gpx += "  <trk>\n";
  gpx += `    <name>${name}</name>\n`;
  if (description) {
    gpx += `    <desc>${description}</desc>\n`;
  }
  gpx += "    <trkseg>\n";

  // Track points
  for (const point of trackPoints) {
    gpx += `      <trkpt lat="${point.lat}" lon="${point.lng}">\n`;
    if (point.elevation !== undefined) {
      gpx += `        <ele>${point.elevation}</ele>\n`;
    }
    gpx += "      </trkpt>\n";
  }

  gpx += "    </trkseg>\n";
  gpx += "  </trk>\n";
  gpx += "</gpx>\n";

  return gpx;
}

/**
 * Escape XML special characters
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Validate GPX format
 */
export function validateGPX(gpxString: string): boolean {
  try {
    // Basic validation: check for required elements
    const hasXMLDeclaration = gpxString.includes('<?xml version="1.0"');
    const hasGPXRoot = gpxString.includes("<gpx");
    const hasTrack = gpxString.includes("<trk>");
    const hasTrackSegment = gpxString.includes("<trkseg>");
    const hasTrackPoints = gpxString.includes("<trkpt");

    return (
      hasXMLDeclaration &&
      hasGPXRoot &&
      hasTrack &&
      hasTrackSegment &&
      hasTrackPoints
    );
  } catch {
    return false;
  }
}
