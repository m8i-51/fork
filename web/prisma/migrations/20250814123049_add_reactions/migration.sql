-- CreateTable
CREATE TABLE "Reaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomName" TEXT NOT NULL,
    "identity" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ReactionAggregate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "Reaction_roomName_createdAt_idx" ON "Reaction"("roomName", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReactionAggregate_roomName_type_key" ON "ReactionAggregate"("roomName", "type");
