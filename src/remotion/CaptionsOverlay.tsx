import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {PromoCaptionCue} from './promo-content';

type CaptionsOverlayProps = {
	cues: PromoCaptionCue[];
};

export const CaptionsOverlay: React.FC<CaptionsOverlayProps> = ({cues}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const cue = cues.find((item) => frame >= item.from && frame <= item.to);

	if (!cue) {
		return null;
	}

	const localFrame = frame - cue.from;
	const entrance = spring({
		frame: localFrame,
		fps,
		config: {
			damping: 18,
			stiffness: 140,
		},
	});

	return (
		<AbsoluteFill
			style={{
				pointerEvents: 'none',
				justifyContent: 'flex-end',
				alignItems: 'center',
				padding: '0 48px 148px',
			}}
		>
			<div
				style={{
					maxWidth: 880,
					padding: '22px 28px',
					borderRadius: 28,
					background: 'rgba(0, 0, 0, 0.82)',
					border: '1px solid rgba(255,255,255,0.14)',
					boxShadow: '0 20px 56px rgba(0,0,0,0.35)',
					transform: `translateY(${interpolate(entrance, [0, 1], [24, 0])}px) scale(${interpolate(
						entrance,
						[0, 1],
						[0.96, 1]
					)})`,
					opacity: entrance,
				}}
			>
				<p
					style={{
						margin: 0,
						fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
						fontSize: 34,
						lineHeight: 1.25,
						fontWeight: 800,
						color: 'white',
						textAlign: 'center',
						letterSpacing: -0.8,
					}}
				>
					{cue.text}
				</p>
			</div>
		</AbsoluteFill>
	);
};
