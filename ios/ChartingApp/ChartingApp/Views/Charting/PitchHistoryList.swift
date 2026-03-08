import SwiftUI

/// Compact history list for the current active charting thread with undo.
struct PitchHistoryList: View {
    let entries: [PitchHistoryEntry]
    let onUndo: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Pitch History")
                    .font(.headline)
                Spacer()
                Button(role: .destructive) {
                    onUndo()
                } label: {
                    Label("Undo", systemImage: "arrow.uturn.backward.circle.fill")
                        .labelStyle(.iconOnly)
                        .font(.title3)
                }
                .disabled(entries.isEmpty)
            }
            .padding(.horizontal)
            .padding(.top)
            .padding(.bottom, 8)

            if entries.isEmpty {
                ContentUnavailableView(
                    "No pitches yet",
                    systemImage: "list.bullet.rectangle",
                    description: Text("Committed pitches for the active AB will appear here.")
                )
                .frame(maxHeight: .infinity)
            } else {
                List {
                    ForEach(entries.reversed(), id: \.id) { entry in
                        HStack(spacing: 12) {
                            Text("\(entry.pitchNumber)")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.secondary)
                                .frame(width: 24, alignment: .leading)

                            VStack(alignment: .leading, spacing: 3) {
                                Text(entry.pitchTypeLabel)
                                    .font(.subheadline.weight(.semibold))
                                Text(entry.resultLabel)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            VStack(alignment: .trailing, spacing: 3) {
                                Text(entry.countLabel)
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(.secondary)
                                if let locationLabel = entry.locationLabel {
                                    Text(locationLabel)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                if let velocityLabel = entry.velocityLabel {
                                    Text(velocityLabel)
                                        .font(.caption2.monospacedDigit())
                                        .foregroundStyle(.orange)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
                .listStyle(.plain)
            }
        }
    }
}
