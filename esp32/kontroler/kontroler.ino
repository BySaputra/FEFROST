// =====================================================
//  FEFROST LIGHTWEIGHT EDGE NODE  —  v4
//  ESP32 Dev Module
//  Sensors  : DHT22 (GPIO4) · DS18B20 (GPIO5)
//  Output   :  · Buzzer (GPIO18)
//  Cloud    : Firebase RTDB (asia-southeast1)
// =====================================================

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

#include <DHT.h>
#include <OneWire.h>
#include <DallasTemperature.h>

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <RTClib.h>

// =====================================================
//  SECRETS  —  pindahkan ke secrets.h sebelum push ke repo
// =====================================================

#define WIFI_SSID        "1123"
#define WIFI_PASSWORD    "12334567"
#define API_KEY          "AIzaSyAYTsELv4EbZYt1JqJH8WBi05NjmLRXvYw"
#define DATABASE_URL     "https://fefrost-system-default-rtdb.asia-southeast1.firebasedatabase.app/"
#define USER_EMAIL       "node1@fefrost.com"
#define USER_PASSWORD    "12345678"

// =====================================================
//  PIN CONFIG
// =====================================================

#define DHTPIN           4
#define DHTTYPE          DHT22
#define ONE_WIRE_BUS     5
#define BUZZER_PIN       18

// =====================================================
//  LCD I2C CONFIG
// =====================================================

#define LCD_ADDR         0x27
#define LCD_COLS         16
#define LCD_ROWS         2

// =====================================================
//  TUNABLE CONSTANTS
// =====================================================

const unsigned long SENSOR_INTERVAL    = 2000;    // ms — baca sensor
const unsigned long UPLOAD_INTERVAL    = 300000;  // ms — 5 menit
const unsigned long OLED_INTERVAL      = 1000;    // ms — refresh OLED

// Durasi per layar (ms)
const unsigned long DUR_LIVE           = 10000;
const unsigned long DUR_STATUS         = 2000;
const unsigned long DUR_TELEMETRY      = 2000;

// Ambang perubahan suhu drastis
const float         TEMP_THRESHOLD     = 5.0;     // °C

// Ambang darurat suhu storage
const float         EMERGENCY_LIMIT    = 10.0;    // °C

// Interval buzzer alert (agar tidak bunyi terus-menerus)
const unsigned long BUZZER_ERR_INTERVAL  = 3000;  // ms — error sensor
const unsigned long BUZZER_WARN_INTERVAL = 2000;  // ms — suhu darurat

// Timeout reconnect WiFi
const unsigned long WIFI_TIMEOUT       = 10000;   // ms

// =====================================================
//  HARDWARE OBJECTS
// =====================================================

DHT               dht(DHTPIN, DHTTYPE);
OneWire           oneWire(ONE_WIRE_BUS);
DallasTemperature ds18b20(&oneWire);
LiquidCrystal_I2C  lcd(LCD_ADDR, LCD_COLS, LCD_ROWS);
RTC_DS3231 rtc;

// =====================================================
//  DEVICE TIME (RTC DS3231)
// =====================================================

bool rtcAvailable = false;
bool rtcLostPowerFlag = false;

int rtcYear = 0;
int rtcMonth = 0;
int rtcDay = 0;
int rtcHour = 0;
int rtcMinute = 0;
int rtcSecond = 0;

String currentDate = "";
String currentTime = "";
String currentDateTime = "";

void initRTC();
void updateRTC();

// =====================================================
//  FIREBASE OBJECTS
// =====================================================

FirebaseData   fbdo;
FirebaseAuth   auth;
FirebaseConfig config;

// =====================================================
//  SENSOR DATA
// =====================================================

float roomTemp    = 0;
float humidity    = 0;
float storageTemp = 0;

float lastStorageTemp = 0;

// =====================================================
//  SYSTEM FLAGS
// =====================================================

bool firstRead     = true;
bool sensorValid   = false;
bool uploadSuccess = false;

// =====================================================
//  TIMERS
// =====================================================

unsigned long sensorMillis  = 0;
unsigned long uploadMillis  = 0;
unsigned long oledMillis    = 0;
unsigned long screenMillis  = 0;
unsigned long buzzerMillis  = 0;
unsigned long lastUploadAt  = 0;   // untuk "X detik lalu" di layar telemetry

