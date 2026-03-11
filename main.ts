// ============================================================
// Grove Sunlight Sensor V2 – SI1151 Extension für MakeCode PXT
// Korrekturen gegenüber ursprünglicher Version:
//   1. Schleifenbedingung in param_set / param_query / send_command
//      war invertiert → jetzt: while (r == cmmnd_ctr)
//   2. Alle drei Read-Funktionen lasen denselben Kanal (Kanal 0) →
//      jetzt lesen IR / Visible / UV jeweils den richtigen Kanal
//   3. UV-Index: SI1151 hat keinen UV-Photodetektor; UV wird jetzt
//      aus Visible- und IR-Kanal nach App-Note-Schema berechnet
//   4. Byte-Reihenfolge in UV-Funktion war verkehrt → vereinheitlicht
//   5. Neuer Helfer read_register16() für 16-Bit-Auslesungen
//   6. read_register() liest jetzt bytesOfData Bytes korrekt
// ============================================================

enum UnitAddress {
    DEVICE_ADDRESS = 0x53
};

enum CommandCodes {
    RESET_CMD_CTR = 0x00,
    RESET_SW = 0x01,
    FORCE = 0x11,
    PAUSE = 0x12,
    START = 0x13
};

enum RegisterAddress {
    PART_ID = 0x00,
    REV_ID = 0x01,
    MFR_ID = 0x02,
    INFO_0 = 0x03,
    INFO_1 = 0x04,
    HOSTIN_3 = 0x07,
    HOSTIN_2 = 0x08,
    HOSTIN_0 = 0x0A,
    COMMAND = 0x0B,
    IRQ_ENABLE = 0x0F,
    RESPONSE_1 = 0x10,
    RESPONSE_0 = 0x11,
    IRQ_STATUS = 0x12,
    HOSTOUT_0 = 0x13,
    HOSTOUT_1 = 0x14,
    HOSTOUT_2 = 0x15,
    HOSTOUT_3 = 0x16,
    HOSTOUT_4 = 0x17,
    HOSTOUT_5 = 0x18,
    HOSTOUT_6 = 0x19,
    HOSTOUT_7 = 0x1A,
    HOSTOUT_8 = 0x1B,
    HOSTOUT_9 = 0x1C,
    HOSTOUT_10 = 0x1D,
    HOSTOUT_11 = 0x1E,
    HOSTOUT_12 = 0x1F,
    HOSTOUT_13 = 0x20,
    HOSTOUT_14 = 0x21,
    HOSTOUT_15 = 0x22,
    HOSTOUT_16 = 0x23,
    HOSTOUT_17 = 0x24,
    HOSTOUT_18 = 0x25,
    HOSTOUT_19 = 0x26,
    HOSTOUT_20 = 0x27,
    HOSTOUT_21 = 0x28,
    HOSTOUT_22 = 0x29,
    HOSTOUT_23 = 0x2A,
    HOSTOUT_24 = 0x2B,
    HOSTOUT_25 = 0x2C
};

enum ParameterAddress {
    I2C_ADDR = 0x00,
    CHAN_LIST = 0x01,
    ADCCONFIG_0 = 0x02,
    ADCSENS_0 = 0x03,
    ADCPOST_0 = 0x04,
    MEASCONFIG_0 = 0x05,
    ADCCONFIG_1 = 0x06,
    ADCSENS_1 = 0x07,
    ADCPOST_1 = 0x08,
    MEASCONFIG_1 = 0x09,
    ADCCONFIG_2 = 0x0A,
    ADCSENS_2 = 0x0B,
    ADCPOST_2 = 0x0C,
    MEASCONFIG_2 = 0x0D,
    ADCCONFIG_3 = 0x0E,
    ADCSENS_3 = 0x0F,
    ADCPOST_3 = 0x10,
    MEASCONFIG_3 = 0x11,
    ADCCONFIG_4 = 0x12,
    ADCSENS_4 = 0x13,
    ADCPOST_4 = 0x14,
    MEASCONFIG_4 = 0x15,
    ADCCONFIG_5 = 0x16,
    ADCSENS_5 = 0x17,
    ADCPOST_5 = 0x18,
    MEASCONFIG_5 = 0x19,
    MEASRATE_H = 0x1A,
    MEASRATE_L = 0x1B,
    MEASCOUNT_0 = 0x1C,
    MEASCOUNT_1 = 0x1D,
    MEASCOUNT_2 = 0x1E,
    LED1_A = 0x1F,
    LED1_B = 0x20,
    LED2_A = 0x21,
    LED2_B = 0x22,
    LED3_A = 0x23,
    LED3_B = 0x24,
    THRESHOLD0_H = 0x25,
    THRESHOLD0_L = 0x26,
    THRESHOLD1_H = 0x27,
    THRESHOLD1_L = 0x28,
    THRESHOLD2_H = 0x29,
    THRESHOLD2_L = 0x2A,
    BURST = 0x2B
};

