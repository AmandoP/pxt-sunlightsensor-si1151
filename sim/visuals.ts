/// <reference path="../node_modules/pxt-core/built/pxtsim.d.ts" />

// ============================================================
// Simulator-Visual: Slider für sichtbares Licht (0–65535)
// Zeichnet ein SVG-Widget mit Slider in der Simulator-Ansicht.
// Die Funktion mkSunlightSensorPart() wird von pxt-calliope
// automatisch aufgerufen, wenn "sunlightsensor" als Part
// registriert ist (siehe pxt.json).
// ============================================================

namespace pxsim.visuals {

    const PANEL_W  = 210;
    const PANEL_H  = 75;
    const TRACK_X  = 15;
    const TRACK_Y  = 48;
    const TRACK_W  = 180;
    const TRACK_H  = 6;
    const THUMB_R  = 10;
    const MAX_VAL  = 65535;
    const DEFAULT  = 500;

    export function mkSunlightSensorPart(xy: Coord): SVGAndSize<SVGGElement> {
        const g = <SVGGElement>svg.elt("g");

        // Hintergrund-Panel
        svg.child(g, "rect", {
            width: PANEL_W, height: PANEL_H,
            rx: 6, ry: 6,
            fill: "#1e1e1e",
            stroke: "#F7B731",
            "stroke-width": "1.5"
        });

        // Titel-Label
        const title = <SVGTextElement>svg.child(g, "text", {
            x: 10, y: 18,
            fill: "#F7B731",
            "font-size": "11",
            "font-family": "monospace"
        });
        title.textContent = "Sunlight Sensor – Visible Light";

        // Aktueller Wert (rechts oben)
        const valueText = <SVGTextElement>svg.child(g, "text", {
            x: PANEL_W - 8, y: 38,
            fill: "#ffffff",
            "font-size": "11",
            "font-family": "monospace",
            "text-anchor": "end"
        });
        valueText.textContent = String(DEFAULT);

        // Slider-Track
        svg.child(g, "rect", {
            x: TRACK_X, y: TRACK_Y,
            width: TRACK_W, height: TRACK_H,
            rx: 3, ry: 3,
            fill: "#444444"
        });

        // Slider-Thumb
        const thumbX = TRACK_X + (DEFAULT / MAX_VAL) * TRACK_W;
        const thumb = <SVGCircleElement>svg.child(g, "circle", {
            cx: thumbX,
            cy: TRACK_Y + TRACK_H / 2,
            r: THUMB_R,
            fill: "#F7B731",
            cursor: "pointer"
        });

        // -------------------------------------------------------
        // Drag-Logik
        // -------------------------------------------------------
        let dragging = false;
        let svgRoot: SVGSVGElement;

        function updateFromClientX(clientX: number) {
            const gRect = g.getBoundingClientRect();
            const relX = Math.max(0, Math.min(TRACK_W, clientX - gRect.left - TRACK_X));
            const val = Math.round((relX / TRACK_W) * MAX_VAL);
            pxsim.SunlightSensor.visible = val;
            thumb.setAttribute("cx", String(TRACK_X + relX));
            valueText.textContent = String(val);
        }

        thumb.addEventListener("mousedown", (e: MouseEvent) => {
            dragging = true;
            e.preventDefault();
        });

        document.addEventListener("mousemove", (e: MouseEvent) => {
            if (!dragging) return;
            updateFromClientX(e.clientX);
        });

        document.addEventListener("mouseup", () => {
            dragging = false;
        });

        // Touch-Support
        thumb.addEventListener("touchstart", (e: TouchEvent) => {
            dragging = true;
            e.preventDefault();
        }, { passive: false });

        document.addEventListener("touchmove", (e: TouchEvent) => {
            if (!dragging) return;
            updateFromClientX(e.touches[0].clientX);
        });

        document.addEventListener("touchend", () => {
            dragging = false;
        });

        return { el: g, x: xy[0], y: xy[1], w: PANEL_W, h: PANEL_H };
    }
}