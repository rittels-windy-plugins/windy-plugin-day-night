const thisYear = 2025;
const { log } = console;

/** array of unique polygons names:   contains:
 *  - epochs:  array of timestamp index values where this polygon should be displayed
 *  - list: list of timezone names,  not needed to draw poly
 *  - name:  name of the polygon to fetch from the server
 *  - offs:  offset
 */
let up;

/** start ts of all epochs,  for thisYear.
 * Lookup index from timelims and then look up if index is contained in epochs in up
 * */
let timelims;

/**
 * Cache of the unique polygons.
 */
let upGeojsons = {};

let allPolys, rules, regions;

const brotli = true;

const baseUrl = 'https://www.flymap.org.za/tz2/';

const url = baseUrl + `data${brotli ? '_br' : ''}/`;

const uniquePolys = url + 'uniquePolys';
const timeLimits = url + 'timeLimits';
const polys = url + 'polys.geojson';
const ruleList = url + 'rulelist.json';
const regionsWithTs = url + 'regionsWithTs.json';

let map;
let color = {
    odd: 'rgb(0,0,255)',
    even: 'rgb(255,255,255)',
    half: 'rgb(255,50,0)',
    outline: 'transparent',
};
let opacity = 0.1;

const str2hr = s => (s == '0' ? 0 : Number(s.slice(0, -3)) + Number(s.slice(-2)) / 60);

function initTzModule(importedMap) {
    map = importedMap;
}

async function loadData() {
    if (window.tz && window.tz.dataLoaded) {
        
        ({ timelims, up, allPolys, rules, regions } = window.tz);
        return;
    }
    window.tz = {};
    tz.tzLayers = [];
    return Promise.all([
        fetch(uniquePolys)
            .then(r => {
                return r.json();
            })
            .then(d => {
                up = d;
                tz.up = up;
            }),
        fetch(timeLimits)
            .then(r => r.json())
            .then(d => {
                timelims = d;
                tz.timelims = timelims;
            }),
        fetch(polys)
            .then(r => r.json())
            .then(d => {
                allPolys = d;
                tz.allPolys = allPolys;
            }),
        fetch(regionsWithTs)
            .then(r => r.json())
            .then(d => {
                regions = d;
                tz.regions = regions;
            }),
        fetch(ruleList)
            .then(r => r.json())
            .then(d => {
                rules = d;
                tz.rules = rules;
            }),
    ]).then(() => {
        window.tz.dataLoaded = true;
    });
}
loadData();//.then(() => log(up, timelims));

function pointInPoly(ll, vs) {
    var x = ll.lon || ll.lng, //point[0],
        y = ll.lat; //point[1];
    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0],
            yi = vs[i][1];
        var xj = vs[j][0],
            yj = vs[j][1];
        var intersect = yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

function showTzPoly(geoJson, color) {
    if (!window.tz.dataLoaded) return;
    tz.singleTzLayer?.remove();
    tz.singleTzLayer = L.geoJSON(geoJson, { style: { color, fillOpacity: 0 }, interactive: false }).addTo(map);
}

function removeTzPoly() {
    if (!window.tz.dataLoaded) return;
    tz.singleTzLayer?.remove();
}

function findTzPoly(lon, lat) {
    if (!window.tz.dataLoaded) return;
    let possibles = [];
    let found = allPolys.features.filter(
        ({
            properties: {
                bbox: [minLn, minLt, maxLn, maxLt],
            },
        }) => lon >= minLn && lon <= maxLn && lat >= minLt && lat <= maxLt,
    );

    found.forEach(f => {
        let p = f.geometry.coordinates;
        let polys;
        let multi;
        //grab outer polys only,  thus index 0
        if (p[0][0][0][0] === undefined) {
            polys = [p[0]];
            multi = false;
        } else {
            polys = p.map(pp => pp[0]);
            multi = true;
        }
        polys.forEach(poly => {
            if (pointInPoly({ lon, lat }, poly)) {
                possibles.push(f);
            }
        });
    });
    if (possibles.length) {
        let gj = possibles.sort((a, b) => a.properties.area - b.properties.area)[0];
        return gj;
    }
}

