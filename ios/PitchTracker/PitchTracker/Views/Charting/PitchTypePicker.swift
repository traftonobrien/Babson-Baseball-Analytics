import SwiftUI

/// Lets the user select the PitchType.
struct PitchTypePicker: View {
    @Bindable var state: ChartingState
    
    var body: some View {
        VStack(spacing: 12) {
            Text("Pitch Type")
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)
            
            HStack(spacing: 12) {
                typeButton(.fastball, color: .red)
                typeButton(.slider, color: .yellow)
                typeButton(.curveball, color: .blue)
            }
            
            HStack(spacing: 12) {
                typeButton(.changeup, color: .green)
                typeButton(.splitCut, color: .purple)
                typeButton(.other, color: .gray)
            }
            
            HStack {
                Text("Bunt Context")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
                Toggle("", isOn: $state.selectedBuntContext)
                    .labelsHidden()
            }
            .padding(.horizontal, 4)
            .padding(.top, 12)
        }
    }
    
    @ViewBuilder
    private func typeButton(_ type: PitchType, color: Color) -> some View {
        let isSelected = state.selectedPitchType == type
        
        Button {
            state.selectedPitchType = type
        } label: {
            Text(type.rawValue)
                .font(.headline)
                .frame(maxWidth: .infinity, minHeight: 60)
                .background(isSelected ? color : color.opacity(0.15))
                .foregroundStyle(isSelected ? .white : color)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(color, lineWidth: isSelected ? 2 : 0)
                )
        }
        .buttonStyle(.plain)
    }
}
