// Shared domain types for the TestForge analysis & test-generation pipeline.

export type RequirementType =
  | "functional"
  | "validation"
  | "business-rule"
  | "non-functional";

export type Priority = "High" | "Medium" | "Low";

export interface ExtractedRequirement {
  id: string;
  text: string;
  module: string;
  type: RequirementType;
  priority: Priority;
}

export interface UserJourney {
  name: string;
  steps: string[];
}

export interface AnalysisStats {
  pages: number;
  words: number;
  requirementCount: number;
  moduleCount: number;
  journeyCount: number;
}

export interface RequirementAnalysis {
  documentName: string;
  /** Which engine produced this analysis — Claude AI or the built-in rule engine. */
  engine: "claude" | "builtin";
  documentType: string;
  summary: string;
  modules: string[];
  requirements: ExtractedRequirement[];
  userJourneys: UserJourney[];
  stats: AnalysisStats;
}

export type TestType = "Positive" | "Negative" | "Edge Case";

export interface TestCase {
  id: string;
  title: string;
  module: string;
  type: TestType;
  priority: Priority;
  precondition: string;
  steps: string[];
  expectedResult: string;
  requirementId: string;
}
