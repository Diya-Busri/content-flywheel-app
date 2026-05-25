import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {CaptionsOverlay} from './CaptionsOverlay';
import type {PromoVariantWithSubtitles} from './promo-content';
import {CTASection} from './scenes/CTASection';
import {FeaturesSection} from './scenes/FeaturesSection';
import {HeroSection} from './scenes/HeroSection';
import {ReviewsSection} from './scenes/ReviewsSection';

const fadeWindow = 18;

const getSectionProgress = (frame: number, start: number, end: number) =>
	interpolate(frame, [start, start + 20, end], [0, 1, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.out(Easing.cubic),
	});

const getFadeOut = (frame: number, end: number) =>
	interpolate(frame, [end - fadeWindow, end], [1, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

type VideoCompositionProps = {
	variant: PromoVariantWithSubtitles;
};

export const VideoComposition: React.FC<VideoCompositionProps> = ({variant}) => {
	const frame = useCurrentFrame();

	const hero = {start: 0, end: 120};
	const features = {start: 120, end: 240};
	const growth = {start: 240, end: 360};
	const cta = {start: 360, end: 450};

	return (
		<AbsoluteFill style={{backgroundColor: '#050505'}}>
			{frame < hero.end && (
				<HeroSection
					progress={getSectionProgress(frame, hero.start, hero.end)}
					fadeOut={getFadeOut(frame, hero.end)}
					variant={variant}
				/>
			)}

			{frame >= features.start && frame < features.end && (
				<FeaturesSection
					progress={getSectionProgress(frame, features.start, features.end)}
					fadeOut={getFadeOut(frame, features.end)}
					variant={variant}
				/>
			)}

			{frame >= growth.start && frame < growth.end && (
				<ReviewsSection
					progress={getSectionProgress(frame, growth.start, growth.end)}
					fadeOut={getFadeOut(frame, growth.end)}
					variant={variant}
				/>
			)}

			{frame >= cta.start && frame <= cta.end && (
				<CTASection
					progress={getSectionProgress(frame, cta.start, cta.end)}
					variant={variant}
				/>
			)}

			<CaptionsOverlay cues={variant.subtitles} />
		</AbsoluteFill>
	);
};