// =====================================================
//  SCREEN STATE
// =====================================================

uint8_t currentScreen = 0;  // 0=Live  1=Status  2=Telemetry

// =====================================================
//  FUNCTION DECLARATIONS
// =====================================================

void connectWiFi();
void reconnectWiFi();
void readSensors();
bool drasticChangeDetected();
void uploadData();
void updateOLED();
void nextScreen();
void showBootScreen();
void checkAlert();

// ─────────────────────────────────────────────────────
//  SETUP
// ─────────────────────────────────────────────────────

void setup() {

  Serial.begin(115200);
  Serial.println(F("\n================================="));
  Serial.println(F("  FEFROST LIGHTWEIGHT EDGE NODE  "));
  Serial.println(F("================================="));

  // --- Buzzer ---
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // --- LCD I2C ---
  // Initialize I2C on the pins used (SDA=21, SCL=22)
  Wire.begin(21, 22);
  Wire.beginTransmission(LCD_ADDR);
  if (Wire.endTransmission() != 0) {
    Serial.println(F("LCD FAILED — check wiring or address"));
    for (uint8_t i = 0; i < 3; i++) {
      tone(BUZZER_PIN, 800, 300);
      delay(500);
    }
    while (true) { /* halt */ }
  }

  lcd.init();
  lcd.backlight();
  showBootScreen();
  // --- RTC ---
  initRTC();

  // --- Sensors ---
  dht.begin();
  ds18b20.begin();

  // --- WiFi ---
  connectWiFi();

  // --- Firebase ---
  config.api_key            = API_KEY;
  config.database_url       = DATABASE_URL;
  auth.user.email           = USER_EMAIL;
  auth.user.password        = USER_PASSWORD;
  config.token_status_callback = tokenStatusCallback;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.println(F("Firebase Initialized"));
}

// ─────────────────────────────────────────────────────
//  MAIN LOOP
// ─────────────────────────────────────────────────────

void loop() {

  unsigned long now = millis();

  // --- WiFi watchdog ---
  reconnectWiFi();

  // --- RTC update (refresh device time variables every loop) ---
  updateRTC();

  // --- Firebase ready check ---
  if (!Firebase.ready()) return;

  // --- Sensor read (every 2s) ---
  if (now - sensorMillis >= SENSOR_INTERVAL) {
    sensorMillis = now;
    readSensors();
  }

  // --- OLED refresh (every 1s) ---
  if (now - oledMillis >= OLED_INTERVAL) {
    oledMillis = now;
    updateOLED();
  }

  // --- Screen rotation ---
  nextScreen();

  // --- Alert ---
  checkAlert();

  // --- Upload gate ---
  if (!sensorValid) return;

  bool periodic = (now - uploadMillis >= UPLOAD_INTERVAL);
  bool drastic  = drasticChangeDetected();

  if (periodic || drastic) {
    uploadMillis  = now;
    lastStorageTemp = storageTemp;
    uploadData();
  }
}

// ─────────────────────────────────────────────────────
//  WIFI
// ─────────────────────────────────────────────────────

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print(F("Connecting WiFi"));
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print('.');
    delay(500);
  }
  Serial.println();
  Serial.print(F("WiFi Connected — IP: "));
  Serial.println(WiFi.localIP());
}

void reconnectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println(F("\nWiFi lost — reconnecting..."));
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED
         && millis() - start < WIFI_TIMEOUT) {
    Serial.print('.');
    delay(500);
  }
  Serial.println();
  Serial.println(WiFi.status() == WL_CONNECTED
    ? F("WiFi Reconnected")
    : F("Reconnect Failed — will retry"));
}

// ─────────────────────────────────────────────────────
//  SENSOR READ
// ─────────────────────────────────────────────────────

