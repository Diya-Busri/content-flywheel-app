import {
	AbsoluteFill,
	Img,
	interpolate,
	spring,
	staticFile,
	useVideoConfig,
} from 'remotion';
import type {PromoVariantWithSubtitles} from '../promo-content';

interface HeroSectionProps {
	progress: number;
	fadeOut: number;
	variant: PromoVariantWithSubtitles;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
	progress,
	fadeOut,
	variant,
}) => {
	const {fps} = useVideoConfig();
	const {hero} = variant;

	const intro = spring({
		frame: progress * 40,
		fps,
		config: {
			damping: 18,
			stiffness: 110,
		},
	});

	const cardRise = spring({
		frame: progress * 40 - 8,
		fps,
		config: {
			damping: 16,
			stiffness: 120,
		},
	});

	return (
		<AbsoluteFill
			style={{
				opacity: fadeOut,
				background:
					'radial-gradient(circle at 20% 20%, rgba(251, 146, 60, 0.28), transparent 32%), radial-gradient(circle at 80% 15%, rgba(245, 158, 11, 0.2), transparent 26%), linear-gradient(180deg, #050505 0%, #111111 100%)',
				color: 'white',
				padding: '96px 72px',
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
					maskImage:
						'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.45) 58%, transparent 100%)',
				}}
			/>

			<div
				style={{
					position: 'relative',
					display: 'flex',
					flexDirection: 'column',
					height: '100%',
					justifyContent: 'space-between',
				}}
			>
				<div
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: 20,
						padding: '18px 24px',
						borderRadius: 999,
						backgroundColor: 'rgba(255,255,255,0.08)',
						border: '1px solid rgba(255,255,255,0.12)',
						width: 'fit-content',
						backdropFilter: 'blur(18px)',
						transform: `translateY(${interpolate(intro, [0, 1], [32, 0])}px)`,
						opacity: intro,
					}}
				>
					<Img
						src={staticFile('logo.png')}
						style={{width: 74, height: 74, objectFit: 'contain'}}
					/>
					<div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
						<span
							style={{
								fontSize: 24,
								textTransform: 'uppercase',
								letterSpacing: 3,
								color: 'rgba(255,255,255,0.68)',
							}}
						>
							Content Flywheel
						</span>
						<span
							style={{
								fontSize: 42,
								fontWeight: 700,
								color: '#fbbf24',
							}}
						>
							{hero.subtitle}
						</span>
					</div>
				</div>

				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						gap: 28,
						maxWidth: 860,
					}}
				>
					<div
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: 14,
							padding: '14px 18px',
							width: 'fit-content',
							borderRadius: 999,
							background: 'rgba(251, 146, 60, 0.15)',
							border: '1px solid rgba(251, 146, 60, 0.35)',
							color: '#fdba74',
							fontSize: 24,
							fontWeight: 600,
							letterSpacing: 1,
							transform: `translateY(${interpolate(intro, [0, 1], [20, 0])}px)`,
							opacity: interpolate(progress, [0.08, 0.25], [0, 1], {
								extrapolateLeft: 'clamp',
								extrapolateRight: 'clamp',
							}),
						}}
					>
						{hero.badge}
					</div>

					<h1
						style={{
							fontSize: 114,
							lineHeight: 0.94,
							fontWeight: 800,
							letterSpacing: -4,
							margin: 0,
							transform: `translateY(${interpolate(intro, [0, 1], [60, 0])}px)`,
							opacity: intro,
						}}
					>
						{hero.title}
						<br />
						<span style={{color: '#fbbf24'}}>{hero.titleAccent}</span>
					</h1>

					<p
						style={{
							margin: 0,
							fontSize: 34,
							lineHeight: 1.35,
							color: 'rgba(255,255,255,0.72)',
							maxWidth: 880,
							transform: `translateY(${interpolate(cardRise, [0, 1], [40, 0])}px)`,
							opacity: cardRise,
						}}
					>
						{hero.description}
					</p>
				</div>

				<div
					style={{
						display: 'flex',
						gap: 18,
						flexWrap: 'wrap',
						transform: `translateY(${interpolate(cardRise, [0, 1], [40, 0])}px)`,
						opacity: cardRise,
					}}
				>
					{hero.pills.map((pill, index) => (
						<div
							key={pill}
							style={{
								padding: '18px 26px',
								borderRadius: 999,
								backgroundColor: index === 1 ? '#f59e0b' : 'rgba(255,255,255,0.08)',
								color: index === 1 ? '#111111' : 'white',
								fontSize: 28,
								fontWeight: 700,
								border:
									index === 1
										? '1px solid rgba(245,158,11,0.5)'
										: '1px solid rgba(255,255,255,0.12)',
								boxShadow:
									index === 1 ? '0 18px 48px rgba(245, 158, 11, 0.2)' : 'none',
							}}
						>
							{pill}
						</div>
					))}
				</div>
			</div>
		</AbsoluteFill>
	);
};
