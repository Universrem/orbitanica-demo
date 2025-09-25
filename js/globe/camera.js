// camera.js - ФІКСОВАНА ВЕРСІЯ

'use strict';

import { markerLayer, defaultCenterLat, defaultCenterLon } from "./globe.js";
import { LonLat } from '../../lib/og.es.js';

let isFlying = false;
let currentFlightToken = 0;

export function initCamera(globus) {
    const cam = globus.planet ? globus.planet.camera : globus.camera;
    if (cam) {
        cam.maxAltitude = 15_000_000;
        cam.update();
        const threeCam = cam.camera;
        if (threeCam) { 
            threeCam.far = 200_000_000; 
            threeCam.updateProjectionMatrix(); 
        }
        
        setTimeout(() => {
            updateCameraView(globus, { type: 'initial' });
        }, 100);
    }
}

export function updateCameraView(globus, context) {
    const cam = globus.planet.camera;
    const entities = markerLayer.getEntities();
    const centerLL = entities.length
        ? entities.slice(-1)[0].getLonLat()
        : new LonLat(defaultCenterLon, defaultCenterLat);

    if (context.type === 'initial') {
        cam._numFrames = 180;
        cam.flyLonLat(new LonLat(centerLL.lon, centerLL.lat, 3_000_000));
    }
}

export function getCameraAPI(globus) {
    const cam = globus?.planet?.camera;
    const ellipsoid = globus?.planet?.ellipsoid;
    if (!cam || !ellipsoid) return null;

    const R = 6_371_008.8;
    const DEG = Math.PI / 180;

    const normLon = (lon) => {
        let L = lon; 
        while (L < -180) L += 360; 
        while (L >= 180) L -= 360; 
        return L;
    };

    const getFov = () => {
        const threeCam = cam.camera;
        return (threeCam && threeCam.fov) ? threeCam.fov : 45;
    };

    const estimateAlt = (radiusM, fovDeg) => {
        const delta = Math.max(0, Math.min(Math.PI, radiusM / R));
        const eff = Math.min(delta, Math.PI - delta);
        const fovR = Math.max(15*DEG, Math.min(90*DEG, fovDeg*DEG));
        const k = 1.15;
        const h = (k * R * eff) / Math.tan(fovR / 2);
        return Math.min(Math.max(h, 10), 30_000_000);
    };

    return {
        getFovDeg() { 
            return getFov();
        },

        flyToNadir({ lon, lat, radiusM, altitudeM, durationMs = 2500 }) {
            if (!cam || isFlying) return;

            isFlying = true;
            currentFlightToken++;
            const token = currentFlightToken;

            console.log('🚀 START flight to:', lon, lat, 'token:', token);

            const fov = this.getFovDeg();
            const finalH = altitudeM > 0 ? altitudeM : 
                          radiusM > 0 ? estimateAlt(radiusM, fov) : 1_000_000;

            const targetLL = new LonLat(normLon(lon), lat);

            // Мінімальний політ без зайвих stopFlying
            try {
                cam._numFrames = Math.max(60, Math.floor(durationMs / 16));
                cam.flyLonLat(new LonLat(targetLL.lon, targetLL.lat, finalH));
                
                // Простий завершення польоту
                setTimeout(() => {
                    if (token === currentFlightToken) {
                        isFlying = false;
                        console.log('✅ FINISHED flight token:', token);
                    }
                }, durationMs + 200);
                
            } catch (error) {
                isFlying = false;
                console.error('❌ Flight error:', error);
            }
        }
    };
}

export function updateAltimeterReadout(globus) {
    const el = document.getElementById('altimeter');
    const cam = globus?.planet?.camera;
    
    if (el && cam) {
        try {
            const h = cam.getHeight ? cam.getHeight() : 
                     cam.getAltitude ? cam.getAltitude() : 0;
            el.textContent = Math.round(h).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' m';
        } catch (e) {}
    }
}