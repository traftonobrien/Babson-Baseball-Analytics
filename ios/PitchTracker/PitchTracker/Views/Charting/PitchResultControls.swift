import SwiftUI

/// Buttons to record the pitch result. Submits the pitch to GameStore.
struct PitchResultControls: View {
    @Bindable var state: ChartingState
    let canRecordPitch: Bool
    let blockedReason: String?
    let recordPitch: (PitchType, Int?, PitchResultType, Bool) -> Void
    
    var body: some View {
        VStack(spacing: 12) {
            Text("Action")
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)
            
            HStack(spacing: 12) {
                resultButton(.ball, color: .green)
                resultButton(.calledStrike, color: .red)
                resultButton(.swingingStrike, color: .orange)
            }
            
            HStack(spacing: 12) {
                resultButton(.foul, color: .gray)
                resultButton(.buntFoul, color: .brown)
                resultButton(.inPlay, color: .blue)
            }
            
            HStack {
                resultButton(.hitByPitch, color: .purple)
                Spacer()
            }

            if let blockedReason, !canRecordPitch {
                Text(blockedReason)
                    .font(.caption)
                    .foregroundStyle(.orange)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
    
    @ViewBuilder
    private func resultButton(_ result: PitchResultType, color: Color) -> some View {
        // HBP doesn't strictly need location, but we require Type for everything.
        let isReady = canRecordPitch && state.selectedPitchType != nil && (state.selectedLocation != nil || result == .hitByPitch)
        
        Button {
            guard let type = state.selectedPitchType else { return }
            let loc = state.selectedLocation
            recordPitch(type, loc, result, state.selectedBuntContext)
            state.resetForm()
        } label: {
            Text(result.displayLabel)
                .font(.subheadline.bold())
                .frame(maxWidth: .infinity, minHeight: 60)
                .background(isReady ? color : color.opacity(0.3))
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .disabled(!isReady)
        .buttonStyle(.plain)
    }
}
