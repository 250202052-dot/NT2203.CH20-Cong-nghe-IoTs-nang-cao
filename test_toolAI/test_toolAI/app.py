from fastapi import FastAPI, HTTPException
import requests
import time
import os
import openai
import traceback
from dotenv import load_dotenv
from groq import Groq
# ======================
# Init
# ======================
load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
if not OPENROUTER_API_KEY:
    raise RuntimeError("❌ OPENROUTER_API_KEY not found")

openai.api_key = OPENROUTER_API_KEY
openai.api_base = "https://openrouter.ai/api/v1"

app = FastAPI(title="Weather LLM API (Stable)")

# ======================
# Config
# ======================
WEATHER_URL = "https://weatherwebapplication-gfdxa5fkcxdth0gy.eastasia-01.azurewebsites.net/api/weather"

WEATHER_TIMEOUT = 10
LLM_TIMEOUT = 30

WEATHER_RETRY = 3
LLM_RETRY = 3

# ======================
# Prompt builder
# ======================
def build_prompt(data: dict) -> str:
    return f"""
Bạn là trợ lý thời tiết thông minh ở TP.HCM.

Dữ liệu hiện tại từ cảm biến:
- Nhiệt độ: {data.get('temp', '--')}°C
- Độ ẩm: {data.get('humidity', '--')}%
- Áp suất: {data.get('pressure', '--')} hPa

Hãy:
- Mô tả ngắn gọn tình hình thời tiết
- Đưa ra lời khuyên thực tế về ăn mặc, đi lại và sức khỏe
- Trả lời 100% bằng tiếng Việt
- Giới hạn 3–5 câu
""".strip()

# ======================
# Weather API Call (Retry)
# ======================
def fetch_weather():
    for i in range(WEATHER_RETRY):
        try:
            r = requests.get(WEATHER_URL, timeout=WEATHER_TIMEOUT)
            r.raise_for_status()

            data = r.json()

            if not data or not isinstance(data, list):
                raise RuntimeError(f"Invalid weather format: {data}")

            return data[0]

        except Exception:
            print("🌦 WEATHER ERROR:")
            print(traceback.format_exc())

            if i == WEATHER_RETRY - 1:
                raise

            time.sleep(1.5 * (i + 1))

# ======================
# LLM Call (Retry)
# ======================
def call_llm(messages):
    for i in range(LLM_RETRY):
        try:
            return openai.ChatCompletion.create(
                model="openai/gpt-3.5-turbo",
                # model="stepfun/step-3.5-flash:free",
                messages=messages,
                temperature=0.7,
                max_tokens=250,
                request_timeout=LLM_TIMEOUT
            )

        except Exception:
            print("🤖 LLM ERROR:")
            print(traceback.format_exc())

            if i == LLM_RETRY - 1:
                raise

            time.sleep(2 * (i + 1))

# ======================
# API endpoint
# ======================
@app.get("/weather")
def get_weather_advice():
    t_start = time.perf_counter()

    # 1️⃣ Fetch weather
    try:
        weather = fetch_weather()
    except Exception as e:
        raise HTTPException(500, f"Weather API error: {e}")

    # 2️⃣ Build prompt
    prompt = build_prompt(weather)

    # 3️⃣ Call LLM
    try:
        llm_resp = call_llm([
            {"role": "system", "content": "You are a helpful weather assistant."},
            {"role": "user", "content": prompt}
        ])

        advice = llm_resp["choices"][0]["message"]["content"].strip()

    except Exception as e:
        raise HTTPException(500, f"LLM error: {e}")

    return {
        "weather": weather,
        "advice": advice,
        "latency_sec": round(time.perf_counter() - t_start, 2)
    }

# ======================
# Run with python app.py
# ======================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )


# from fastapi import FastAPI, HTTPException
# import requests
# import time
# import os
# import openai
# import traceback
# from dotenv import load_dotenv

# # ======================
# # Init
# # ======================
# load_dotenv()

# OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
# if not OPENROUTER_API_KEY:
#     raise RuntimeError("❌ OPENROUTER_API_KEY not found")

# openai.api_key = OPENROUTER_API_KEY
# openai.api_base = "https://openrouter.ai/api/v1"

# app = FastAPI(title="Weather LLM API (Stable FIX)")

