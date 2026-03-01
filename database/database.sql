CREATE TABLE `tblUsers` (
  `UserID` varchar(36),
  `Username` VARCHAR(100),
  `Password` VARCHAR(255),
  `Role` VARCHAR(32),
  `AssignedAmbulance` INT,
  `ServiceUUID` VARCHAR(255),
  PRIMARY KEY (`UserID`)
);

CREATE TABLE `tblAmbulance` (
  `UnitID` INT,
  `ShiftStatus` BOOLEAN,
  `ActiveCall (ID=0 for NotActive)` INT,
  `CaseID` INT,
  `ConnectedESP` INT,
  PRIMARY KEY (`UnitID`)
);

CREATE TABLE `tblAssignments` (
  `ID` INT,
  `Name` VARCHAR(32),
  `Description` VARCHAR(500),
  `NeedsAccess` BOOLEAN,
  PRIMARY KEY (`ID`)
);

CREATE TABLE `tblUserDevices` (
  `UserID` INT,
  `ConnectedDevice` INT,
  `Connected` BOOLEAN,
  PRIMARY KEY (`UserID`)
);

CREATE TABLE `tblCases` (
  `CaseID` INT,
  `ESPID` VARCHAR(17),
  `Locked` BOOLEAN,
  `Open??` BOOLEAN,
  `Needed` BOOLEAN,
  PRIMARY KEY (`CaseID`)
);

CREATE TABLE `tblLogins` (
  `SessionID` INT AUTO_INCREMENT,
  `UserID` VARCHAR(36),
  `LastLoginTime` DATETIME,
  `LastLogoutTime` DATETIME,
  PRIMARY KEY (`SessionID`)
);

CREATE TABLE `tblRoles` (
  `RoleID` INT,
  `Name` VARCHAR(32),
  `Description` VARCHAR(500),
  `HasPerms` BOOLEAN,
  PRIMARY KEY (`RoleID`)
);

CREATE TABLE `tblOverrideLogs` (
  `LogID` INT AUTO_INCREMENT,
  `UnitID` INT,
  `OverrideTime` DATETIME,
  PRIMARY KEY (`LogID`)
);

CREATE TABLE `tblFailedLogins` (
  `LogID` INT AUTO_INCREMENT,
  `UserID` VARCHAR(36),
  `TimeStamp` DATETIME,
  PRIMARY KEY (`LogID`)
);

CREATE TABLE `tblCallLogs` (
  `LogID` INT AUTO_INCREMENT,
  `ActiveCall` INT,
  `TimeStamp` DATETIME,
  PRIMARY KEY (`LogID`)
);