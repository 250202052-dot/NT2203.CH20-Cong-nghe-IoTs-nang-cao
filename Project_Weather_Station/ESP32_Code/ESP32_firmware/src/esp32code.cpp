#include "ModelDT.h"
Eloquent::ML::Port::DecisionTree clf;

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESPAsyncWebServer.h>
#include <Adafruit_BME280.h>
#include <SPIFFS.h>
#include "esp_heap_caps.h"

// ================= CONFIG =================
// const char* ssid = "SMARTNET";
// const char* password = "0348304495";

const char* ssid = "Hoai Phuong"; 
const char* password = "Lucky123";

// const char* SERVER_API_URL = "https://weatherwebapplication-gfdxa5fkcxdth0gy.eastasia-01.azurewebsites.net/api/weather";

const char* THINGSPEAK_API_KEY = "DE1EUVOP56LST8Q3";
const char* THINGSPEAK_URL = "http://api.thingspeak.com/update";

// String ip = NULL;
// String HEARTBEAT_URL = "http://" + ip + ":5000/api/device/heartbeat";

const char* SERVER_IP = "192.168.1.15";
String HEARTBEAT_URL = String("http://") + SERVER_IP + ":5000/api/device/heartbeat";
String serverUrl = String("http://") + SERVER_IP + ":5000/log";
// ================= GLOBAL =================
Adafruit_BME280 bme;
AsyncWebServer server(80);

float gTemp = NAN, gHum = NAN, gPres = NAN;

unsigned long lastSample = 0;
unsigned long lastSend = 0;

#define SAMPLE_INTERVAL 10000
#define SEND_INTERVAL   60000

// Device ID tự sinh từ MAC
String DEVICE_ID;

// ================= WIFI =================
void connectWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > 15000) break;
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected!");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi Failed!");
  }
}

// ================= SENSOR =================
void readBME() {
  gTemp = bme.readTemperature();
  gHum  = bme.readHumidity();
  gPres = bme.readPressure() / 100.0F;
}

// ================= HEALTH =================
void printSystemHealth() {
  Serial.println("===== SYSTEM =====");
  Serial.printf("Free heap: %u\n", ESP.getFreeHeap());
  Serial.printf("Min heap: %u\n", ESP.getMinFreeHeap());
  Serial.printf("Largest block: %u\n",
                heap_caps_get_largest_free_block(MALLOC_CAP_8BIT));
  Serial.printf("RSSI: %d\n", WiFi.RSSI());
  Serial.printf("Uptime: %lu sec\n", millis()/1000);
  Serial.println("==================");
}

// ================= PREDICT =================
int predictWeather() {
  if (isnan(gTemp) || isnan(gHum) || isnan(gPres))
    return -1;

  float sample[3] = { gTemp, gHum, gPres };
  return clf.predict(sample);
}

// ================= THINGSPEAK =================
void sendToThingSpeak() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (isnan(gTemp)) return;

  String url = String(THINGSPEAK_URL) +
               "?api_key=" + THINGSPEAK_API_KEY +
               "&field1=" + gTemp +
               "&field2=" + gHum +
               "&field3=" + gPres;

  HTTPClient http;
  http.begin(url);
  http.GET();
  http.end();
}

// ================= HEARTBEAT =================
void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  StaticJsonDocument<512> doc;

  // ===== Device =====
  doc["device_id"] = DEVICE_ID;

  // ===== System =====
  JsonObject sys = doc.createNestedObject("system");
  sys["chip_model"] = ESP.getChipModel();
  sys["revision"]   = ESP.getChipRevision();
  sys["cores"]      = ESP.getChipCores();
  sys["sdk"]        = ESP.getSdkVersion();
  sys["cpu_mhz"]    = getCpuFrequencyMhz();
  sys["uptime"]     = millis() / 1000;

  // ===== Memory =====
  JsonObject mem = doc.createNestedObject("memory");
  mem["free_heap"]   = ESP.getFreeHeap();
  mem["min_heap"]    = ESP.getMinFreeHeap();
  mem["largest_blk"] = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);

  if (psramFound()) {
    mem["free_psram"] = ESP.getFreePsram();
    mem["min_psram"]  = ESP.getMinFreePsram();
  }

  // ===== Network =====
  JsonObject net = doc.createNestedObject("network");
  net["wifi"] = WiFi.status() == WL_CONNECTED;
  net["rssi"] = WiFi.RSSI();
  net["ip"]   = WiFi.localIP().toString();

  // ===== Sensor =====
  JsonObject sensor = doc.createNestedObject("sensor");
  sensor["connected"] = !isnan(gTemp);
  sensor["temp"] = gTemp;
  sensor["hum"]  = gHum;
  sensor["pres"] = gPres;
  sensor["predict"] = predictWeather();

  // ===== Firmware =====
  JsonObject fw = doc.createNestedObject("firmware");
  fw["size"]      = ESP.getSketchSize();
  fw["free_ota"]  = ESP.getFreeSketchSpace();
  fw["flash"]     = ESP.getFlashChipSize();

  char buffer[512];
  size_t len = serializeJson(doc, buffer);

  HTTPClient http;
  http.begin(HEARTBEAT_URL);
  Serial.print("Heartbeat URL: " + HEARTBEAT_URL);
  http.addHeader("Content-Type", "application/json");
  int httpCode = http.POST((uint8_t*)buffer, len);
  Serial.print("API HTTP code: ");
  Serial.println(httpCode);

  if (httpCode > 0) {
    Serial.println(http.getString());
  }
  http.end();
}

