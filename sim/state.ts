/// <reference path="../node_modules/pxt-core/built/pxtsim.d.ts" />
 
// ============================================================
// Simulator-Zustand für den Sunlight Sensor
// Hält den aktuellen simulierten Visible-Light-Wert und stellt
// ihn dem Haupt-Namespace über getVisible() zur Verfügung.
// ============================================================
 
namespace pxsim.SunlightSensor {
    // Simulierter Wert für sichtbares Licht (0–65535)
    export let visible: number = 500;
}