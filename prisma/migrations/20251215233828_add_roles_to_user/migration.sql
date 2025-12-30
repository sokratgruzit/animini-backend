-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'AUTHOR', 'CRITIC');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "roles" "Role"[] DEFAULT ARRAY['USER']::"Role"[];
