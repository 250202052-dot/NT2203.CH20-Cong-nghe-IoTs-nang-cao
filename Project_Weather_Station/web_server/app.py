from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from service import *
from security import verify_device

app = Flask(__name__)
CORS(app)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/dashboard")
def dashboard():
    data = get_dashboard()
    if not data:
        return jsonify({"error": "No data"}), 404
    return jsonify(data)


@app.route("/api/device/heartbeat", methods=["POST"])
def heartbeat():

    valid, data, code = verify_device()
    if not valid:
        return data, code

    device_id = data.get("device_id")
    if not device_id:
        return jsonify({"error": "Missing device_id"}), 400

    save_device(device_id, data, request.remote_addr)

    return jsonify({"status": "ok"})


@app.route("/api/device/list")
def devices():
    return jsonify(get_devices())


@app.route("/send-telegram", methods=["POST"])
def telegram():
    msg = request.json.get("message")
    ok, resp = send_telegram(msg)
    return jsonify({"ok": ok, "telegram": resp})


@app.route("/api/server/flask-usage")
def usage():
    return jsonify(flask_usage())


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)