-- CreateTable
CREATE TABLE "Presence" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomName" TEXT NOT NULL,
    "identity" TEXT NOT NULL,
    "name" TEXT,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Room" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "hostIdentity" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Room" ("createdAt", "hostIdentity", "id", "name") SELECT "createdAt", "hostIdentity", "id", "name" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
CREATE UNIQUE INDEX "Room_name_key" ON "Room"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Presence_roomName_lastSeen_idx" ON "Presence"("roomName", "lastSeen");

-- CreateIndex
CREATE UNIQUE INDEX "Presence_roomName_identity_key" ON "Presence"("roomName", "identity");
