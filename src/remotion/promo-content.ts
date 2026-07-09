export type PromoFeatureCard = {
	accent: string;
	description: string;
	kicker: string;
	points: string[];
	title: string;
};

export type PromoChannelCard = {
	accent: string;
	body: string;
	label: string;
	title: string;
};

export type PromoMetric = {
	label: string;
	value: string;
};

export type PromoCaptionCue = {
	from: number;
	text: string;
	to: number;
};

export type PromoVariant = {
	compositionId: string;
	cta: {
		description: string;
		eyebrow: string;
		footerBullets: string[];
		primary: string;
		secondary: string;
		title: string;
		titleAccent: string;
	};
	features: {
		cards: PromoFeatureCard[];
		eyebrow: string;
		title: string;
		titleAccent?: string;
	};
	filename: string;
	growth: {
		channels: PromoChannelCard[];
		description: string;
		eyebrow: string;
		metrics: PromoMetric[];
		title: string;
		titleAccent?: string;
	};
	hero: {
		badge: string;
		description: string;
		pills: string[];
		subtitle: string;
		title: string;
		titleAccent: string;
	};
	name: string;
	voiceover: string[];
};

const createCaptions = (lines: string[]): PromoCaptionCue[] => {
	const cues: PromoCaptionCue[] = [];
	let frame = 6;

	for (const line of lines) {
		const duration = Math.max(38, Math.min(72, line.length * 1.7));
		cues.push({
			from: Math.round(frame),
			to: Math.round(frame + duration),
			text: line,
		});
		frame += duration + 4;
	}

	return cues;
};

const baseFeatureCards: PromoFeatureCard[] = [
	{
		kicker: 'Create',
		title: 'Build the product with AI',
		description:
			'Generate ebooks, planners, journals, templates, and more without starting from a blank page.',
		points: ['AI writing + formatting', 'Multiple product formats', 'Fast first draft in minutes'],
		accent: '#f59e0b',
	},
	{
		kicker: 'Sell',
		title: 'Launch your own store',
		description:
			'Turn the idea into an offer with product pages, Stripe checkout, delivery, and order tracking.',
		points: ['Branded storefront', '0% platform fees', 'Automatic delivery'],
		accent: '#fb7185',
	},
	{
		kicker: 'Grow',
		title: 'Keep the flywheel moving',
		description:
			'Promote with email campaigns, affiliates, discount codes, and built-in content tools.',
		points: ['Broadcasts + drip sequences', 'Referral links', 'Video and caption workflows'],
		accent: '#38bdf8',
	},
];

