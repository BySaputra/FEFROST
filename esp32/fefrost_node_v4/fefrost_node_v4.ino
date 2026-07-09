// =====================================================
//  FEFROST LIGHTWEIGHT EDGE NODE  —  v5.0 (With Product Alerts)
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
#include <Preferences.h>

// =====================================================
//  SECRETS
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
const unsigned long SENSOR_INTERVAL      = 2000;    
const unsigned long UPLOAD_INTERVAL      = 600000;  // 10 menit
const unsigned long FETCH_INTERVAL       = 60000;   // 1 menit (Cek status produk)
const unsigned long OLED_INTERVAL        = 1000;    

// Durasi per layar (ms)
const unsigned long DUR_LIVE             = 8000;
const unsigned long DUR_STATUS           = 2000;
const unsigned long DUR_TELEMETRY        = 2000;
const unsigned long DUR_PRODUCTS         = 4000; // Durasi layar produk

// Ambang perubahan suhu drastis
const float         TEMP_THRESHOLD       = 5.0;     

// Interval buzzer alert
const unsigned long BUZZER_ERR_INTERVAL  = 3000;    // ms — error sensor
const unsigned long BUZZER_WARN_INTERVAL = 1500;    // ms — produk warning
const unsigned long BUZZER_DANG_INTERVAL = 1000;    // ms — produk danger

const unsigned long WIFI_TIMEOUT         = 10000;   

// =====================================================
//  HARDWARE OBJECTS
// =====================================================
DHT               dht(DHTPIN, DHTTYPE);
OneWire           oneWire(ONE_WIRE_BUS);
DallasTemperature ds18b20(&oneWire);
LiquidCrystal_I2C lcd(LCD_ADDR, LCD_COLS, LCD_ROWS);
RTC_DS3231        rtc;

// =====================================================
//  CALIBRATION & PREFERENCES
// =====================================================
Preferences preferences;
float offsetRT = 0.0; 
float offsetHM = 0.0; 
float offsetST = 0.0; 

// =====================================================
//  DEVICE TIME (RTC DS3231)
// =====================================================
bool rtcAvailable     = false;
bool rtcLostPowerFlag = false;

int rtcYear = 0, rtcMonth = 0, rtcDay = 0;
int rtcHour = 0, rtcMinute = 0, rtcSecond = 0;

String currentDate     = "";
String currentTime     = "";
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
//  DATA SENSOR & PRODUK
// =====================================================
float roomTemp        = 0;
float humidity        = 0;
float storageTemp     = 0;
float lastStorageTemp = 0;

int safeProducts      = 0;
int warningProducts   = 0;
int dangerProducts    = 0;

// =====================================================
//  SYSTEM FLAGS
// =====================================================
bool firstRead     = true;
bool sensorValid   = false;
bool uploadSuccess = false;

// =====================================================
//  TIMERS & TRACKERS
// =====================================================
unsigned long sensorMillis  = 0;
unsigned long uploadMillis  = 0;
unsigned long fetchMillis   = 0;
unsigned long oledMillis    = 0;
unsigned long screenMillis  = 0;
unsigned long buzzerMillis  = 0;

unsigned long lastUploadAt  = 0;
String lastUploadTimeStr    = ""; 

// =====================================================
//  FUNCTION DECLARATIONS
// =====================================================
uint8_t currentScreen = 0; // 0=Live, 1=Status, 2=Telemetry, 3=Products
void connectWiFi();
void reconnectWiFi();
void readSensors();
void fetchProductData();
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

  // --- Memuat Data Kalibrasi Tersimpan ---
  preferences.begin("fefrost", false);
  offsetRT = preferences.getFloat("offRT", 0.0);
  offsetHM = preferences.getFloat("offHM", 0.0);
  offsetST = preferences.getFloat("offST", 0.0);

  // --- Buzzer ---
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // --- LCD I2C ---
  Wire.begin(21, 22);
  Wire.beginTransmission(LCD_ADDR);

  if (Wire.endTransmission() != 0) {
    Serial.println(F("LCD FAILED"));
    for (uint8_t i = 0; i < 3; i++) {
      tone(BUZZER_PIN, 800, 300);
      delay(500);
    }
    while (true) { /* halt */ }
  }

  lcd.init();
  lcd.backlight();
  showBootScreen();

  // --- Initializations ---
  initRTC();
  dht.begin();
  ds18b20.begin();
  connectWiFi();

  // --- Firebase ---
  config.api_key               = API_KEY;
  config.database_url          = DATABASE_URL;
  auth.user.email              = USER_EMAIL;
  auth.user.password           = USER_PASSWORD;
  config.token_status_callback = tokenStatusCallback;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

