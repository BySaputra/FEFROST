/*
====================================================
FEFROST Hardware Test
ESP32
- LCD 16x2 I2C
- RTC DS1307
- DHT22
- DS18B20
- Buzzer
====================================================
*/

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <RTClib.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>

//==================== LCD ====================
#define LCD_ADDR         0x27
#define LCD_COLS         16
#define LCD_ROWS         2

LiquidCrystal_I2C lcd(LCD_ADDR, LCD_COLS, LCD_ROWS);

//==================== DHT22 ==================
#define DHTPIN           4
#define DHTTYPE          DHT22
DHT dht(DHTPIN, DHTTYPE);

//==================== DS18B20 ================
#define ONE_WIRE_BUS     5
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature ds18b20(&oneWire);

//==================== RTC ====================
RTC_DS1307 rtc;

//==================== BUZZER =================
#define BUZZER_PIN       18

//==================== STATUS =================
bool rtcOK = false;
bool dhtOK = false;
bool dsOK = false;

//================================================

void beep(uint16_t t)
{
  digitalWrite(BUZZER_PIN, HIGH);
  delay(t);
  digitalWrite(BUZZER_PIN, LOW);
}

void lcdMessage(String a, String b)
{
  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print(a);

  lcd.setCursor(0,1);
  lcd.print(b);
}

//================================================

void setup()
{
  Serial.begin(115200);

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  Wire.begin();

  lcd.init();
  lcd.backlight();

  lcdMessage("FEFROST","Hardware Test");
  delay(1500);

  //---------------- RTC ----------------
  rtcOK = rtc.begin();

  if(rtcOK)
  {
    if(!rtc.isrunning())
    {
      rtc.adjust(DateTime(F(__DATE__),F(__TIME__)));
    }
  }

  //---------------- DHT ----------------
  dht.begin();

  float h = dht.readHumidity();
  float t = dht.readTemperature();

  if(!isnan(h) && !isnan(t))
      dhtOK = true;

  //---------------- DS18B20 ----------------
  ds18b20.begin();

  if(ds18b20.getDeviceCount()>0)
      dsOK = true;

  //================ LCD =================
  lcdMessage("LCD","OK");
  Serial.println("LCD      : OK");
  delay(1200);

  //================ RTC =================
  if(rtcOK)
  {
    lcdMessage("RTC DS1307","OK");
    Serial.println("RTC      : OK");
  }
  else
  {
    lcdMessage("RTC DS1307","ERROR");
    Serial.println("RTC      : ERROR");
  }
  delay(1200);

  //================ DHT =================
  if(dhtOK)
  {
    lcdMessage("DHT22","OK");
    Serial.println("DHT22    : OK");
  }
  else
  {
    lcdMessage("DHT22","ERROR");
    Serial.println("DHT22    : ERROR");
  }
  delay(1200);

  //================ DS18B20 ================
  if(dsOK)
  {
    lcdMessage("DS18B20","OK");
    Serial.println("DS18B20  : OK");
  }
  else
  {
    lcdMessage("DS18B20","ERROR");
    Serial.println("DS18B20  : ERROR");
  }
  delay(1200);

  //================ BUZZER =================
  lcdMessage("Buzzer","Testing");
  beep(300);
  delay(200);
  beep(300);

  //================ HASIL =================
  if(rtcOK && dhtOK && dsOK)
  {
    lcdMessage("ALL SYSTEM","READY");

    Serial.println();
    Serial.println("===== ALL SYSTEM READY =====");
    Serial.println("Ketik SET_RTC YYYY-MM-DD hh:mm:ss untuk set waktu RTC");
    Serial.println("Contoh: SET_RTC 2026-07-08 13:14:00");

    beep(800);
  }
  else
  {
    lcdMessage("CHECK","HARDWARE");

    Serial.println();
    Serial.println("===== CHECK HARDWARE =====");

    for(int i=0;i<3;i++)
    {
      beep(150);
      delay(150);
    }
  }

  delay(2000);
}

//================================================

void loop()
{
  // --- FITUR ADJUST RTC VIA SERIAL ---
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    input.trim(); // Menghapus karakter spasi/newline berlebih

    if (input.startsWith("SET_RTC")) {
      int yr, mth, day, hr, min, sec;
      
      // Mengambil data dari string format: SET_RTC YYYY-MM-DD hh:mm:ss
      int parsed = sscanf(input.c_str(), "SET_RTC %d-%d-%d %d:%d:%d", &yr, &mth, &day, &hr, &min, &sec);

      if (parsed == 6) {
        rtc.adjust(DateTime(yr, mth, day, hr, min, sec));
        Serial.println("\n>>> WAKTU RTC BERHASIL DIUPDATE! <<<\n");
        beep(200); // Opsional: bunyi buzzer saat berhasil update
      } else {
        Serial.println("\n>>> FORMAT SALAH! <<<");
        Serial.println("Gunakan: SET_RTC YYYY-MM-DD hh:mm:ss");
        Serial.println("Contoh: SET_RTC 2026-07-08 13:14:00\n");
      }
    }
  }
  // -----------------------------------

  float suhuDHT = dht.readTemperature();
  float hum = dht.readHumidity();

  ds18b20.requestTemperatures();
  float suhuDS = ds18b20.getTempCByIndex(0);

  DateTime now = rtc.now();

  //================ SERIAL =================

  Serial.println("--------------------------------");

  Serial.print("RTC      : ");
  Serial.print(now.day());
  Serial.print("/");
  Serial.print(now.month());
  Serial.print("/");
  Serial.print(now.year());
  Serial.print(" ");

  if(now.hour()<10) Serial.print("0");
  Serial.print(now.hour());
  Serial.print(":");

  if(now.minute()<10) Serial.print("0");
  Serial.print(now.minute());
  Serial.print(":");

  if(now.second()<10) Serial.print("0");
  Serial.println(now.second());

  Serial.print("DHT22    : ");
  Serial.print(suhuDHT);
  Serial.print(" C  ");

  Serial.print(hum);
  Serial.println(" %");

  Serial.print("DS18B20  : ");
  Serial.print(suhuDS);
  Serial.println(" C");

  //================ LCD =================

  lcd.clear();

  lcd.setCursor(0,0);
  lcd.print("T:");
  lcd.print(suhuDS,1);
  lcd.print((char)223);
  lcd.print("C");

  lcd.print(" H:");
  lcd.print((int)hum);
  lcd.print("%");

  lcd.setCursor(0,1);

  if(now.hour()<10) lcd.print("0");
  lcd.print(now.hour());

  lcd.print(":");

  if(now.minute()<10) lcd.print("0");
  lcd.print(now.minute());

  lcd.print(":");

  if(now.second()<10) lcd.print("0");
  lcd.print(now.second());

  delay(2000);
}