#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "HX711.h"

// 1. Credentials
#define WIFI_SSID "Wifi Name"
#define WIFI_PASSWORD "Wifi password"
#define DATABASE_SECRET // That long secret code
#define DATABASE_URL // Ends in .firebaseio.com

// 2. Pins from your WORKING code
const int LOADCELL_DOUT_PIN = 2;
const int LOADCELL_SCK_PIN = 4;

HX711 scale;
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

float lastVolume = 0;
unsigned long lastMillis = 0;

void setup() {
  Serial.begin(57600);
  delay(1000);
  Serial.println("\n--- Saline Monitor: Final Combined Mode ---");

  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  scale.set_scale(400.8); 
  scale.tare();           
  Serial.println("Scale Ready.");

  // Connect WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");


  config.database_url = DATABASE_URL;
  config.signer.tokens.legacy_token = DATABASE_SECRET;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  Serial.println("Firebase Ready.");
}

void loop() {
  if (millis() - lastMillis > 1000) {
    lastMillis = millis();


    float weight = scale.get_units(10); 
    if (weight < 0) weight = 0; 


    float volumeLeft = weight; 
    float timeElapsedMin = 1.0 / 60.0; 
    float flowRate = (lastVolume - volumeLeft) / timeElapsedMin;
    if (flowRate < 0 || lastVolume == 0) flowRate = 0;
    
    float timeRemainingTotalMin = (flowRate > 0.01) ? (volumeLeft / flowRate) : 0;
    
    int hours = (int)timeRemainingTotalMin / 60;
    int mins = (int)timeRemainingTotalMin % 60;
    String timeLeftStr = String(hours) + "h " + String(mins) + "m";

    FirebaseJson json;
    json.set("volume", volumeLeft);
    json.set("rate", flowRate);
    json.set("time_left", timeLeftStr);

    String roomID = "101"; 
    String path = "/saline_monitor/" + roomID;

    Serial.printf("Room %s | Vol: %.1fml | Firebase: ", roomID.c_str(), volumeLeft);

    if (Firebase.RTDB.setJSON(&fbdo, path.c_str(), &json)) {
      Serial.println("SUCCESS");
    } else {
      Serial.println(fbdo.errorReason());
    }

    lastVolume = volumeLeft;

    scale.power_down();
    delay(100); 
    scale.power_up();
  }
}
