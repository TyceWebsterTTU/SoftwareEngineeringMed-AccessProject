#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>

// --- Defaults ---
BLEUUID targetUUID = BLEUUID("2E9C4DE7-7236-422D-89B3-272E5813879C"); 
bool isArmed = false; 

const int LED_PIN = 2;
const int RSSI_THRESHOLD = -80;
int scanTime = 1; // Short scan time for responsiveness

// --- Callback Logic ---
class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {
      if (advertisedDevice.haveServiceUUID() && advertisedDevice.isAdvertisingService(targetUUID)) {
        int rssi = advertisedDevice.getRSSI();
        if (rssi > RSSI_THRESHOLD) {
           digitalWrite(LED_PIN, HIGH); // Found it!
        }
      }
    }
};

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  BLEDevice::init("");
  BLEScan* pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setActiveScan(true);
}

void loop() {
  // 1. ALWAYS check for new commands first
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim(); 

    if (command.startsWith("A:")) {
      String value = command.substring(2);
      isArmed = (value == "1");
      Serial.println(isArmed ? "CMD: ARMED" : "CMD: DISARMED");
    } 
    else if (command.startsWith("U:")) {
      String newUUID = command.substring(2);
      if (newUUID.length() > 10) { 
        targetUUID = BLEUUID(newUUID.c_str());
        Serial.println("CMD: UUID Updated");
      }
    }
  }

  // 2. Run Logic if Armed
  if (isArmed) {
    digitalWrite(LED_PIN, LOW); // Reset LED before scan
    BLEDevice::getScan()->start(scanTime, false);
    BLEDevice::getScan()->clearResults();
  } else {
    digitalWrite(LED_PIN, LOW);
    delay(100); // Small delay to prevent CPU hogging when idle
  }
}
