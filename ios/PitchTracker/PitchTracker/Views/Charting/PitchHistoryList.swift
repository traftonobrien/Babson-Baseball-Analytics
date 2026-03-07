import SwiftUI

/// Compact history list of pitches in the active PA (and previous PAs) with undo.
struct PitchHistoryList: View {
    let activePitches: [PersistedPitch]
    let onUndo: () -> Void
    
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Pitch History")
                    .font(.subheadline.bold())
                Spacer()
                Button(role: .destructive) {
                    onUndo()
                } label: {
                    Image(systemName: "arrow.uturn.backward.circle.fill")
                        .font(.title3)
                }
                .disabled(activePitches.isEmpty)
            }
            .padding(.horizontal)
            .padding(.bottom, 8)
            
            List {
                ForEach(activePitches.reversed(), id: \.id) { pitch in
                    HStack {
                        Text("\(pitch.pitchOrder + 1)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .frame(width: 20, alignment: .leading)
                        
                        Text(pitch.pitchType.prefix(1).uppercased())
                            .font(.subheadline.bold())
                            .frame(width: 20)
                        
                        Text(pitch.pitchResult.replacingOccurrences(of: "_", with: " ").capitalized)
                            .font(.caption)
                            .lineLimit(1)
                        
                        Spacer()
                        
                        Text("\(pitch.ballsBefore)-\(pitch.strikesBefore)")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 2)
                }
            }
            .listStyle(.plain)
            .background(Color(white: 0.98))
        }
    }
}
