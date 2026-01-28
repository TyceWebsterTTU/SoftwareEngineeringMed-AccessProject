#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>

class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {
      // PRINT EVERYTHING SEEN
      Serial.print("Device Found: ");
      Serial.print(advertisedDevice.getName().c_str());
      Serial.print(" | RSSI: ");
      Serial.print(advertisedDevice.getRSSI());
      
      // Check for Service UUIDs
      if (advertisedDevice.haveServiceUUID()) {
        Serial.print(" | UUID: ");
        Serial.println(advertisedDevice.getServiceUUID().toString().c_str());
      } else {
        Serial.println(" | (No Service UUID visible)");
      }
    }
};

void setup() {
  Serial.begin(115200);
  Serial.println("STARTING DIAGNOSTIC SCAN...");

  BLEDevice::init("");
  BLEScan* pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setActiveScan(true); // REQUIRED to see iPhone data
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);
}

void loop() {
  BLEDevice::getScan()->start(1, false);
  BLEDevice::getScan()->clearResults();
  delay(500);
}
