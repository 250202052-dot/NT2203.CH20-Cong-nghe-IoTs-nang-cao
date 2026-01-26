#include "ModelDT.h"
Eloquent::ML::Port::DecisionTree clf;
#include <ArduinoJson.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <time.h>
#include <HTTPClient.h>
#include <SPIFFS.h>

// ================= WIFI =================
const char* ssid = "Hoai Phuong";
const char* password = "Lucky123";

// const char* ssid = "SMARTNET";
// const char* password = "0348304495";

// ================= TIME (NTP) =================
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 7 * 3600;   // GMT+7
const int   daylightOffset_sec = 0;

// ================= SENSOR =================
Adafruit_BME280 bme;
AsyncWebServer server(80);

float gTemp = NAN;
float gHum  = NAN;
float gPres = NAN;

// ================= TIMING =================
unsigned long lastSampleTime = 0;
unsigned long lastSendTime   = 0;

const unsigned long SAMPLE_INTERVAL = 10000;   // 10s
const unsigned long SEND_INTERVAL   = 60000;   // 1 phút

// ================= WEB SERVER - FLASK =================
const char* SERVER_URL = "http://192.168.1.100:8080/log";
const char* SERVER_API_URL = "https://weatherwebapplication-gfdxa5fkcxdth0gy.eastasia-01.azurewebsites.net/api/weather1";
// ================= SENSOR COLLECT =================
void collectBME280() {
  gTemp = bme.readTemperature();
  gHum  = bme.readHumidity();
  gPres = bme.readPressure() / 100.0F;
  Serial.print("BME280 Collected: T=" + String(gTemp, 2) + "°C, H=" + String(gHum, 2) + "%, P=" + String(gPres, 2) + "hPa \n");
}

// ================= TIME STRING =================
String getTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "1970-01-01 00:00:00";
  }
  char buffer[25];
  strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(buffer);
}

// ================= SEND TO PC (SERIAL) =================
void sendToPC() {
  if (isnan(gTemp) || isnan(gHum) || isnan(gPres)) return;

  Serial.print(getTimestamp());
  Serial.print(",");
  Serial.print(gTemp, 2);
  Serial.print(",");
  Serial.print(gHum, 2);
  Serial.print(",");
  Serial.println(gPres, 2);
}

void sendToServer() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (isnan(gTemp) || isnan(gHum) || isnan(gPres)) return;

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  String payload = "{";
  payload += "\"time\":\"" + getTimestamp() + "\",";
  payload += "\"temperature\":" + String(gTemp, 2) + ",";
  payload += "\"humidity\":" + String(gHum, 2) + ",";
  payload += "\"pressure\":" + String(gPres, 2);
  payload += "}";

  http.POST(payload);
  http.end();
}

// ================= READ FOR WEB =================
String readBME280Temperature() {
  return isnan(gTemp) ? "" : String(gTemp, 2);
}

String readBME280Humidity() {
  return isnan(gHum) ? "" : String(gHum, 2);
}

String readBME280Pressure() {
  return isnan(gPres) ? "" : String(gPres, 2);
}

// ================= PREDICT =================
String Predict() {
  if (isnan(gTemp) || isnan(gHum) || isnan(gPres)) {
    return "No data";
  }

  float sample[3] = { gTemp, gHum, gPres };
  int pred = clf.predict(sample);

  switch (pred) {
    case 0: return "Cold fog";
    case 1: return "Rainy";
    case 2: return "Sunny";
    case 3: return "Blazing sun";
    case 4: return "Lightly sunlit";
    default: return "Pleasantly cool";
  }
}

int mapPredictToInt(const String& label) {
  if (label == "Cold fog") return 0;
  if (label == "Rainy") return 1;
  if (label == "Sunny") return 2;
  if (label == "Blazing sun") return 3;
  if (label == "Lightly sunlit") return 4;
  return -1;
}

void sendToServerAPI() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (isnan(gTemp) || isnan(gHum) || isnan(gPres)) return;

  String label = Predict();
  int predictValue = mapPredictToInt(label);

  JsonDocument doc;

  doc["temp"]     = gTemp;      
  doc["humidity"] = gHum;
  doc["pressure"] = gPres;
  doc["predict"]  = String(predictValue);

  String requestBody;
  serializeJson(doc, requestBody);
  Serial.println(requestBody);

  HTTPClient http;
  http.begin(SERVER_API_URL);
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.POST(requestBody);
  Serial.print("HTTP code: ");
  Serial.println(httpCode);

  if (httpCode > 0) {
    Serial.println(http.getString());
  }

  http.end();
}


void Check_wifi_connection() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi disconnected! Reconnecting...");
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
      delay(1000);
      Serial.print(".");
    }
    Serial.println("\n✅ WiFi reconnected");
    Serial.println(WiFi.localIP());
  }
}

void checkBME280Connection() {
  Wire.begin();        
  delay(100);

  if (!bme.begin(0x76)) {
    Serial.println("❌ Could not find BME280 at 0x76!");
    while (1);
  }
  Serial.println("✅ BME280 connected");
}


void setupTime() {
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
    return;
  }
}

void setupWebServer()
{
  if (!SPIFFS.begin())
  {
    Serial.println("❌ SPIFFS mount failed");
    return;
  }
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request)
            { request->send(SPIFFS, "/index.html"); });
  server.on("/script.js", HTTP_GET, [](AsyncWebServerRequest *request)
            { request->send(SPIFFS, "/script.js", "text/javascript"); });
  // server.on("/rain.js", HTTP_GET, [](AsyncWebServerRequest *request)
  //           { request->send(SPIFFS, "/rain.js", "text/javascript"); });
  server.on("/style.css", HTTP_GET, [](AsyncWebServerRequest *request)
            { request->send(SPIFFS, "/style.css", "text/css"); });
  server.on("/temperature", HTTP_GET, [](AsyncWebServerRequest *request)
            { request->send(200, "text/plain", readBME280Temperature()); });
  server.on("/humidity", HTTP_GET, [](AsyncWebServerRequest *request)
            { request->send(200, "text/plain", readBME280Humidity()); });
  server.on("/pressure", HTTP_GET, [](AsyncWebServerRequest *request)
            { request->send(200, "text/plain", readBME280Pressure()); });
  server.on("/predict", HTTP_GET, [](AsyncWebServerRequest *request)
            { request->send(200, "text/plain", Predict()); });
  server.begin();
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);

  Wire.begin();                 
  checkBME280Connection();      
  Check_wifi_connection();     
  setupTime();
  setupWebServer();
}

// ================= LOOP =================
void loop() {
  unsigned long now = millis();

  if (now - lastSampleTime >= SAMPLE_INTERVAL) {
    lastSampleTime = now;
    collectBME280();
  }

  if (now - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = now;
    sendToPC();  
    sendToServer();
    // sendToServerAPI();
  }
}
