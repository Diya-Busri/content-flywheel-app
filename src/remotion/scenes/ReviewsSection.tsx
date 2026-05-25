import {AbsoluteFill, interpolate, spring, useVideoConfig} from 'remotion';
import type {PromoChannelCard, PromoVariantWithSubtitles} from '../promo-content';

interface ReviewsSectionProps {
	progress: number;
	fadeOut: number;
	variant: PromoVariantWithSubtitles;
}

interface ChannelCardProps {
	accent: string;
	body: string;
	delay: number;
	label: string;
	progress: number;
	title: string;
}

const ChannelCard: React.FC<ChannelCardProps> = ({
	accent,
	body,
	delay,
	label,
	progress,
	title,
}) => {
	const {fps} = useVideoConfig();
	const entrance = spring({
		frame: progress * 40 - delay,
		fps,
		config: {
			damping: 17,
			stiffness: 135,
		},
	});

	return (
		<div
			style={{
				borderRadius: 30,
				padding: '28px 30px',
				background: 'rgba(255,255,255,0.92)',
				border: '1px solid rgba(255,255,255,0.75)',
				boxShadow: '0 26px 70px rgba(0,0,0,0.18)',
				display: 'flex',
				flexDirection: 'column',
				gap: 14,
				transform: `translateX(${interpolate(entrance, [0, 1], [80, 0])}px)`,
				opacity: entrance,
			}}
		>
			<div
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: 10,
					padding: '10px 14px',
					borderRadius: 999,
					backgroundColor: `${accent}18`,
					color: accent,
					fontWeight: 800,
					fontSize: 18,
					width: 'fit-content',
					textTransform: 'uppercase',
					letterSpacing: 1.4,
				}}
			>
				{label}
			</div>
			<h3
				style={{
					margin: 0,
					fontSize: 40,
					lineHeight: 1.05,
					fontWeight: 800,
					color: '#111111',
				}}
			>
				{title}
			</h3>
			<p
				style={{
					margin: 0,
					fontSize: 23,
					lineHeight: 1.45,
					color: '#52525b',
				}}
			>
				{body}
			</p>
		</div>
	);
};

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({
	progress,
	fadeOut,
	variant,
}) => {
	const headingOpacity = interpolate(progress, [0, 0.2], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	const metricProgress = interpolate(progress, [0.34, 0.7], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	const {growth} = variant;

	return (
		<AbsoluteFill
			style={{
				opacity: fadeOut,
				background:
					'linear-gradient(180deg, #fff7ed 0%, #ffffff 32%, #fff1f2 100%)',
				padding: '90px 68px',
				fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
			}}
		>
			<div
				style={{
					position: 'relative',
					display: 'grid',
					gridTemplateColumns: '0.95fr 1.05fr',
					gap: 30,
					height: '100%',
				}}
			>
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						justifyContent: 'space-between',
						padding: '12px 0',
					}}
				>
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							gap: 18,
							opacity: headingOpacity,
							transform: `translateY(${interpolate(headingOpacity, [0, 1], [34, 0])}px)`,
						}}
					>
						<span
							style={{
								fontSize: 22,
								fontWeight: 700,
								letterSpacing: 2,
								textTransform: 'uppercase',
								color: '#c2410c',
							}}
						>
							{growth.eyebrow}
						</span>
						<h2
							style={{
								margin: 0,
								fontSize: 88,
								lineHeight: 0.96,
								fontWeight: 800,
								letterSpacing: -3,
								color: '#111111',
							}}
						>
							{growth.title}
							<br />
							{growth.titleAccent ?? ''}
						</h2>
						<p
							style={{
								margin: 0,
								fontSize: 28,
								lineHeight: 1.42,
								color: '#52525b',
								maxWidth: 640,
							}}
						>
							{growth.description}
						</p>
					</div>

					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(3, 1fr)',
							gap: 16,
						}}
					>
						{growth.metrics.map((metric, index) => (
							<div
								key={metric.label}
								style={{
									borderRadius: 26,
									padding: '22px 20px',
									background: 'rgba(17, 17, 17, 0.95)',
									color: 'white',
									transform: `translateY(${interpolate(metricProgress, [0, 1], [26 + index * 8, 0])}px)`,
									opacity: metricProgress,
								}}
							>
								<div
									style={{
										fontSize: 46,
										fontWeight: 800,
										letterSpacing: -2,
										marginBottom: 6,
									}}
								>
									{metric.value}
								</div>
								<div
									style={{
										fontSize: 18,
										color: 'rgba(255,255,255,0.7)',
									}}
								>
									{metric.label}
								</div>
							</div>
						))}
					</div>
				</div>

				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						justifyContent: 'center',
						gap: 18,
					}}
				>
					{growth.channels.map((channel: PromoChannelCard, index) => (
						<ChannelCard
							key={channel.title}
							progress={progress}
							delay={index * 7}
							{...channel}
						/>
					))}
				</div>
			</div>
		</AbsoluteFill>
	);
};
