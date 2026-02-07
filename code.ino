#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <ESP32Servo.h>
#include <Preferences.h>

Preferences preferences;
BLEUUID TARGET_UUID; // get this from web server
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
  preferences.begin("dispatch", false);
  
  // Default to a placeholder
  String lastSaved = preferences.getString("target_uuid", "00000000-0000-0000-0000-000000000000");
  TARGET_UUID = BLEUUID(lastSaved.c_str());

  // Start stopped
  myServo.attach(SERVO_PIN);
  myServo.write(95); // Specific STOP value
  delay(200);
  myServo.detach();  // Completely kill signal for silence

  BLEDevice::init("");
  BLEScan* pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setActiveScan(true);
}

void loop() {

  // CHECK FOR UPDATES FROM THE FRONTEND (VIA USB)
  if (Serial.available() > 0) {
    String incoming = Serial.readStringUntil('\n');
    incoming.trim();
    
    // DEBUG: Tell the dashboard exactly what was received
    Serial.print("DEBUG_RECEIVED: ");
    Serial.println(incoming);

    if (incoming.startsWith("ARM:")) {
        String uuidOnly = incoming.substring(4); 
        TARGET_UUID = BLEUUID(uuidOnly.c_str());
        preferences.putString("target_uuid", uuidOnly);
        Serial.println("SYNC_OK");
    }
  }

  // 2. SCANNING
  deviceInRange = false;
  // We don't need to print "Starting Scan" every 2 seconds
  BLEScanResults foundDevices = BLEDevice::getScan()->start(scanTime, false);
  
  // 1. JUST CONNECTED (Target found)
  if (deviceInRange && !wasDeviceInRange) {
    // IMPORTANT: Tell the Web App we found it!
    Serial.println("MATCH_FOUND"); 
    
    myServo.attach(SERVO_PIN);
    myServo.write(75);        
    delay(400);              
    myServo.write(95);        
    delay(200);
    myServo.detach();         
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
