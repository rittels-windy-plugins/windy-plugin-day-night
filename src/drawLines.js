import SunCalc from './SunCalc.js';
import { drawMoon } from './moon.js';

import { map } from '@windy/map';
import store from '@windy/store';

const { PI, floor, abs, cos, sin, atan2, round, asin, max, min, acos } = Math;
const { log } = console;

let nightPolyNames = ['middle', 'left', 'right'];
let maxLt = 85;
let degInterval = 1;

let dayMs = 1000 * 60 * 60 * 24;
let h1 = 1000 * 60 * 60;

let nightPolys = [],
    nightLines = [],
    sunCircle,
    moonCircle;

//////--  Main Program

//// create lines and sun -- these are created when mounted the 1st time,  then added or removed from map
export function createMapLayers() {
    SunCalc.times.forEach(suntime => {
        let color = suntime[1].includes('moon') ? 'white' : 'black';
        nightLines.push({
            middle: L.polyline([], { stroke: true, weight: 1, color, smoothFactor: 1 }),
            left: L.polyline([], { stroke: true, weight: 1, color, smoothFactor: 1 }),
            right: L.polyline([], { stroke: true, weight: 1, color, smoothFactor: 1 }),
        });
        nightPolys.push({
            middle: L.polygon([], { stroke: false, weight: 1, color, fillOpacity: 0.08, smoothFactor: 1 }),
            left: L.polygon([], { stroke: false, weight: 1, color, fillOpacity: 0.08, smoothFactor: 1 }),
            right: L.polygon([], { stroke: false, weight: 1, color, fillOpacity: 0.08, smoothFactor: 1 }),
        });
    });
    sunCircle = L.circleMarker([90, 0], { radius: 8, color: 'yellow' });
    moonCircle = L.circleMarker([0, 0], { radius: 8, color: 'white' });
}

function wrapLn(ln) {
    return ((ln + 360 * 3 + 180) % 360) - 180;
}

