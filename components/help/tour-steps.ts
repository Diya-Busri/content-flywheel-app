/**
 * App tour step definitions for each page.
 * Each step targets a CSS selector and shows a title + description tooltip.
 */

export type TourStep = {
  /** CSS selector of the element to highlight */
  element?: string;
  /** Tooltip title */
  title: string;
  /** Tooltip description */
  description: string;
  /** Where to position the tooltip */
  side?: "top" | "bottom" | "left" | "right";
};

export type PageTour = {
  page: string;       // matches pathname (startsWith)
  label: string;
  steps: TourStep[];
};

export const PAGE_TOURS: PageTour[] = [
  // ─── Dashboard Home ────────────────────────────────────────────────────────
  {
    page: "/dashboard",
    label: "Dashboard Home",
    steps: [
      {
        title: "👋 Welcome to Content Flywheel!",
        description: "This is your command centre. Everything you need to create, manage, and sell with AI video lives here. This tour will walk you through each section on this page — use the Next button to go step by step.",
      },
      {
        element: ".sidebar",
        side: "right",
        title: "🗂️ Sidebar — Your Main Navigation",
        description: "Every tool lives in the sidebar on the left. Click any item to switch between AI Coach, Digital Products, TikTok Shop, My Library, Video Timeline, Template Studio, and more. The sidebar collapses using the arrow icon at the top if you need more space.",
      },
      {
        element: "[data-tour='quick-stats']",
        side: "bottom",
        title: "📊 Quick Stats — Your Progress at a Glance",
        description: "These two cards show how many Digital Products and TikTok Shop videos you've created so far. The numbers update automatically as you create more content — a quick way to track your output.",
      },
      {
        element: "[data-tour='quick-actions']",
        side: "top",
        title: "⚡ Quick Actions — 3 Main Workflows",
        description: "These are your 3 primary content flows. 'Create Digital Product Video' takes you through building a full video for your ebook, course or template. 'Generate TikTok Shop Video' is for physical products sold via TikTok. 'Check Script Compliance' runs any script through a compliance checker before you post. Click any card to start that flow.",
      },
    ],
  },

  // ─── AI Coach ─────────────────────────────────────────────────────────────
  {
    page: "/dashboard/ai-coach",
    label: "AI Coach",
    steps: [
      {
        title: "🤖 AI Coach — Your Personal Content Strategist",
        description: "The AI Coach is a powerful conversational tool for generating scripts, strategies, pricing advice, and content plans. It works like ChatGPT but is trained specifically on content creation, digital product selling, and social media growth. You can have multiple separate sessions (conversations) and they're all saved.",
      },
      {
        element: ".sidebar",
        side: "right",
        title: "💬 Sessions Panel",
        description: "On the left you'll see your saved sessions (conversations). Each session is a separate thread. Click the '+' icon to start a fresh chat, or click any past session to pick up where you left off. You can pin important sessions to the top and rename them.",
      },
      {
        title: "🧠 Coach Modes — Choose Your Focus",
        description: "At the top of the chat area you can switch between 6 coach modes: Business Strategy, Finance & Pricing, Content & Marketing, YouTube Strategy, Goal Setting, and General Chat. Each mode adjusts the AI's expertise — for example 'YouTube Strategy' focuses on scripting long-form content and audience building.",
      },
      {
        title: "🎬 YouTube Strategy Mode — Special Features",
        description: "If you select 'YouTube Strategy' mode, the AI generates a full multi-scene video script with a hook, body, and CTA. You'll see an 'Action Panel' appear with buttons to Save Script to Library, which then lets you load it into the Video Timeline and compile a full MP4.",
      },
      {
        title: "💡 What to Ask the AI Coach",
        description: "Some powerful prompts to try: 'Write me a viral TikTok script for my [product name]', 'What price should I charge for my digital planner?', 'Give me 10 content ideas for my niche', 'Review this script and suggest improvements', or 'Create a 30-day content calendar for Instagram'. The AI remembers the context within each session.",
      },
    ],
  },

  // ─── Digital Products ─────────────────────────────────────────────────────
  {
    page: "/dashboard/digital-products",
    label: "Digital Products",
    steps: [
      {
        title: "📦 Digital Products — Your Product Hub",
        description: "This section is where you create and manage your digital products — ebooks, online courses, templates, planners, journals, checklists, and more. For each product you can generate a complete video marketing suite including scene breakdowns, AI-generated images, animated clips, and a compiled MP4.",
      },
      {
        title: "➕ Creating Your First Product",
        description: "Click 'New Digital Product' (or the + button) to add a product. You'll enter a product name (e.g. 'Passive Income Planner') and format (Ebook, Course, Template, etc.). The AI fills in a description and niche automatically, but you can edit everything.",
      },
      {
        title: "📋 Product List — Your Inventory",
        description: "Each product appears as a card showing its name, format, status, and a preview image if one has been generated. Click 'Edit' to update the product details. Click 'View Guide' to enter the full Video Guide for that product where all the video magic happens.",
      },
      {
        title: "🗺️ The Video Guide — Inside Each Product",
        description: "The Video Guide is where you turn a product into a video. It has 5 key sections: (1) Script — the AI writes a full voiceover script. (2) Scenes — breaks the script into individual scenes with image prompts. (3) Images — generates AI visuals for each scene. (4) Video Timeline — animates everything and adds voiceover. (5) Make Full MP4 — compiles the final downloadable video.",
      },
      {
        title: "🎬 From Product to Posted Video — The Full Flow",
        description: "Here's the complete process: Create product → Open Video Guide → Generate script → Generate scenes → Click 'Generate Image' on each scene → Click 'Animate scenes & open Video Timeline' → Add voiceover in Timeline → Click 'Make full MP4' → Download and post. The whole thing can take as little as 10 minutes.",
      },
    ],
  },

  // ─── Script Checker ─────────────────────────────────────────────────────
  {
    page: "/dashboard/script-checker",
    label: "Script Checker",
    steps: [
      {
        title: "✅ Script Checker — Avoid Getting Banned or Shadowbanned",
        description: "Before you post any video, run the script through the Script Checker. It analyses your text against each platform's content policies and flags banned phrases, misleading claims, missing disclaimers, and weak hooks — all the things that can get your video removed or suppressed.",
      },
      {
        element: "[data-tour='checker-platform']",
        side: "bottom",
        title: "📱 Step 1: Choose Your Platform",
        description: "Select where you plan to post. TikTok has the strictest rules (no health claims, no 'guaranteed results', etc). Instagram is slightly more relaxed. YouTube is stricter on medical and financial content. Select 'All platforms' to run it against the combined strictest rules — useful if you're posting everywhere.",
      },
      {
        element: "[data-tour='checker-input']",
        side: "bottom",
        title: "📝 Step 2: Paste Your Script",
        description: "Paste the full video script (or just the voiceover text) into the text area. You can also click 'Try sample script (known violations)' to see an example of what a flagged script looks like — it contains phrases like 'guaranteed cure' and undisclosed affiliate links that would get you penalised. The checker handles up to 5,000 characters.",
      },
      {
        title: "📸 Step 3: Upload Your Visual (Optional)",
        description: "If your script references on-screen visuals (like showing a product label), you can upload an image. The AI will consider the visual content when checking compliance — for example it can flag if your thumbnail makes a health claim that violates platform rules.",
      },
      {
        title: "🔍 Check Compliance",
        description: "Click the orange 'Check Compliance' button. The AI analyses your script in about 10-15 seconds. It will highlight specific lines with violations in red and show you the exact reason for each flag.",
      },
      {
        element: "[data-tour='checker-result']",
        side: "top",
        title: "📊 Reading Your Results",
        description: "You'll see two versions side by side: your original script (with violations highlighted in red) and a compliant rewrite (editable, shown in green). Each violation has an explanation. You can edit the compliant version directly, then either Copy it, Download it as a text file, or Save it to My Library as a script you can load into the Video Timeline.",
      },
    ],
  },

  // ─── Goal Tracker ─────────────────────────────────────────────────────────
  {
    page: "/dashboard/goals",
    label: "Goal Tracker",
    steps: [
      {
        title: "🎯 Goal Tracker — Stay Consistent and Accountable",
        description: "The Goal Tracker helps you set and stick to content creation goals. Most creators fail because they don't have a system — this gives you one. You set a goal with a daily task, and it tracks your streak so you build momentum.",
      },
      {
        title: "➕ Creating a Goal",
        description: "Click 'Create Goal' or the + button. Give your goal a title (e.g. 'Post 20 TikToks in 30 days'), set the target date, and define the daily task (e.g. 'Film and post one TikTok video'). The tracker breaks your goal into daily steps automatically.",
      },
      {
        title: "🔥 Tracking Your Streak",
        description: "Each day you complete a task you check it off. Your streak counter increases. The tracker shows your current streak, longest streak, and percentage completion. If you miss a day your streak resets — which is the psychological hook that keeps you showing up.",
      },
      {
        title: "📋 Submitting Proof",
        description: "Some goals require proof of completion (like a screenshot of your posted video or sales stats). Click 'Submit Proof' on the daily task to upload your evidence. This keeps you honest and gives you a record of everything you've created.",
      },
      {
        title: "📊 Your Goal Dashboard",
        description: "Active goals show progress bars, streak flames, and completion percentages. Completed goals get a trophy icon and move to the 'Completed' section. You can archive goals you no longer need, or delete them. The AI Coach can reference your goals to keep its strategy advice aligned with your targets.",
      },
    ],
  },

  // ─── My Library ───────────────────────────────────────────────────────────
  {
    page: "/dashboard/library",
    label: "My Library",
    steps: [
      {
        title: "📚 My Library — Everything You've Ever Created",
        description: "My Library is your content archive. Every digital product, AI Coach script, video, and compiled MP4 you create gets saved here automatically. It's also where you store voiceovers — they need to be here (as public URLs) for the 'Make full MP4' button to work.",
      },
      {
        element: "[data-tour='library-tabs']",
        side: "bottom",
        title: "🗂️ Filter Tabs — Find Exactly What You Need",
        description: "Use the tabs to filter your library by type. 'All Items' shows everything. 'Digital Products' shows your product cards. 'Scripts' shows AI Coach scripts you've saved. 'My Videos' shows compiled MP4s and video timeline projects. 'Template Packs' shows your Template Studio exports. 'Trash' lets you recover deleted items within 30 days.",
      },
      {
        element: "[data-tour='library-search']",
        side: "bottom",
        title: "🔍 Search — Find Anything Instantly",
        description: "Type any keyword to search across all your library items. It searches by title, product name, niche, script content, and metadata. For example search 'planner' to find all content related to your planner products.",
      },
      {
        title: "📁 What You Can Do With Library Items",
        description: "Hover over any item to see action options. Products have 'Edit' and 'View Guide'. Scripts have 'Load in Timeline' to open in the Video Timeline editor. Videos have a 'Download' button for MP4s and a preview player. You can also duplicate items, move them to trash, or share a link.",
      },
      {
        title: "🎙️ Voiceovers — The Key to Full MP4 Export",
        description: "When you generate a voiceover in the Video Guide (inside a Digital Product), it uploads to your library as a public URL. This URL is what 'Make full MP4' uses. If you see 'Public voiceover URLs required', it means you need to generate voiceovers from the Video Guide's voiceover section first — not just record locally.",
      },
    ],
  },

  // ─── Video Timeline ────────────────────────────────────────────────────────
  {
    page: "/dashboard/video-timeline",
    label: "Video Timeline",
    steps: [
      {
        title: "🎬 Video Timeline — Your Video Editor",
        description: "The Video Timeline is where you assemble your final video. Think of it like a simplified video editor — you have scenes lined up in sequence, each with its own media, text overlays, and duration. You can load scenes from a saved AI Coach script, or build manually scene by scene.",
      },
      {
        title: "📂 Loading Scenes from a Script",
        description: "If you've saved a YouTube script in AI Coach, click 'Load from Library' in the timeline. Select your saved script and it pre-fills all the scenes with the script text. Then you can generate images or add video clips to each scene individually.",
      },
      {
        title: "🖼️ Scene Tracks — Building Each Scene",
        description: "Each row in the timeline is a scene. Click a scene to select it, then use the panel on the right to: upload or generate an image/video for the background, write a text overlay, set the scene duration in seconds, and pick a transition effect (fade, slide, zoom, etc.).",
      },
      {
        title: "🎙️ Voiceover Track",
        description: "The audio track sits below your scenes. Click 'Add Voiceover' to upload an MP3 or WAV file. You can also generate a voiceover with ElevenLabs directly from this panel — pick a voice and click generate. Once uploaded to your library it becomes a public URL that the MP4 compiler can use.",
      },
      {
        title: "⏱️ Timeline Ruler and Playback",
        description: "The ruler at the top shows timecodes. The red playhead shows your current position. Drag it to scrub through your timeline. Use the Play/Pause button to preview. Zoom In/Out changes how much of the timeline is visible. Drag scene edges to resize durations.",
      },
      {
        title: "⬇️ Exporting Your Video",
        description: "When you're happy with your timeline, click 'Compile to MP4'. The server renders all your scenes (Ken Burns motion on images, real video clips trimmed to length), adds your voiceover, and optional background music, then delivers a downloadable MP4. This usually takes 2-5 minutes depending on scene count.",
      },
    ],
  },

  // ─── Template Studio ──────────────────────────────────────────────────────
  {
    page: "/dashboard/template-studio",
    label: "Template Studio",
    steps: [
      {
        title: "🎨 Template Studio — Viral Videos Without Editing",
        description: "Template Studio creates ready-to-post videos from proven viral formats. No editing, no timeline — just pick a template, fill in your topic, and export. It works for both short-form (9:16 for TikTok/Reels) and long-form (16:9 for YouTube).",
      },
      {
        element: "[data-tour='template-steps']",
        side: "bottom",
        title: "🔢 3-Step Workflow",
        description: "Template Studio uses a simple 3-step flow. Step 1: Setup — choose your template type and fill in the topic. Step 2: Slides — the AI generates the content and shows you a live preview. Step 3: Get Captions & Publish — copy captions, hashtags, and download your MP4.",
      },
      {
        element: "[data-tour='template-type-select']",
        side: "bottom",
        title: "📋 Step 1: Choose Your Template Type",
        description: "The dropdown has 10+ template types: AI Story (emotional narrative video), Stickman Whiteboard (animated explainer), Viral Templates (Would You Rather, Quiz), Kinetic Typography (bold animated text with voiceover), Brand Story, and more. Each type has its own form below — they adapt automatically when you switch.",
      },
      {
        element: "[data-tour='template-format']",
        side: "bottom",
        title: "📐 Short-form vs Long-form",
        description: "⚡ Short-form (9:16) = vertical video for TikTok and Instagram Reels. Slides are 3-5 seconds each, scene count is 5-10. 🎬 Long-form (16:9) = widescreen for YouTube. Slides are longer, scene count goes up to 20, and the layout switches to landscape with different visual designs. Always match this to where you're posting.",
      },
      {
        title: "✨ Generating Your Content",
        description: "Fill in your topic (be specific — 'Why introverts make the best entrepreneurs' beats just 'introvert content'). Then click 'Generate'. The AI writes all the slide text, picks accent words to highlight in colour, and shows you a live animated preview. You can regenerate as many times as you want.",
      },
      {
        element: "[data-tour='template-export']",
        side: "top",
        title: "⬇️ Exporting Your MP4",
        description: "Click 'Export MP4' when you're happy with the preview. For Kinetic Typography, this also generates an ElevenLabs voiceover automatically — no extra steps. For Viral Templates, you can optionally add a voiceover voice in the settings. Export takes 30-90 seconds. The file downloads directly and is also saved to My Library.",
      },
    ],
  },

  // ─── TikTok Shop ──────────────────────────────────────────────────────────
  {
    page: "/dashboard/tiktok-shop",
    label: "TikTok Shop",
    steps: [
      {
        title: "🛍️ TikTok Shop — Turn Product Links Into Videos",
        description: "If you sell on TikTok Shop (or promote affiliate products), this tool generates a complete video brief from just a product URL. Paste the link, and the AI reads the product name, description, and price to write a viral TikTok script optimised for shop conversions.",
      },
      {
        title: "🔗 Step 1: Paste a Product URL",
        description: "Copy the URL from any TikTok Shop product page (it usually looks like shop.tiktok.com/product/...) and paste it into the product URL field. You can also use Amazon or Shopify product links. The AI extracts product details automatically.",
      },
      {
        title: "📝 Step 2: Choose Your Video Style",
        description: "Pick from several video styles: 'Product Demo' (show the product in use), 'Problem/Solution' (hook with a pain point), 'Social Proof' (before/after or testimonial style), or 'Fast Facts' (rapid feature rundown). Each style produces a different script structure.",
      },
      {
        title: "🎬 What You Get After Generating",
        description: "You'll receive: a full scene-by-scene video script, AI image prompts for each scene, suggested text overlays, recommended hashtags, and a caption for the post. You can also generate AI images directly and compile everything into a downloadable MP4.",
      },
      {
        title: "🏪 TikTok Shop Compliance",
        description: "TikTok Shop has strict rules about what you can and can't say about products — especially health, results claims, and pricing. The scripts are written to avoid common violations, but always run the final script through the Script Checker before posting.",
      },
    ],
  },
];