// ─────────────────────────────────────────────────────
//  MAIN LOOP
// ─────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  // --- FITUR SERIAL COMMAND ---
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    if (input.startsWith("SET_RTC")) {
      int yr, mth, day, hr, min, sec;
      int parsed = sscanf(input.c_str(), "SET_RTC %d-%d-%d %d:%d:%d", &yr, &mth, &day, &hr, &min, &sec);
      if (parsed == 6 && rtcAvailable) {
        rtc.adjust(DateTime(yr, mth, day, hr, min, sec));
        Serial.println(F("\n>>> WAKTU RTC BERHASIL DIUPDATE! <<<\n"));
        tone(BUZZER_PIN, 2000, 200); 
      }
    } 
    else if (input.startsWith("CAL_")) {
      char type[5];
      float val;
      int parsed = sscanf(input.c_str(), "CAL_%2s %f", type, &val);
      if (parsed == 2) {
        String t = String(type);
        if (t == "ST") { offsetST = val; preferences.putFloat("offST", val); }
        else if (t == "RT") { offsetRT = val; preferences.putFloat("offRT", val); }
        else if (t == "HM") { offsetHM = val; preferences.putFloat("offHM", val); }
        tone(BUZZER_PIN, 2000, 100); delay(150); tone(BUZZER_PIN, 2500, 150);
      }
    }
  }

  // --- Core Routines ---
  reconnectWiFi();
  updateRTC();

  if (!Firebase.ready()) return;

  // Baca Sensor
  if (now - sensorMillis >= SENSOR_INTERVAL) {
    sensorMillis = now;
    readSensors();
  }

  // Ambil data produk dari Firebase setiap 1 menit
  if (now - fetchMillis >= FETCH_INTERVAL) {
    fetchMillis = now;
    fetchProductData();
  }

  // Refresh Layar
  if (now - oledMillis >= OLED_INTERVAL) {
    oledMillis = now;
    updateOLED();
  }

  nextScreen();
  checkAlert();

  // --- Upload Gate ---
  if (!sensorValid) return;

  bool periodic = (now - uploadMillis >= UPLOAD_INTERVAL);
  bool drastic  = drasticChangeDetected();

  if (periodic || drastic) {
    uploadMillis    = now;
    lastStorageTemp = storageTemp;
    uploadData();
  }
}

// ─────────────────────────────────────────────────────
//  WIFI
// ─────────────────────────────────────────────────────
void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

void reconnectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT) {
    delay(500);
  }
}

// ─────────────────────────────────────────────────────
//  FETCH PRODUCT DATA (FIREBASE READ)
// ─────────────────────────────────────────────────────
void fetchProductData() {
  Serial.println(F("\nFetching Product Data..."));
  
  if (Firebase.RTDB.getInt(&fbdo, "/fefrost/product_summary/safe_products")) {
    safeProducts = fbdo.intData();
  }
  if (Firebase.RTDB.getInt(&fbdo, "/fefrost/product_summary/warning_products")) {
    warningProducts = fbdo.intData();
  }
  if (Firebase.RTDB.getInt(&fbdo, "/fefrost/product_summary/danger_products")) {
    dangerProducts = fbdo.intData();
  }
  
  Serial.printf("Safe: %d | Warn: %d | Danger: %d\n", safeProducts, warningProducts, dangerProducts);
}

// ─────────────────────────────────────────────────────
//  SENSOR READ & UPLOAD
// ─────────────────────────────────────────────────────
void readSensors() {
  float tTemp = dht.readTemperature();
  float tHum  = dht.readHumidity();
  ds18b20.requestTemperatures();
  float tStorage = ds18b20.getTempCByIndex(0);

  if (isnan(tTemp) || isnan(tHum) || tStorage == DEVICE_DISCONNECTED_C) {
    sensorValid = false;
    return;
  }
  
  roomTemp    = tTemp + offsetRT;
  humidity    = tHum + offsetHM;
  storageTemp = tStorage + offsetST;
  sensorValid = true;

  if (firstRead) {
    lastStorageTemp = storageTemp;
    firstRead = false;
  }
}

bool drasticChangeDetected() {
  float diff = abs(storageTemp - lastStorageTemp);
  return (diff >= TEMP_THRESHOLD);
}

void uploadData() {
  FirebaseJson json;
  json.set("room_temp",    roomTemp);
  json.set("humidity",     humidity);
  json.set("storage_temp", storageTemp);
  json.set("rtc_timestamp", currentDateTime); 
  json.set("timestamp/.sv", "timestamp");

  bool live    = Firebase.RTDB.setJSON(&fbdo,  "/fefrost/live",    &json);
  bool history = Firebase.RTDB.pushJSON(&fbdo, "/fefrost/history", &json);

  uploadSuccess = live && history;

  if (uploadSuccess) {
    lastUploadAt = millis();
    lastUploadTimeStr = currentTime;
  }
}

