import type { IntroSectionId } from './introduction'

export type ActiveView =
  | { kind: 'intro'; sectionId: IntroSectionId }
  | { kind: 'api';   apiId: string }
