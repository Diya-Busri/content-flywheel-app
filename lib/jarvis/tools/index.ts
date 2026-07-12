/**
 * Registers every Jarvis tool with the tool registry (lib/jarvis/tool-registry.ts).
 * Orchestration code must import this file (not individual tool files) so the
 * registry is guaranteed to be fully populated before a phase runs.
 *
 * Populated across Checkpoints 2–3:
 *   get_business_profile, get_product_details, get_brand_memory,
 *   get_existing_content, analyse_offer, create_content_strategy,
 *   generate_video_scripts, generate_carousel_copy, generate_email_campaign,
 *   save_content_campaign
 */
export {};
