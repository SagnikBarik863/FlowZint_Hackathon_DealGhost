-- AlterTable
ALTER TABLE "ProjectAnalysis" ADD COLUMN     "ambiguities" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "assumptions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "confirmedFacts" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "contradictions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "conversationSummary" TEXT,
ADD COLUMN     "discoveryTargets" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "fieldConfidence" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "keyDiscoveries" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "technicalRisks" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "userRoles" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "workflows" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "feature_ontology" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "aliases" TEXT[],
    "typicalComplexity" TEXT,
    "typicalHoursMin" INTEGER,
    "typicalHoursMax" INTEGER,
    "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "incompatibleWith" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "commonProjectTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_ontology_pkey" PRIMARY KEY ("id")
);
