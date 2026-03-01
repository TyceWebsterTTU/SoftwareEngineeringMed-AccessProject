#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <ESP32Servo.h>
#include <Preferences.h>

Preferences preferences;
String targetUuidStr = ""; // We will use String comparison
const int SERVO_PIN = 13;
const int BUTTON_PIN = 27;    
const int LED_PIN = 2; // Usually the built-in LED on ESP32
const int RSSI_THRESHOLD = -80;
int scanTime = 1; 
unsigned long lastLogAttempt = 0;

Servo myServo;
bool deviceInRange = false;
bool wasDeviceInRange = false; 
bool armed = false;

// Volatile variables are needed because they are changed inside an interrupt (ISR)
volatile bool overrideOccurred = false;
volatile bool logDelivered = true;

// New flag to lock the system out until a reset is sent
bool inOverrideMode = false; 

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

// Interrupt Service Routine for the button
void IRAM_ATTR handleOverride() {
  overrideOccurred = true;
  logDelivered = false; 
  digitalWrite(LED_PIN, HIGH);
}

void operateServo(bool open) {
    myServo.attach(SERVO_PIN);
    myServo.write(open ? 75 : 115);
    delay(400);
    myServo.write(95);
    delay(200);
    myServo.detach();
}

void setup() {
  Serial.begin(115200);
  ESP32PWM::allocateTimer(0);
  delay(1000); 
  
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW); // Ensure LED is off at startup
  
  // Attach the interrupt to the button pin
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), handleOverride, FALLING);
  
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
  // 1. HANDLE BUTTON OVERRIDE (Triggered by ISR)
  if (overrideOccurred) {
    inOverrideMode = true;         // Lock out the scanner
    digitalWrite(LED_PIN, HIGH);   // Turn on the warning LED
    operateServo(true);            // Open the servo
    armed = false;                 // Disarm the system
    overrideOccurred = false;      // Reset the trigger flag
  }

  // 2. HANDLE SERIAL COMMANDS
  if (Serial.available() > 0) {
    String incoming = Serial.readStringUntil('\n');
    incoming.trim();

    if (incoming == "LOG_ACK") {
      logDelivered = true;
      Serial.println("STATUS:LOG_CLEARED");
    }
    else if (incoming == "ADMIN_RESET_CMD") {
    inOverrideMode = false;      
    overrideOccurred = false;    // Clear any pending button presses
    armed = false;               // Disarm so it doesn't immediately scan again
    wasDeviceInRange = false;    // Reset tracking
    logDelivered = true;         // Stop the "Override Pressed" serial spam
    
    digitalWrite(LED_PIN, LOW);  // Turn off LED
    Serial.println("STATUS:SYSTEM_RESET_SUCCESSFUL");
    Serial.println("INFO:System disarmed and cleared.");
  }
    else if (incoming.startsWith("ARM:")) {
      targetUuidStr = incoming.substring(4);
      targetUuidStr.trim();
      preferences.putString("target_uuid", targetUuidStr);
      armed = true;
      Serial.print("CONFIRM_ARM:");
      Serial.println(targetUuidStr);
    }
    else if (incoming == "DISARM") {
      armed = false;
      if (wasDeviceInRange) {
        operateServo(false);
      }
      wasDeviceInRange = false;
      Serial.println("DISARMED");
    }
  }

  // 3. BLE SCANNING — ONLY WHEN ARMED AND NOT LOCKED OUT
  if (armed && !inOverrideMode) {
    deviceInRange = false;

    BLEDevice::getScan()->start(scanTime, false);

    if (deviceInRange && !wasDeviceInRange) {
      Serial.println("MATCH_FOUND");
      operateServo(true);
      wasDeviceInRange = true;
    }
    else if (!deviceInRange && wasDeviceInRange) {
      Serial.println("TARGET_LOST");
      operateServo(false);
      wasDeviceInRange = false;
    }

    BLEDevice::getScan()->clearResults();
  }

  // 4. LOG DELIVERY RETRY & LOOP PACING
  if (!logDelivered) {
    if (millis() - lastLogAttempt > 1000) { // Only print once per second
      Serial.println("LOG:OVERRIDE_PRESSED");
      lastLogAttempt = millis();
    }
  } else {
    delay(100); 
    }
  }