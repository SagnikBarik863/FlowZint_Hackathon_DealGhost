export interface FeatureOntologyEntry {
  id: string                   // snake_case canonical ID e.g. 'realtime_delivery_tracking'
  canonicalName: string        // human-readable e.g. 'Real-time Delivery Tracking'
  category: string             // 'auth' | 'payments' | 'tracking' | 'logistics' | ...
  description: string | null   // one-sentence description of what this capability does
  aliases: string[]            // ['live tracking', 'GPS tracking', 'track orders', ...]
  typicalComplexity: 'LOW' | 'MEDIUM' | 'HIGH' | null
  typicalHoursMin: number | null
  typicalHoursMax: number | null
  dependencies: string[]       // canonical IDs this feature requires to function
  incompatibleWith: string[]
  relatedFeatures: string[]    // commonly appear alongside this feature (not required)
  commonProjectTypes: string[] // project types that typically need this feature
}
