#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <ESP32Servo.h>
#include <Preferences.h>

Preferences preferences;
String targetUuidStr = ""; // We will use String comparison
const int SERVO_PIN = 13;    
const int RSSI_THRESHOLD = -80;
int scanTime = 2; 

Servo myServo;
bool deviceInRange = false;
bool wasDeviceInRange = false; 
bool armed = false;

class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {
      if (advertisedDevice.haveServiceUUID()) {
        // Convert found UUID to string for a "clean" comparison
        String foundUUID = advertisedDevice.getServiceUUID().toString().c_str();
        
        // Compare ignoring case (important for Web vs ESP32 formatting)
        if (foundUUID.equalsIgnoreCase(targetUuidStr)) {
          if (advertisedDevice.getRSSI() > RSSI_THRESHOLD) {
            deviceInRange = true; 
          }
        }
      }
    }
};

void setup() {
  Serial.begin(115200);
  ESP32PWM::allocateTimer(0);
  delay(1000); 
  
  preferences.begin("dispatch", false);
  // Load saved UUID or use a dummy that won't match anything accidentally
  targetUuidStr = preferences.getString("target_uuid", "NONE");
  
  Serial.println("SYSTEM_READY");
  Serial.print("ACTIVE_UUID:");
  Serial.println(targetUuidStr);

  myServo.attach(SERVO_PIN);
  myServo.write(95); // Neutral/Stop
  delay(200);
  myServo.detach();

  BLEDevice::init("Access Device");
  BLEScan* pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setActiveScan(true);
}

void loop() {
  // 1. ALWAYS check Serial first (this stays fast)
  if (Serial.available() > 0) {
    String incoming = Serial.readStringUntil('\n');
    incoming.trim();

    if (incoming.startsWith("ARM:")) {
      targetUuidStr = incoming.substring(4);
      targetUuidStr.trim();
      preferences.putString("target_uuid", targetUuidStr);
      armed = true;
      Serial.print("CONFIRM_ARM:");
      Serial.println(targetUuidStr);
    }

    if (incoming == "DISARM") {
      armed = false;
      wasDeviceInRange = false;
      // Force stop any active scan immediately
      BLEDevice::getScan()->stop(); 
      Serial.println("DISARMED");
    }

    if ((incoming == "DISARM") && (wasDeviceInRange)) {
      armed = false;
      wasDeviceInRange = false;
      // Force stop any active scan immediately
      operateServo(false);
      BLEDevice::getScan()->stop(); 
      Serial.println("DISARMED");
    }
  }

    // 2. BLE SCANNING — ONLY WHEN ARMED
    if (armed) {
    BLEScan* pBLEScan = BLEDevice::getScan();
    if (!pBLEScan->isScanning()) {
        deviceInRange = false; 
        // Setting the second parameter to 'false' for non-blocking
        pBLEScan->start(scanTime, scanCompleteCB, false); 
    }

    if (deviceInRange && !wasDeviceInRange) {
        Serial.println("MATCH_FOUND");
        operateServo(true);
        wasDeviceInRange = true;
    } else if (!deviceInRange && wasDeviceInRange) {
        Serial.println("TARGET_LOST");
        operateServo(false);
        wasDeviceInRange = false;
    }
  }

    BLEDevice::getScan()->clearResults();

  delay(100);
}


void operateServo(bool open) {
    myServo.attach(SERVO_PIN);
    myServo.write(open ? 75 : 115);
    delay(400);
    myServo.write(95);
    delay(200);
    myServo.detach();
}