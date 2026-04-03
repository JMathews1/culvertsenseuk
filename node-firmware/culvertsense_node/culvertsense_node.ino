// CulvertSense Node Firmware
// Hardware: ELEGOO WROOM-32 + RFM95W + JSN-SR04T
// ─────────────────────────────────────────────
// TODO: set your TRIG_PIN and ECHO_PIN below

#include <lmic.h>
#include <hal/hal.h>
#include <SPI.h>

// ── LoRaWAN credentials ───────────────────────────────────────

// DevEUI — LSB first
static const u1_t PROGMEM DEVEUI[8] = { 0x9E, 0x7E, 0x9F, 0x90, 0xE0, 0xFD, 0x3A, 0x8B };
void os_getDevEui(u1_t* buf) { memcpy_P(buf, DEVEUI, 8); }

// AppEUI — all zeros, LSB first
static const u1_t PROGMEM APPEUI[8] = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
void os_getArtEui(u1_t* buf) { memcpy_P(buf, APPEUI, 8); }

// AppKey — MSB first
static const u1_t PROGMEM APPKEY[16] = {
  0x37, 0xCD, 0x60, 0xE1, 0x73, 0x94, 0xB4, 0x91,
  0x2D, 0x10, 0xC1, 0xFF, 0xA7, 0xB4, 0x76, 0xB2
};
void os_getDevKey(u1_t* buf) { memcpy_P(buf, APPKEY, 16); }

// ── Pin definitions ───────────────────────────────────────────

#define TRIG_PIN  27    // TODO: change if wired differently
#define ECHO_PIN  13    // TODO: change if wired differently
#define BATT_PIN  35    // ADC input-only pin

// ── LMIC pin map ──────────────────────────────────────────────

const lmic_pinmap lmic_pins = {
  .nss  = 5,
  .rxtx = LMIC_UNUSED_PIN,
  .rst  = 14,
  .dio  = { 26, 25, LMIC_UNUSED_PIN },  // G0→GPIO26, G1→GPIO25
};

// ── State ─────────────────────────────────────────────────────

static uint8_t payload[4];
static osjob_t sendjob;
const unsigned TX_INTERVAL = 300;  // 5 minutes

// ── JSN-SR04T ─────────────────────────────────────────────────

uint16_t readDistanceMM() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) {
    Serial.println("SENSOR: no echo");
    return 9999;
  }
  uint16_t mm = (uint16_t)((duration / 2.0) * 0.0343 * 10);
  Serial.printf("SENSOR: %u mm\n", mm);
  return mm;
}

// ── Battery voltage ───────────────────────────────────────────

uint16_t readBatteryMV() {
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) { sum += analogRead(BATT_PIN); delay(2); }
  uint16_t mv = (uint16_t)((sum / 16 / 4095.0) * 3300.0 * 2.0);
  Serial.printf("BATT: %u mV\n", mv);
  return mv;
}

// ── Payload builder ───────────────────────────────────────────
// Bytes 0-1: distance_mm uint16 big-endian
// Bytes 2-3: battery_mv  uint16 big-endian

void buildPayload() {
  uint16_t dist = readDistanceMM();
  uint16_t batt = readBatteryMV();
  payload[0] = (dist >> 8) & 0xFF;
  payload[1] =  dist       & 0xFF;
  payload[2] = (batt >> 8) & 0xFF;
  payload[3] =  batt       & 0xFF;
}

// ── LMIC event handler ────────────────────────────────────────

void onEvent(ev_t ev) {
  Serial.print(os_getTime());
  Serial.print(": ");
  switch (ev) {
    case EV_JOINING:
      Serial.println("EV_JOINING");
      break;
    case EV_JOINED:
      Serial.println("EV_JOINED");
      LMIC_setLinkCheckMode(0);
      break;
    case EV_JOIN_FAILED:
      Serial.println("EV_JOIN_FAILED");
      break;
    case EV_REJOIN_FAILED:
      Serial.println("EV_REJOIN_FAILED");
      break;
    case EV_TXSTART:
      Serial.println("EV_TXSTART");
      break;
    case EV_TXCOMPLETE:
      Serial.println("EV_TXCOMPLETE");
      if (LMIC.txrxFlags & TXRX_ACK) Serial.println("ACK received");
      os_setTimedCallback(&sendjob, os_getTime() + sec2osticks(TX_INTERVAL), do_send);
      break;
    case EV_RXCOMPLETE:
      Serial.println("EV_RXCOMPLETE");
      break;
    case EV_LINK_DEAD:
      Serial.println("EV_LINK_DEAD");
      break;
    case EV_LINK_ALIVE:
      Serial.println("EV_LINK_ALIVE");
      break;
    case EV_JOIN_TXCOMPLETE:
      Serial.println("EV_JOIN_TXCOMPLETE: no JoinAccept");
      break;
    default:
      Serial.print("Unknown event: ");
      Serial.println((unsigned)ev);
      break;
  }
}

// ── Send job ──────────────────────────────────────────────────

void do_send(osjob_t* j) {
  if (LMIC.opmode & OP_TXRXPEND) {
    Serial.println("OP_TXRXPEND, skipping");
  } else {
    buildPayload();
    LMIC_setTxData2(1, payload, sizeof(payload), 0);
    Serial.println("Packet queued");
  }
}

// ── Setup / loop ──────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  Serial.println("CulvertSense node starting");

  analogSetPinAttenuation(BATT_PIN, ADC_11db);  // allow up to ~3.3 V on ADC pin

  os_init();
  LMIC_reset();
  LMIC_setClockError(MAX_CLOCK_ERROR * 10 / 100);  // ESP32 clock drift compensation

  do_send(&sendjob);
}

void loop() {
  os_runloop_once();
}
