import logging
import requests
import os
from flask import jsonify, request

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

BASE_URL = f"https://api.telegram.org/bot{TOKEN}/getUpdates"
CHAT_ID = "6448086756"
print(TOKEN)

class TelegramErrorHandler(logging.Handler):
    def emit(self, record):
        try:
            log_entry = self.format(record)

            # Chỉ gửi khi level WARNING trở lên
            if record.levelno >= logging.WARNING:
                send_telegram_message(f"🔥 SERVER ERROR\n\n{log_entry}")

        except Exception:
            pass
        
        
def send_telegram_message(message: str):
    try:
        url = f"https://api.telegram.org/bot{TOKEN}/sendMessage"
        requests.post(
            url,
            json={
                "chat_id": CHAT_ID,
                "text": message
            },
            timeout=10
        )
    except Exception as e:
        print("Telegram send failed:", e)
        
# ===== CREATE LOGGER HERE =====
security_logger = logging.getLogger("security")
security_logger.setLevel(logging.WARNING)

if not security_logger.handlers:
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | IP=%(ip)s | DEVICE=%(device)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    file_handler = logging.FileHandler("security.log")
    file_handler.setFormatter(formatter)
    security_logger.addHandler(file_handler)

    telegram_handler = TelegramErrorHandler()
    telegram_handler.setFormatter(formatter)
    security_logger.addHandler(telegram_handler)

# @app.route("/send-telegram", methods=["POST"])
# def send_telegram():
#     data = request.get_json()

#     if not data or "message" not in data:
#         return jsonify({"error": "message is required"}), 400

#     message = data["message"]

        
#     url = f"https://api.telegram.org/bot{TOKEN}/sendMessage"
#     r = requests.post(url, json={
#         "chat_id": CHAT_ID,
#         "text": message
#     })

#     return jsonify({
#         "ok": r.ok,
#         "telegram_response": r.json()
#     })
