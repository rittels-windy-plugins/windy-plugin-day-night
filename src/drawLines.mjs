import SunCalc from './SunCalc.mjs';
import { map } from '@windy/map';
import store from '@windy/store';

let nightPolyNames = ['middle', 'left', 'right'];
let maxLt = 85;
let degInterval = 1;

let dayMs = 1000 * 60 * 60 * 24;
let h1 = 1000 * 60 * 60;

let nightPolys = [],
    nightLines = [],
    sunCircle;

//////--  Main Program

//// create lines and sun -- these are created when mounted the 1st time,  then added or removed from map
function createMapLayers() {
    SunCalc.times.forEach(() => {
        nightLines.push({
            middle: L.polyline([], { stroke: true, weight: 1, color: 'black', smoothFactor: 1 }),
            left: L.polyline([], { stroke: true, weight: 1, color: 'black', smoothFactor: 1 }),
            right: L.polyline([], { stroke: true, weight: 1, color: 'black', smoothFactor: 1 }),
        });
        nightPolys.push({
            middle: L.polygon([], { stroke: false, weight: 1, color: 'black', fillOpacity: 0.08, smoothFactor: 1 }),
            left: L.polygon([], { stroke: false, weight: 1, color: 'black', fillOpacity: 0.08, smoothFactor: 1 }),
            right: L.polygon([], { stroke: false, weight: 1, color: 'black', fillOpacity: 0.08, smoothFactor: 1 }),
        });
    });
    sunCircle = L.circle([90, 0], { radius: 12, color: 'yellow' }).addTo(map);
}
createMapLayers();

function wrapLn(ln) {
    return ((ln + 360 * 3 + 180) % 360) - 180;
}

