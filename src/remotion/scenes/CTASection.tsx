import {
	AbsoluteFill,
	Img,
	interpolate,
	spring,
	staticFile,
	useVideoConfig,
} from 'remotion';
import type {PromoVariantWithSubtitles} from '../promo-content';

interface CTASectionProps {
	progress: number;
	variant: PromoVariantWithSubtitles;
}

export const CTASection: React.FC<CTASectionProps> = ({progress, variant}) => {
	const {fps} = useVideoConfig();
	const {cta} = variant;

	const entrance = spring({
		frame: progress * 40,
		fps,
		config: {
			damping: 18,
			stiffness: 110,
		},
	});

	const buttonReveal = spring({
		frame: progress * 40 - 8,
		fps,
		config: {
			damping: 17,
			stiffness: 140,
		},
	});

	const shimmer = interpolate(progress, [0.35, 1], [-120, 120], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	return (
		<AbsoluteFill
			style={{
				background:
					'radial-gradient(circle at 30% 20%, rgba(251, 191, 36, 0.28), transparent 28%), radial-gradient(circle at 78% 0%, rgba(251, 146, 60, 0.34), transparent 24%), linear-gradient(180deg, #111111 0%, #050505 100%)',
				padding: '76px 68px',
				fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
				color: 'white',
			}}
		>
			<div
				style={{
					position: 'absolute',
					inset: 0,
					backgroundImage:
						'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
					backgroundSize: '72px 72px',
					opacity: 0.45,
				}}
			/>

			<div
				style={{
					position: 'relative',
					height: '100%',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<div
					style={{
						width: '100%',
						maxWidth: 900,
						padding: '58px 54px',
						borderRadius: 36,
						background: 'rgba(255,255,255,0.08)',
						border: '1px solid rgba(255,255,255,0.14)',
						backdropFilter: 'blur(18px)',
						boxShadow: '0 30px 90px rgba(0,0,0,0.35)',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						textAlign: 'center',
						gap: 24,
						transform: `scale(${interpolate(entrance, [0, 1], [0.92, 1])}) translateY(${interpolate(
							entrance,
							[0, 1],
							[40, 0]
						)}px)`,
						opacity: entrance,
						overflow: 'hidden',
					}}
				>
					<div
						style={{
							position: 'absolute',
							inset: 0,
							background:
								'linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)',
							transform: `translateX(${shimmer}%)`,
						}}
					/>

					<Img
						src={staticFile('logo.png')}
						style={{
							width: 118,
							height: 118,
							objectFit: 'contain',
							filter: 'drop-shadow(0 18px 40px rgba(245,158,11,0.18))',
						}}
					/>

					<div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
						<span
							style={{
								fontSize: 22,
							fontWeight: 700,
							letterSpacing: 2,
							textTransform: 'uppercase',
							color: '#fdba74',
						}}
					>
							{cta.eyebrow}
						</span>
						<h2
							style={{
								margin: 0,
								fontSize: 82,
								lineHeight: 0.95,
								fontWeight: 800,
								letterSpacing: -3,
								maxWidth: 760,
							}}
						>
							{cta.title}
							<br />
							<span style={{color: '#fbbf24'}}>{cta.titleAccent}</span>
						</h2>
						<p
							style={{
								margin: 0,
								fontSize: 28,
								lineHeight: 1.42,
								color: 'rgba(255,255,255,0.74)',
								maxWidth: 700,
							}}
						>
							{cta.description}
						</p>
					</div>

					<div
						style={{
							display: 'flex',
							gap: 18,
							transform: `translateY(${interpolate(buttonReveal, [0, 1], [26, 0])}px)`,
							opacity: buttonReveal,
						}}
					>
						<div
							style={{
								padding: '20px 30px',
								borderRadius: 999,
								backgroundColor: '#f59e0b',
								color: '#111111',
								fontSize: 25,
								fontWeight: 800,
								boxShadow: '0 20px 54px rgba(245, 158, 11, 0.3)',
							}}
						>
							{cta.primary}
						</div>
						<div
							style={{
								padding: '20px 30px',
								borderRadius: 999,
								backgroundColor: 'rgba(255,255,255,0.08)',
								border: '1px solid rgba(255,255,255,0.14)',
								color: 'white',
								fontSize: 25,
								fontWeight: 700,
							}}
						>
							{cta.secondary}
						</div>
					</div>

					<div
						style={{
							display: 'flex',
							gap: 14,
							flexWrap: 'wrap',
							justifyContent: 'center',
							color: 'rgba(255,255,255,0.7)',
							fontSize: 20,
							fontWeight: 600,
						}}
					>
						{cta.footerBullets.map((item, index) => (
							<span key={item}>
								{index > 0 ? '• ' : ''}
								{item}
							</span>
						))}
					</div>
				</div>
			</div>
		</AbsoluteFill>
	);
};
