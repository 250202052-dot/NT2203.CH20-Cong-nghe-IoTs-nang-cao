import hmac
import hashlib
import time
from flask import request, jsonify
from config import SECRET_KEY, VALID_API_KEY

def verify_device():

    if request.headers.get("x-api-key") != VALID_API_KEY:
        return False, jsonify({"error": "Invalid API key"}), 401

    raw_body = request.get_data()
    signature = request.headers.get("x-signature")

    if not signature:
        return False, jsonify({"error": "Missing signature"}), 401

    computed = hmac.new(
        SECRET_KEY,
        raw_body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, computed):
        return False, jsonify({"error": "Invalid signature"}), 403

    data = request.get_json(silent=True)
    if not data:
        return False, jsonify({"error": "Invalid JSON"}), 400

    timestamp = data.get("timestamp")
    if not timestamp or abs(int(time.time()) - int(timestamp)) > 30:
        return False, jsonify({"error": "Expired request"}), 403

    return True, data, 200