const drawLinesFxs = {
    removeSunLayers: function () {
        map.removeLayer(sunCircle);
        [nightPolys, nightLines].forEach(ar =>
            ar.forEach(poly => {
                for (let p in poly) map.removeLayer(poly[p]);
            }),
        );
    },

    addSunLayers: function (k = -1) {
        if (!map.hasLayer(sunCircle)) {
            sunCircle.addTo(map);
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

        //let hreq=(ts % (dayMs)) / h1;

        let noon = Math.floor(ts / dayMs) * dayMs + dayMs / 2;
        //let lnRefs=[];
        //let arr = [];
        //arr = SunCalc.times.map(e => { return { selected: e[3].val, setN: [], setS: [], riseN: [], riseS: [], start: false, end: false } });

        //console.log(arr);

        // 1st get the coordinates gps coords for the zenith and nadir
        let dt = new Date(ts);
        let noonLn = (15 * (noon - ts)) / h1; //to get close
        let solarNoon = SunCalc.getTimes(dt, 0, noonLn, 1).solarNoon;
        noonLn += (15 * (solarNoon.getTime() - ts)) / h1;
        solarNoon = SunCalc.getTimes(dt, 0, noonLn, 1).solarNoon;
        noonLn += (15 * (solarNoon.getTime() - ts)) / h1;
        let pos = SunCalc.getPosition(solarNoon, 0, noonLn);
        let sunPos = {
            lat: Math.abs(pos.azimuth) < Math.PI / 2 ? (pos.altitude * 180) / Math.PI - 90 : 90 - (pos.altitude * 180) / Math.PI,
            lng: noonLn,
        };
        let nadirPos = {
            lat: -sunPos.lat,
            lng: wrapLn(noonLn + 180),
        };

        sunCircle.setLatLng(sunPos);

        let getPolygon = alt => {
            //get polygon for terminator altitude

            let pos = (lat1, lon1, b, alt) => {
                alt *= Math.PI / 180;
                b *= Math.PI / 180;
                lat1 *= Math.PI / 180;
                lon1 *= Math.PI / 180;
                let lat2 = Math.asin(Math.sin(lat1) * Math.cos(alt) + Math.cos(lat1) * Math.sin(alt) * Math.cos(b));
                let lon2 = lon1 + Math.atan2(Math.sin(b) * Math.sin(alt) * Math.cos(lat1), Math.cos(alt) - Math.sin(lat1) * Math.sin(lat2));
                return [(lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI];
            };

            let veryNear = (ln1, ln2) => {
                if (Math.abs(wrapLn(ln1) - wrapLn(ln2)) < 0.5) return true;
            };

            let ar = [];

            for (let d = 0; d <= 360; d += degInterval) {
                ar.push(pos(nadirPos.lat, nadirPos.lng, d, alt));
            }

            if (!veryNear(ar[0][1], nadirPos.lng)) {
                ar.unshift([maxLt, ar[0][1]]);
                ar.push([maxLt, ar[ar.length - 1][1]]);
            }

            let iSouth = (ar.length - 1) / 2; //index pointing south
            if (!veryNear(ar[iSouth][1], nadirPos.lng)) {
                ar.splice(iSouth + 1, 0, [-maxLt, ar[iSouth][1]], [-maxLt, ar[iSouth][1] - 360], [ar[iSouth][0], ar[iSouth][1] - 360]);
            }

            ar.push(ar[0]); //close the polygon.  Important to do so that polygons can be split in 2.

            return ar;
        };

        SunCalc.times.forEach((suntime, k) => {
            //k is the index

            if (suntime[3].val) {
                //sun time line selected

                let line = getPolygon(suntime[0] + 90);

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
                let shift = -Math.floor((minLn + 180) / 360) * 360;
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
                    let x = Math.round(line1[i][1] / 360) - Math.round(line1[i - 1][1] / 360);
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
                        if (Math.abs(l[i][0]) == maxLt) l.splice(i, 1);
                        else if (l[i][0] == 0 && (l[i][1] + 360 * 3) % 360 == (nadirPos.lng + 180 + 360 * 3) % 360) l.splice(i, 1);
                    }
                };

                let polyl = polyl1.concat(polyl2);
                polyl.forEach(removeExtremeLats);

                for (let i = polyl.length - 1; i >= 0; i--) {
                    if (polyl[i].length == 0) polyl.splice(i, 1);
                }
                //console.log(aa.polyl)

                let shiftPoly = (line, left) => {
                    if (line[0][0][0] !== void 0) {
                        return line.map(p => p.map(e => [e[0], e[1] + (left ? -360 : 360)]));
                    } else {
                        return line.map(e => [e[0], e[1] + (left ? -360 : 360)]);
                    }
                };

                //console.log("K",k);
                //console.log(polyl);

                nightPolyNames.forEach(n => {
                    //if (!map.hasLayer(nightLines[k][n])) nightLines[k][n].addTo(map); //can be added more than once in leaflet
                    nightLines[k][n].setLatLngs(n == 'middle' ? polyl : shiftPoly(polyl, n == 'left' ? true : false));
                    //if (!map.hasLayer(nightPolys[k][n])) nightPolys[k][n].addTo(map);
                    nightPolys[k][n].setLatLngs(n == 'middle' ? polyg : shiftPoly(polyg, n == 'left' ? true : false));
                });

                this.addSunLayers(k);
            } else {
                //console.log("remove",suntime,k);
                //remove unselected lines in case still present
                nightPolyNames.forEach(n => {
                    //console.log(nightLines[k]);
                    map.removeLayer(nightPolys[k][n]);
                    map.removeLayer(nightLines[k][n]);
                });
            }
        });

        //checkspeed,  optimize based on system performance
        let duration = Date.now() - now;
        if (duration > 30 && degInterval < 3) {
            degInterval += 1;
        } else if (duration < 10 && degInterval > 1) {
            degInterval -= 1;
        }
        //console.log(duration, degInterval);
    },

    setOpacity: function (v) {
        nightPolys.forEach(polys => {
            for (let p in polys) polys[p].setStyle({ fillOpacity: v });
        });
    },
};

export default drawLinesFxs;