# # ======================
# # Config
# # ======================
# WEATHER_URL = "https://weatherwebapplication-gfdxa5fkcxdth0gy.eastasia-01.azurewebsites.net/api/weather"

# WEATHER_TIMEOUT = 10
# LLM_TIMEOUT = 30

# WEATHER_RETRY = 3
# LLM_RETRY = 3

# # ⭐ Model fallback list (Free)
# FREE_MODELS = [
#     "stepfun/step-3.5-flash:free"
    
# ]

# # ======================
# # Prompt builder
# # ======================
# def build_prompt(data: dict) -> str:
#     return f"""
# Bạn là trợ lý thời tiết thông minh ở TP.HCM.

# Dữ liệu hiện tại từ cảm biến:
# - Nhiệt độ: {data.get('temp', '--')}°C
# - Độ ẩm: {data.get('humidity', '--')}%
# - Áp suất: {data.get('pressure', '--')} hPa

# Hãy:
# - Mô tả ngắn gọn tình hình thời tiết
# - Đưa ra lời khuyên thực tế về ăn mặc, đi lại và sức khỏe
# - Trả lời 100% bằng tiếng Việt
# - Giới hạn 3–5 câu
# """.strip()

# # ======================
# # Weather API Call
# # ======================
# def fetch_weather():
#     for i in range(WEATHER_RETRY):
#         try:
#             r = requests.get(WEATHER_URL, timeout=WEATHER_TIMEOUT)
#             r.raise_for_status()

#             data = r.json()

#             if not data or not isinstance(data, list):
#                 raise RuntimeError(f"Invalid weather format: {data}")

#             return data[0]

#         except Exception:
#             print("🌦 WEATHER ERROR:")
#             print(traceback.format_exc())

#             if i == WEATHER_RETRY - 1:
#                 raise

#             time.sleep(1.5 * (i + 1))

# # ======================
# # Safe extract content
# # ======================
# def extract_text(resp):
#     msg = resp["choices"][0]["message"]

#     # ưu tiên content
#     if msg.get("content"):
#         return msg["content"].strip()

#     # fallback reasoning
#     if msg.get("reasoning"):
#         return msg["reasoning"].strip()

#     return ""


# # ======================
# # LLM Call with fallback
# # ======================
# def call_llm(messages):

#     for model in FREE_MODELS:
#         print(f"🤖 Trying model: {model}")

#         for retry in range(LLM_RETRY):
#             try:
#                 resp = openai.ChatCompletion.create(
#                     model=model,
#                     messages=messages,
#                     temperature=0.7,
#                     max_tokens=512,
#                     request_timeout=LLM_TIMEOUT
#                 )

#                 print("🧾 RAW RESPONSE:", resp)

#                 content = extract_text (resp)

#                 if content:
#                     return content.strip()

#                 raise RuntimeError("Empty content")

#             except Exception:
#                 print("🤖 LLM ERROR:")
#                 print(traceback.format_exc())

#                 time.sleep(2 * (retry + 1))

#         print(f"⚠ Model failed → fallback next")

#     raise RuntimeError("All models failed")

# # ======================
# # API endpoint
# # ======================
# @app.get("/weather")
# def get_weather_advice():

#     t_start = time.perf_counter()

#     # 1️⃣ Fetch weather
#     try:
#         weather = fetch_weather()
#     except Exception as e:
#         raise HTTPException(500, f"Weather API error: {e}")

#     # 2️⃣ Prompt
#     prompt = build_prompt(weather)
#     prompt += "\n\nChỉ trả lời kết quả cuối. Không giải thích."

#     # 3️⃣ LLM
#     try:
#         advice = call_llm([
#                     {
#                         "role": "system",
#                         "content": """
#                 You are a weather assistant.

#                 STRICT RULES:
#                 - Only output final answer
#                 - No reasoning
#                 - No thinking text
#                 - No markdown
#                 - Vietnamese only
#                 - Max 5 sentences
#                 """
#                     },
#                     {"role": "user", "content": prompt}
#                 ])


#     except Exception as e:
#         raise HTTPException(500, f"LLM error: {e}")

#     return {
#         "weather": weather,
#         "advice": advice,
#         "latency_sec": round(time.perf_counter() - t_start, 2)
#     }

# # ======================
# # Run
# # ======================
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
