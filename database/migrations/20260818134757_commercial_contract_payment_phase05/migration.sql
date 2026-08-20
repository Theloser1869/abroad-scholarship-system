-- AlterTable
ALTER TABLE "contract_amendments" ADD COLUMN     "after" JSONB,
ADD COLUMN     "before" JSONB;

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "activated_at" TIMESTAMP(3),
ADD COLUMN     "approval_threshold" DECIMAL(14,2),
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "liquidated_at" TIMESTAMP(3),
ADD COLUMN     "merge_field_values" JSONB,
ADD COLUMN     "sent_at" TIMESTAMP(3),
ADD COLUMN     "submitted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "receipt_document_id" TEXT,
ADD COLUMN     "refund_reason" TEXT,
ADD COLUMN     "refunded_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "refunded_at" TIMESTAMP(3),
ADD COLUMN     "refunded_by_id" TEXT,
ADD COLUMN     "waived_at" TIMESTAMP(3),
ADD COLUMN     "waived_by_id" TEXT,
ADD COLUMN     "waived_reason" TEXT;

-- CreateTable
CREATE TABLE "contract_review_links" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "viewed_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_review_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_review_links_token_hash_key" ON "contract_review_links"("token_hash");

-- CreateIndex
CREATE INDEX "contract_review_links_contract_id_idx" ON "contract_review_links"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");

-- AddForeignKey
ALTER TABLE "contract_review_links" ADD CONSTRAINT "contract_review_links_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

