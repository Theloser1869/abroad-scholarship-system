-- CreateEnum
CREATE TYPE "PortalLinkStatus" AS ENUM ('NONE', 'INVITED', 'ACTIVE', 'REVOKED');

-- DropIndex
DROP INDEX "student_contacts_portal_user_id_key";

-- AlterTable
ALTER TABLE "student_contacts" ADD COLUMN     "portal_status" "PortalLinkStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "revoked_at" TIMESTAMP(3),
ADD COLUMN     "revoked_by_id" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "visible_to_student" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "parent_invitations" (
    "id" TEXT NOT NULL,
    "student_contact_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "invited_by_id" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parent_invitations_token_hash_key" ON "parent_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "parent_invitations_student_contact_id_idx" ON "parent_invitations"("student_contact_id");

-- CreateIndex
CREATE INDEX "student_contacts_portal_user_id_idx" ON "student_contacts"("portal_user_id");

-- AddForeignKey
ALTER TABLE "parent_invitations" ADD CONSTRAINT "parent_invitations_student_contact_id_fkey" FOREIGN KEY ("student_contact_id") REFERENCES "student_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_invitations" ADD CONSTRAINT "parent_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