// ─────────────────────────────────────────────────────
//  RTC (DS3231)
// ─────────────────────────────────────────────────────
void initRTC() {
  if (!rtc.begin()) {
    rtcAvailable = false;
    return;
  }
  rtcAvailable = true;
  rtcLostPowerFlag = rtc.lostPower();
}

void updateRTC() {
  if (!rtcAvailable) return;
  DateTime now = rtc.now();
  
  rtcYear   = now.year();
  rtcMonth  = now.month();
  rtcDay    = now.day();
  rtcHour   = now.hour();
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
//  UI & SCREENS
// ─────────────────────────────────────────────────────
void showBootScreen() {
  lcd.clear();
  lcd.setCursor(3, 0);
  lcd.print("FEFROST");
  lcd.setCursor(1, 1);
  lcd.print("Initializing...");
  delay(1500);
}

void nextScreen() {
  // Tambah durasi DUR_PRODUCTS ke dalam array rotasi layar
  const unsigned long durations[] = { DUR_LIVE, DUR_STATUS, DUR_TELEMETRY, DUR_PRODUCTS };
  if (millis() - screenMillis >= durations[currentScreen]) {
    screenMillis = millis();
    currentScreen = (currentScreen + 1) % 4; // Berubah dari % 3 menjadi % 4
  }
}

void updateOLED() {
  lcd.clear();

  if (!sensorValid) {
    lcd.setCursor(0, 0); lcd.print("SENSOR ERROR");
    lcd.setCursor(0, 1); lcd.print("CHECK SENSORS");
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    lcd.setCursor(0, 0); lcd.print("WIFI LOST");
    lcd.setCursor(0, 1); lcd.print("RECONNECT...");
    return;
  }

  // --- Screen 0 : Live Monitoring ---
  if (currentScreen == 0) {
    String w = (WiFi.status() == WL_CONNECTED) ? "ON" : "OFF";
    String line1 = "ST:" + String(storageTemp, 1) + " RT:" + String(roomTemp, 1);
    lcd.setCursor(0, 0); lcd.print(line1);
    
    String line2 = "HM:" + String((int)humidity) + "% W:" + w;
    lcd.setCursor(0, 1); lcd.print(line2);
  }
  
  // --- Screen 1 : Products Status ---
  else if (currentScreen == 1) {
    if (warningProducts == 0 && dangerProducts == 0) {
      // Kondisi Aman
      lcd.setCursor(0, 0);
      lcd.print("SAFE PROD: " + String(safeProducts));
      lcd.setCursor(0, 1);
      lcd.print("ALL CLEAR");
    } else {
      // Kondisi Warning / Danger
      lcd.setCursor(0, 0);
      lcd.print("S:" + String(safeProducts) + " W:" + String(warningProducts));
      lcd.setCursor(0, 1);
      lcd.print("DANGER: " + String(dangerProducts));
    }
  }
  
  // --- Screen 2 : System Status ---
  else if (currentScreen == 2) {
    String w = (WiFi.status() == WL_CONNECTED) ? "OK" : "FAIL";
    String f = Firebase.ready() ? "RDY" : "FAIL";
    lcd.setCursor(0, 0);
    lcd.print("WIFI:" + w + " FB:" + f);
    
    String ip = WiFi.localIP().toString();
    if (ip.length() > 13) ip = ip.substring(0, 13);
    lcd.setCursor(0, 1); lcd.print("IP:" + ip);
  }
  
  // --- Screen 3 : Telemetry ---
  else {
    lcd.setCursor(0, 0);
    lcd.print(String("UPLOAD:") + (uploadSuccess ? "OK" : "FAIL"));
    lcd.setCursor(0, 1);
    if (lastUploadAt == 0) lcd.print("WAITING...");
    else lcd.print("AT " + lastUploadTimeStr);
  }
}

// ─────────────────────────────────────────────────────
//  ALERT (Buzzer dengan debounce)
// ─────────────────────────────────────────────────────
void checkAlert() {
  unsigned long now = millis();
  
  if (!sensorValid) {
    if (now - buzzerMillis >= BUZZER_ERR_INTERVAL) {
      buzzerMillis = now;
      tone(BUZZER_PIN, 1000, 200);
    }
    return;
  }

  // Logika baru: Peringatan berdasarkan status Produk
  if (dangerProducts > 0) {
    // Beep cepat jika ada danger
    if (now - buzzerMillis >= BUZZER_DANG_INTERVAL) {
      buzzerMillis = now;
      tone(BUZZER_PIN, 2000, 400);
    }
    return;
  } 
  else if (warningProducts > 0) {
    // Beep lambat jika ada warning tapi tidak ada danger
    if (now - buzzerMillis >= BUZZER_WARN_INTERVAL) {
      buzzerMillis = now;
      tone(BUZZER_PIN, 1500, 200);
    }
    return;
  }

  // Matikan buzzer jika aman
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}