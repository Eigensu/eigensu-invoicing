ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invite_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invite_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_invite_token_unique" UNIQUE("invite_token");