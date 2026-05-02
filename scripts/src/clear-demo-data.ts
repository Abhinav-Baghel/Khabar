import { pool } from "@workspace/db";

async function main() {
  if (process.env.CONFIRM_CLEAR_DEMO !== "YES") {
    throw new Error(
      "Refusing to clear DB without CONFIRM_CLEAR_DEMO=YES. This will delete ALL rows.",
    );
  }

  // Keep schema intact; remove all seeded/demo data.
  // CASCADE clears dependent rows safely.
  await pool.query(`
    TRUNCATE TABLE
      post_ai_analyses,
      post_media,
      saved_posts,
      post_votes,
      reputation_events,
      posts,
      users
    RESTART IDENTITY CASCADE;
  `);

  // eslint-disable-next-line no-console
  console.log("Cleared all rows from users/posts-related tables.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });

