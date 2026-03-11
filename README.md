# NT2203.CH20 - Đồ án IoT nâng cao

Hệ thống này là một đồ án IoT thời tiết gồm 4 phần chính:

- `ESP32 + BME280`: thu thập nhiệt độ, độ ẩm, áp suất.
- `TinyML`: chạy mô hình phân loại thời tiết trực tiếp trên ESP32.
- `Flask Web Server`: nhận dữ liệu từ thiết bị, lưu vào Azure SQL, hiển thị dashboard và dự đoán.
- `Android App`: hiển thị dữ liệu thời tiết hiện tại từ backend.

Ngoài ra repo còn có một nhánh thử nghiệm `test_toolAI` để sinh tư vấn thời tiết bằng LLM.

## 1. Kiến trúc tổng thể

```text
ESP32 + BME280
  |- đọc sensor theo chu kỳ
  |- phân loại thời tiết bằng TinyML (Decision Tree)
  |- gửi heartbeat + dữ liệu lên Flask server
  |- đẩy dữ liệu lên ThingSpeak

Flask server
  |- nhận dữ liệu từ ESP32
  |- lưu vào Azure SQL
  |- cung cấp dashboard/history/forecast/system health
  |- gọi thêm AI advice service (tùy chọn)

Training notebooks
  |- train model phân loại để export ModelDT.h cho ESP32
  |- train model hồi quy chuỗi thời gian để export best_weather_model.pkl cho server

Android app
  |- gọi API backend để hiển thị trạng thái thời tiết hiện tại
```

## 2. Cấu trúc thư mục

```text
Project_Weather_Station/
  ESP32_Code/ESP32_firmware/     Firmware PlatformIO cho ESP32
  web_server/                    Flask server + dashboard + model dự báo
  requirements.txt               Requirements mức project

Training Model/
  TraningModel.ipynb             Train model phân loại thời tiết
  Predict_model_iot.ipynb        Train model dự báo chuỗi thời gian

weatherapp/
  app/                           Ứng dụng Android Java

test_toolAI/
  test_toolAI/                   FastAPI service sinh lời khuyên thời tiết bằng LLM
```

## 3. Chức năng từng thành phần

### 3.1 ESP32 firmware

Thư mục: `Project_Weather_Station/ESP32_Code/ESP32_firmware`

- Đọc dữ liệu từ cảm biến BME280.
- Chạy mô hình `DecisionTree` được export thành `ModelDT.h`.
- Mở web dashboard local ngay trên ESP32 qua SPIFFS.
- Gửi heartbeat tới `/api/device/heartbeat`.
- Gửi dữ liệu sensor và nhãn dự đoán tới `/log`.
- Gửi dữ liệu thô lên ThingSpeak.

File chính:

- `src/esp32code.cpp`
- `src/ModelDT.h`
- `data/index.html`
- `data/script.js`
- `data/style.css`

### 3.2 Flask web server

Thư mục: `Project_Weather_Station/web_server`

Server hiện cung cấp các nhóm chức năng sau:

- Dashboard dữ liệu mới nhất.
- Lịch sử dữ liệu có phân trang.
- Download dữ liệu CSV.
- Dự báo 60 phút, 12 giờ, 7 ngày bằng model đã train.
- Theo dõi heartbeat thiết bị ESP32.
- Theo dõi tài nguyên Flask process và Azure SQL.
- Gửi cảnh báo qua Telegram logger.

File chính:

- `server.py`: backend chính.
- `db_jdbc.py`: kết nối Azure SQL qua JDBC.
- `telegram_notify.py`: logging và Telegram notification.
- `security.py`, `config.py`: xác thực device kiểu HMAC/API key.
- `templates/index.html`, `static/app.js`, `static/style.css`: giao diện dashboard.

### 3.3 Training notebooks

Thư mục: `Training Model`

`TraningModel.ipynb`

- Đọc dataset `final_data.csv` trên Google Drive.
- Encode label thời tiết.
- So sánh `DecisionTree`, `SVM`, `RandomForest`.
- Export model tốt nhất dạng C header bằng `micromlgen` sang `ModelDT.h`.

`Predict_model_iot.ipynb`

