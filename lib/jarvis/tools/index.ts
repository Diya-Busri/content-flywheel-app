/**
 * Registers every Jarvis tool with the tool registry (lib/jarvis/tool-registry.ts).
 * Orchestration code must import this file (not individual tool files) so the
 * registry is guaranteed to be fully populated before a phase runs.
 *
 * Populated so far (Checkpoint 2 — context reading + planning):
 *   get_business_profile, get_product_details, get_brand_memory,
 *   get_existing_content, analyse_offer, create_content_strategy
 *
 * Still to come (Checkpoint 3):
 *   generate_video_scripts, generate_carousel_copy, generate_email_campaign,
 *   save_content_campaign
 */
import { registerTool } from "../tool-registry";
import { getBusinessProfileTool } from "./get-business-profile";
import { getProductDetailsTool } from "./get-product-details";
import { getBrandMemoryTool } from "./get-brand-memory";
import { getExistingContentTool } from "./get-existing-content";
import { analyseOfferTool } from "./analyse-offer";
import { createContentStrategyTool } from "./create-content-strategy";

registerTool(getBusinessProfileTool);
registerTool(getProductDetailsTool);
registerTool(getBrandMemoryTool);
registerTool(getExistingContentTool);
registerTool(analyseOfferTool);
registerTool(createContentStrategyTool);

export {};