export const drawLinesFxs = {
    removeSunLayers: function () {
        map.removeLayer(sunCircle);
        map.removeLayer(moonCircle);
        [nightPolys, nightLines].forEach(ar =>
            ar.forEach(poly => {
                for (let p in poly) map.removeLayer(poly[p]);
            }),
        );
    },

    addSunLayers: function (k = -1) {
        if (!store.get('day-night-show-sun')) {
            map.removeLayer(sunCircle);
        } else {
            if (!map.hasLayer(sunCircle)) sunCircle.addTo(map);
        }
        if (!store.get('day-night-show-moon')) {
            map.removeLayer(moonCircle);
        } else {
            if (!map.hasLayer(moonCircle)) moonCircle.addTo(map);
        }

        [nightPolys, nightLines].forEach(times => {
            times.forEach((layerAr, i) => {
                if (k == -1 || k == i) {
                    for (let layer in layerAr) {
                        if (!map.hasLayer(layerAr[layer])) {
                            layerAr[layer].addTo(map);
                        }
                    }
                }
            });
        });
    },

    drawLines: function (ts) {
        let now = Date.now();
        let noon = floor(ts / dayMs) * dayMs + dayMs / 2;

        // Get the coordinates gps coords for the zenith and nadir,  subSolar pos,  (subPos).
        let dt = new Date(ts);
        let noonLn = (15 * (noon - ts)) / h1; //to get close
        let solarNoon = SunCalc.getTimes(dt, 0, noonLn, 1).solarNoon;
        let sunPos = SunCalc.getPosition(solarNoon, 0, noonLn).subSolarPoint;
        let nadirPos = { lat: -sunPos.lat, lng: wrapLn(sunPos.lng + 180) };
        let moonPos = SunCalc.getMoonPosition(new Date(ts), 0, 0).subLunarPoint;

        sunCircle.setLatLng(sunPos);
        moonCircle.setLatLng(moonPos);

        this.sunPos = sunPos;
        this.moonPos = moonPos;

        /**
         *
         * @param {*} alt
         * @param {*} sun true or false,  if moon,  false;
         * @returns
         */
        let getPolygon = (alt, sun = true) => {
            //get polygon for terminator altitude

            let position = sun ? nadirPos : moonPos;

            let pos = (lat1, lon1, b, alt) => {
                alt *= PI / 180;
                b *= PI / 180;
                lat1 *= PI / 180;
                lon1 *= PI / 180;
                let lat2 = asin(sin(lat1) * cos(alt) + cos(lat1) * sin(alt) * cos(b));
                let lon2 = lon1 + atan2(sin(b) * sin(alt) * cos(lat1), cos(alt) - sin(lat1) * sin(lat2));
                return [(lat2 * 180) / PI, (lon2 * 180) / PI];
            };

            let veryNear = (ln1, ln2) => {
                if (abs(wrapLn(ln1) - wrapLn(ln2)) < 0.5) return true;
            };

            let ar = [];

            for (let d = 0; d <= 360; d += degInterval) {
                ar.push(pos(position.lat, position.lng, d, alt));
            }

            if (!veryNear(ar[0][1], position.lng)) {
                ar.unshift([maxLt, ar[0][1]]);
                ar.push([maxLt, ar[ar.length - 1][1]]);
            }

            let iSouth = (ar.length - 1) / 2; //index pointing south
            if (!veryNear(ar[iSouth][1], position.lng)) {
                ar.splice(iSouth + 1, 0, [-maxLt, ar[iSouth][1]], [-maxLt, ar[iSouth][1] - 360], [ar[iSouth][0], ar[iSouth][1] - 360]);
            }

            ar.push(ar[0]); //close the polygon.  Important to do so that polygons can be split in 2.

            return ar;
        };

        SunCalc.times.forEach((suntime, k) => {
            //k is the index

            if (suntime[3].val) {
                //sun time line selected

                let line = getPolygon(suntime[1].includes('moon') ? 90 - suntime[0] : suntime[0] + 90, suntime[1].includes('moon') ? false : true);

                //find smallest lng
                let minLn = Infinity;
                let mini;
                for (let i = 0; i < line.length; i++) {
                    let l = line[i][1];
                    if (l < minLn) {
                        minLn = l;
                        mini = i;
                    }
                }

                //create new line,  starting from smallest lng
                let shift = -floor((minLn + 180) / 360) * 360;
                let line1 = [];
                for (let i = mini, l = line.length; i < l + mini; i++) {
                    let ii = i % l;
                    line1.push([line[ii][0], line[ii][1] + shift]);
                }
                line1.push(line1[0]);

                //find split points,  there may be 4 split points.:
                let next = null;
                let split = [];
                for (let i = 1; i < line1.length; i++) {
                    let x = round(line1[i][1] / 360) - round(line1[i - 1][1] / 360);
                    if (x) split.push(i);
                }

                //simple linear interpolation to find lat at where the polys are split
                let ipLat = function (spl, l) {
                    return l[spl - 1][0] + (l[spl][0] - l[spl - 1][0]) * ((180 - l[spl - 1][1]) / (l[spl][1] - l[spl - 1][1]));
                };

                let polyl1 = [],
                    polyl2 = [];

                //create 2 multipolylines
                for (let i = 0, start = 0, prevlt; i < split.length; i += 2) {
                    let lt1 = ipLat(split[i], line1);
                    let lt2 = ipLat(split[i + 1], line1);

                    polyl1.push((prevlt ? [[prevlt, 180]] : []).concat(line1.slice(start, split[i]), [[lt1, 180]]));
                    polyl2.push(
                        [[lt1, -180]].concat(
                            line1.slice(split[i], split[i + 1]).map(e => [e[0], e[1] - 360]),
                            [[lt2, -180]],
                        ),
                    );
                    start = split[i + 1];
                    prevlt = lt2;
                    if (i == split.length - 2) {
                        polyl1.push([[prevlt, 180]].concat(line1.slice(start)));
                    }
                }

                if (!polyl1.length) polyl1 = [line1];

                //flatten arrays to make polygons
                let polyg1 = Array.prototype.concat.apply([], polyl1);
                let polyg2 = Array.prototype.concat.apply([], polyl2);

                let polyg = polyg2.length ? [polyg1, polyg2] : polyg1;

                let removeExtremeLats = function (l) {
                    for (let i = l.length - 1; i >= 0; i--) {
                        if (abs(l[i][0]) == maxLt) l.splice(i, 1);
                        else if (l[i][0] == 0 && (l[i][1] + 360 * 3) % 360 == (nadirPos.lng + 180 + 360 * 3) % 360) l.splice(i, 1);
                    }
                };

                let polyl = polyl1.concat(polyl2);
                polyl.forEach(removeExtremeLats);

                for (let i = polyl.length - 1; i >= 0; i--) {
                    if (polyl[i].length == 0) polyl.splice(i, 1);
                }

                let shiftPoly = (line, left) => {
                    if (line[0][0][0] !== void 0) {
                        return line.map(p => p.map(e => [e[0], e[1] + (left ? -360 : 360)]));
                    } else {
                        return line.map(e => [e[0], e[1] + (left ? -360 : 360)]);
                    }
                };

                nightPolyNames.forEach(n => {
                    //if (!map.hasLayer(nightLines[k][n])) nightLines[k][n].addTo(map); //can be added more than once in leaflet
                    nightLines[k][n].setLatLngs(n == 'middle' ? polyl : shiftPoly(polyl, n == 'left' ? true : false));
                    //if (!map.hasLayer(nightPolys[k][n])) nightPolys[k][n].addTo(map);
                    nightPolys[k][n].setLatLngs(n == 'middle' ? polyg : shiftPoly(polyg, n == 'left' ? true : false));
                });

                this.addSunLayers(k);
            } else {
                //remove unselected lines in case still present
                nightPolyNames.forEach(n => {
                    map.removeLayer(nightPolys[k][n]);
                    map.removeLayer(nightLines[k][n]);
                });
            }
        });

        drawMoon(dt);

        //checkspeed,  optimize based on system performance
        let duration = Date.now() - now;
        if (duration > 30 && degInterval < 3) {
            degInterval += 1;
        } else if (duration < 10 && degInterval > 1) {
            degInterval -= 1;
        }
    },

    setOpacity: function (v) {
        nightPolys.forEach(polys => {
            for (let p in polys) polys[p].setStyle({ fillOpacity: v });
        });
    },

    getSunPos: function () {
        return this.sunPos;
    },

    getMoonPos: function () {
        return this.moonPos;
    },
};
