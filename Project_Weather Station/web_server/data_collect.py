from flask import Flask, request ,render_template,  jsonify
import csv
import os
import requests
from datetime import datetime, timedelta
from flask_cors import CORS

app = Flask(__name__)
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)

# ================= FILE =================
CSV_FILE = "weather_data_labeled.csv" 

# ================= WEATHERAPI =================
API_KEY = "dbde00f5dd8549ffbbf140520260101"
WEATHER_URL = "http://api.weatherapi.com/v1/current.json"
LOCATION = "Ho Chi Minh City"
LAT = 10.869368
LON = 106.673879
# ================= THRESHOLDS =================

# --- Nhiệt độ (Temperature) ---
TEMP_SENSOR_ERROR = 1   # Sai số cảm biến BME280: ±1°C
TEMP_INDOOR_OFFSET = 5  # Chênh lệch giữa indoor và outdoor: phòng thường cao hơn ngoài trời 5°C


# Tổng threshold để auto-label
TEMP_THRESHOLD = TEMP_SENSOR_ERROR + TEMP_INDOOR_OFFSET 

# --- Độ ẩm (Humidity) ---
HUM_SENSOR_ERROR = 3     # BME280 ±3%
HUM_INDOOR_OFFSET = 10   # phòng khô/máy lạnh ±10%
HUM_THRESHOLD = HUM_SENSOR_ERROR + HUM_INDOOR_OFFSET   + 15

# --- Áp suất (Pressure) ---
PRESS_SENSOR_ERROR = 1    # BME280 ±1 hPa
PRESS_INDOOR_OFFSET = 5   # indoor vs outdoor ±5 hPa
PRESS_THRESHOLD = PRESS_SENSOR_ERROR + PRESS_INDOOR_OFFSET   # 1 + 5 + 4 = 10 hPa


# ================= INIT CSV =================
if not os.path.exists(CSV_FILE):
    with open(CSV_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "time",
            "temperature",
            "humidity",
            "pressure",
            "api_temp",
            "api_humidity",
            "api_pressure",
            "api_weather",
            "label"
        ])
    print("📄 Created weather_data_labeled.csv")

# ================= WEATHER API =================
def fetch_weather_api():
    try:
        params = {
            "key": API_KEY,
            "q": f"{LAT},{LON}",
            "aqi": "no"
        }
        r = requests.get(WEATHER_URL, params=params, timeout=5)
        data = r.json()
        current = data["current"]
        return {
            "temp": current["temp_c"],
            "humidity": current["humidity"],
            "pressure": current["pressure_mb"],
            "condition": current["condition"]["text"],
            "is_day": current["is_day"]
        }
    except Exception as e:
        print("⚠️ WeatherAPI error:", e)
        return None

# ================= LABEL MAP =================
def map_weather_to_label(api_weather, temp, is_day):
    w = api_weather.lower()

    if "fog" in w or "mist" in w:
        return "Cold fog"
    if "rain" in w or "drizzle" in w or "thunder" in w:
        return "Rainy"
    if "cloud" in w or "overcast" in w:
        return "Lightly sunlit"
    if "sunny" in w or "clear" in w:
        if not is_day:
            return "Pleasantly cool"
        return "Blazing sun" if temp >= 33 else "Sunny"
    return "Unknown"

# ================= ROUTE =================
@app.route("/log", methods=["POST"])
def log_data():
    data = request.get_json(force=True)
    try:
        timestamp = data["time"]
        temp = float(data["temperature"])
        hum = float(data["humidity"])
        pres = float(data["pressure"])

        api_data = fetch_weather_api()
        if api_data is None:
            label = "Unknown"
            api_temp = api_humidity = api_pres = api_weather = "Unknown"
        else:
            api_temp = api_data["temp"]
            api_humidity = api_data["humidity"]
            api_pres = api_data["pressure"]
            api_weather = api_data["condition"]
            is_day = api_data["is_day"]

            # So sánh sensor vs API
            temp_diff = abs(temp - api_temp)
            hum_diff = abs(hum - api_humidity)
            pres_diff = abs(pres - api_pres)

            if temp_diff <= TEMP_THRESHOLD and pres_diff <= PRESS_THRESHOLD:
                label = map_weather_to_label(api_weather, temp, is_day)
            else:
                label = "Unknown"

        row = [
            timestamp,
            temp,
            hum,
            pres,
            api_temp,
            api_humidity,
            api_pres,
            api_weather,
            label
        ]

        with open(CSV_FILE, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(row)

        print(f"✅ {timestamp} | {api_weather} | {label}")
        return "OK", 200

    except Exception as e:
        print("❌ Error:", e)
        return "BAD REQUEST", 400


# ================= MAIN =================
if __name__ == "__main__":
    print("🚀 Python Weather Server running...")
    app.run(
        host="0.0.0.0",   # ESP32 truy cập được
        port=5000,
        debug=True
    )
