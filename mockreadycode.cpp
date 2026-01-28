#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <ESP32Servo.h> // You may need to install "ESP32Servo" library

// --- CONFIGURATION ---
const int SERVO_PIN = 18;       // Pin where Servo is connected
const int LOCK_POS = 0;         // Angle for Locked
const int UNLOCK_POS = 90;      // Angle for Unlocked
const int RSSI_THRESHOLD = -75; // How close? (Closer is closer to 0, e.g. -60)

// --- GLOBAL VARIABLES ---
Servo myservo;
BLEScan* pBLEScan;
String targetUUID = "";         // Will be set by PC
bool isSystemArmed = false;

// --- CALLBACK: What happens when a device is found ---
class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {
      // Only check devices if we are ARMED and looking for a specific UUID
      if (isSystemArmed && targetUUID != "") {
        
        // Check if this device has the Service UUID we are looking for
        if (advertisedDevice.haveServiceUUID() && 
            advertisedDevice.isAdvertisingService(BLEUUID(targetUUID.c_str()))) {
            
            // Check signal strength (Proximity)
            int rssi = advertisedDevice.getRSSI();
            if (rssi > RSSI_THRESHOLD) {
              Serial.print("MATCH_FOUND: RSSI ");
              Serial.println(rssi);
              unlockBox();
            }
        }
      }
    }
};

void setup() {
  Serial.begin(115200);
  
  // Setup Servo
  myservo.attach(SERVO_PIN);
  myservo.write(LOCK_POS); // Start locked

  // Setup BLE
  BLEDevice::init("");
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  
  // CRITICAL FOR IPHONE: Active Scan = True
  // This tells ESP32 to ask the phone "Do you have more data?" (Scan Response)
  pBLEScan->setActiveScan(true); 
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);
  
  Serial.println("SYSTEM_READY");
}

void loop() {
  // 1. LISTEN FOR COMMANDS FROM PC
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim(); // Remove whitespace
    
    // Command format: "ARM:1234-5678-..."
    if (command.startsWith("ARM:")) {
      targetUUID = command.substring(4); // Extract UUID after "ARM:"
      isSystemArmed = true;
      Serial.println("STATUS: ARMED_WAITING_FOR_PARAMEDIC");
    }
    
    // Command: "DISARM"
    else if (command == "DISARM") {
      isSystemArmed = false;
      targetUUID = "";
      myservo.write(LOCK_POS);
      Serial.println("STATUS: DISARMED");
    }
  }

  // 2. IF ARMED, SCAN FOR PHONE
  if (isSystemArmed) {
    // Scan for 1 second, then stop and check serial again
    pBLEScan->start(1, false);
    pBLEScan->clearResults(); 
  }
}

// --- HELPER: Unlock Logic ---
void unlockBox() {
  myservo.write(UNLOCK_POS); // Open
  Serial.println("ACTION: UNLOCKED");
  
  delay(5000); // Keep open for 5 seconds
  
  myservo.write(LOCK_POS);   // Relock
  Serial.println("ACTION: RELOCKED");
  
  // Optional: Disarm system after successful entry?
  // isSystemArmed = false; 
}
