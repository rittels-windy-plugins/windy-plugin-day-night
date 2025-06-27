import _ from '@windy/utils';
import store from '@windy/store';
import bcast from '@windy/broadcast';
import { emitter as picker } from '@windy/picker';
import loc from '@windy/location';
import * as singleclick from '@windy/singleclick';
import { map, baseLayer } from '@windy/map';
//import rs from '@windy/rootScope';
//import drag from '@windy/Drag';
//import transModule from '@windy/trans';
//let trans = transModule.t;
//import windyFetch from '@windy/fetch';

//import { Calendar } from '@windy/Calendar';

import SunCalc from './SunCalc.js';
import linesModule from './drawLines.js'; // methods:  drawLines,  removeSunLayers,  addSunLayers draws polygons based on timestamp.  Imports SunCalc
import { initTzModule, findTzPoly, showTzPoly, removeTzPoly, ruleAndDST, displayZones, removeZones, zoneOpacity } from './tz/tz.js';

import config from './pluginConfig.js';

import { insertGlobalCss, removeGlobalCss } from './globalCss.js';

import { getPickerMarker } from 'custom-windy-picker';
//import { checkVersion, showMsg } from './utils/infoWinUtils.js';

const { log } = console;
const { floor, abs } = Math;

let dayMs = 1000 * 60 * 60 * 24;
let h1 = 1000 * 60 * 60;

let yearStart = Date.UTC(new Date().getUTCFullYear(), 0, 1);
let ownTime = Date.now() % dayMs;
let ownDoty = getDayOfYear(Date.now());
let ownTs;

let useOwnTime = false;
let setUseOwnTime = () => { };

//let userSelParticles = store.get('particlesAnim');
//let particlesOff4Zoom = false;
let userSelOverlay = store.get('overlay');
if (userSelOverlay == 'map') {
    userSelOverlay = 'wind';
}

//let playyear = false,
//    playday = false;
//let playInterval = null;

let timeTds = [];
let timeRows = [];

const { name } = config;
const { $, getRefs } = _;

let thisPlugin, refs, node;

let hasHooks;
let pickerT;

/** logger timeout */
let loggerTO;
function logMessage(msg) {
    if (!store.get('consent')) return;
    if (!store.get('consent').analytics) return;
    fetch(`https://www.flymap.org.za/windy-logger/logger.htm?name=${name}&message=${msg}`, {
        cache: 'no-store',
    }).then(console.log);
}

initTzModule(map);

function init(plgn, setUseOwnTimeFun) {
    thisPlugin = plgn;
    setUseOwnTime = setUseOwnTimeFun;

    ({ node } = plgn.window);
    ({ refs } = getRefs(node));

    // important to close the windy picker
    bcast.fire('rqstClose', 'picker');

    //??? should I open my picker if windy picker was open,  for the moment not.

    pickerT = getPickerMarker();

    // add[Right|Left]Plugin is done by focus in demo.svelte.   Not needed here.

    makeUI();

    if (hasHooks) return;

    // log message -  this is to track usage of the plugin
    let devMode = loc.getURL().includes('windy.com/dev');
    logMessage(devMode ? 'open_dev' : 'open_user');
    if (!devMode) loggerTO = setTimeout(logMessage, 1000 * 60 * 3, '3min');
    //

    // click stuff, IMPORTANT
    singleclick.singleclick.on(name, pickerT.openMarker);
    bcast.on('pluginOpened', onPluginOpened);
    bcast.on('pluginClosed', onPluginClosed);

    insertGlobalCss();

    // the custom picker broadcasts when opened, moved or closed to the same eventer as the internal picker.
    // picker onDrag is added, it is not native to internal picker,  the second parameter is how much the function is throttled in millisecs
    picker.on('pickerOpened', getSunTimes);
    picker.on('pickerMoved', getSunTimes);
    picker.on('pickerMoved', collapseTz);
    picker.on('pickerClosed', clearSunTimes);

    pickerT.onDrag(getSunTimes, 300);

    drawLines();

    store.on('timestamp', drawLines);
    store.on('timestamp', getSunTimes);
    store.on('timestamp', drawTimezones);
    store.on('satelliteTimestamp', drawLines);
    store.on('satelliteTimestamp', getSunTimes);
    store.on('satelliteTimestamp', drawTimezones);
    store.on('radarTimestamp', drawLines);
    store.on('radarTimestamp', getSunTimes);
    store.on('radarTimestamp', drawTimezones);

    SunCalc.times.forEach(t => {
        store.on(t[3].storeName, t[3].toggle);
    });

    store.on('show-timezones', toggleTimezones);
    store.on('show-picker-timezone', togglePickerTimezone);
    store.on('day-night-utc-local', getSunTimes);
    store.on('day-night-times-4picker', getSunTimes);
    store.on('day-night-picker-side', changePickerSide);

    // responsiev to sunpos plugin
    bcast.on('pluginOpened', watchForSunPosOpen);
    bcast.on('pluginClosed', watchForSunPosClosed);

    //// read query and set querystring
    //bcast.on('pluginOpened', readQuery);

    // This is not needed anymore,  but allows you to close this plugin completely from somewhere else
    thisPlugin.closeCompletely = closeCompletely;

    hasHooks = true;
}

