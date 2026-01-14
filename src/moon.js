import SunCalc from './SunCalc.js';
import moonURL from './moon_100.png';
import geo from '@windy/geolocation';

const { log } = console;
const { PI, sign, round } = Math;

let h1 = 60 * 60 * 1000;

let refs;

function initMoon(_refs) {
    refs = _refs;
    refs.moonImg.setAttribute('href', moonURL);
}

function drawMoon(date, lat, lng) {
    if (lat === undefined || lng === undefined) {
        let pos = geo.getMyLatestPos();
        if (pos) {
            lat = pos.lat;
            lng = pos.lon;
        }
    }

    const SYNODIC_PERIOD_MS = 2551443840;

    let { parallacticAngle } = lat !== undefined && lng !== undefined ? SunCalc.getMoonPosition(date, lat, lng) : 0;
    let { phase, angle, fraction } = SunCalc.getMoonIllumination(date);
    let offset = -PI / 2;
    let rotation = -(angle - parallacticAngle);
    let rotationCorrected = rotation + offset;

    let r = 15;
    let x0 = r,
        y0 = 0,
        x1 = r,
        y1 = r * 2;
    let xrR = Math.cos(2 * Math.PI * (phase - 0.5)) * r;
    let xrL = r;
    let orientationR = phase < 0.25 || phase > 0.75 ? 0 : 1;
    let nextFull = new Date(+date + (1 - ((phase + 0.5) % 1)) * SYNODIC_PERIOD_MS);

    let { phase: phaseFull } = SunCalc.getMoonIllumination(nextFull);

    // Find full moon:   SunCalc full moon is out by up to 4 hours.
    let dir = 0.5 - phaseFull;
    let prevNextFull;
    for (let prevdir = null, i = 0; prevdir === null || sign(prevdir) == sign(dir); i++) {
        prevdir = dir;
        prevNextFull = nextFull;
        nextFull = new Date(+nextFull + (dir > 0 ? h1 : -h1));
        let { phase: phaseFull } = SunCalc.getMoonIllumination(nextFull);
        dir = 0.5 - phaseFull;
    }
    nextFull = new Date(round((+nextFull + +prevNextFull) / 2 / h1) * h1);

    let d = `
        	M ${x0}, ${y0} 
        	A ${xrL} ${r} 0 0 0 ${x1}, ${y1} 
			A ${xrR} ${r} 0 0 ${orientationR} ${x0}, ${y0} 
     	`;

    refs.moonTerm.setAttribute('d', d);
    refs.moonTerm.setAttribute('transform', `rotate(${(rotationCorrected * 180) / Math.PI}, 15,15 )`);
    refs.moonImg.setAttribute('transform', `rotate(${(parallacticAngle * 180) / Math.PI}, 15,15 )`);
    //refs.bright.setAttribute("transform", `rotate(${rotation * 180 / Math.PI}, 15,15 )`);
    refs.waxWane.innerHTML = phase > 0.5 ? 'Waning' : 'Waxing';
    refs.phase.innerHTML = `Phase: ${phase.toFixed(2)}`;
    refs.fraction.innerHTML = `Illumination: ${(100 * fraction).toFixed(1)}%`;
    refs.nextFull.innerHTML = `Full moon: ${nextFull.toISOString().slice(0, 10)}`;
}

export { initMoon, drawMoon };
