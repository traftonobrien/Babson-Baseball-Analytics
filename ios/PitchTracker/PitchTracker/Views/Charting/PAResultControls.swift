import SwiftUI

/// Buttons to close a plate appearance.
struct PAResultControls: View {
    let availableResults: [PAResultType]
    let statusMessage: String
    let submitResult: (PAResultType) -> Void
    
    var body: some View {
        VStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Close PA")
                    .font(.caption)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .foregroundStyle(.secondary)
                Text(statusMessage)
                    .font(.caption)
                    .foregroundStyle(availableResults.isEmpty ? Color.secondary : .orange)
            }
            
            HStack {
                ForEach(PAResultType.primaryRow) { result in
                    paButton(result)
                }
            }
            
            HStack {
                ForEach(PAResultType.secondaryRow) { result in
                    paButton(result)
                }
            }
        }
    }
    
    @ViewBuilder
    private func paButton(_ result: PAResultType) -> some View {
        let enabled = availableResults.contains(result)
        let color = color(for: result)

        Button {
            submitResult(result)
        } label: {
            Text(result.rawValue)
                .font(.footnote.bold())
                .frame(maxWidth: .infinity, minHeight: 36)
                .background(enabled ? color.opacity(0.2) : Color.gray.opacity(0.1))
                .foregroundStyle(enabled ? color : .secondary)
                .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .disabled(!enabled)
        .buttonStyle(.plain)
    }

    private func color(for result: PAResultType) -> Color {
        switch result.family {
        case .strikeout:
            return .red
        case .freePass:
            return result == .hitByPitch ? .purple : .green
        case .hit:
            return .blue
        case .out:
            return .orange
        case .misc:
            return .gray
        }
    }
}