const promoVariantsBase: PromoVariant[] = [
	{
		compositionId: 'ShowcaseVideo',
		filename: 'video.mp4',
		name: 'Core Promo',
		hero: {
			badge: 'Stop stitching together 5 tools just to launch one offer',
			title: 'Turn one idea into',
			titleAccent: 'a product, store, and promo plan',
			description:
				'Create ebooks, planners, and templates with AI. Sell from your own brand. Grow with content, email, affiliates, and discounts in one app.',
			subtitle: 'Build. Sell. Promote.',
			pills: ['AI product creator', 'Branded store', 'Content studio'],
		},
		features: {
			eyebrow: 'One workflow instead of a tool stack',
			title: 'From product idea',
			titleAccent: 'to promotion-ready system',
			cards: baseFeatureCards,
		},
		growth: {
			eyebrow: 'Promotion is part of the product',
			title: 'Post once.',
			titleAccent: 'Build momentum.',
			description:
				'Content Flywheel helps you connect the post, the offer, and the follow-up so your promo effort compounds instead of disappearing.',
			metrics: [
				{label: 'Ideas', value: '3x'},
				{label: 'Tools replaced', value: '5'},
				{label: 'Setup stress', value: '-80%'},
			],
			channels: [
				{
					label: 'Hook',
					title: 'Turn one product into multiple scripts',
					body: 'Generate platform-specific ideas for TikTok, Reels, and YouTube instead of rewriting every post from scratch.',
					accent: '#f59e0b',
				},
				{
					label: 'Offer',
					title: 'Layer in urgency without the scramble',
					body: 'Run promo codes, limited launches, and affiliate pushes from the same place as the product and store.',
					accent: '#ec4899',
				},
				{
					label: 'Nurture',
					title: 'Keep warm leads moving after the first post',
					body: 'Capture emails, send broadcasts, and automate follow-up sequences so every piece of content has somewhere to go.',
					accent: '#0ea5e9',
				},
			],
		},
		cta: {
			eyebrow: 'Start promoting smarter',
			title: 'Build your first',
			titleAccent: 'content flywheel',
			description:
				'Create the product, launch the store, and turn every post into a system that keeps selling after you hit publish.',
			primary: 'Start creating',
			secondary: 'contentflywheel.app',
			footerBullets: ['No per-sale fees', 'All-in-one workflow', 'Built for creators'],
		},
		voiceover: [
			'Still using five different tools just to launch one digital product?',
			'Content Flywheel turns one idea into a product, store, and promo plan.',
			'Create ebooks, planners, and templates with AI.',
			'Launch your own branded store with checkout and delivery built in.',
			'Then promote with content workflows, email campaigns, affiliates, and discounts.',
			'Build your first content flywheel with Content Flywheel.',
		],
	},
	{
		compositionId: 'ShowcaseVideoPainPoint',
		filename: 'video-pain-point.mp4',
		name: 'Pain Point Hook',
		hero: {
			badge: 'Creators are tired of using one app to create and four more to sell',
			title: 'Too many tools.',
			titleAccent: 'Not enough momentum.',
			description:
				'If your product, store, and marketing stack live in different places, launches feel heavier than they should. This fixes that.',
			subtitle: 'Less chaos. More shipping.',
			pills: ['One dashboard', 'Launch faster', 'Less setup'],
		},
		features: {
			eyebrow: 'What changes when the workflow is connected',
			title: 'Write it.',
			titleAccent: 'Sell it. Promote it.',
			cards: baseFeatureCards,
		},
		growth: {
			eyebrow: 'The real bottleneck is workflow friction',
			title: 'Your offer should not',
			titleAccent: 'die in setup mode.',
			description:
				'When promotion is built into the same system, your launch can keep moving instead of stalling between tools and tabs.',
			metrics: [
				{label: 'Tabs to juggle', value: '-5'},
				{label: 'Launch friction', value: '↓'},
				{label: 'Offer clarity', value: '↑'},
			],
			channels: [
				{
					label: 'Fix',
					title: 'One place to create the offer',
					body: 'Build the product and its marketing assets inside the same workflow instead of passing files between tools.',
					accent: '#f59e0b',
				},
				{
					label: 'Ship',
					title: 'One place to take payment',
					body: 'Storefront, checkout, and delivery stay connected so you are not rebuilding the launch each time.',
					accent: '#ec4899',
				},
				{
					label: 'Scale',
					title: 'One place to keep promoting',
					body: 'Use content, email, affiliates, and discounts together so every push actually compounds.',
					accent: '#0ea5e9',
				},
			],
		},
		cta: {
			eyebrow: 'Ready to simplify the launch?',
			title: 'Replace the chaos with',
			titleAccent: 'one flywheel',
			description:
				'Build and promote from one place so the next digital product feels lighter, faster, and easier to repeat.',
			primary: 'Try the workflow',
			secondary: 'contentflywheel.app',
			footerBullets: ['Less setup', 'More consistency', 'Creator-first'],
		},
		voiceover: [
			'Too many tools and not enough momentum?',
			'That is what most digital product launches feel like.',
			'Content Flywheel gives you one place to build the offer, launch the store, and keep promoting.',
			'Create the product with AI, take payments, deliver files, and run the follow-up from the same workflow.',
			'Replace the chaos with one flywheel.',
		],
	},
	{
		compositionId: 'ShowcaseVideoWorkflow',
		filename: 'video-workflow.mp4',
		name: 'Workflow Hook',
		hero: {
			badge: 'Here is the simple workflow I wanted for selling digital products',
			title: 'Idea in.',
			titleAccent: 'Assets out.',
			description:
				'Go from rough concept to product, store, scripts, and follow-up plan without rebuilding the process every time.',
			subtitle: 'From blank page to launch system.',
			pills: ['Idea', 'Offer', 'Content engine'],
		},
		features: {
			eyebrow: 'A repeatable creator workflow',
			title: 'Input the idea.',
			titleAccent: 'Get the system.',
			cards: baseFeatureCards.map((card, index) =>
				index === 0
					? {...card, title: 'Start from a niche or rough offer'}
					: index === 1
						? {...card, title: 'Turn it into a real checkout-ready product'}
						: {...card, title: 'Spin up the promo layer immediately'}
			),
		},
		growth: {
			eyebrow: 'One idea, multiple outputs',
			title: 'The product is not',
			titleAccent: 'the only asset anymore.',
			description:
				'Every launch can produce the offer, scripts, promo angles, audience capture, and follow-up you need to keep selling.',
			metrics: [
				{label: 'Outputs', value: '4+'},
				{label: 'Repeatability', value: 'High'},
				{label: 'Guesswork', value: 'Low'},
			],
			channels: [
				{
					label: 'Output',
					title: 'Product assets',
					body: 'Get the digital product itself without starting from a blank doc or scattered notes.',
					accent: '#f59e0b',
				},
				{
					label: 'Output',
					title: 'Store assets',
					body: 'Launch pages, pricing, delivery, and offer presentation from the same ecosystem.',
					accent: '#ec4899',
				},
				{
					label: 'Output',
					title: 'Promo assets',
					body: 'Turn the same launch into scripts, captions, emails, codes, and affiliate pushes that work together.',
					accent: '#0ea5e9',
				},
			],
		},
		cta: {
			eyebrow: 'Build a repeatable launch process',
			title: 'Start with one idea.',
			titleAccent: 'Leave with a system.',
			description:
				'If you want your next product launch to feel repeatable instead of random, start with Content Flywheel.',
			primary: 'Start the workflow',
			secondary: 'contentflywheel.app',
			footerBullets: ['Repeatable', 'Fast to test', 'Built to scale'],
		},
		voiceover: [
			'Here is the workflow I wanted for selling digital products.',
			'Put one idea in.',
			'Get the product, the store, and the promo system out.',
			'Content Flywheel helps you create the offer with AI, launch it in your own store, and turn it into content and follow-up.',
			'Start with one idea. Leave with a system.',
		],
	},
	{
		compositionId: 'ShowcaseVideoCreator',
		filename: 'video-creator.mp4',
		name: 'Creator Hook',
		hero: {
			badge: 'If you sell ebooks, planners, guides, or templates, this is for you',
			title: 'Made for creators who',
			titleAccent: 'want offers that actually move',
			description:
				'Not just a builder. A launch system for people selling knowledge, templates, digital downloads, and niche resources.',
			subtitle: 'Built for digital product creators.',
			pills: ['Ebooks', 'Planners', 'Templates'],
		},
		features: {
			eyebrow: 'Everything a digital creator needs to launch',
			title: 'Create the product.',
			titleAccent: 'Keep the audience warm.',
			cards: [
				{
					...baseFeatureCards[0],
					title: 'Build niche digital offers fast',
					points: ['Guides and planners', 'Templates and journals', 'Prompted AI drafting'],
				},
				{
					...baseFeatureCards[1],
					title: 'Sell from your own brand',
					points: ['Storefront + checkout', 'Delivery built in', 'Own the customer journey'],
				},
				{
					...baseFeatureCards[2],
					title: 'Stay visible after launch day',
					points: ['Email list growth', 'Affiliate push', 'Content that keeps circulating'],
				},
			],
		},
		growth: {
			eyebrow: 'Launches should compound',
			title: 'Every new product can',
			titleAccent: 'feed the next sale.',
			description:
				'Instead of launching once and going quiet, build a creator system that keeps your offers discoverable and your audience engaged.',
			metrics: [
				{label: 'Offer types', value: 'Many'},
				{label: 'Brand control', value: '100%'},
				{label: 'Promo leverage', value: 'Compounding'},
			],
			channels: [
				{
					label: 'Audience',
					title: 'Capture attention with content',
					body: 'Use scripts and promo angles to turn product knowledge into short-form hooks and social posts.',
					accent: '#f59e0b',
				},
				{
					label: 'Trust',
					title: 'Reinforce the offer with proof',
					body: 'Discounts, affiliates, and follow-up help you turn curiosity into clicks and clicks into buyers.',
					accent: '#ec4899',
				},
				{
					label: 'Retention',
					title: 'Keep buyers inside your world',
					body: 'Your list, your store, and your launches stay connected so you can sell again without restarting from zero.',
					accent: '#0ea5e9',
				},
			],
		},
		cta: {
			eyebrow: 'For digital product creators',
			title: 'Create the offer.',
			titleAccent: 'Own the flywheel.',
			description:
				'If you want a simpler way to create, sell, and keep promoting your digital products, start here.',
			primary: 'Start building',
			secondary: 'contentflywheel.app',
			footerBullets: ['Own your brand', 'Own your audience', 'Own the workflow'],
		},
		voiceover: [
			'If you sell ebooks, planners, guides, or templates, this is for you.',
			'Content Flywheel was built for digital product creators who want more than a builder.',
			'Create the offer with AI, sell from your own brand, and keep your audience warm with content, email, and follow-up.',
			'Create the offer. Own the flywheel.',
		],
	},
];

export const PROMO_VARIANTS = promoVariantsBase.map((variant) => ({
	...variant,
	subtitles: createCaptions(variant.voiceover),
}));

export type PromoVariantWithSubtitles = (typeof PROMO_VARIANTS)[number];
