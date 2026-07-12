/**
 * Registers every Jarvis tool with the tool registry (lib/jarvis/tool-registry.ts).
 * Orchestration code must import this file (not individual tool files) so the
 * registry is guaranteed to be fully populated before a phase runs.
 *
 * Populated (Checkpoint 2 — context reading + planning):
 *   get_business_profile, get_product_details, get_brand_memory,
 *   get_existing_content, analyse_offer, create_content_strategy
 *
 * Populated (Checkpoint 3 — generation):
 *   generate_video_scripts, generate_carousel_copy, generate_email_campaign
 *
 * Populated (Checkpoint 4 — saving):
 *   save_content_campaign
 */
import { registerTool } from "../tool-registry";
import { getBusinessProfileTool } from "./get-business-profile";
import { getProductDetailsTool } from "./get-product-details";
import { getBrandMemoryTool } from "./get-brand-memory";
import { getExistingContentTool } from "./get-existing-content";
import { analyseOfferTool } from "./analyse-offer";
import { createContentStrategyTool } from "./create-content-strategy";
import { generateVideoScriptsTool } from "./generate-video-scripts";
import { generateCarouselCopyTool } from "./generate-carousel-copy";
import { generateEmailCampaignTool } from "./generate-email-campaign";
import { saveContentCampaignTool } from "./save-content-campaign";

registerTool(getBusinessProfileTool);
registerTool(getProductDetailsTool);
registerTool(getBrandMemoryTool);
registerTool(getExistingContentTool);
registerTool(analyseOfferTool);
registerTool(createContentStrategyTool);
registerTool(generateVideoScriptsTool);
registerTool(generateCarouselCopyTool);
registerTool(generateEmailCampaignTool);
registerTool(saveContentCampaignTool);

export {};
