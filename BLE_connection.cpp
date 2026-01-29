#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>

// 1. Configuration
static BLEUUID TARGET_UUID("2E9C4DE7-7236-422D-89B3-272E5813879C");   //get this from webserver
const int LED_PIN = 2;
const int RSSI_THRESHOLD = -80;
int scanTime = 1;

// Track presence
bool deviceInRange = false;

// 2. Callback logic
class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {
      if (advertisedDevice.haveServiceUUID() &&
          advertisedDevice.isAdvertisingService(TARGET_UUID)) {

        int rssi = advertisedDevice.getRSSI();
        Serial.print("Target Found! RSSI: ");
        Serial.println(rssi);

        if (rssi > RSSI_THRESHOLD) {
          deviceInRange = true;
          digitalWrite(LED_PIN, HIGH);   // ✅ LED stays ON
          Serial.println(">>> Device in range — LED ON");
        }
      }
    }
};

void setup() {
  Serial.begin(115200);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Serial.println("Starting BLE Scan...");

  BLEDevice::init("");
  BLEScan* pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);
}

void loop() {
  deviceInRange = false;   // Reset before each scan

  BLEDevice::getScan()->start(scanTime, false);
  BLEDevice::getScan()->clearResults();

  if (!deviceInRange) {
    digitalWrite(LED_PIN, LOW);   // ❌ Device out of range → LED OFF
  }

  delay(1000);
}
