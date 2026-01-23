#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>

// 1. PASTE YOUR GENERATED UUID HERE (From the App)
// Format must be dashed: "12345678-1234-1234-1234-123456789abc"
static BLEUUID TARGET_UUID("2E9C4DE7-7236-422D-89B3-272E5813879C");

int scanTime = 5; // Scan for 5 seconds

// 2. Define what to do when a device is found
class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {
      // Check if the device has a Service UUID and if it matches ours
      if (advertisedDevice.haveServiceUUID() && 
          advertisedDevice.isAdvertisingService(TARGET_UUID)) {
            
        Serial.println("TARGET FOUND!");
        Serial.print("Device: ");
        Serial.println(advertisedDevice.toString().c_str());
        Serial.print("RSSI: ");
        Serial.println(advertisedDevice.getRSSI()); // Signal Strength
        
        // UNLOCK LOGIC GOES HERE (e.g., servo.write(90))
      }
    }
};

void setup() {
  Serial.begin(115200);
  Serial.println("Scanning for target UUID...");

  // 3. Initialize BLE
  BLEDevice::init("");
  BLEScan* pBLEScan = BLEDevice::getScan(); //create new scan
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setActiveScan(true); // Active scan uses more power, but gets results faster
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);  // less or equal setInterval
}

void loop() {
  // 4. Scan repeatedly
  BLEDevice::getScan()->start(scanTime, false);
  BLEDevice::getScan()->clearResults();   // clear buffer to release memory
  delay(2000);
}
