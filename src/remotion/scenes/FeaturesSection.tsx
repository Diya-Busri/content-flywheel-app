import {AbsoluteFill, interpolate, spring, useVideoConfig} from 'remotion';
import type {PromoFeatureCard, PromoVariantWithSubtitles} from '../promo-content';

interface FeaturesSectionProps {
	progress: number;
	fadeOut: number;
	variant: PromoVariantWithSubtitles;
}

interface FeatureCardProps {
	accent: string;
	delay: number;
	description: string;
	index: number;
	kicker: string;
	points: string[];
	progress: number;
	title: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
	accent,
	delay,
	description,
	index,
	kicker,
	points,
	progress,
	title,
}) => {
	const {fps} = useVideoConfig();
	const entrance = spring({
		frame: progress * 40 - delay,
		fps,
		config: {
			damping: 18,
			stiffness: 120,
		},
	});

	return (
		<div
			style={{
				flex: 1,
				borderRadius: 32,
				padding: '34px 32px',
				background: 'rgba(255,255,255,0.08)',
				border: '1px solid rgba(255,255,255,0.14)',
				boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
				backdropFilter: 'blur(18px)',
				display: 'flex',
				flexDirection: 'column',
				gap: 20,
				transform: `translateY(${interpolate(entrance, [0, 1], [70, 0])}px) scale(${interpolate(
					entrance,
					[0, 1],
					[0.92, 1]
				)})`,
				opacity: entrance,
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
				}}
			>
				<div
					style={{
						padding: '10px 14px',
						borderRadius: 999,
						backgroundColor: `${accent}22`,
						border: `1px solid ${accent}55`,
						color: accent,
						fontWeight: 700,
						fontSize: 18,
						letterSpacing: 1,
						textTransform: 'uppercase',
					}}
				>
					{kicker}
				</div>
				<div
					style={{
						fontSize: 68,
						fontWeight: 800,
						lineHeight: 1,
						color: 'rgba(255,255,255,0.08)',
					}}
				>
					0{index + 1}
				</div>
			</div>

			<div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
				<h3
					style={{
						margin: 0,
						fontSize: 42,
						lineHeight: 1.06,
						fontWeight: 800,
						color: 'white',
					}}
				>
					{title}
				</h3>
				<p
					style={{
						margin: 0,
						fontSize: 23,
						lineHeight: 1.4,
						color: 'rgba(255,255,255,0.72)',
					}}
				>
					{description}
				</p>
			</div>

			<div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
				{points.map((point) => (
					<div
						key={point}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 14,
							fontSize: 22,
							color: 'white',
						}}
					>
						<div
							style={{
								width: 10,
								height: 10,
								borderRadius: '50%',
								backgroundColor: accent,
								boxShadow: `0 0 24px ${accent}`,
							}}
						/>
						<span>{point}</span>
					</div>
				))}
			</div>
		</div>
	);
};

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({
	progress,
	fadeOut,
	variant,
}) => {
	const headerOpacity = interpolate(progress, [0, 0.22], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	const {features} = variant;

	return (
		<AbsoluteFill
			style={{
				opacity: fadeOut,
				background:
					'radial-gradient(circle at 50% 0%, rgba(251, 146, 60, 0.18), transparent 40%), linear-gradient(180deg, #111111 0%, #050505 100%)',
				padding: '90px 68px',
				color: 'white',
				fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
			}}
		>
			<div
				style={{
					position: 'absolute',
					inset: 0,
					backgroundImage:
						'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
					backgroundSize: '72px 72px',
					opacity: 0.5,
				}}
			/>

			<div
				style={{
					position: 'relative',
					display: 'flex',
					flexDirection: 'column',
					height: '100%',
					justifyContent: 'center',
					gap: 46,
				}}
			>
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						gap: 12,
						maxWidth: 1080,
						opacity: headerOpacity,
						transform: `translateY(${interpolate(headerOpacity, [0, 1], [30, 0])}px)`,
					}}
				>
					<span
						style={{
							fontSize: 22,
							fontWeight: 700,
							letterSpacing: 2,
						textTransform: 'uppercase',
						color: '#fdba74',
					}}
				>
						{features.eyebrow}
					</span>
					<h2
						style={{
							margin: 0,
							fontSize: 88,
							lineHeight: 0.96,
							fontWeight: 800,
							letterSpacing: -3,
						}}
					>
						{features.title}
						<br />
						{features.titleAccent ?? ''}
					</h2>
				</div>

				<div style={{display: 'flex', gap: 26}}>
					{features.cards.map((card: PromoFeatureCard, index) => (
						<FeatureCard
							key={card.title}
							index={index}
							progress={progress}
							delay={index * 6}
							{...card}
						/>
					))}
				</div>
			</div>
		</AbsoluteFill>
	);
};
