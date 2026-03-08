import SwiftUI

/// Lets the scorer select from the active pitcher's available pitch families.
struct PitchTypePicker: View {
    @Bindable var state: ChartingState
    let availablePitchTypes: [PitchType]

    private let columns = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Pitch Type")
                    .font(.headline)

                Spacer()

                Text(state.selectedPitchType?.rawValue ?? "Select pitch")
                    .font(.caption.bold())
                    .foregroundStyle(state.selectedPitchType == nil ? Color.secondary : .blue)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.blue.opacity(state.selectedPitchType == nil ? 0.08 : 0.14))
                    .clipShape(Capsule())
            }

            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(availablePitchTypes) { type in
                    typeButton(type)
                }
            }

            HStack(spacing: 12) {
                Text("Bunt Context")
                    .font(.subheadline.bold())
                    .foregroundStyle(.secondary)

                Spacer()

                Toggle("", isOn: $state.selectedBuntContext)
                    .labelsHidden()
            }
            .padding(.top, 4)
        }
    }

    @ViewBuilder
    private func typeButton(_ type: PitchType) -> some View {
        let color = pitchColor(for: type)
        let isSelected = state.selectedPitchType == type

        Button {
            state.selectedPitchType = type
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Text(type.rawValue)
                    .font(.body.bold())
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
                    .minimumScaleFactor(0.9)

                Spacer(minLength: 0)

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title3)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 54, alignment: .leading)
            .padding(.horizontal, 14)
                .background(isSelected ? color.opacity(0.9) : color.opacity(0.16))
                .foregroundStyle(isSelected ? .white : color)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(color.opacity(isSelected ? 0.95 : 0.25), lineWidth: isSelected ? 2 : 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
    }

    private func pitchColor(for type: PitchType) -> Color {
        switch type {
        case .fastball:
            return .red
        case .slider:
            return .orange
        case .curveball:
            return .blue
        case .changeup:
            return .green
        case .splitCut:
            return .purple
        case .other:
            return .gray
        }
    }
}
