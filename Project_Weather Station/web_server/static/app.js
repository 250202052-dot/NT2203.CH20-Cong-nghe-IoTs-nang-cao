/* ================= TAB SWITCH ================= */
function showTab(index) {
    document.querySelectorAll(".tab").forEach((tab, i) => {
        tab.classList.toggle("active", i === index);
    });

    document.querySelectorAll(".tab-content").forEach((content, i) => {
        content.classList.toggle("active", i === index);
    });
}

/* ================= DOM CACHE ================= */
const tempEl = document.getElementById("temp");
const humEl  = document.getElementById("hum");
const presEl = document.getElementById("pres");

const trendTempEl = document.getElementById("trendTemp");
const trendHumEl  = document.getElementById("trendHum");
const trendPresEl = document.getElementById("trendPres");

const weatherNewsEl = document.getElementById("weatherNews");

const historyChartEl  = document.getElementById("historyChart");
const trendChartEl    = document.getElementById("trendChart");
const forecastChartEl = document.getElementById("forecastChart");

/* ================= API ================= */
const API_URL = "https://weatherwebapplication-gfdxa5fkcxdth0gy.eastasia-01.azurewebsites.net/api/weather";

/* ================= DASHBOARD ================= */
const PREDICT_LABELS = {
    0: "🌫️ Sương mù lạnh",
    1: "🌧️ Mưa",
    2: "☀️ Nắng",
    3: "🔥 Nắng gắt",
    4: "🌤️ Nắng nhẹ"
};

let lastTelegramAlert = 0;

function notifyTelegram(message) {
  const now = Date.now();

  // ⛔ chống spam (5 phút)
  if (now - lastTelegramAlert < 5 * 60 * 1000) return;
  lastTelegramAlert = now;

  fetch("/send-telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  }).catch(err => {
    console.error("Telegram send failed:", err);
  });
}


// async function loadDashboard() {
//     try {
//         // 1️⃣ Gọi API dashboard (server đã lọc sẵn)
//         const res = await fetch("/api/dashboard");
//         const data = await res.json();

//         // 2️⃣ Đổ dữ liệu lên UI
//         tempEl.innerText = data.temp;
//         humEl.innerText  = data.humidity;
//         presEl.innerText = data.pressure;

//         // 3️⃣ Hiển thị thời gian đo
//         weatherNewsEl.innerHTML = `
//             🌤️ Dữ liệu mới nhất<br>
//             🕒 ${new Date(data.createdAt).toLocaleString("vi-VN")}
//         `;
//         loadDashboardCharts();
//     } catch (err) {
//         // 4️⃣ Lỗi thì báo
//         weatherNewsEl.innerText = "❌ Không lấy được dữ liệu";
//         console.error(err);
//     }
// }

async function loadDashboard() {
  try {
    // 1️⃣ Gọi API dashboard
    const res = await fetch("/api/dashboard", {
      cache: "no-store"
    });

    // ❌ HTTP error (404, 500...)
    if (!res.ok) {
      throw new Error("HTTP error " + res.status);
    }

    const data = await res.json();

    // ❌ Data lỗi / thiếu
    if (
      data == null ||
      data.temp == null ||
      data.humidity == null ||
      data.pressure == null
    ) {
      throw new Error("Invalid dashboard data");
    }

    // 2️⃣ Đổ dữ liệu lên UI
    tempEl.innerText = Number(data.temp).toFixed(1);
    humEl.innerText  = Number(data.humidity).toFixed(1);
    presEl.innerText = Number(data.pressure).toFixed(1);

    // 3️⃣ Hiển thị thời gian đo
    weatherNewsEl.innerHTML = `
      🌤️ Dữ liệu mới nhất<br>
      🕒 ${new Date(data.createdAt).toLocaleString("vi-VN")}
    `;

    loadDashboardCharts();

  } catch (err) {
    console.error("Dashboard error:", err);

    // 4️⃣ UI báo lỗi
    weatherNewsEl.innerText = "❌ Không lấy được dữ liệu";

    // 🚨 GỬI TELEGRAM KHI CÓ LỖI
    notifyTelegram(
      "🚨 LỖI DASHBOARD\n" +
      "❌ " + err.message + "\n" +
      "⏰ " + new Date().toLocaleString("vi-VN")
    );
  }
}

/* ================= Vẽ chart ================= */
const tempChart = new Chart(
    document.getElementById("tempChart"),
    {
        type: "line",
        data: {
            labels: [],
            datasets: [{ label: "°C", data: [], tension: 0.4 }]
        }
    }
);

const humChart = new Chart(
    document.getElementById("humChart"),
    {
        type: "line",
        data: {
            labels: [],
            datasets: [{ label: "%", data: [], tension: 0.4 }]
        }
    }
);

const presChart = new Chart(
    document.getElementById("presChart"),
    {
        type: "line",
        data: {
            labels: [],
            datasets: [{ label: "hPa", data: [], tension: 0.4 }]
        }
    }
);

function sortByTimeDesc(arr) {
    return arr.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
}

async function loadDashboardCharts() {
    const res = await fetch("/api/history");
    let arr = await res.json();

    arr = sortByTimeDesc(arr);

    // lấy 30 phút gần nhất
    const latest = arr.slice(0, 30).reverse(); // cũ → mới

    const labels = latest.map(d =>
        new Date(d.createdAt).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit"
        })
    );

    // nhiệt độ
    tempChart.data.labels = labels;
    tempChart.data.datasets[0].data = latest.map(d => d.temp);
    tempChart.update();

    // độ ẩm
    humChart.data.labels = labels;
    humChart.data.datasets[0].data = latest.map(d => d.humidity);
    humChart.update();

    // áp suất
    presChart.data.labels = labels;
    presChart.data.datasets[0].data = latest.map(d => d.pressure);
    presChart.update();
}