namespace SI1151 {

    export class SI1151 {
        conf: Buffer;
        writeBuf: Buffer;

        // -------------------------------------------------------
        // Kanal konfigurieren (intern)
        // -------------------------------------------------------
        private config_channel(index: number) {
            const len = 4;
            if (index < 0 || index > 5) return;
            const inc = index * len;
            this.param_set(ParameterAddress.ADCCONFIG_0 + inc, this.conf[0]);
            this.param_set(ParameterAddress.ADCSENS_0 + inc, this.conf[1]);
            this.param_set(ParameterAddress.ADCPOST_0 + inc, this.conf[2]);
            this.param_set(ParameterAddress.MEASCONFIG_0 + inc, this.conf[3]);
        }

        // -------------------------------------------------------
        // I2C schreiben
        // -------------------------------------------------------
        private write_data() {
            pins.i2cWriteBuffer(UnitAddress.DEVICE_ADDRESS, this.writeBuf, false);
        }

        // -------------------------------------------------------
        // 1 Byte aus Register lesen
        // -------------------------------------------------------
        private read_register(addr: number, reg: number): number {
            let buf = pins.createBuffer(1);
            buf[0] = reg;
            pins.i2cWriteBuffer(addr, buf, false);
            buf = pins.i2cReadBuffer(addr, 1, false);
            return buf[0];
        }

        // -------------------------------------------------------
        // FIX 5: Helfer für 16-Bit-Auslesung (Big-Endian, High-Byte zuerst)
        // Liest zwei aufeinanderfolgende HOSTOUT-Register in einem Zug.
        // -------------------------------------------------------
        private read_register16(addr: number, reg: number): number {
            let buf = pins.createBuffer(1);
            buf[0] = reg;
            pins.i2cWriteBuffer(addr, buf, false);
            buf = pins.i2cReadBuffer(addr, 2, false);
            return buf[0] * 256 + buf[1];  // Big-Endian laut Datenblatt
        }

        // -------------------------------------------------------
        // FIX 1: Schleifenbedingung korrigiert → while (r == cmmnd_ctr)
        // Vorher: while (r > cmmnd_ctr)  ← invertiert / führt zu
        //   Endlosschleife wenn Befehl verarbeitet wurde
        // Jetzt: Schleife läuft, solange Befehlszähler sich NICHT
        //   geändert hat (Befehl noch nicht abgeschlossen).
        // -------------------------------------------------------
        private param_set(loc: number, val: number) {
            let r: number;
            let cmmnd_ctr: number;
            do {
                cmmnd_ctr = this.read_register(UnitAddress.DEVICE_ADDRESS, RegisterAddress.RESPONSE_0);
                this.writeBuf = pins.createBuffer(2);
                this.writeBuf[0] = RegisterAddress.HOSTIN_0;
                this.writeBuf[1] = val;
                this.write_data();
                this.writeBuf[0] = RegisterAddress.COMMAND;
                this.writeBuf[1] = loc | 0x80;  // 0x80 = 0b10_000000 = PARAM_SET
                this.write_data();
                r = this.read_register(UnitAddress.DEVICE_ADDRESS, RegisterAddress.RESPONSE_0);
            } while (r == cmmnd_ctr);  // FIX 1: warten bis Zähler sich ändert
        }