function lookUpDST(region, ts) {
    if (!window.tz.dataLoaded) return;
    return ts >= region.begTs && ts < region.endTs ? region.saveIn : region.saveOut;
}

function ruleAndDST(gj, ts) {
    if (!window.tz.dataLoaded) return;
    let {
        properties: { tzid },
    } = gj;
    let region = regions.find(reg => reg.reg == tzid);
    let { rule, offs } = region;
    if (!rule || rule == '-' || !region.begTs || !region.endTs) {
        return { rule, offset: str2hr(offs), baseoff: str2hr(offs) };
    } else {
        let dst = lookUpDST(region, ts);
        return {
            rule,
            ruleDescription: rules.find(r => r.rule == rule),
            baseoff: str2hr(offs),
            offset: str2hr(offs) + str2hr(dst),
        };
    }
}

/**
 *
 * @param {*} toDel  array of filenames to delete,  if null,  delete all layers
 */
function removeZones(toDel = null) {
    if (!toDel) {
        for (let l of tz.tzLayers) {
            l.layer.remove();
        }
        tz.tzLayers = [];
    } else {
        tz.tzLayers.forEach(l => {
            if (toDel.includes(l.filename)) {
                l.layer.remove();
                l.filename = null; //mark to filter
            }
        });
        tz.tzLayers = tz.tzLayers.filter(l => l.filename);
    }
}

function zoneOpacity(s) {
    opacity = s;
    for (let l of tz.tzLayers) {
        l.layer.setStyle({ fillOpacity: opacity });
    }
}
function zoneColor(s) {
    color = s;
    for (let l of tz.tzLayers) {
        l.layer.setStyle({
            color: color.outline,
            fillColor: mod == 0 ? color.even : mod == 1 ? color.odd : color.half,
        });
    }
}

/**
 *
 * @param {*} ts - timestamp
 * @param {*} force - if false will only show if timeIx different from prevIx,  remembered as closure
 * @returns
 */
let displayZones = (function () {
    let prevIx = null;
    let prevFiles = [];
    return function (ts, force = false) {
        
        if (!window.tz.dataLoaded) return;
        let timeIx = timelims.findIndex(t => t > ts);
        if (timeIx == -1) timeIx = timelims.length - 1;
        else timeIx -= 1;
      
        if (prevIx !== timeIx || force) {
            //document.getElementById("index").innerHTML = timeIx;
            let polys = up.filter(u => u.epochs.includes(timeIx));
            let files = polys.map(p => p.name);

            // if tzLayers was removed,  clear prevFiles;
            if (tz.tzLayers.length == 0) prevFiles = [];

            // only delete layers that are not in files list and only add layers that are not in prev list.
            let files2del = prevFiles.filter(f => !files.includes(f));
            let files2load = files.filter(f => !prevFiles.includes(f));
            prevFiles = files;

            let promises = [];
            for (let f of files2load) {
                promises.push(
                    new Promise((res, rej) => {
                        // 1st check in  cache, else fetch and store in cache
                        if (upGeojsons[f]) {
                            res(upGeojsons[f]);
                        } else
                            res(
                                fetch(url + `unions/${f}.geojson`)
                                    .then(r => r.json())
                                    .then(gj => {
                                        gj.properties.filename = f; // should be added in backend
                                        upGeojsons[f] = gj;
                                        return gj;
                                    }),
                            );
                    }),
                );
            }
            Promise.all(promises).then(gjs => {
                removeZones(files2del);
                gjs.forEach(gj => {
                    let mod = Math.abs(+gj.properties.offs % 2);
                    tz.tzLayers.push({
                        filename: gj.properties.filename,
                        layer: L.geoJSON(gj, {
                            style: feature => ({
                                color: color.outline,
                                weight: '1',
                                fillColor: mod == 0 ? color.even : mod == 1 ? color.odd : color.half,
                                fillOpacity: opacity,
                            }),
                            interactive: false,
                        }).addTo(map),
                    });
                });
            });
            prevIx = timeIx;
        }
    };
})();

export { initTzModule, findTzPoly, showTzPoly, removeTzPoly, displayZones, removeZones, ruleAndDST, zoneOpacity };
