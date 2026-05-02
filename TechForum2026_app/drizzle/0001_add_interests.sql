CREATE TABLE "interests" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"color" varchar(16) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_interests" (
	"user_id" text NOT NULL,
	"interest_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_interests_user_id_interest_id_pk" PRIMARY KEY("user_id","interest_id")
);
--> statement-breakpoint
ALTER TABLE "speakers" ADD COLUMN "interest_ids" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_interest_id_interests_id_fk" FOREIGN KEY ("interest_id") REFERENCES "public"."interests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_interests_user_idx" ON "user_interests" USING btree ("user_id");