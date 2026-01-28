CREATE TABLE `tblUsers` (
  `UserID` INT,
  `Username` VARCHAR(100),
  `Password` VARCHAR(255),
  `Role` VARCHAR(32),
  `AssignedAmbulance` INT,
  PRIMARY KEY (`UserID`)
);

CREATE TABLE `tblAmbulance` (
  `UnitID` INT,
  `ShiftStatus ` BOOL,
  `ActiveCall (ID=0 for NotActive)` INT,
  `CaseID` INT,
  `ConnectedESP` INT,
  PRIMARY KEY (`UnitID`),
  FOREIGN KEY (`UnitID`)
      REFERENCES `tblUsers`(`AssignedAmbulance`)
);

CREATE TABLE `tblAssignments` (
  `ID` INT,
  `Name` VARCHAR(32),
  `Description` VARCHAR(500),
  `NeedsAccess` BOOL,
  PRIMARY KEY (`ID`),
  FOREIGN KEY (`ID`)
      REFERENCES `tblAmbulance`(`ActiveCall (ID=0 for NotActive)`)
);

CREATE TABLE `tblUserDevices` (
  `UserID` INT,
  `ConnectedDevice` INT,
  `Connected` BOOL,
  PRIMARY KEY (`UserID`)
);

CREATE TABLE `tblCases` (
  `CaseID` INT,
  `ESPID` VARCHAR(17),
  `Locked` BOOL,
  `Open??` BOOL,
  `Needed` BOOL,
  PRIMARY KEY (`CaseID`),
  FOREIGN KEY (`Needed`)
      REFERENCES `tblAssignments`(`NeedsAccess`),
  FOREIGN KEY (`CaseID`)
      REFERENCES `tblUserDevices`(`ConnectedDevice`),
  FOREIGN KEY (`CaseID`)
      REFERENCES `tblAmbulance`(`CaseID`)
);

CREATE TABLE `tblLogins` (
  `UserID` INT,
  `LastLoginTime` DATETIME,
  `LastLogoutTime` DATETIME,
  PRIMARY KEY (`UserID`),
  FOREIGN KEY (`UserID`)
      REFERENCES `tblUsers`(`UserID`)
);

CREATE TABLE `tblRoles` (
  `RoleID` INT,
  `Name` VARCHAR(32),
  `Description` VARCHAR(500),
  `HasPerms` BOOL,
  PRIMARY KEY (`RoleID`),
  FOREIGN KEY (`Name`)
      REFERENCES `tblUsers`(`Role`)
);