- Tạo feature thời gian (`hour`, `minute`, `day`, `month`, sin/cos`).
- Sinh cửa sổ trễ (`lag`) cho bài toán dự báo đa biến.
- So sánh `LinearRegression`, `RandomForestRegressor`, `GradientBoostingRegressor`.
- Export model tốt nhất sang `best_weather_model.pkl` để Flask server dùng khi forecast.

### 3.4 Android app

Thư mục: `weatherapp`

- Viết bằng Java + Volley.
- Poll API định kỳ để lấy dữ liệu mới nhất.
- Hiển thị nhiệt độ, độ ẩm, áp suất, nhãn thời tiết và trạng thái online/offline.
- UI đang thiết kế dạng 2 sensor, nhưng source hiện chỉ bind dữ liệu cho sensor 1.

### 3.5 test_toolAI

Thư mục: `test_toolAI/test_toolAI`

Đây là nhánh thử nghiệm, không phải thành phần lõi của pipeline IoT.

- `app.py`: FastAPI service lấy dữ liệu thời tiết rồi gọi LLM để sinh lời khuyên.
- `utils/vector_store.py`, `utils/rag_pipeline.py`: xử lý FAISS + embedding + RAG.
- `utils/pdf_utils.py`: đọc PDF bằng PyMuPDF.

## 4. Luồng dữ liệu

1. ESP32 đọc dữ liệu từ BME280.
2. ESP32 chạy model TinyML để suy ra nhãn thời tiết hiện tại.
3. ESP32 gửi heartbeat và dữ liệu lên Flask server.
4. Flask server lưu dữ liệu vào Azure SQL, đồng thời phục vụ dashboard/history/forecast.
5. Android app và web dashboard đọc dữ liệu từ backend để hiển thị.

## 5. Yêu cầu môi trường

- Python 3.11 khuyến nghị cho server.
- Java 17 hoặc Java 21 cho Android/Gradle.
- Android Studio để build app mobile.
- PlatformIO để nạp firmware cho ESP32.
- SQL Server JDBC driver cho Flask server.

Lưu ý: build Android trong môi trường này đã lỗi khi dùng JDK `25.0.2`, vì vậy không nên dùng JDK 25 cho project này.

## 6. Cách chạy từng phần

### 6.1 Train model

Hai notebook hiện đang viết theo môi trường Google Colab và đọc dữ liệu từ đường dẫn Google Drive tuyệt đối. Cần chỉnh lại path dataset trước khi chạy.

Kết quả mong đợi:

- Từ `TraningModel.ipynb`: sinh `ModelDT.h` rồi chép vào `Project_Weather_Station/ESP32_Code/ESP32_firmware/src/`.
- Từ `Predict_model_iot.ipynb`: sinh `best_weather_model.pkl` rồi đặt trong `Project_Weather_Station/web_server/`.

### 6.2 Chạy Flask server

```bash
cd Project_Weather_Station/web_server
pip install -r requirements.txt
python server.py
```

Trước khi chạy cần kiểm tra:

- `db_jdbc.py` đang dùng đường dẫn tuyệt đối tới file JDBC JAR, cần đổi sang path tương đối phù hợp với máy của bạn.
- Chuỗi kết nối DB lấy từ biến môi trường `DB_USER` và `DB_PASS`.
- Nếu dùng Telegram logger, cần `TELEGRAM_BOT_TOKEN`.

API chính của server:

- `POST /log`
- `POST /api/device/heartbeat`
- `GET /api/device/list`
- `GET /api/dashboard`
- `GET /api/history`
- `GET /api/download`
- `GET /api/forecast/60m`
- `GET /api/forecast/12h`
- `GET /api/forecast/7d`
- `GET /api/server/flask-usage`
- `GET /api/health/db`
- `GET /api/advice`

### 6.3 Chạy AI advice service (tùy chọn)

```bash
cd test_toolAI/test_toolAI
python app.py
```

Service này cần ít nhất:

- `OPENROUTER_API_KEY`
- các package cho `FastAPI`, `uvicorn`, `requests`, `python-dotenv`, `openai`

Repo hiện chỉ có file `requirement.txt` rất tối giản, nên phần này nên xem là experimental.

### 6.4 Nạp firmware ESP32

Mở `Project_Weather_Station/ESP32_Code/ESP32_firmware` bằng PlatformIO, sau đó chỉnh:

- `ssid`
- `password`
- `SERVER_IP`
- các key/secret liên quan tới thiết bị hoặc ThingSpeak

Sau đó:

1. Upload filesystem SPIFFS.
2. Build và upload firmware.
3. Mở Serial Monitor để kiểm tra WiFi, sensor, heartbeat và HTTP response.

### 6.5 Chạy Android app

Mở thư mục `weatherapp` bằng Android Studio rồi build/run.

Lưu ý:

- App hiện gọi endpoint `/api/weather` trên backend public.
- Nếu bạn muốn chạy với server local trong repo, cần đồng bộ lại contract API vì `server.py` hiện không expose endpoint này.

## 7. Công nghệ sử dụng

- ESP32, BME280, PlatformIO, SPIFFS
- C++/Arduino framework
- Python, Flask, FastAPI
- Azure SQL + JDBC
- scikit-learn, TensorFlow, micromlgen, joblib
- Android Java
- OpenRouter/OpenAI API
