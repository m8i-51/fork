-- CreateTable
CREATE TABLE "Room" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "hostIdentity" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Ban" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomName" TEXT NOT NULL,
    "identity" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Room_name_key" ON "Room"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Ban_roomName_identity_key" ON "Ban"("roomName", "identity");
