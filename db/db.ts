import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { profilesTable } from "./schema/profiles-schema";
import { pendingProfilesTable } from "./schema/pending-profiles-schema";
import { productsTable } from "./schema/products-schema";
import { scriptsTable, videosTable, tiktokShopVideosTable, renderJobsTable, myLibraryTable, savedScriptsTable } from "./schema/library-schema";
import { faceProfilesTable } from "./schema/face-profiles-schema";
import { videoJobsTable } from "./schema/video-jobs-schema";
import { ugcCampaignsTable, ugcCampaignProductsTable } from "./schema/ugc-campaigns-schema";
import { nicheCacheTable } from "./schema/niche-cache-schema";
import { userSettingsTable } from "./schema/user-settings-schema";
import { brandProfilesTable } from "./schema/brand-profiles-schema";
import { connectedAccountsTable } from "./schema/connected-accounts-schema";
import { seoHashtagGroupsTable } from "./schema/seo-hashtag-groups-schema";
import {
  goalsTable,
  dailyTasksTable,
  goalReminderSettingsTable,
  goalWeeklyReviewsTable,
} from "./schema/goals-schema";
import { workflowProgressTable } from "./schema/workflow-progress-schema";
import { contentStudioWizardProgressTable } from "./schema/content-studio-wizard-schema";
import { contentStudioVideosTable } from "./schema/content-studio-videos-schema";
import { userContentSettingsTable } from "./schema/user-content-settings-schema";
import { brandVoiceTable } from "./schema/brand-voice-schema";
import { savedTemplatesTable } from "./schema/saved-templates-schema";
import { productHistoryTable } from "./schema/product-history-schema";
import { templatePacksTable } from "./schema/template-packs-schema";
import { brandCalendarTable } from "./schema/brand-calendar-schema";
import { dropScriptsTable } from "./schema/drop-scripts-schema";
import { launchChecklistTable } from "./schema/launch-checklist-schema";
import { brandWorkspacesTable } from "./schema/brand-workspaces-schema";
import { brandCampaignsTable } from "./schema/brand-campaigns-schema";
import { scheduledPostsTable } from "./schema/scheduled-posts-schema";
import { templateStudioSetupTable } from "./schema/template-studio-setup-schema";
import { coachSettingsTable, coachChatsTable } from "./schema/coach-settings-schema";
import { chatSummariesTable } from "./schema/chat-summaries-schema";
import { emailContactsTable, emailCampaignsTable } from "./schema/email-marketing-schema";
import { productSalesTable } from "./schema/product-sales-schema";
import { promoCodesTable } from "./schema/promo-codes-schema";
import {
  academyCoursesTable,
  academyModulesTable,
  academyLessonsTable,
  academyResourcesTable,
  academyProgressTable,
  academyCommunityPostsTable,
  academyCommunityCommentsTable,
  academyCommunityLikesTable,
} from "./schema/academy-schema";
import {
  conversationsTable,
  conversationParticipantsTable,
  messagesTable,
  communityReportsTable,
} from "./schema/messaging-schema";
import { creatorReferralsTable } from "./schema/creator-referrals-schema";
import { featuredCreditEventsTable } from "./schema/featured-credits-schema";
import { creatorScoresTable } from "./schema/creator-scores-schema";
import { featuredProductsTable } from "./schema/featured-products-schema";
import { referralsTable } from "./schema/referrals-schema";
import { productOrdersTable } from "./schema/product-orders-schema";
import { productReviewsTable } from "./schema/product-reviews-schema";
import { creatorFollowsTable } from "./schema/creator-follows-schema";
import { storeSettingsTable } from "./schema/store-settings-schema";

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
  userSettings: userSettingsTable,
  brandProfiles: brandProfilesTable,
  connectedAccounts: connectedAccountsTable,
  seoHashtagGroups: seoHashtagGroupsTable,
  workflowProgress: workflowProgressTable,
  contentStudioWizardProgress: contentStudioWizardProgressTable,
  contentStudioVideos: contentStudioVideosTable,
  userContentSettings: userContentSettingsTable,
  brandVoice: brandVoiceTable,
  savedTemplates: savedTemplatesTable,
  productHistory: productHistoryTable,
  templatePacks: templatePacksTable,
  brandCalendar: brandCalendarTable,
  dropScripts: dropScriptsTable,
  launchChecklist: launchChecklistTable,
  brandWorkspaces: brandWorkspacesTable,
  brandCampaigns: brandCampaignsTable,
  scheduledPosts: scheduledPostsTable,
  templateStudioSetup: templateStudioSetupTable,
  coachSettings: coachSettingsTable,
  chatSummaries: chatSummariesTable,
  coachChats: coachChatsTable,
  myLibrary: myLibraryTable,
  savedScripts: savedScriptsTable,
  emailContacts: emailContactsTable,
  emailCampaigns: emailCampaignsTable,
  productSales: productSalesTable,
  promoCodes: promoCodesTable,
  academyCourses: academyCoursesTable,
  academyModules: academyModulesTable,
  academyLessons: academyLessonsTable,
  academyResources: academyResourcesTable,
  academyProgress: academyProgressTable,
  academyCommunityPosts: academyCommunityPostsTable,
  academyCommunityComments: academyCommunityCommentsTable,
  academyCommunityLikes: academyCommunityLikesTable,
  conversations: conversationsTable,
  conversationParticipants: conversationParticipantsTable,
  messages: messagesTable,
  communityReports: communityReportsTable,
  // Rewards & Marketplace
  creatorReferrals: creatorReferralsTable,
  featuredCreditEvents: featuredCreditEventsTable,
  creatorScores: creatorScoresTable,
  featuredProducts: featuredProductsTable,
  referrals: referralsTable,
  productOrders: productOrdersTable,
  productReviews: productReviewsTable,
  creatorFollows: creatorFollowsTable,
  storeSettings: storeSettingsTable,
};

// Connection options tuned for Supabase pgBouncer (port 6543 pooler).
// prepare: false is REQUIRED for pgBouncer transaction mode.
// connect_timeout raised so cold-start connections don't fail prematurely.
const connectionOptions = {
  max: 5,                // pgBouncer handles the real pool; 5 is safe
  idle_timeout: 30,      // Keep connections alive longer to avoid cold starts
  connect_timeout: 15,   // Give pgBouncer time to hand off a connection
  prepare: false,        // REQUIRED: pgBouncer doesn't support prepared statements
  keepalive: true,       // Keep TCP alive between requests
  debug: false,
  connection: {
    application_name: "content-flywheel"
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