// ================= READ FOR WEB =================
String readBME280Temperature() { return isnan(gTemp) ? "" : String(gTemp, 2); }
String readBME280Humidity() { return isnan(gHum) ? "" : String(gHum, 2); }
String readBME280Pressure() { return isnan(gPres) ? "" : String(gPres, 2); } 
// ================= PREDICT =================
String Predict()
{
  if (isnan(gTemp) || isnan(gHum) || isnan(gPres))
  {
    return "No data";
  }
  float sample[3] = {gTemp, gHum, gPres};
  int pred = clf.predict(sample);
  switch (pred)
  {
  case 0:
    return "Cold fog";
  case 1:
    return "Rainy";
  case 2:
    return "Sunny";
  case 3:
    return "Blazing sun";
  case 4:
    return "Lightly sunlit";
  default:
    return "Pleasantly cool";
  }
}
int mapPredictToInt(const String &label)
{
  if (label == "Cold fog")
    return 0;
  if (label == "Rainy")
    return 1;
  if (label == "Sunny")
    return 2;
  if (label == "Blazing sun")
    return 3;
  if (label == "Lightly sunlit")
    return 4;
  return -1;
}
// ================= WEB =================
void setupWebServer()
{
  if (!SPIFFS.begin())
  {
    Serial.println(" SPIFFS mount failed");
    return;
  }
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request)
            { request->send(SPIFFS, "/index.html", "text/html"); });
  server.on("/script.js", HTTP_GET, [](AsyncWebServerRequest *request)
            { request->send(SPIFFS, "/script.js", "text/javascript"); });
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

// ================= SEND WEB API =================
// void sendToServerAPI() {
//   if (isnan(gTemp) || isnan(gHum) || isnan(gPres)) return;

//   String label = Predict();
//   int predictValue = mapPredictToInt(label);

//   JsonDocument doc;

//   doc["temp"]     = gTemp;      
//   doc["humidity"] = gHum;
//   doc["pressure"] = gPres;
//   doc["predict"]  = String(predictValue);

//   String requestBody;
//   serializeJson(doc, requestBody);
//   Serial.println(requestBody);

//   HTTPClient http;
//   http.begin(SERVER_API_URL);
//   http.addHeader("Content-Type", "application/json");

//   int httpCode = http.POST(requestBody);
//   Serial.print("API HTTP code: ");
//   Serial.println(httpCode);

//   if (httpCode > 0) {
//     Serial.println(http.getString());
//   }

//   http.end();
// }
  

const String DEVICE_SECRET = "Nhom5_ESP32_KEY";

void sendData() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected");
    return;
  }
  float sample[3] = { gTemp, gHum, gPres }; 
  String label = Predict();
  int predictValue = mapPredictToInt(label);

  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");

  String payload = "{";
  payload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"device_secret\":\"" + String(DEVICE_SECRET) + "\",";
  payload += "\"temperature\":" + String(sample[0], 2) + ",";
  payload += "\"humidity\":" + String(sample[1], 2) + ",";
  payload += "\"pressure\":" + String(sample[2], 2)+ ",";
  payload += "\"predict\":" + String(predictValue);
  payload += "}";

  int httpResponseCode = http.POST(payload);

  Serial.print("HTTP Response: ");
  Serial.println(httpResponseCode);

  if (httpResponseCode != 200) {
    Serial.println("Send failed - will retry later");
  }

  http.end();
}

// ================= SETUP =================
  void setup()
  {
    Serial.begin(115200);

    Wire.begin();
    if (!bme.begin(0x76))
    {
      Serial.println("BME280 not found");
      while (1)
        ;
    }

    // Tạo device_id từ MAC
    uint64_t chipid = ESP.getEfuseMac();
    DEVICE_ID = String((uint32_t)(chipid >> 32), HEX) +
                String((uint32_t)chipid, HEX);

    connectWiFi();
    setupWebServer();
    printSystemHealth();
  }

  // ================= LOOP =================
  void loop()
  {
    unsigned long now = millis();

    if (now - lastSample > SAMPLE_INTERVAL)
    {
      lastSample = now;
      readBME();
      sendHeartbeat();
    }

    if (now - lastSend > SEND_INTERVAL)
    {
      sendData();
      lastSend = now;
      // sendToServerAPI();
      sendToThingSpeak();
      printSystemHealth();
    }
  }