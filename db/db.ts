import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { profilesTable } from "./schema/profiles-schema";
import { pendingProfilesTable } from "./schema/pending-profiles-schema";
import { productsTable } from "./schema/products-schema";
import { scriptsTable, videosTable, tiktokShopVideosTable, renderJobsTable } from "./schema/library-schema";
import { faceProfilesTable } from "./schema/face-profiles-schema";
import { videoJobsTable } from "./schema/video-jobs-schema";
import { ugcCampaignsTable, ugcCampaignProductsTable } from "./schema/ugc-campaigns-schema";
import { nicheCacheTable } from "./schema/niche-cache-schema";
import {
  goalsTable,
  dailyTasksTable,
  goalReminderSettingsTable,
  goalWeeklyReviewsTable,
} from "./schema/goals-schema";

// Define the schema properly
const schema = {
  profiles: profilesTable,
  pendingProfiles: pendingProfilesTable,
  products: productsTable,
  scripts: scriptsTable,
  videos: videosTable,
  tiktokShopVideos: tiktokShopVideosTable,
  renderJobs: renderJobsTable,
  goals: goalsTable,
  dailyTasks: dailyTasksTable,
  goalReminderSettings: goalReminderSettingsTable,
  goalWeeklyReviews: goalWeeklyReviewsTable,
  faceProfiles: faceProfilesTable,
  videoJobs: videoJobsTable,
  ugcCampaigns: ugcCampaignsTable,
  ugcCampaignProducts: ugcCampaignProductsTable,
  nicheCache: nicheCacheTable,
};

// Add connection options with improved timeout and retry settings for Vercel environment
const connectionOptions = {
  max: 3,               // Lower max connections to prevent overloading
  idle_timeout: 10,     // Shorter idle timeout
  connect_timeout: 5,   // Shorter connect timeout
  prepare: false,       // Disable prepared statements
  keepalive: true,      // Keep connections alive
  debug: false,         // Disable debug logging in production
  connection: {
    application_name: "whop-boilerplate" // Identify app in Supabase logs
  }
};

// Create a postgres client with optimized connection options
export const client = postgres(process.env.DATABASE_URL!, connectionOptions);

// Create a drizzle client
export const db = drizzle(client, { schema });

// Export a function to check the database connection health
export async function checkDatabaseConnection(): Promise<{ ok: boolean, message: string }> {
  try {
    // Attempt a simple query with a shorter timeout
    const startTime = Date.now();
    await Promise.race([
      client`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Connection timeout")), 2000))
    ]);
    const duration = Date.now() - startTime;
    return { 
      ok: true, 
      message: `Database connection successful (${duration}ms)` 
    };
  } catch (error) {
    console.error("Database connection check failed:", error);
    
    // Return detailed error information
    const message = error instanceof Error 
      ? `Connection error: ${error.message}`
      : "Unknown connection error";
      
    return { ok: false, message };
  }
}

// Function to check and log connection status
export async function logDatabaseConnectionStatus(): Promise<void> {
  try {
    const status = await checkDatabaseConnection();
    if (status.ok) {
      console.log(status.message);
    } else {
      console.error(status.message);
    }
  } catch (error) {
    console.error("Failed to check database connection:", error);
  }
}