// Closes the plugin completely.  It is not closed by onDestroy in svelte,  as it can be opened again.
//  It is closed only when the user closes it with the close button in the embedded window.

const closeCompletely = function () {
    clearTimeout(loggerTO);

    removeGlobalCss();

    picker.off('pickerMoved', getSunTimes);
    picker.off('pickerOpened', getSunTimes);
    picker.off('pickerMoved', collapseTz);
    picker.off('pickerClosed', clearSunTimes);

    pickerT.offDrag(getSunTimes);
    pickerT.remLeftPlugin(name);
    pickerT.remRightPlugin(name); // We are not using the right div,  not needed,  but nothing will happend if you try to remove it

    //store.off('map', updateBase);
    //store.off('overlay', setMinZoom2ExceptSat);
    //store.off('overlay', addBarIfMap);
    store.off('timestamp', drawLines);
    store.off('timestamp', getSunTimes);
    store.off('timestamp', drawTimezones);
    store.off('satelliteTimestamp', drawLines);
    store.off('satelliteTimestamp', getSunTimes);
    store.off('satelliteTimestamp', drawTimezones);
    store.off('radarTimestamp', drawLines);
    store.off('radarTimestamp', getSunTimes);
    store.off('radarTimestamp', drawTimezones);
    store.off('show-timezones', toggleTimezones);
    store.off('show-picker-timezone', togglePickerTimezone);
    store.off('day-night-utc-local', getSunTimes);
    store.off('day-night-times-4picker', getSunTimes);
    store.off('day-night-picker-side', changePickerSide);

    SunCalc.times.forEach(t => {
        store.off(t[3].storeName, t[3].toggle);
    });

    //bcast.off('pluginOpened', readQuery);

    // click stuff,  IMPORTANT
    singleclick.release(name, 'high');
    singleclick.singleclick.off(name, pickerT.openMarker);
    bcast.off('pluginOpened', onPluginOpened);
    bcast.off('pluginClosed', onPluginClosed);

    // responsiev to sunpos plugin
    bcast.off('pluginOpened', watchForSunPosOpen);
    bcast.off('pluginClosed', watchForSunPosClosed);

    // finally close the plugin
    bcast.fire('rqstClose', name);

    // remove map layers
    linesModule.removeSunLayers();
    removeZones();
    removeTzPoly();

    // other plugins will try to defocus this plugin,  if these functions are still present
    delete thisPlugin.focus;
    delete thisPlugin.defocus;

    pickerT = null; // in case plugin re-opened
    hasHooks = false;
};

// VERY important and rather complicated.
// If another plugin is opened while this one is still open,  give that plugin singleclick priority, if listenToSingleclick and singleclickPriority is high
// It should happen anyway,  but does not always,  especially if the other plugin is later reopened.
function onPluginOpened(p) {
    if (W.plugins[p].listenToSingleclick && W.plugins[p].singleclickPriority == 'high') {
        singleclick.register(p, 'high');
    }
}

// When another plugin closes and has high singleclickpriority,  it returns single click to the default picker (not here as it should),
// so instead register this plugin as priority high,  (take back priority).
function onPluginClosed(p) {
    if (p !== name && W.plugins[p].singleclickPriority == 'high') {
        console.log('on plugin closed:', p, '  This plugin gets priority:', name);
        singleclick.register(name, 'high');
    }
}

export { init, closeCompletely };

function capStr(s) {
    return (s.slice(0, 1).toUpperCase() + s.slice(1)).replace(/([A-Z])/g, ' $1').trim();
}

/** returns either windy ts or ownTs,  depending on useOwnTs, *  thus remembers ownTs,  when going back and forth between windy or useOwn*/
function getts() {
    return useOwnTime ? ownTs : store.get('timestamp')
}

function onTimestamp(ts) {
    drawLines(ts);
    drawTimezones(ts);
    getSunTimes(ts);
}

function drawLines(ts) {
    //send timestamp to drawL function
    if (!ts) {
        let o = store.get('overlay');
        ts = o == 'satellite' ? store.get('satelliteTimestamp') : o == 'radar' ? store.get('radarTimestamp') : store.get('timestamp');
    }
    linesModule.drawLines(useOwnTime ? ownTs : ts);
}

function drawTimezones() {
    let opacity = store.get('timezone-opacity');
    if (store.get('show-timezones')) {
        displayZones(getts(), true, {
            odd: `rgba(0,0,0,${opacity})`,
            even: `rgba(255,255,255,${opacity})`,
            half: `rgba(255,50,0,${opacity})`,
            outline: 'transparent',
        });
    }
}

function toggleTimezones(e) {
    if (e) displayZones(getts(), true); else removeZones();
}

function togglePickerTimezone(e) {
    if (e == false) removeTzPoly();
    else if (pickerT.isOpen) {
        let pos = store.get('pickerLocation');
        let tzgj = findTzPoly(pos.lon, pos.lat);
        let rdst = ruleAndDST(tzgj, getts());
        let absOff = abs(rdst.offset);
        showTzPoly(tzgj, absOff % 2 == 0 ? 'red' : absOff % 2 == 1 ? 'blue' : 'orange');
    }
}

function changePickerSide(side) {
    if (side == 'left') {
        pickerT.addLeftPlugin(name);
        pickerT.remRightPlugin(name);
    } else {
        pickerT.addRightPlugin(name);
        pickerT.remLeftPlugin(name);
    }
    let pickerParams = pickerT.getParams();
    if (pickerParams) getSunTimes(pickerParams);
}

/** Day of the year,  from timestamp,  day 0 = 1st of Jan */
function getDayOfYear(timestamp) {
    return floor((timestamp - yearStart) / dayMs);
}

/** get date string from day of the year */
function getDate(doty) {
    const mnths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dt = new Date(yearStart + doty * dayMs);
    return ('00' + dt.getUTCDate()).slice(-2) + '-' + mnths[dt.getUTCMonth()];
}

////left pane UI components

//// SunCalc.times consist of [degree, start name , end name]  ..now extend these arrays with:
//// an object:   {storeName, val, description, toggle function}

/**
 * ar of times
 * [name, description]
 */
let ar = [
    ['sun-gold', 'Golden hour end & start'],
    ['sun-rise-start', 'Sunrise end & Sunset start'],
    ['sun-rise-set', 'Sunrise & Sunset'],
    ['sun-dusk-dawn', 'Dawn start & Dusk end'],
    ['sun-nautical', 'Nautical dawn & dusk'],
    ['sun-night', 'Night end & start'],
    ['sun-custom', 'Custom'],
];

/**
 *  Suncalc.times:
 *  [alt (degrees above horizon),
 *  name start,
 *  name end,
 *  { description, storeName, toggle fun, val: true|false}]
 */
SunCalc.times.forEach((t, i) => {
    store.insert(ar[i][0], { def: false, allowed: [true, false], save: true });
    t.push({
        storeName: ar[i][0],
        val: store.get(ar[i][0]),
        description: ar[i][1],
        toggle: function (val) {
            t[3].val = val;
            store.set(t[3].storeName, val);
            drawLines(useOwnTime ? ownTs : null);
            timeRows[i].style.display = t[3] ? 'table-row' : 'none';
            if (store.get('day-night-times-4picker') == i) {
                store.set('day-night-times-4picker', -1);
                getSunTimes();
            }
        },
    });
});



store.insert('day-night-custom-altitude', {
    def: 20,
    allowed: v => v >= -90 && v <= 90,
    save: true,
});
SunCalc.times[6][0] = store.get('day-night-custom-altitude');


store.insert('day-night-opacity', { def: 0.1, allowed: v => v >= 0 && v <= 0.5, save: true });
store.insert('day-night-utc-local', { def: 'local', allowed: ['utc', 'local'], save: true });
store.insert('show-timezones', { def: false, allowed: [true, false], save: true });
store.insert('show-picker-timezone', { def: false, allowed: [true, false], save: true });
store.insert('timezone-opacity', { def: 0.2, allowed: v => v >= 0 && v <= 1, save: true });

