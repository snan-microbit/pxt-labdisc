/**
 * Extensión Labdisc para micro:bit
 * Recibe datos de sensores del Labdisc vía BLE UART desde la App Bridge
 * 
 * Formato de entrada (2 líneas por muestra):
 *   "A,274,655,2,1013,-9999,-9999,560,-9999\n"   (ambientales)
 *   "B,5,0,-9999,-9999,-3477462,-5582083,0,1615\n" (eléctricos + GPS)
 * 
 * Valores enteros multiplicados por factor. -9999 = sin dato.
 * 
 * v1.0.0 — Arquitectura polling (0x55)
 */
//% weight=50 color=#4a9eff icon="\uf0c3" block="Labdisc"
namespace labdisc {

    // ─── Estado interno ───

    const NO_DATA = -9999
    const NUM_SENSORS = 16
    const LABDISC_EVENT_ID = 9200

    // Divisores para convertir enteros a valores reales
    // Línea A (índices 0-7): TempAmb, Humedad, Luz, Presión, pH, Distancia, Sonido, TempExt
    // Línea B (índices 8-15): Voltaje, Corriente, Micrófono, ExtAnalog, GPSLat, GPSLon, GPSVel, GPSAng
    const DIVISORS = [10, 10, 1, 10, 100, 1000, 10, 10, 1000, 1000, 1000, 1000, 100000, 100000, 10, 10]

    // Valores crudos (enteros como llegan por UART)
    let rawValues: number[] = []
    for (let i = 0; i < NUM_SENSORS; i++) {
        rawValues.push(NO_DATA)
    }

    let conectado = false
    let muestrasRecibidas = 0

    // Event sub-IDs
    const EVT_DATA_A = 1      // Llegó línea A
    const EVT_DATA_B = 2      // Llegó línea B
    const EVT_DATA_COMPLETE = 3  // Llegaron A y B (muestra completa)

    // Flag para saber si la muestra actual tiene ambas partes
    let tieneA = false
    let tieneB = false

    // ─── Inicialización BLE UART ───

    bluetooth.startUartService()

    bluetooth.onBluetoothConnected(function () {
        conectado = true
    })

    bluetooth.onBluetoothDisconnected(function () {
        conectado = false
        muestrasRecibidas = 0
        tieneA = false
        tieneB = false
        for (let i = 0; i < NUM_SENSORS; i++) {
            rawValues[i] = NO_DATA
        }
    })

    // ─── Recepción de datos ───

    bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
        let line = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))
        if (line.length < 3) return

        let prefix = line.charAt(0)
        if (prefix !== "A" && prefix !== "B") return

        // Quitar el prefijo "A," o "B,"
        let csv = line.substr(2)
        let parts = csv.split(",")

        if (prefix === "A" && parts.length >= 8) {
            for (let i = 0; i < 8; i++) {
                rawValues[i] = parseInt(parts[i])
            }
            tieneA = true
            control.raiseEvent(LABDISC_EVENT_ID, EVT_DATA_A)
        }

        if (prefix === "B" && parts.length >= 8) {
            for (let i = 0; i < 8; i++) {
                rawValues[8 + i] = parseInt(parts[i])
            }
            tieneB = true
            control.raiseEvent(LABDISC_EVENT_ID, EVT_DATA_B)
        }

        // Muestra completa cuando tenemos ambas partes
        if (tieneA && tieneB) {
            muestrasRecibidas++
            tieneA = false
            tieneB = false
            control.raiseEvent(LABDISC_EVENT_ID, EVT_DATA_COMPLETE)
        }
    })

    // ─── Helper interno ───

    function sensorValue(index: number): number {
        let raw = rawValues[index]
        if (raw === NO_DATA || isNaN(raw)) return NO_DATA
        return raw / DIVISORS[index]
    }

    // ─── Bloques reportadores: Sensores ambientales (Línea A) ───

    /**
     * Temperatura ambiente en °C
     */
    //% blockId=labdisc_temp_amb
    //% block="temperatura ambiente"
    //% weight=100
    export function temperaturaAmbiente(): number {
        return sensorValue(0)
    }

    /**
     * Humedad relativa en %
     */
    //% blockId=labdisc_humedad
    //% block="humedad"
    //% weight=95
    export function humedad(): number {
        return sensorValue(1)
    }

    /**
     * Nivel de luz en lux
     */
    //% blockId=labdisc_luz
    //% block="luz"
    //% weight=90
    export function luz(): number {
        return sensorValue(2)
    }

    /**
     * Presión atmosférica en kPa
     */
    //% blockId=labdisc_presion
    //% block="presión"
    //% weight=85
    export function presion(): number {
        return sensorValue(3)
    }

    /**
     * pH (acidez/alcalinidad)
     */
    //% blockId=labdisc_ph
    //% block="pH"
    //% weight=80
    export function ph(): number {
        return sensorValue(4)
    }

    /**
     * Distancia en metros
     */
    //% blockId=labdisc_distancia
    //% block="distancia"
    //% weight=75
    export function distancia(): number {
        return sensorValue(5)
    }

    /**
     * Nivel de sonido en dB
     */
    //% blockId=labdisc_sonido
    //% block="sonido"
    //% weight=70
    export function sonido(): number {
        return sensorValue(6)
    }

    /**
     * Temperatura externa en °C (sonda)
     */
    //% blockId=labdisc_temp_ext
    //% block="temperatura externa"
    //% weight=65
    export function temperaturaExterna(): number {
        return sensorValue(7)
    }

    // ─── Bloques reportadores: Sensores eléctricos (Línea B) ───

    /**
     * Voltaje en V
     */
    //% blockId=labdisc_voltaje
    //% block="voltaje"
    //% weight=60
    export function voltaje(): number {
        return sensorValue(8)
    }

    /**
     * Corriente en A
     */
    //% blockId=labdisc_corriente
    //% block="corriente"
    //% weight=55
    export function corriente(): number {
        return sensorValue(9)
    }

    /**
     * Micrófono en V
     */
    //% blockId=labdisc_microfono
    //% block="micrófono"
    //% weight=50
    export function microfono(): number {
        return sensorValue(10)
    }

    /**
     * Entrada analógica externa en V
     */
    //% blockId=labdisc_ext_analog
    //% block="entrada analógica"
    //% weight=45
    export function entradaAnalogica(): number {
        return sensorValue(11)
    }

    // ─── Bloques reportadores: GPS (Línea B) ───

    /**
     * GPS Latitud en grados decimales
     */
    //% blockId=labdisc_gps_lat
    //% block="GPS latitud"
    //% weight=40
    export function gpsLatitud(): number {
        return sensorValue(12)
    }

    /**
     * GPS Longitud en grados decimales
     */
    //% blockId=labdisc_gps_lon
    //% block="GPS longitud"
    //% weight=35
    export function gpsLongitud(): number {
        return sensorValue(13)
    }

    /**
     * GPS Velocidad en km/h
     */
    //% blockId=labdisc_gps_vel
    //% block="GPS velocidad"
    //% weight=30
    export function gpsVelocidad(): number {
        return sensorValue(14)
    }

    /**
     * GPS Ángulo/rumbo en grados
     */
    //% blockId=labdisc_gps_ang
    //% block="GPS ángulo"
    //% weight=25
    export function gpsAngulo(): number {
        return sensorValue(15)
    }

    // ─── Bloques de estado ───

    /**
     * Número de muestras completas recibidas
     */
    //% blockId=labdisc_muestras
    //% block="muestras recibidas"
    //% weight=20
    export function muestrasCompletas(): number {
        return muestrasRecibidas
    }

    /**
     * Verifica si hay conexión Bluetooth activa
     */
    //% blockId=labdisc_conectado
    //% block="está conectado"
    //% weight=15
    export function estaConectado(): boolean {
        return conectado
    }

    /**
     * Verifica si un sensor tiene dato válido
     * (no es -9999)
     */
    //% blockId=labdisc_tiene_dato
    //% block="tiene dato %sensor"
    //% sensor.defl="temperatura ambiente"
    //% weight=14
    export function tieneDato(valor: number): boolean {
        return valor !== NO_DATA
    }

    // ─── Bloques de eventos ───

    /**
     * Se ejecuta cuando llegan datos nuevos del Labdisc
     * (muestra completa: líneas A y B recibidas)
     */
    //% blockId=labdisc_on_data
    //% block="al recibir datos del Labdisc"
    //% weight=10
    export function alRecibirDatos(handler: () => void) {
        control.onEvent(LABDISC_EVENT_ID, EVT_DATA_COMPLETE, handler)
    }

    /**
     * Se ejecuta al conectar con la App Bridge
     */
    //% blockId=labdisc_on_connected
    //% block="al conectar con Labdisc"
    //% weight=8
    export function alConectar(handler: () => void) {
        bluetooth.onBluetoothConnected(function () {
            conectado = true
            handler()
        })
    }

    /**
     * Se ejecuta al desconectar de la App Bridge
     */
    //% blockId=labdisc_on_disconnected
    //% block="al desconectar del Labdisc"
    //% weight=6
    export function alDesconectar(handler: () => void) {
        bluetooth.onBluetoothDisconnected(function () {
            conectado = false
            muestrasRecibidas = 0
            for (let i = 0; i < NUM_SENSORS; i++) {
                rawValues[i] = NO_DATA
            }
            handler()
        })
    }

    /**
     * Muestra el nombre Bluetooth del micro:bit en la matriz LED
     * Útil para identificar dispositivos en un salón de clases
     */
    //% blockId=labdisc_show_name
    //% block="mostrar nombre Bluetooth"
    //% weight=4
    export function mostrarNombreBluetooth() {
        basic.showString(control.deviceName())
    }
}