void readSensors() {

  float tTemp = dht.readTemperature();
  float tHum  = dht.readHumidity();

  ds18b20.requestTemperatures();
  float tStorage = ds18b20.getTempCByIndex(0);

  // Validation
  if (isnan(tTemp) || isnan(tHum)) {
    Serial.println(F("DHT22 ERROR"));
    sensorValid = false;
    return;
  }
  if (tStorage == DEVICE_DISCONNECTED_C) {
    Serial.println(F("DS18B20 ERROR"));
    sensorValid = false;
    return;
  }

  // Commit valid data
  roomTemp    = tTemp;
  humidity    = tHum;
  storageTemp = tStorage;
  sensorValid = true;

  // First-read fix — cegah false drastic-change saat boot
  if (firstRead) {
    lastStorageTemp = storageTemp;
    firstRead = false;
  }

  Serial.println(F("\n===== SENSOR DATA ====="));
  Serial.printf("Room Temp    : %.1f °C\n", roomTemp);
  Serial.printf("Humidity     : %.1f %%\n", humidity);
  Serial.printf("Storage Temp : %.1f °C\n", storageTemp);
  // Show device RTC time (if available)
  if (rtcAvailable) {
    Serial.print(F("RTC Time : "));
    Serial.println(currentDateTime);
  } else {
    Serial.println(F("RTC Time : N/A"));
  }
}

// ─────────────────────────────────────────────────────
//  DRASTIC CHANGE DETECTION
// ─────────────────────────────────────────────────────

