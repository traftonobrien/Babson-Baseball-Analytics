import Foundation

/// Holds the ephemeral state of a pitch before it is submitted.
@Observable
class ChartingState {
    var selectedPitchType: PitchType?
    var selectedLocation: Int?
    var selectedBuntContext: Bool = false
    
    /// Indicates whether a pitch is ready to be submitted.
    /// Some results (like HBP) might not strictly require a location, but
    /// for a standard pitch, both type and location are needed.
    var isReadyForResult: Bool {
        selectedPitchType != nil && selectedLocation != nil
    }
    
    /// Resets the ephemeral state after a pitch is recorded.
    func resetForm() {
        selectedPitchType = nil
        selectedLocation = nil
        selectedBuntContext = false
    }
}
