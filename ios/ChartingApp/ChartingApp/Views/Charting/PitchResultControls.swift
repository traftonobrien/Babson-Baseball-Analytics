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
                    .font(.system(.title3, design: .rounded).weight(.semibold))

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

                Text(state.selectedPitchResult?.displayLabel(isBuntMode: isBuntMode) ?? "Select action")
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
                Text(result.displayLabel(isBuntMode: isBuntMode))
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
            .frame(maxWidth: .infinity, minHeight: 60, alignment: .leading)
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
            return Color(red: 0.25, green: 0.75, blue: 0.4)
        case .calledStrike:
            return Color(red: 0.9, green: 0.3, blue: 0.35)
        case .swingingStrike:
            return Color(red: 0.95, green: 0.55, blue: 0.2)
        case .foul, .buntFoul:
            return Color(red: 0.55, green: 0.6, blue: 0.65)
        case .inPlay:
            return Color(red: 0.2, green: 0.6, blue: 0.95)
        case .hitByPitch:
            return Color(red: 0.6, green: 0.35, blue: 0.85)
        }
    }
}
