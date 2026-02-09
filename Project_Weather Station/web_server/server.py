from flask import Flask, request ,render_template,  jsonify
import csv
import os
import requests
from datetime import datetime, timedelta
from flask_cors import CORS
import requests
from dotenv import load_dotenv
load_dotenv()

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {"origins": "*"}
})



API_SOURCE = "https://weatherwebapplication-gfdxa5fkcxdth0gy.eastasia-01.azurewebsites.net/api/weather"
session = requests.Session()

@app.route("/api/dashboard")
def api_dashboard():
    try:
        res = session.get(API_SOURCE, timeout=10)
        res.raise_for_status()

        # 1️⃣ đảm bảo response là JSON
        if "application/json" not in res.headers.get("Content-Type", ""):
            return jsonify({
                "error": "API did not return JSON",
                "raw": res.text[:200]
            }), 500

        # 2️⃣ parse JSON
        arr = res.json()

        if not isinstance(arr, list):
            return jsonify({"error": "Invalid data format"}), 500

        # 3️⃣ lọc data hợp lệ
        valid = next((
            d for d in arr
            if 0 < d.get("temp", 0) < 60
            and 0 < d.get("humidity", 0) <= 100
            and 900 < d.get("pressure", 0) < 1100
        ), None)

        if not valid:
            return jsonify({"error": "No valid data"}), 404

        # 4️⃣ trả data cho dashboard
        return jsonify({
            "temp": valid["temp"],
            "humidity": valid["humidity"],
            "pressure": valid["pressure"],
            "createdAt": valid["createdAt"]
        })

    except requests.exceptions.RequestException as e:
        return jsonify({
            "error": "Cannot connect to API",
            "detail": str(e)
        }), 500

@app.route("/api/history")
def api_history():
    res = requests.get(API_SOURCE, timeout=5)
    arr = res.json()

    valid = [
        d for d in arr
        if 0 < d["temp"] < 60
        and 0 < d["humidity"] <= 100
        and 900 < d["pressure"] < 1100
    ]

    valid = valid[:40][::-1]

    return jsonify(valid)



BASE_URL = f"https://api.telegram.org/bot{TOKEN}/getUpdates"
CHAT_ID = "6448086756"

@app.route("/send-telegram", methods=["POST"])
def send_telegram():
    data = request.get_json()

    if not data or "message" not in data:
        return jsonify({"error": "message is required"}), 400

    message = data["message"]

    url = f"https://api.telegram.org/bot{TOKEN}/sendMessage"
    r = requests.post(url, json={
        "chat_id": CHAT_ID,
        "text": message
    })

    return jsonify({
        "ok": r.ok,
        "telegram_response": r.json()
    })

@app.route("/api/advice")
def get_advice():

    try:
        res = requests.get(
            "http://localhost:8000/weather",
            timeout=60
        )

        data = res.json()

        return jsonify({
            "advice": data["advice"],
            "weather": data["weather"]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/")
def home():
    return render_template("index.html")

# ================= MAIN =================
if __name__ == "__main__":
    print("🚀 Python Weather Server running...")
    app.run(
        host="0.0.0.0",   # ESP32 truy cập được
        port=5000,
        debug=True
    )