// ─── Live Demo Tours (shown after full app tour completes) ────────────────────
// These are action-oriented — they tell the user exactly what to click/type.

export type LiveDemo = {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  page: string;
  steps: TourStep[];
};

export const LIVE_DEMOS: LiveDemo[] = [
  {
    id: "digital-product",
    emoji: "📦",
    title: "Build a Digital Product Video",
    subtitle: "Watch the full flow — from product creation to compiled MP4",
    page: "/dashboard/digital-products",
    steps: [
      {
        title: "🚀 Live Demo: Digital Product → MP4",
        description: "Follow along — this demo walks you through the exact steps to turn a digital product idea into a posted video. Each step tells you exactly what to click. Let's start on the Digital Products page.",
      },
      {
        title: "➕ Step 1: Click 'New Digital Product'",
        description: "👆 Look for the orange 'New Digital Product' button at the top right of the page. Click it to open the product creation form. You'll give your product a name here — try something like 'Passive Income Planner for Beginners'.",
      },
      {
        title: "📝 Step 2: Fill in Your Product Details",
        description: "Enter your product name in the first field. The AI will auto-suggest a description and niche — you can keep these or edit them. Choose a format (Ebook, Course, Template, etc.). Then click 'Create Product' to save it.",
      },
      {
        title: "📋 Step 3: Open the Video Guide",
        description: "Your new product now appears in the list. Click the 'View Guide' button on its card. This opens the Video Guide — a 5-section workflow that turns your product into a full marketing video.",
      },
      {
        title: "✍️ Step 4: Generate Your Script",
        description: "Inside the Video Guide, scroll to the 'Script' section. Click 'Generate Script'. The AI writes a full voiceover script for your product — usually 30-60 seconds long. Read it through and make any edits you want.",
      },
      {
        title: "🎬 Step 5: Generate Scenes",
        description: "Click 'Generate Scenes' below the script. The AI splits your script into individual scenes (usually 5-8), each with an image prompt and voiceover text. These become the individual clips in your video.",
      },
      {
        title: "🖼️ Step 6: Generate Images for Each Scene",
        description: "For each scene card, click 'Generate Image'. The AI creates a visual that matches the scene. Do this for all your scenes — it takes about 15-20 seconds each. These images become the backgrounds in your final video.",
      },
      {
        title: "🎙️ Step 7: Generate Voiceover",
        description: "Scroll to the 'Voiceover' section and click 'Generate Voiceover'. This creates a professional AI voice reading your script. It uploads automatically to your Library as a public URL — which is required for the final MP4.",
      },
      {
        title: "🎞️ Step 8: Open the Video Timeline",
        description: "Click 'Animate scenes & open Video Timeline'. This loads all your scenes and images into the timeline editor with smooth Ken Burns motion applied automatically. Your voiceover is already attached.",
      },
      {
        title: "⬇️ Step 9: Make Your Full MP4",
        description: "Scroll down to the 'Make full MP4' card and click the orange compile button. The server renders your video in 2-3 minutes. When done, a Download button appears — your video is also saved to My Library automatically. That's it — you've just created a marketing video! 🎉",
      },
    ],
  },
  {
    id: "tiktok-shop",
    emoji: "🛍️",
    title: "Create a TikTok Shop Video",
    subtitle: "Product URL → viral video script → compiled MP4",
    page: "/dashboard/tiktok-shop",
    steps: [
      {
        title: "🚀 Live Demo: TikTok Shop → MP4",
        description: "This demo walks you through the exact steps to turn any TikTok Shop product link into a ready-to-post video. We're starting on the TikTok Shop page — follow each step as we go.",
      },
      {
        title: "🔗 Step 1: Paste a Product URL",
        description: "👆 Find the 'Product URL' input field at the top of the page. Paste the URL of any TikTok Shop product (e.g. shop.tiktok.com/product/...). You can also use an Amazon or Shopify link. The AI reads the product details automatically.",
      },
      {
        title: "🎭 Step 2: Choose a Video Style",
        description: "Select your preferred video style from the dropdown: 'Problem/Solution' works best for conversions (hook with a pain point, solve with the product). 'Product Demo' is great for physical items. 'Social Proof' suits products with good reviews. Pick one and move on.",
      },
      {
        title: "⚡ Step 3: Generate Your Script",
        description: "Click the orange 'Generate' button. In about 15 seconds you'll see a full scene-by-scene TikTok video script — written specifically to drive shop conversions. It includes a hook, body, and CTA (call to action) with your product link.",
      },
      {
        title: "✅ Step 4: Check Compliance (Important!)",
        description: "Before recording, copy your script and head to Script Checker. Paste it in, select 'TikTok', and click 'Check Compliance'. TikTok Shop has strict rules about results claims and product descriptions — always verify before posting to avoid bans.",
      },
      {
        title: "🖼️ Step 5: Generate Scene Images",
        description: "Back on the TikTok Shop page, scroll down to the scene cards. Each scene has an image prompt — click 'Generate Image' on each one. These become the visual backgrounds in your video.",
      },
      {
        title: "🎬 Step 6: Build Your Video",
        description: "Click 'Open in Video Timeline' to load all your scenes. Add a voiceover (record or generate with ElevenLabs), set your scene durations, and click 'Compile to MP4'. Your finished TikTok Shop video downloads and saves to My Library. Ready to post! 🛍️",
      },
    ],
  },
  {
    id: "template-studio",
    emoji: "🎨",
    title: "Create a Viral Template Video",
    subtitle: "Pick a format → fill in topic → export MP4 in 60 seconds",
    page: "/dashboard/template-studio",
    steps: [
      {
        title: "🚀 Live Demo: Template Studio",
        description: "This is the fastest way to create content — no timeline, no editing. Just pick a template, add your topic, and export. This demo walks you through the full flow start to finish.",
      },
      {
        element: "[data-tour='template-type-select']",
        side: "bottom",
        title: "🎨 Step 1: Pick Your Template Type",
        description: "👆 Click the dropdown that says 'Select template type'. For maximum engagement, try 'Kinetic Typography' (bold animated text + voiceover — great for motivational or educational content) or 'Viral Templates' (Would You Rather, Quiz format — huge reach on TikTok).",
      },
      {
        element: "[data-tour='template-format']",
        side: "bottom",
        title: "📐 Step 2: Choose Short or Long Form",
        description: "Toggle 'Short-form (9:16)' for TikTok and Reels, or 'Long-form (16:9)' for YouTube. Short-form creates a 30-60 second vertical video. Long-form creates a 3-5 minute widescreen video. Match this to where you're posting.",
      },
      {
        title: "✍️ Step 3: Fill in Your Topic",
        description: "In the topic or hook field, type your video idea. Be specific — 'Why introverts make better entrepreneurs than extroverts' will outperform 'introvert business tips'. The more specific your hook, the better the AI's output. Then click 'Generate'.",
      },
      {
        title: "👀 Step 4: Preview Your Slides",
        description: "The live preview shows your video playing automatically. Watch all the slides play through. If the content isn't quite right, click 'Regenerate' — it's free and fast. Each regeneration gives you a completely different version.",
      },
      {
        element: "[data-tour='template-export']",
        side: "top",
        title: "⬇️ Step 5: Export Your MP4",
        description: "👆 Click 'Export MP4'. For Kinetic Typography, this automatically generates a voiceover with ElevenLabs — no extra steps needed. For other templates, you can optionally add a voice. Export takes 30-90 seconds. The file downloads directly and saves to My Library. Done! 🎨",
      },
    ],
  },
];

