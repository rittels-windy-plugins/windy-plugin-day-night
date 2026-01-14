import { map } from '@windy/map';

const { log } = console;
const { PI, sin, cos, tan, asin, atan2, sqrt, abs } = Math;

const moonLine = L.polyline([], { stroke: true, weight: 2, color: 'rgb(200,200,200)', opacity: 0.5, smoothFactor: 1 });
const sunLine = L.polyline([], { stroke: true, weight: 2, color: 'rgb(255,200,0)', opacity: 0.5, smoothFactor: 1 });

function geodesicPoints(p1, p2, n = 100) {
    const rad = PI / 180;
    const lat1 = rad * p1.lat;
    const lng1 = rad * p1.lng;
    const lat2 = rad * p2.lat;
    const lng2 = rad * p2.lng;

    const d = 2 * asin(sqrt(sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lng2 - lng1) / 2) ** 2));

    const points = [];
    for (let i = 0; i <= n; i++) {
        const f = i / n;
        const A = sin((1 - f) * d) / sin(d);
        const B = sin(f * d) / sin(d);

        const x = A * cos(lat1) * cos(lng1) + B * cos(lat2) * cos(lng2);
        const y = A * cos(lat1) * sin(lng1) + B * cos(lat2) * sin(lng2);
        const z = A * sin(lat1) + B * sin(lat2);

        const lat = atan2(z, sqrt(x * x + y * y));
        const lng = atan2(y, x);

        //for now,  as soon as crosses the antimeridian,   stop growing line and just return, in future make 2 lines
        if (points[i - 1] && abs(points[i - 1].lng - lng / rad) > 180) return points;
        points.push({ lat: lat / rad, lng: lng / rad });
    }
    return points;
}

function drawLine(body, p1, p2) {
    if (!p1 || !p2) return;
    if (p1.lng === undefined) p1.lng = p1.lon;
    if (p2.lng === undefined) p2.lng = p2.lon;
    let l = body == 'sun' ? sunLine : moonLine;
    l.setLatLngs(geodesicPoints(p1, p2));
    if (!map.hasLayer(l)) l.addTo(map);
}

function removeLines(body) {
    if (body === undefined || body === 'sun') map.removeLayer(sunLine);
    if (body === undefined || body === 'moon') map.removeLayer(moonLine);
}

export { drawLine, removeLines };
