-- CreateTable
CREATE TABLE "business_id_sequences" (
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_id_sequences_pkey" PRIMARY KEY ("prefix","year")
);