// done in svelte
// store.insert('day-night-picker-side', { def: 'right', allowed: ['left', 'right'], save: true, });

store.insert('day-night-times-4picker', {
    def: 2,
    allowed: n => Number(n) >= -1 && Number(n) < 8,
    save: true,
});

function makeUI() {
    for (let togSec of node.querySelectorAll('.toggle-section')) {
        store.insert('dayNight_' + togSec.dataset.ref, {
            def: false,
            allowed: [true, false],
            save: true,
        });
    }

    SunCalc.times.forEach((t, i) => {
        let tr = document.createElement('tr');
        refs.dayNightSunTable.appendChild(tr);
        let cb = tr.appendChild(document.createElement('td')).appendChild(document.createElement('div'));
        cb.innerHTML = t[3].description + ':&nbsp;&nbsp;';
        cb.classList.add('checkbox');
        cb.classList[t[3].val ? 'remove' : 'add']('checkbox--off');

        cb.addEventListener('click', () => {
            cb.classList.toggle('checkbox--off');
            //store.set(t[3].storeName, !cb.classList.contains("checkbox--off"));
            t[3].toggle(!cb.classList.contains('checkbox--off'));
        });

        ////add description and degrees to table
        let alt = tr.appendChild(document.createElement('td'));
        alt.innerHTML = t[0];
        if (i == 6) {
            refs.customAltVal = alt;
        }
    });

    ////times table

    let storedRow = store.get('day-night-times-4picker');

    SunCalc.times.forEach((t, i) => {
        let row = document.createElement('tr');
        timeRows[i] = row;
        $('tbody', refs.dayNightTimesTable).appendChild(row);

        //add description and degrees t table
        timeTds[i] = [];
        [0, 1].forEach(k => {
            row.appendChild(document.createElement('td')).innerHTML = capStr(t[k + 1]);
            row.appendChild((timeTds[i][k] = document.createElement('td')));
        });
        row.style.display = t[3] ? 'table-row' : 'none';
        row.addEventListener('click', () => {
            timeRows.forEach((r, ii) => {
                if (i == ii) return;
                r.classList.remove('selected');
            });
            row.classList.toggle('selected');
            store.set('day-night-times-4picker', row.classList.contains('selected') ? i : -1);
        });

        if (storedRow !== -1 && i == storedRow) row.classList.add('selected');
    });
    refs.clearPicker.addEventListener('click', () => {
        store.set('day-night-times-4picker', -1);
        timeRows.forEach(row => row.classList.remove('selected'));
    });

    refs.customAlt.addEventListener('input', e => {
        let v = Number(e.target.value);
        store.set('day-night-custom-altitude', v);
        SunCalc.times[6][0] = v;
        refs.customAltVal.innerHTML = v;
        drawLines();
        getSunTimes();
    });
    refs.customAlt.value = Number(store.get('day-night-custom-altitude'));

    refs.opacity.addEventListener('input', e => {
        let v = Number(e.target.value);
        store.set('day-night-opacity', v);
        linesModule.setOpacity(v);
    });
    refs.opacity.value = Number(store.get('day-night-opacity'));

    refs.tzOpacity.addEventListener('input', e => {
        let v = Number(e.target.value);
        v = Math.pow(v, 2);
        store.set('timezone-opacity', v);
        zoneOpacity(v);
    });
    let znOp = Number(store.get('timezone-opacity'));
    refs.tzOpacity.value = Math.pow(znOp, 0.5);
    zoneOpacity(znOp);

    const onFullyearTime = v => {
        ownTime = v * 1000 * 60;
        let d = new Date(ownTime);
        ownTs = yearStart + ownDoty * dayMs + ownTime;
        drawLines(ownTs);
        refs.valFullyearTime.innerHTML = ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2);
        drawTimezones();
        getSunTimes();
    };
    refs.fullyearTime.addEventListener('input', e => onFullyearTime(Number(e.target.value)));
    refs.fullyearTime.value = floor(ownTime / 60000);
    onFullyearTime(floor(ownTime / 60000));

    const onFullyearDate = v => {
        if (!useOwnTime) return;
        ownDoty = v;
        ownTs = yearStart + ownDoty * dayMs + ownTime;
        drawLines(ownTs);
        refs.valFullyearDate.innerHTML = getDate(v);
        drawTimezones();
        getSunTimes();
    };
    refs.fullyearDate.addEventListener('input', e => onFullyearDate(Number(e.target.value)));
    refs.fullyearDate.value = ownDoty;
    onFullyearDate(ownDoty);

    for (let setting of refs.dayNightSettings.rows) {
        let opts = Array.from(setting.querySelectorAll('.select-setting'));
        
        if (opts.length == 0) {
            // if not opt then is checkbox,
            let el = setting.firstChild;
            el.classList[store.get(setting.dataset.ref) ? "remove" : "add"]('checkbox--off');
            
            setting.addEventListener('click', e => {
                el.classList.toggle('checkbox--off');
                store.set(setting.dataset.ref, !el.classList.contains('checkbox--off'));
                
            });
        } else {
            opts.forEach(e => {
                if (setting.dataset.ref == 'select-time') {
                    if (e.dataset.do == 'windy') e.classList.add('selected');
                } else {
                    if (store.get(setting.dataset.ref) == e.dataset.do) e.classList.add('selected');
                }

                e.addEventListener('click', () => {
                    opts.forEach(ee => ee.classList.remove('selected'));
                    e.classList.add('selected');
                    if (setting.dataset.ref == 'select-time') {
                        useOwnTime = e.dataset.do !== 'windy';
                        store.set('overlay', useOwnTime ? 'topoMap' : userSelOverlay);
                        setUseOwnTime(useOwnTime);
                        if (useOwnTime) {
                            onFullyearDate(ownDoty);
                            onFullyearTime(floor(ownTime / 60000));
                        }
                        setTimeout(() => (refs.scrollable.scrollTop = refs.scrollable.scrollHeight), 100);
                    } else store.set(setting.dataset.ref, e.dataset.do);
                });
            });
        }
    }

    ////toggle section visibility

    for (let togSec of node.querySelectorAll('.toggle-section')) {
        if (store.get('dayNight_' + togSec.dataset.ref)) togSec.classList.add('off');
        togSec.addEventListener('click', () => {
            togSec.classList.toggle('off');
            store.set('dayNight_' + togSec.dataset.ref, togSec.classList.contains('off'));
        });
    }

    toggleTimezones(store.get('show-timezones'));
}

