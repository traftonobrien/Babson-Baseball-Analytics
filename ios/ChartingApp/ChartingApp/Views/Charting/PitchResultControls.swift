import SwiftUI

/// Buttons to select the pending pitch action without committing the pitch.
struct PitchResultControls: View {
    @Bindable var state: ChartingState
    let availableResults: [PitchResultType]
    let isBuntMode: Bool
    let isInteractive: Bool
    let blockedReason: String?

    private let columns = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Action")
                    .font(.headline)

                Spacer()

                if isBuntMode {
                    Text("Bunt Rep")
                        .font(.caption.bold())
                        .foregroundStyle(.brown)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.brown.opacity(0.14))
                        .clipShape(Capsule())
                }

                Text(state.selectedPitchResult?.displayLabel ?? "Select action")
                    .font(.caption.bold())
                    .foregroundStyle(state.selectedPitchResult == nil ? Color.secondary : .blue)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.blue.opacity(state.selectedPitchResult == nil ? 0.08 : 0.14))
                    .clipShape(Capsule())
            }

            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(availableResults) { result in
                    resultButton(result)
                }
            }

            if let blockedReason, !isInteractive {
                Text(blockedReason)
                    .font(.caption)
                    .foregroundStyle(.orange)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    @ViewBuilder
    private func resultButton(_ result: PitchResultType) -> some View {
        let isSelected = state.selectedPitchResult == result
        let color = color(for: result)

        Button {
            guard isInteractive else { return }
            state.selectedPitchResult = result
        } label: {
            HStack(alignment: .top, spacing: 8) {
                Text(result.displayLabel)
                    .font(.subheadline.bold())
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)

                Spacer(minLength: 0)

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.body.bold())
                }
            }
            .frame(maxWidth: .infinity, minHeight: 50, alignment: .leading)
            .padding(.horizontal, 12)
                .background(isSelected ? color.opacity(0.92) : color.opacity(0.16))
                .foregroundStyle(isSelected ? .white : color)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(color.opacity(isSelected ? 0.95 : 0.24), lineWidth: isSelected ? 2 : 1)
                )
                .opacity(isInteractive ? 1 : 0.45)
        }
        .buttonStyle(.plain)
        .disabled(!isInteractive)
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
    }

    private func color(for result: PitchResultType) -> Color {
        switch result {
        case .ball:
            return .green
        case .calledStrike:
            return .red
        case .swingingStrike:
            return .orange
        case .foul:
            return .gray
        case .buntFoul:
            return .gray
        case .inPlay:
            return .blue
        case .hitByPitch:
            return .purple
        }
    }
}
