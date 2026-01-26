/* ================= TAB SWITCH ================= */
function showTab(index) {
    document.querySelectorAll(".tab").forEach((tab, i) => {
        tab.classList.toggle("active", i === index);
    });

    document.querySelectorAll(".tab-content").forEach((content, i) => {
        content.classList.toggle("active", i === index);
    });
}

/* ================= HELPERS ================= */
function randomArray(n, min, max) {
    return Array.from({ length: n }, () =>
        +(Math.random() * (max - min) + min).toFixed(2)
    );
}

function randomTimestamps(n) {
    const now = Date.now();
    return Array.from({ length: n }, (_, i) =>
        new Date(now - (n - i) * 60000).toLocaleTimeString("vi-VN")
    );
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

/* ================= DASHBOARD ================= */
function loadDashboard() {
    tempEl.innerText = randomArray(1, 28, 34)[0];
    humEl.innerText  = randomArray(1, 45, 75)[0];
    presEl.innerText = randomArray(1, 990, 1015)[0];

    weatherNewsEl.innerHTML = `
        🌤️ Trời nắng nhẹ<br>
        🌬️ Gió: ${(Math.random() * 5).toFixed(1)} m/s<br>
        🤒 Cảm giác như: ${(Math.random() * 5 + 28).toFixed(1)} °C
    `;
}

/* ================= HISTORY CHART ================= */
const historyChart = new Chart(historyChartEl, {
    type: "line",
    data: {
        labels: randomTimestamps(40),
        datasets: [
            {
                label: "🌡️ Nhiệt độ (°C)",
                data: randomArray(40, 26, 35),
                tension: 0.4
            },
            {
                label: "💧 Độ ẩm (%)",
                data: randomArray(40, 45, 80),
                tension: 0.4
            },
            {
                label: "🔽 Áp suất (hPa)",
                data: randomArray(40, 980, 1020),
                tension: 0.4
            }
        ]
    },
    options: {
        responsive: true,
        plugins: {
            legend: { position: "top" }
        }
    }
});

/* ================= TREND DATA ================= */
const trendDataByDay = [
    {
        date: "2026-01-25",
        temp: [31, 32, 33, 32],
        hum:  [66, 65, 64, 65],
        pres: [1006, 1005, 1005, 1006],
        time: ["06:00", "12:00", "15:00", "21:00"]
    },
    {
        date: "2026-01-24",
        temp: [30, 31, 32, 33],
        hum:  [68, 67, 65, 64],
        pres: [1007, 1006, 1005, 1005],
        time: ["06:00", "12:00", "15:00", "21:00"]
    },
    {
        date: "2026-01-23",
        temp: [29, 30, 31, 32],
        hum:  [70, 69, 67, 66],
        pres: [1008, 1007, 1006, 1006],
        time: ["06:00", "12:00", "15:00", "21:00"]
    }
];

let trendChart = null;

/* ================= TREND ================= */
function loadTrendDay(index) {
    const d = trendDataByDay[index];

    trendTempEl.innerText =
        `${Math.min(...d.temp)} → ${Math.max(...d.temp)} °C`;

    trendHumEl.innerText =
        `${Math.min(...d.hum)} → ${Math.max(...d.hum)} %`;

    trendPresEl.innerText =
        `${Math.min(...d.pres)} → ${Math.max(...d.pres)} hPa`;

    if (trendChart) trendChart.destroy();

    trendChart = new Chart(trendChartEl, {
        type: "line",
        data: {
            labels: d.time,
            datasets: [
                { label: "🌡️ Nhiệt độ", data: d.temp, tension: 0.4 },
                { label: "💧 Độ ẩm", data: d.hum, tension: 0.4 },
                { label: "🔽 Áp suất", data: d.pres, tension: 0.4 }
            ]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: `Dữ liệu ngày ${d.date}`
                }
            }
        }
    });
}

function selectDay(index) {
    document.querySelectorAll(".day-selector button").forEach((btn, i) => {
        btn.classList.toggle("active", i === index);
    });

    loadTrendDay(index);
}

/* ================= FORECAST ================= */
const forecastChart = new Chart(forecastChartEl, {
    type: "line",
    data: {
        labels: ["+1h", "+2h", "+3h", "+4h", "+5h", "+6h"],
        datasets: [
            {
                label: "🌡️ Nhiệt độ dự báo (°C)",
                data: randomArray(6, 28, 35),
                tension: 0.4
            }
        ]
    }
});

/* ================= WIND MAP ================= */
function loadWindyMap(lat, lon) {
    document.getElementById("windyMap").innerHTML = `
        <iframe
            width="100%"
            height="520"
            src="https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&zoom=7&overlay=wind"
            frameborder="0">
        </iframe>
    `;
}

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        pos => loadWindyMap(
            pos.coords.latitude.toFixed(2),
            pos.coords.longitude.toFixed(2)
        ),
        () => loadWindyMap(21.03, 105.85)
    );
} else {
    loadWindyMap(21.03, 105.85);
}

/* ================= DATE ================= */
function updateDateTime() {
    const now = new Date();
    const formatted = now.toLocaleDateString("vi-VN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });

    document.getElementById("currentDate").innerText = "📅 " + formatted;
}

/* ================= INIT ================= */
updateDateTime();
loadDashboard();
loadTrendDay(0);

setInterval(loadDashboard, 5000);
setInterval(updateDateTime, 1000);