async function loadDashboardTrend() {
    const res = await fetch("/api/history");
    const data = await res.json();

    if (!data || data.length < 2) return;

    const first = data[0];
    const last = data[data.length - 1];

    // So sánh
    const tempTrend = last.temp - first.temp;
    const humTrend  = last.humidity - first.humidity;
    const presTrend = last.pressure - first.pressure;

    document.getElementById("trendTempText").innerHTML =
        `🌡️ Nhiệt độ: <strong>${tempTrend > 0 ? "Tăng 📈" : "Giảm 📉"}</strong>`;

    document.getElementById("trendHumText").innerHTML =
        `💧 Độ ẩm: <strong>${humTrend > 0 ? "Tăng" : "Giảm"}</strong>`;

    document.getElementById("trendPresText").innerHTML =
        `🔽 Áp suất: <strong>${presTrend < 0 ? "Giảm ⚠️" : "Ổn định"}</strong>`;

    // Nhận định tổng hợp
    let summary = "🌤️ Thời tiết ổn định";

    if (presTrend < -2 && humTrend > 5) {
        summary = "🌧️ Áp suất giảm & độ ẩm tăng → Có khả năng mưa";
    } else if (tempTrend > 2) {
        summary = "🔥 Nhiệt độ tăng → Thời tiết nóng dần";
    }

    document.getElementById("trendSummary").innerText = summary;
}


/* ================= RAW DATA TABLE ================= */
async function loadRawDataTable() {
    try {
        const res = await fetch("/api/history");
        let data = await res.json();

        const tbody = document.getElementById("rawDataTable");
        const selectedDate = document.getElementById("rawDate").value;
        tbody.innerHTML = "";

        if (selectedDate) {
            data = data.filter(d => {
                const date = new Date(d.createdAt);

                const localDate =
                    date.getFullYear() + "-" +
                    String(date.getMonth() + 1).padStart(2, "0") + "-" +
                    String(date.getDate()).padStart(2, "0");

                return localDate === selectedDate;
            });
        }

        if (!data.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="table-empty">
                        Không có dữ liệu
                    </td>
                </tr>
            `;
            return;
        }

        data
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .forEach(d => {
                const label =
                    PREDICT_LABELS[d.predict] ?? "🌥️ Dễ chịu";

                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${new Date(d.createdAt).toLocaleString("vi-VN")}</td>
                    <td>${Number(d.temp).toFixed(1)}</td>
                    <td>${Number(d.humidity).toFixed(1)}</td>
                    <td>${Number(d.pressure).toFixed(1)}</td>
                    <td><strong>${label}</strong></td>
                `;
                tbody.appendChild(tr);
            });

    } catch (err) {
        console.error(err);
    }
}


function showTab(index) {
    document.querySelectorAll(".tab").forEach((tab, i) => {
        tab.classList.toggle("active", i === index);
    });

    document.querySelectorAll(".tab-content").forEach((content, i) => {
        content.classList.toggle("active", i === index);
    });

    // Tab Raw Data / Analytics
    if (index === 1) {
        loadRawDataTable();
    }
}

// 🔮 MAP NHÃN DỰ BÁO
const PREDICT_LABELS_download = {
    0: "Cold fog",
    1: "Rainy",
    2: "Sunny",
    3: "Blazing sun",
    4: "Lightly sunlit"
};

async function downloadRawCSV() {
    try {
        const res = await fetch("/api/history");
        let data = await res.json();

        if (!data || data.length === 0) {
            alert("Không có dữ liệu để tải");
            return;
        }

        // 📅 FILTER THEO NGÀY ĐANG CHỌN
        const selectedDate = document.getElementById("rawDate")?.value;
        if (selectedDate) {
            data = data.filter(d =>
                d.createdAt?.startsWith(selectedDate)
            );
        }

        if (data.length === 0) {
            alert("Không có dữ liệu cho ngày này");
            return;
        }

        // 🔽 SORT: CŨ → MỚI
        data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // 🧾 CSV HEADER
        let csv = "createdAt,temp,humidity,pressure,predict\n";

        data.forEach(d => {
            const label = PREDICT_LABELS_download[d.predict] ?? "Pleasantly cool";

            csv += `"${d.createdAt}",` +
                   `${Number(d.temp).toFixed(1)},` +
                   `${Number(d.humidity).toFixed(1)},` +
                   `${Number(d.pressure).toFixed(1)},` +
                   `"${label}"\n`;
        });

        // 📥 DOWNLOAD
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = selectedDate
            ? `raw_data_${selectedDate}.csv`
            : `raw_data_all.csv`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (err) {
        console.error(err);
        alert("Lỗi khi tải CSV");
    }
}



/* ================= FORECAST (GIẢ) ================= */
const forecastChart = new Chart(forecastChartEl, {
    type: "line",
    data: {
        labels: ["+1h", "+2h", "+3h", "+4h", "+5h", "+6h"],
        datasets: [
            {
                label: "🌡️ Nhiệt độ dự báo (°C)",
                data: [30, 31, 32, 32, 33, 34],
                tension: 0.4
            }
        ]
    }
});

/* ================= DATE ================= */
function updateDateTime() {
    const now = new Date();
    document.getElementById("currentDate").innerText =
        "📅 " + now.toLocaleDateString("vi-VN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
}

/* ================= INIT ================= */
updateDateTime();

// Load dashboard ngay khi mở trang
loadDashboard();
loadDashboardTrend();
setInterval(loadDashboard, 1000);
setInterval(loadDashboardTrend, 1000);