package com.example.appsweathers;

import androidx.appcompat.app.AppCompatActivity;

import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.widget.ImageView;
import android.widget.TextView;

import com.android.volley.Request;
import com.android.volley.RequestQueue;
import com.android.volley.Response;
import com.android.volley.VolleyError;
import com.android.volley.toolbox.StringRequest;
import com.android.volley.toolbox.Volley;

import org.json.JSONException;
import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

public class MainActivity extends AppCompatActivity {
    private static final String BASE_URL = "https://weatherwebapplication-gfdxa5fkcxdth0gy.eastasia-01.azurewebsites.net";
    private static final int INTERVAL = 20000;
    private static final long ONLINE_WINDOW_MS = 60000;

    private ImageView img;
    private ImageView img2;

    private TextView dayTimeTxt;
    private TextView predictTxt;
    private TextView humidityTxt;
    private TextView temperatureTxt;
    private TextView pressureTxt;
    private TextView statusTxt;

    private TextView dayTimeTxt2;
    private TextView predictTxt2;
    private TextView humidityTxt2;
    private TextView temperatureTxt2;
    private TextView pressureTxt2;
    private TextView statusTxt2;

    private Handler mHandler;
    private RequestQueue requestQueue;

    private final Runnable mStatusChecker = new Runnable() {
        @Override
        public void run() {
            try {
                getCurrentWeatherData();
            } finally {
                mHandler.postDelayed(this, INTERVAL);
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        requestQueue = Volley.newRequestQueue(this);

        dayTimeTxt = findViewById(R.id.dayTime);
        predictTxt = findViewById(R.id.predict);
        humidityTxt = findViewById(R.id.humidity);
        temperatureTxt = findViewById(R.id.temperature);
        pressureTxt = findViewById(R.id.pressure);
        img = findViewById(R.id.imageView1);
        statusTxt = findViewById(R.id.status1);

        dayTimeTxt2 = findViewById(R.id.dayTime2);
        predictTxt2 = findViewById(R.id.predict2);
        humidityTxt2 = findViewById(R.id.humidity2);
        temperatureTxt2 = findViewById(R.id.temperature2);
        pressureTxt2 = findViewById(R.id.pressure2);
        img2 = findViewById(R.id.imageView2);
        statusTxt2 = findViewById(R.id.status2);

        mHandler = new Handler();
        startRepeatingTask();

        getCurrentWeatherData();
        setSensor2Unknown();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopRepeatingTask();
    }

    private void startRepeatingTask() {
        mStatusChecker.run();
    }

    private void stopRepeatingTask() {
        mHandler.removeCallbacks(mStatusChecker);
    }

    public void getCurrentWeatherData() {
        fetchLatestWeatherAndBind(
                0,
                dayTimeTxt,
                predictTxt,
                humidityTxt,
                temperatureTxt,
                pressureTxt,
                statusTxt,
                img
        );
    }

    private void setSensor2Unknown() {
        dayTimeTxt2.setText("Unknown");
        predictTxt2.setText("Unknown");
        humidityTxt2.setText("Unknown");
        temperatureTxt2.setText("Unknown");
        pressureTxt2.setText("Unknown");
        statusTxt2.setText("Unknown");
        statusTxt2.setTextColor(Color.parseColor("#B0B0B0"));
        img2.setImageResource(R.drawable.cloudy);
    }

    private void fetchLatestWeatherAndBind(
            int latestIndex,
            TextView dayTimeView,
            TextView predictView,
            TextView humidityView,
            TextView temperatureView,
            TextView pressureView,
            TextView statusView,
            ImageView imageView
    ) {
        String url = BASE_URL + "/api/weather";

        StringRequest stringRequest = new StringRequest(
                Request.Method.GET,
                url,
                new Response.Listener<String>() {
                    @Override
                    public void onResponse(String response) {
                        try {
                            JSONArray weatherArray = new JSONArray(response);
                            JSONObject jsonObject = pickLatestRecord(weatherArray, latestIndex);
                            if (jsonObject == null) {
                                showErrorState(statusView, predictView);
                                return;
                            }

                            double humidity = jsonObject.optDouble("humidity", Double.NaN);
                            double temp = jsonObject.optDouble("temp", Double.NaN);
                            double pressure = jsonObject.optDouble("pressure", Double.NaN);
                            int predictCode = jsonObject.optInt("predict", -1);
                            String createdAt = jsonObject.optString("createdAt", "");

                            Date serverDate = parseServerDate(createdAt);

                            dayTimeView.setText(formatDisplayDate(serverDate, createdAt));
                            predictView.setText(mapPredictionLabel(predictCode));
                            imageView.setImageResource(mapPredictionIcon(predictCode));

                            humidityView.setText(String.format(Locale.getDefault(), "%.1f%%", humidity));
                            temperatureView.setText(String.format(Locale.getDefault(), "%.1f\u00B0C", temp));
                            pressureView.setText(String.format(Locale.getDefault(), "%.1f hPa", pressure));

                            updateOnlineStatus(statusView, serverDate);
                        } catch (JSONException e) {
                            showErrorState(statusView, predictView);
                        }
                    }
                },
                new Response.ErrorListener() {
                    @Override
                    public void onErrorResponse(VolleyError error) {
                        showErrorState(statusView, predictView);
                    }
                }
        );

        requestQueue.add(stringRequest);
    }

    private JSONObject pickLatestRecord(JSONArray weatherArray, int latestIndex) {
        if (weatherArray == null || weatherArray.length() == 0) {
            return null;
        }

        JSONObject best = null;
        Date bestDate = null;

        for (int i = 0; i < weatherArray.length(); i++) {
            JSONObject item = weatherArray.optJSONObject(i);
            if (item == null) {
                continue;
            }

            Date itemDate = parseServerDate(item.optString("createdAt", ""));
            if (itemDate == null) {
                continue;
            }

            if (bestDate == null || itemDate.after(bestDate)) {
                bestDate = itemDate;
                best = item;
            }
        }

        if (best == null) {
            return weatherArray.optJSONObject(0);
        }

        if (latestIndex <= 0) {
            return best;
        }

        JSONObject secondBest = null;
        Date secondDate = null;
        for (int i = 0; i < weatherArray.length(); i++) {
            JSONObject item = weatherArray.optJSONObject(i);
            if (item == null || item == best) {
                continue;
            }

            Date itemDate = parseServerDate(item.optString("createdAt", ""));
            if (itemDate == null || !itemDate.before(bestDate)) {
                continue;
            }

            if (secondDate == null || itemDate.after(secondDate)) {
                secondDate = itemDate;
                secondBest = item;
            }
        }

        return secondBest != null ? secondBest : best;
    }

    private void showErrorState(TextView statusView, TextView predictView) {
        statusView.setText("Offline");
        statusView.setTextColor(Color.parseColor("#FF0000"));
        predictView.setText("No data");
    }

    private void updateOnlineStatus(TextView statusView, Date serverDate) {
        if (serverDate == null) {
            statusView.setText("Offline");
            statusView.setTextColor(Color.parseColor("#FF0000"));
            return;
        }

        long now = System.currentTimeMillis();
        long diffMillis = now - serverDate.getTime();
        boolean isOnline = diffMillis >= 0 && diffMillis <= ONLINE_WINDOW_MS;

        if (isOnline) {
            statusView.setText("Online");
            statusView.setTextColor(Color.parseColor("#00FF00"));
        } else {
            statusView.setText("Offline");
            statusView.setTextColor(Color.parseColor("#FF0000"));
        }
    }

    private Date parseServerDate(String createdAt) {
        if (createdAt == null || createdAt.isEmpty()) {
            return null;
        }

        String trimmed = createdAt.length() >= 19 ? createdAt.substring(0, 19) : createdAt;
        SimpleDateFormat parser = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
        parser.setTimeZone(TimeZone.getDefault());

        try {
            return parser.parse(trimmed);
        } catch (Exception ignored) {
            return null;
        }
    }

    private String formatDisplayDate(Date date, String fallbackRaw) {
        if (date == null) {
            return fallbackRaw == null || fallbackRaw.isEmpty() ? "N/A" : fallbackRaw;
        }

        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault());
        return formatter.format(date);
    }

    private String mapPredictionLabel(int predictCode) {
        switch (predictCode) {
            case -1:
                return "Pleasantly cool";
            case 0:
                return "Cold fog";
            case 1:
                return "Rainy";
            case 2:
                return "Sunny";
            case 3:
                return "Blazing sun";
            case 4:
                return "Lightly sunlit";
            default:
                return "Unknown (" + predictCode + ")";
        }
    }

    private int mapPredictionIcon(int predictCode) {
        switch (predictCode) {
            case -1:
                return R.drawable.pleasant_cool;
            case 0:
                return R.drawable.fog;
            case 1:
                return R.drawable.rainy;
            case 2:
                return R.drawable.sunny;
            case 3:
                return R.drawable.balzing;
            case 4:
                return R.drawable.lightly_sunlit;
            default:
                return R.drawable.cloudy;
        }
    }
}
