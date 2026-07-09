import {Composition} from 'remotion';
import {PROMO_VARIANTS} from './promo-content';
import {VideoComposition} from './VideoComposition';
import {
	VideoEngineComposition,
	type VideoEngineCompositionProps,
} from './engine/VideoEngineComposition';

const compositionLength = 450;

const DEFAULT_ENGINE_PROPS: VideoEngineCompositionProps = {
	projectTitle: '',
	scenes: [],
	audioUrls: {},
};

export const ShowcaseVideo = () => {
	return (
		<>
			{/* Existing promo compositions */}
			{PROMO_VARIANTS.map((variant) => (
				<Composition
					key={variant.compositionId}
					id={variant.compositionId}
					component={VideoComposition}
					durationInFrames={compositionLength}
					fps={30}
					width={1080}
					height={1920}
					defaultProps={{variant}}
				/>
			))}

			{/* CF Video Engine — dynamic composition driven by VideoEngineProject */}
			<Composition
				id="VideoEngine"
				component={VideoEngineComposition}
				durationInFrames={900}   // default; overridden by calculateMetadata
				fps={30}
				width={1080}
				height={1920}
				defaultProps={DEFAULT_ENGINE_PROPS}
				calculateMetadata={({props}) => {
					const totalSeconds = (props.scenes ?? []).reduce(
						(sum, s) => sum + (s.durationSeconds ?? 5),
						0
					);
					return {
						durationInFrames: Math.max(Math.ceil(totalSeconds * 30), 30),
					};
				}}
			/>
		</>
	);
};