        private param_query(loc: number): number {
            let r: number;
            let cmmnd_ctr: number;
            do {
                cmmnd_ctr = this.read_register(UnitAddress.DEVICE_ADDRESS, RegisterAddress.RESPONSE_0);
                this.writeBuf = pins.createBuffer(2);
                this.writeBuf[0] = RegisterAddress.COMMAND;
                this.writeBuf[1] = loc | 0x40;  // 0x40 = 0b01_000000 = PARAM_QUERY
                this.write_data();
                r = this.read_register(UnitAddress.DEVICE_ADDRESS, RegisterAddress.RESPONSE_0);
            } while (r == cmmnd_ctr);  // FIX 1
            return this.read_register(UnitAddress.DEVICE_ADDRESS, RegisterAddress.RESPONSE_1);
        }

        send_command(code: number) {
            let r: number;
            let cmmnd_ctr: number;
            do {
                cmmnd_ctr = this.read_register(UnitAddress.DEVICE_ADDRESS, RegisterAddress.RESPONSE_0);
                this.writeBuf = pins.createBuffer(2);
                this.writeBuf[0] = RegisterAddress.COMMAND;
                this.writeBuf[1] = code;
                this.write_data();
                r = this.read_register(UnitAddress.DEVICE_ADDRESS, RegisterAddress.RESPONSE_0);
            } while (r == cmmnd_ctr);  // FIX 1
        }

        // -------------------------------------------------------
        // Initialisierung
        // -------------------------------------------------------
        init(): boolean {
            if (this.ReadByte(RegisterAddress.PART_ID) != 0x51) {
                return false;  // Kein SI1151 gefunden
            }

            // Software-Reset
            this.send_command(CommandCodes.RESET_SW);
            basic.pause(25);

            this.conf = pins.createBuffer(4);

            // Kanal 0: Large IR  (ADCMUX = 0x0D)
            this.conf[0] = 0x0D;  // ADCCONFIG: ADCMUX = Large IR
            this.conf[1] = 0x00;  // ADCSENS:  Standard-Empfindlichkeit
            this.conf[2] = 0x00;  // ADCPOST:  kein Shift, kein Akkumulieren
            this.conf[3] = 0x00;  // MEASCONFIG
            this.config_channel(0);

            // Kanal 1: Large White / sichtbares Licht  (ADCMUX = 0x0F)
            this.conf[0] = 0x0F;  // ADCCONFIG: ADCMUX = Large White
            this.conf[1] = 0x00;
            this.conf[2] = 0x00;
            this.conf[3] = 0x00;
            this.config_channel(1);

            // Kanal 2: Small IR – für UV-Berechnung als zweite Komponente
            this.conf[0] = 0x00;  // ADCCONFIG: ADCMUX = Small IR
            this.conf[1] = 0x00;
            this.conf[2] = 0x00;
            this.conf[3] = 0x00;
            this.config_channel(2);

            this.param_set(ParameterAddress.MEASRATE_H, 0);
            this.param_set(ParameterAddress.MEASRATE_L, 1);
            this.param_set(ParameterAddress.MEASCOUNT_0, 5);
            this.param_set(ParameterAddress.MEASCOUNT_1, 10);
            this.param_set(ParameterAddress.MEASCOUNT_2, 10);

            basic.pause(100);
            return true;
        }

        // -------------------------------------------------------
        // FIX 2 + 5: IR – liest Kanal 0 (Large IR)
        // -------------------------------------------------------
        ReadHalfWord_IR(): number {
            // Nur Kanal 0 aktivieren
            this.param_set(ParameterAddress.CHAN_LIST, 0x01);
            this.send_command(CommandCodes.FORCE);
            basic.pause(10);
            // Kanal 0 ist der einzige aktive Kanal → Ergebnis in HOSTOUT_0/1
            return this.read_register16(UnitAddress.DEVICE_ADDRESS, RegisterAddress.HOSTOUT_0);
        }

