#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <ESP32Servo.h>

static BLEUUID TARGET_UUID("2E9C4DE7-7236-422D-89B3-272E5813879C"); // get this from web server
const int SERVO_PIN = 13;    
const int RSSI_THRESHOLD = -80;
int scanTime = 2; 

Servo myServo;
bool deviceInRange = false;
bool wasDeviceInRange = false; 

class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {
      if (advertisedDevice.haveServiceUUID() && advertisedDevice.isAdvertisingService(TARGET_UUID)) {
        if (advertisedDevice.getRSSI() > RSSI_THRESHOLD) {
          deviceInRange = true; 
        }
      }
    }
};

void setup() {
  Serial.begin(115200);
  ESP32PWM::allocateTimer(0);
  myServo.setPeriodHertz(50);
  
  // Start stopped
  myServo.attach(SERVO_PIN);
  myServo.write(95); // Your specific STOP value
  delay(200);
  myServo.detach();  // Completely kill signal for silence

  BLEDevice::init("");
  BLEScan* pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setActiveScan(true);
}

void loop() {
  deviceInRange = false; 
  BLEDevice::getScan()->start(scanTime, false);
  
  // 1. JUST CONNECTED
  if (deviceInRange && !wasDeviceInRange) {
    //Serial.println("Target Found! Moving...");
    myServo.attach(SERVO_PIN);
    myServo.write(75);        // Move forward (95 - 20)
    delay(400);              // Adjust this time for "one full turn"
    myServo.write(95);        // STOP
    delay(200);
    myServo.detach();         // LOCK
    wasDeviceInRange = true;
  } 
  
  // 2. JUST DISCONNECTED
  else if (!deviceInRange && wasDeviceInRange) {
    //Serial.println("Target Lost! Returning...");
    myServo.attach(SERVO_PIN);
    myServo.write(115);       // Move backward (95 + 20)
    delay(400);              // Match the timing above
    myServo.write(95);        // STOP
    delay(200);
    myServo.detach();         // LOCK
    wasDeviceInRange = false;
  }

  BLEDevice::getScan()->clearResults();
  delay(200); 
}