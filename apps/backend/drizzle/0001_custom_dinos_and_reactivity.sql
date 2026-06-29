CREATE TABLE IF NOT EXISTS "custom_dinos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"species" text,
	"avatar_url" text,
	"blurb" text,
	"persona" text,
	"system_prompt" text NOT NULL,
	"model" text NOT NULL,
	"tool_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"accent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dino_reactivity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"dino_id" text NOT NULL,
	"level" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "custom_dinos_user_idx" ON "custom_dinos" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dino_reactivity_user_dino_idx" ON "dino_reactivity" USING btree ("user_id","dino_id");