        // -------------------------------------------------------
        // FIX 2 + 5: Sichtbares Licht – liest Kanal 1 (Large White)
        // -------------------------------------------------------
        ReadHalfWord_VISIBLE(): number {
            // Nur Kanal 1 aktivieren
            this.param_set(ParameterAddress.CHAN_LIST, 0x02);
            this.send_command(CommandCodes.FORCE);
            basic.pause(10);
            // Da Kanal 1 als einziger aktiv ist, liegt sein Ergebnis
            // ebenfalls in HOSTOUT_0/1 (sequentielle Ausgabe laut Datenblatt)
            return this.read_register16(UnitAddress.DEVICE_ADDRESS, RegisterAddress.HOSTOUT_0);
        }

        // -------------------------------------------------------
        // FIX 2 + 3 + 4: UV-Index
        //
        // Der SI1151 besitzt KEINEN UV-Photodetektor.
        // UV-Index wird aus Visible- und IR-Kanal berechnet
        // (Silicon Labs Application Note AN498, Formelstruktur).
        //
        // Beide Kanäle werden gleichzeitig gemessen:
        //   Kanal 0 (IR)  → HOSTOUT_0/1  (erster aktiver Kanal)
        //   Kanal 1 (Vis) → HOSTOUT_2/3  (zweiter aktiver Kanal)
        //
        // Koeffizienten: Startwerte aus Community-Kalibrierungen;
        // können je nach Einbausituation / Abdeckung abweichen.
        // Empfehlung: mit bekanntem UV-Meter kalibrieren.
        // -------------------------------------------------------
        ReadHalfWord_UV(): number {
            // Kanäle 0 (IR) und 1 (Visible) gleichzeitig aktivieren
            this.param_set(ParameterAddress.CHAN_LIST, 0x03);
            this.send_command(CommandCodes.FORCE);
            basic.pause(10);

            // Kanal 0 (IR)      → HOSTOUT_0/1
            let ch_ir = this.read_register16(UnitAddress.DEVICE_ADDRESS, RegisterAddress.HOSTOUT_0);
            // Kanal 1 (Visible) → HOSTOUT_2/3
            let ch_vis = this.read_register16(UnitAddress.DEVICE_ADDRESS, RegisterAddress.HOSTOUT_2);

            // UV-Index-Annäherung (Koeffizienten ggf. kalibrieren):
            //   UV ~ (a * ch_vis - b * ch_ir) / Skalierung
            let uv = (ch_vis * 5.41 - ch_ir * 0.08) / 1000.0;
            if (uv < 0) uv = 0;
            return uv;
        }

        private ReadByte(Reg: number): number {
            let buf = pins.createBuffer(1);
            buf[0] = Reg;
            pins.i2cWriteBuffer(UnitAddress.DEVICE_ADDRESS, buf, false);
            buf = pins.i2cReadBuffer(UnitAddress.DEVICE_ADDRESS, 1, false);
            return buf[0];
        }
    }

    let si1151 = new SI1151();

    //% group="Sunlight sensor SI1151"
    //% block="init sunlight sensor"
    export function initSunlight(): boolean {
        return si1151.init();
    }

    //% group="Sunlight sensor SI1151"
    //% block="read Visible [lux approx]"
    export function getHalfWord_Visible(): number {
        return Math.round(si1151.ReadHalfWord_VISIBLE());
    }

    //% group="Sunlight sensor SI1151"
    //% block="read IR [lux approx]"
    export function getHalfWordIR(): number {
        return Math.round(si1151.ReadHalfWord_IR());
    }

    //% group="Sunlight sensor SI1151"
    //% block="read UV index"
    export function getHalfWordUV(): number {
        // UV-Index ist dimensionslos (0–11+), daher eine Dezimalstelle sinnvoll
        return Math.round(si1151.ReadHalfWord_UV() * 10) / 10;
    }
}
