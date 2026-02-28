from flask import Flask, request ,render_template,  jsonify
import csv
import os
import requests
from datetime import datetime, timedelta
from flask_cors import CORS
import requests
from db_jdbc import get_connection
from dotenv import load_dotenv
import pandas as pd
import numpy as np
import psutil
import time
from telegram_notify import security_logger

load_dotenv()



app = Flask(__name__)


API_SOURCE = "https://weatherwebapplication-gfdxa5fkcxdth0gy.eastasia-01.azurewebsites.net/api/weather"
session = requests.Session()

@app.route("/api/dashboard")
def api_dashboard():
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT TOP 1 temp, humidity, pressure, createdAt
            FROM weather
            WHERE temp BETWEEN 1 AND 59
            AND humidity BETWEEN 1 AND 100
            AND pressure BETWEEN 901 AND 1099
            ORDER BY createdAt DESC
        """)

        row = cursor.fetchone()

        if not row:
            return jsonify({"error": "No valid data"}), 404

        return jsonify({
            "temp": row[0],
            "humidity": row[1],
            "pressure": row[2],
            "createdAt": str(row[3])
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    
@app.route("/api/history")
def api_history():

    selected_date = request.args.get("date")
    page = int(request.args.get("page", 1))
    per_page = 40

    offset = (page - 1) * per_page

    conn = get_connection()
    cursor = conn.cursor()

    try:

        # ===== COUNT TOTAL =====
        if selected_date:
            cursor.execute("""
                SELECT COUNT(*)
                FROM weather
                WHERE CAST(createdAt AS DATE) = ?
            """, (selected_date,))
        else:
            cursor.execute("SELECT COUNT(*) FROM weather")

        total = cursor.fetchone()[0]

        # ===== LOAD PAGE DATA =====
        if selected_date:
            sql = """
                SELECT temp, humidity, pressure, createdAt, Predict
                FROM weather
                WHERE CAST(createdAt AS DATE) = ?
                ORDER BY createdAt DESC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
            """
            params = (selected_date, offset, per_page)
        else:
            sql = """
                SELECT temp, humidity, pressure, createdAt, Predict
                FROM weather
                ORDER BY createdAt DESC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
            """
            params = (offset, per_page)

        cursor.execute(sql, params)
        rows = cursor.fetchall()

        data = []
        for r in rows:
            data.append({
                "temp": r[0],
                "humidity": r[1],
                "pressure": r[2],
                "createdAt": str(r[3]),
                "predict": r[4]
            })

        return jsonify({
            "data": data,
            "total": total,
            "perPage": per_page,
            "page": page
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
   
@app.route("/api/download")
def api_download():
    res = requests.get(API_SOURCE, timeout=5)
    arr = res.json()

    valid = [
        d for d in arr
        if 0 < d["temp"] < 60
        and 0 < d["humidity"] <= 100
        and 900 < d["pressure"] < 1100
    ]
    return jsonify(valid)
   
def load_weather_data(days=30):

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(f"""
        SELECT 
            createdAt,
            temp,
            humidity,
            pressure
        FROM weather
        WHERE CAST(createdAt AS DATETIME2) >= DATEADD(DAY, -{days}, GETDATE())
        ORDER BY CAST(createdAt AS DATETIME2) ASC
    """)

    rows = cursor.fetchall()

    df = pd.DataFrame(rows, columns=[
        "createdAt",
        "temp",
        "humidity",
        "pressure"
    ])

    conn.close()

    return df

import joblib
MODEL_DATA = joblib.load("best_weather_model.pkl")

model = MODEL_DATA["model"]
lag = MODEL_DATA["lag"]
feature_count = MODEL_DATA["feature_count"]

def build_features(df):

    df = df.copy()
    df["datetime"] = pd.to_datetime(df["createdAt"])

    df["hour"] = df["datetime"].dt.hour
    df["minute"] = df["datetime"].dt.minute
    df["day"] = df["datetime"].dt.dayofweek
    df["month"] = df["datetime"].dt.month

    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)

    df["minute_sin"] = np.sin(2 * np.pi * df["minute"] / 60)
    df["minute_cos"] = np.cos(2 * np.pi * df["minute"] / 60)

    df = df.drop(columns=["datetime", "createdAt"])

    return df
def forecast_all(df, n_steps=60):

    df = df.copy()
    df["createdAt"] = pd.to_datetime(df["createdAt"])
    df = df.sort_values("createdAt")

    # build feature full dataframe giống lúc train
    df_features = build_features(df)
    values = df_features.values

    # lấy window cuối
    last_window = values[-lag:].flatten()

    preds = []

    last_time = df["createdAt"].iloc[-1]

    for _ in range(n_steps):

        # ===== 1. Predict =====
        pred = model.predict([last_window])[0]

        temp_pred = float(pred[0])
        hum_pred = float(pred[1])
        pres_pred = float(pred[2])

        # ===== 2. Tạo thời gian mới =====
        future_time = last_time + timedelta(minutes=1)

        # ===== 3. Tạo feature thủ công (KHÔNG gọi build_features) =====
        hour = future_time.hour
        minute = future_time.minute
        day = future_time.weekday()
        month = future_time.month

        hour_sin = np.sin(2 * np.pi * hour / 24)
        hour_cos = np.cos(2 * np.pi * hour / 24)

        minute_sin = np.sin(2 * np.pi * minute / 60)
        minute_cos = np.cos(2 * np.pi * minute / 60)

        # Thứ tự PHẢI giống lúc train
        new_values = np.array([
            temp_pred,
            hum_pred,
            pres_pred,
            hour,
            minute,
            day,
            month,
            hour_sin,
            hour_cos,
            minute_sin,
            minute_cos
        ])

        # ===== 4. Update rolling window =====
        last_window = np.roll(last_window, -feature_count)
        last_window[-feature_count:] = new_values

        # ===== 5. Lưu kết quả =====
        preds.append({
            "time": future_time.isoformat(),
            "temp": temp_pred,
            "humidity": hum_pred,
            "pressure": pres_pred
        })

        last_time = future_time

    return preds

@app.route("/api/forecast/60m")
def api_forecast_60m():

    df = load_weather_data()
    forecast = forecast_all(df, n_steps=60)

    return jsonify({"forecast": forecast})


@app.route("/api/forecast/12h")
def api_forecast_12h():

    df = load_weather_data()
    forecast = forecast_all(df, n_steps=60*12)

    return jsonify({"forecast": forecast})


@app.route("/api/forecast/7d")
def api_forecast_7d():

    df = load_weather_data()
    forecast = forecast_all(df, n_steps=60*24*7)

    return jsonify({"forecast": forecast})



@app.route("/api/advice")
def get_advice():
    try:
        res = requests.get(
            "http://192.168.1.15:8000/weather",
            timeout=60
        )

        data = res.json()

        return jsonify({
            "advice": data["advice"],
            "weather": data["weather"]
        })

    except Exception as e:
        return security_logger.error({"error": str(e)}), 500




LAST_DEVICE = {}

@app.route("/api/device/heartbeat", methods=["POST"])
def device_heartbeat():

    data = request.get_json(silent=True)

    if not data:
        return jsonify({
            "status": "error",
            "message": "Invalid JSON"
        }), 400

    device_id = data.get("device_id", "unknown")

    LAST_DEVICE[device_id] = {
        "last_seen": datetime.now().isoformat(),
        "ip": request.remote_addr,
        "data": data
    }

    print(f"Heartbeat from {device_id}")

    return jsonify({
        "status": "ok",
        "device": device_id
    }), 200


@app.route("/api/device/list", methods=["GET"])
def list_devices():
    return jsonify(LAST_DEVICE)



process = psutil.Process(os.getpid())
@app.route("/api/server/flask-usage")
def flask_usage():

    cpu_raw = process.cpu_percent()

    cpu_normalized = cpu_raw / psutil.cpu_count()
    total_ram_mb = psutil.virtual_memory().total / 1024 / 1024
    
    return jsonify({
        "cpu_process": round(cpu_normalized, 2),
        "cpu_raw": cpu_raw,
        "cpu_total": psutil.cpu_percent(),
        "ram_process_mb": round(process.memory_info().rss / 1024 / 1024, 2),
        "ram_total_percent": psutil.virtual_memory().percent,
        "threads": process.num_threads(),
        "ram_total_mb": round(total_ram_mb, 2)
    })


@app.route("/api/health/db")
def db_health():

    start = time.time()

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM weather")
    count = cursor.fetchone()[0]

    cursor.execute("SELECT MAX(CreatedAt) FROM weather")
    last_insert = cursor.fetchone()[0]

    latency = (time.time() - start) * 1000

    return jsonify({
        "status": "Online",
        "latency_ms": round(latency, 2),
        "total_records": count,
        "last_insert": str(last_insert)
    })

# ===== TRUSTED DEVICES =====
TRUSTED_DEVICES = {
    "cc7e4bdc5193": "Nhom5_ESP32_KEY",

}

@app.route("/log", methods=["POST"])
def log_data():

    ip = request.remote_addr or "Unknown"

    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "No JSON received"}), 400

        device_id = data.get("device_id")
        device_secret = data.get("device_secret")

        # ===== CHECK TRUST =====
        if device_id not in TRUSTED_DEVICES:
            security_logger.warning(
                "Untrusted device tried to push data",
                extra={"ip": ip, "device": device_id or "Unknown"} 
            )
            return jsonify({"error": "Unauthorized device"}), 403

        if TRUSTED_DEVICES[device_id] != device_secret:
            security_logger.warning(
                "Invalid secret key",
                extra={"ip": ip, "device": device_id}
            )
            return jsonify({"error": "Invalid credentials"}), 403

        # ===== CHECK REQUIRED FIELDS =====
        required_fields = ["temperature", "humidity", "pressure", "predict"]

        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400

        temp = float(data["temperature"])
        hum = float(data["humidity"])
        pres = float(data["pressure"])
        pred = str(data["predict"])
        created_at = datetime.now().isoformat(timespec="microseconds")
        # ===== VALIDATE VALUE =====
        if not (-20 <= temp <= 60):
            return jsonify({"error": "Invalid temperature"}), 400

        if not (0 <= hum <= 100):
            return jsonify({"error": "Invalid humidity"}), 400

        if not (900 <= pres <= 1100):
            return jsonify({"error": "Invalid pressure"}), 400

        # ===== INSERT DB =====
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO weather (Temp, Humidity, Pressure,"CreatedAt",Predict)
            VALUES (?, ?, ?, ? ,?)
        """, (temp, hum, pres, created_at ,pred))

        conn.commit()
        conn.close()

        security_logger.info(
            "Trusted data inserted",
            extra={"ip": ip, "device": device_id}
        )

        return jsonify({
            "status": "success",
            "device": device_id,
            "inserted_at": datetime.now().isoformat()
        }), 200

    except Exception as e:
        security_logger.error(
            f"Exception: {e}",
            extra={"ip": ip, "device": device_id if 'device_id' in locals() else "Unknown"}
        )
        return jsonify({"error": str(e)}), 500
    


@app.route("/")
def home():
    return render_template("index.html")

# ================= MAIN =================
if __name__ == "__main__":
    print("🚀 Python Weather Server running...")
    app.run(
        host="0.0.0.0",   
        port=5000,
        debug=True
    )
    