function setURL(p, ts) {
    loc.setUrl(name, {
        lat: p.lat.toFixed(5),
        lon: p.lon.toFixed(5),
        time: new Date(ts || store.get('timestamp')).toISOString().slice(0, 16) + 'Z',
    });
}

////Detect picker position and set times and also TZ detail

let lastlon = null,
    lastlat = null,
    lastTzOffs = null,
    ruleExists,
    lastTs = 0;

let tzRefs = ['tzName', 'tzOffset', 'tzOffsetDST', 'tzRule', 'tzBeg', 'tzEnd'];

/**
 *
 * @param {*} e {lat, lon}
 * @returns undefined
 * Fills table and picker with times.
 * gets tz detail and fills table and draws poly
 */
function getSunTimes(e) {
    let { tzSection, tzName, tzOffset, tzOffsetDST, tzRule, tzBeg, tzEnd } = refs;

    if (e === void 0 || e.lat === void 0) {
        if (pickerT.isOpen) {
            e = store.get('pickerLocation');
        } else {
            return;
        }
    }
    if (e.lon === void 0) e.lon = e.lng; // if comes from leaflet marker

    let dt = new Date(getts());
    let times = SunCalc.getTimes(dt, e.lat, e.lon);

    // function not really needed?
    let fillTableAndPicker = function () {
        let html = '',
            t4p = store.get('day-night-times-4picker'),
            tz = store.get('day-night-utc-local');
        SunCalc.times.forEach((t, i) => {
            [1, 2].forEach(k => {
                if (times[t[k]]) {
                    const timestr = offs =>
                        (offs ? new Date(times[t[k]].getTime() + offs * h1) : times[t[k]]).toISOString().slice(11, 16) + (offs ? '' : 'z');

                    timeTds[i][k - 1].innerHTML = !(times[t[k]] instanceof Date)
                        ? times[t[k]]
                        : tz == 'utc'
                            ? timestr()
                            : lastTzOffs != null
                                ? timestr(lastTzOffs)
                                : '';

                    if (t4p == i) {
                        html += `
                            ${capStr(t[k])}: ${!(times[t[k]] instanceof Date) ? times[t[k]] : timestr()}
                            ${!(times[t[k]] instanceof Date) ? '' : lastTzOffs ? ', ' + timestr(lastTzOffs) : ''}
                            ${k == 1 ? '<br>' : ''}`;
                    }
                }
            });
        });
        //if (pickerT.isOpen) {  //no really needed,  wont happen if closed
        if (store.get('day-night-picker-side') == 'right') {
            if (pickerT.getRightPlugin() == name) pickerT.fillRightDiv(html);
        } else {
            if (pickerT.getLeftPlugin() == name) pickerT.fillLeftDiv(html, true);
        }
        //}
    };

    fillTableAndPicker();

    // now tzs
    if (lastlon === null || abs(lastlon - e.lon) > 0.1 || abs(lastlat - e.lat) > 0.1 || abs(lastTs - dt.getTime()) > h1) {
        let tzgj = findTzPoly(e.lon, e.lat);
        let {
            properties: { tzid },
        } = tzgj;
        let rdst = ruleAndDST(tzgj, dt.getTime());
        let { offset, rule, baseoff, ruleDescription } = rdst;
        if (store.get('show-picker-timezone')) {
            let absOff = abs(offset);
            showTzPoly(tzgj, absOff % 2 == 0 ? 'red' : absOff % 2 == 1 ? 'blue' : 'orange');
        }

        lastTzOffs = offset;
        (lastlon = e.lon), (lastlat = e.lat);
        lastTs = dt.getTime();
        tzName.innerHTML = tzid;
        tzOffset.innerHTML = (baseoff > 0 ? '+' : '') + baseoff;
        tzOffsetDST.innerHTML = (offset > 0 ? '+' : '') + offset;

        let dayStr = s => {
            let ord = n => (n > 0 ? ['th', 'st', 'nd', 'rd'][(n > 3 && n < 21) || n % 10 > 3 ? 0 : n % 10] : '');
            return s.indexOf('>=') >= 0
                ? (a => (
                    (a = s.split('>=')),
                    a[1] == 1 ? 'the 1st ' + a[0] : a[1] == 8 ? 'the 2nd ' + a[0] : 'the 1st ' + a[0] + ' from the ' + a[1] + ord(a[1])
                ))()
                : isNaN(s)
                    ? 'the ' + s.replace(/([A-Z])/g, ' $1').trim()
                    : 'the ' + s + ord(s);
        };

     
        if (ruleDescription) {
            tzSection.classList.remove('collapsed', 'hide-rows');
            ruleExists = true;
            let s = ruleDescription.beg.save,
                b = 'beg',
                e = 'end';
            if (s == 0) {
                s = ruleDescription.end.save;
                b = 'end';
                e = 'beg';
            }
            tzRule.innerHTML = `${rule}: Save: ${s}`;
            tzBeg.innerHTML = `At ${ruleDescription[b].at} on ${dayStr(ruleDescription[b].day)} of ${ruleDescription[b].month}`;
            tzEnd.innerHTML = `At ${ruleDescription[e].at} on ${dayStr(ruleDescription[e].day)} of ${ruleDescription[e].month}`;
            [tzBeg, tzEnd].forEach((t, i, a) => {
                t.classList[a[i].innerHTML.length > 33 || a[1 - i].innerHTML.length > 33 ? 'add' : 'remove']('small');
            });
        } else {
            ruleExists = false;
            tzRule.innerHTML = 'No daylight saving time';
            tzSection.classList.add('hide-rows');
        }
    }
    setURL(e, store.get('timestamp'));
}

function collapseTz() {
    if (!ruleExists) {
        refs.tzSection.classList.add('collapsed', 'hide-rows');
    }
}

function clearSunTimes() {
    SunCalc.times.forEach((t, i) => [0, 1].forEach(k => (timeTds[i][k].innerHTML = '')));
    ruleExists = false;
    tzRefs.forEach(e => (refs[e].innerHTML = ''));
    collapseTz();
    removeTzPoly();
}

///// extra work wiht sun position plugin

let sunPosMarker;

function watchForSunPosOpen(e) {
    if (e == 'windy-plugin-sun-position') {
        pickerT.removeMarker(); // close my picker
        map.eachLayer(layer => {
            if (layer.options?.icon?.options?.className == 'dial') {
               
                sunPosMarker = layer;
                sunPosMarker.on('drag', e => getSunTimes(e.latlng));
                sunPosMarker.on('move', e => getSunTimes(e.latlng));
            }
        });
    }
}

function watchForSunPosClosed(e) {
    if (e == 'windy-plugin-sun-position') {
        if (sunPosMarker) {
            // prob not needed
            sunPosMarker.off('drag');
            sunPosMarker.off('move');
        }
        removeTzPoly();
    }
}
