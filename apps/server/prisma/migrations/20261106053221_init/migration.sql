-- CreateTable
CREATE TABLE "messages" (
    "id" BIGINT NOT NULL,
    "channel_id" BIGINT NOT NULL,
    "author_id" BIGINT NOT NULL,
    "author_name" TEXT NOT NULL,
    "author_avatar_url" TEXT,
    "content" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "edited_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messages_channel_id_id_idx" ON "messages"("channel_id", "id");
