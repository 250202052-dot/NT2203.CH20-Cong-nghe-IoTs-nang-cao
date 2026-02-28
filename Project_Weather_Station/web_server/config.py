import os
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
SECRET_KEY = b"my_super_secret_key_123"
VALID_API_KEY = "ESP32_DEVICE_KEY"

API_SOURCE = "https://weatherwebapplication-gfdxa5fkcxdth0gy.eastasia-01.azurewebsites.net/api/weather"
CHAT_ID = "6448086756"