bool drasticChangeDetected() {
  float diff = abs(storageTemp - lastStorageTemp);
  if (diff >= TEMP_THRESHOLD) {
    Serial.printf("\nDRASTIC CHANGE: %.1f °C\n", diff);
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────
//  FIREBASE UPLOAD
// ─────────────────────────────────────────────────────

void uploadData() {
  Serial.println(F("\nUploading..."));

  FirebaseJson json;
  json.set("room_temp",    roomTemp);
  json.set("humidity",     humidity);
  json.set("storage_temp", storageTemp);
  json.set("timestamp/.sv", "timestamp");

  bool live    = Firebase.RTDB.setJSON(&fbdo,  "/fefrost/live",    &json);
  bool history = Firebase.RTDB.pushJSON(&fbdo, "/fefrost/history", &json);

  uploadSuccess = live && history;

  if (uploadSuccess) {
    lastUploadAt = millis();
    Serial.println(F("UPLOAD SUCCESS ✓"));
  } else {
    Serial.print(F("UPLOAD FAILED ✗ — "));
    Serial.println(fbdo.errorReason());
  }
}

//  RTC (DS3231) initialization and update
// ─────────────────────────────────────────────────────

void initRTC() {
  // rtc uses same I2C bus as LCD (Wire already begun in setup)
  if (!rtc.begin()) {
    rtcAvailable = false;
    Serial.println(F("RTC NOT FOUND on I2C"));
    // show error on LCD and beep buzzer 3x but do NOT halt system
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("RTC ERROR");
    for (uint8_t i = 0; i < 3; i++) {
      tone(BUZZER_PIN, 1000, 200);
      delay(400);
    }
    return;
  }

  rtcAvailable = true;
  Serial.println(F("RTC DS3231 found"));

  if (rtc.lostPower()) {
    rtcLostPowerFlag = true;
    Serial.println(F("RTC lost power — time may be invalid"));
    // NOTE: place to implement time sync (e.g., NTP or Firebase time)
    // future: perform automatic device_time synchronization here
  } else {
    rtcLostPowerFlag = false;
  }
}

void updateRTC() {
  if (!rtcAvailable) return;
  DateTime now = rtc.now();
  rtcYear = now.year();
  rtcMonth = now.month();
  rtcDay = now.day();
  rtcHour = now.hour();
  rtcMinute = now.minute();
  rtcSecond = now.second();

  char buf[32];
  snprintf(buf, sizeof(buf), "%04d-%02d-%02d", rtcYear, rtcMonth, rtcDay);
  currentDate = String(buf);
  snprintf(buf, sizeof(buf), "%02d:%02d:%02d", rtcHour, rtcMinute, rtcSecond);
  currentTime = String(buf);
  currentDateTime = currentDate + " " + currentTime;
}

// ─────────────────────────────────────────────────────
//  BOOT SCREEN
// ─────────────────────────────────────────────────────

void showBootScreen() {
  lcd.clear();
  lcd.setCursor(3, 0);
  lcd.print("FEFROST");
  lcd.setCursor(1, 1);
  lcd.print("Initializing...");
  delay(1500);
}

// ─────────────────────────────────────────────────────
//  SCREEN ROTATION
// ─────────────────────────────────────────────────────

void nextScreen() {
  const unsigned long durations[] = {
    DUR_LIVE, DUR_STATUS, DUR_TELEMETRY
  };
  if (millis() - screenMillis >= durations[currentScreen]) {
    screenMillis = millis();
    currentScreen = (currentScreen + 1) % 3;
  }
}

// ─────────────────────────────────────────────────────
//  OLED UPDATE
// ─────────────────────────────────────────────────────

void updateOLED() {
  lcd.clear();

  // --- Priority: sensor error ---
  if (!sensorValid) {
    lcd.setCursor(0, 0);
    lcd.print("SENSOR ERROR");
    lcd.setCursor(0, 1);
    lcd.print("CHECK SENSORS");
    return;
  }

  // --- Priority: WiFi lost ---
  if (WiFi.status() != WL_CONNECTED) {
    lcd.setCursor(0, 0);
    lcd.print("WIFI LOST");
    lcd.setCursor(0, 1);
    lcd.print("RECONNECT...");
    return;
  }

  // ---- Screen 0 : Live Monitoring ----
  if (currentScreen == 0) {
    String line1 = "ST:" + String(storageTemp, 1) + " RT:" + String(roomTemp, 0);
    if (line1.length() > LCD_COLS) line1 = line1.substring(0, LCD_COLS);
    lcd.setCursor(0, 0);
    lcd.print(line1);

    String t = rtcAvailable && currentTime.length() >= 5 ? currentTime.substring(0,5) : "--:--";
    String line2 = "HM:" + String((int)humidity) + "% T:" + t;
    if (line2.length() > LCD_COLS) line2 = line2.substring(0, LCD_COLS);
    lcd.setCursor(0, 1);
    lcd.print(line2);
  }

  // ---- Screen 1 : System Status ----
  else if (currentScreen == 1) {
    String w = (WiFi.status() == WL_CONNECTED) ? "OK" : "FAIL";
    String f = Firebase.ready() ? "RDY" : "FAIL";
    String line1 = "WIFI:" + w + " FB:" + f;
    if (line1.length() > LCD_COLS) line1 = line1.substring(0, LCD_COLS);
    lcd.setCursor(0, 0);
    lcd.print(line1);

    String ip = WiFi.localIP().toString();
    if (ip.length() > LCD_COLS - 3) ip = ip.substring(0, LCD_COLS - 3);
    lcd.setCursor(0, 1);
    lcd.print("IP:" + ip);
  }

  // ---- Screen 2 : Telemetry ----
  else {
    lcd.setCursor(0, 0);
    lcd.print(String("UPLOAD:") + (uploadSuccess ? "OK" : "FAIL"));

    if (lastUploadAt == 0) {
      lcd.setCursor(0, 1);
      lcd.print("EVT MODE");
    } else {
      unsigned long sec = (millis() - lastUploadAt) / 1000;
      String s = String(sec) + "s ago";
      if (s.length() > LCD_COLS) s = s.substring(0, LCD_COLS);
      lcd.setCursor(0, 1);
      lcd.print(s);
    }
  }
}

// ─────────────────────────────────────────────────────
//  ALERT (buzzer dengan debounce)
// ─────────────────────────────────────────────────────

void checkAlert() {
  unsigned long now = millis();

  // Sensor error — beep pendek tiap 3 detik
  if (!sensorValid) {
    if (now - buzzerMillis >= BUZZER_ERR_INTERVAL) {
      buzzerMillis = now;
      tone(BUZZER_PIN, 1000, 200);
    }
    return;
  }

  // Suhu darurat — beep tiap 2 detik
  if (storageTemp > EMERGENCY_LIMIT) {
    if (now - buzzerMillis >= BUZZER_WARN_INTERVAL) {
      buzzerMillis = now;
      tone(BUZZER_PIN, 1500, 300);
    }
    return;
  }

  // Kondisi normal — pastikan buzzer mati
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}
