import { SectionFrame, type SectionFrameProps, type SectionRole, type SectionTone } from "./SectionFrame";

export type BandTone = SectionTone;
export type BandRole = SectionRole;
export type BandProps = SectionFrameProps;

/**
 * Full-bleed section wrapper for editorial pages: tone background, standard
 * vertical rhythm and the 1240px container. One Band per page section.
 */
export function Band(props: BandProps) {
  return <SectionFrame {...props} />;
}
