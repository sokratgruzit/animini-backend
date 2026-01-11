/*
  Warnings:

  - You are about to drop the column `collectedFunds` on the `Series` table. All the data in the column will be lost.
  - You are about to drop the column `votesRequired` on the `Series` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Series" DROP COLUMN "collectedFunds",
DROP COLUMN "votesRequired",
ADD COLUMN     "totalEarnings" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "collectedFunds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isReleased" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "votesRequired" INTEGER NOT NULL DEFAULT 1000;