export const ALL_FEATURES = [
  {
    emoji: "🤖",
    title: "AI Coach",
    href: "/dashboard/ai-coach",
    description: "A conversational AI trained for content creators. Generate scripts, strategies, pricing advice, and content plans. Works like ChatGPT but focused on social media growth and digital product selling.",
    tips: [
      "Use 'YouTube Strategy' mode to get a full multi-scene script you can load into the Video Timeline",
      "Start every session with your niche and product details for personalised advice",
      "Save scripts to Library from the action panel — this unlocks the Video Timeline",
      "Ask it to review scripts you've already written and suggest improvements",
      "You can have multiple saved sessions — pin important ones to the top",
    ],
  },
  {
    emoji: "📦",
    title: "Digital Products",
    href: "/dashboard/digital-products",
    description: "Create digital products (ebooks, courses, planners, templates) and generate a complete video marketing suite. Includes script writing, scene breakdowns, AI image generation, animated clips, and MP4 compilation.",
    tips: [
      "Be specific with your product name — 'Budget Planner for Single Mums' beats 'Budget Planner'",
      "The Video Guide inside each product walks you through the full video creation process",
      "Generate AI images for each scene — they're used as the visual backgrounds in your video",
      "Use 'Animate scenes & open Video Timeline' to add motion to your stills",
      "Make full MP4 requires voiceover to be generated first from the Video Guide's voiceover section",
    ],
  },
  {
    emoji: "🛍️",
    title: "TikTok Shop",
    href: "/dashboard/tiktok-shop",
    description: "Paste any TikTok Shop, Amazon, or Shopify product URL and get a viral video script, AI image prompts, text overlays, and hashtags — all optimised for TikTok Shop conversions.",
    tips: [
      "Works with TikTok Shop, Amazon, and Shopify URLs",
      "Choose 'Problem/Solution' style for highest-converting scripts",
      "Always run the final script through Script Checker — TikTok Shop has strict compliance rules",
      "You can generate AI images for each scene directly from the results page",
      "Export directly to MP4 or open in Video Timeline to add voiceover",
    ],
  },
  {
    emoji: "✅",
    title: "Script Checker",
    href: "/dashboard/script-checker",
    description: "Paste any script and get a compliance analysis for TikTok, Instagram, YouTube, or all platforms at once. Flags banned phrases, misleading claims, missing disclaimers, and weak hooks.",
    tips: [
      "Run every script before recording or posting — catches issues you'd miss manually",
      "Use 'Try sample script' to see what a flagged script looks like before using your own",
      "The compliant rewrite is fully editable — tweak it before saving",
      "Save the compliant version to Library, then load it in Video Timeline",
      "Select 'All platforms' if posting everywhere — applies the strictest combined rules",
    ],
  },
  {
    emoji: "🎯",
    title: "Goal Tracker",
    href: "/dashboard/goals",
    description: "Set monthly content and revenue goals with daily tasks, track your streak, and submit proof of completion. The streak system keeps you consistent.",
    tips: [
      "Set a posting goal first — e.g. '20 videos in 30 days'",
      "Check off daily tasks every day to build and protect your streak",
      "Submit proof (screenshot of posted video) to stay accountable",
      "Archive completed goals — don't delete them, they're a record of your progress",
      "Link your goals to the AI Coach for strategy advice aligned with your targets",
    ],
  },
  {
    emoji: "📚",
    title: "My Library",
    href: "/dashboard/library",
    description: "Your central archive for all digital products, scripts, videos, voiceovers, and compiled MP4s. Items are saved here automatically. Voiceovers must be in Library (as public URLs) for full MP4 compilation to work.",
    tips: [
      "Use the 'My Videos' tab to find all your compiled MP4 downloads",
      "Search by keyword to find any item across your entire library",
      "Voiceovers generated in Video Guide are automatically saved here as public URLs",
      "Load saved scripts into Video Timeline using the 'Load from Library' button",
      "Deleted items go to Trash — you have 30 days to recover them",
    ],
  },
  {
    emoji: "🎬",
    title: "Video Timeline",
    href: "/dashboard/video-timeline",
    description: "A scene-by-scene video editor. Load scenes from a saved script, add AI images or animated clips, upload a voiceover, set durations and transitions, then export a full MP4.",
    tips: [
      "Load a saved AI Coach script to pre-fill all your scenes automatically",
      "Use 'Animate Scene' on still images to add professional Ken Burns motion",
      "Drag the edge of a scene block in the timeline to change its duration",
      "The voiceover needs to be uploaded here or generated via ElevenLabs for the final MP4",
      "'Compile to MP4' takes 2-5 minutes — the result downloads directly and saves to My Library",
    ],
  },
  {
    emoji: "🎨",
    title: "Template Studio",
    href: "/dashboard/template-studio",
    description: "10+ ready-to-post viral video templates. No editing required — pick a format, fill in your topic, preview, and export an MP4. Works for short-form (9:16) and long-form (16:9) content.",
    tips: [
      "Kinetic Typography auto-generates an ElevenLabs voiceover — no extra steps needed",
      "Viral Templates (Would You Rather, Quiz) get huge engagement on TikTok",
      "Toggle Short/Long form to change the video format and scene count",
      "Long-form Kinetic Typography cycles through 3 different visual layouts automatically",
      "Exports save to My Library so you can find them later without re-generating",
    ],
  },
];
