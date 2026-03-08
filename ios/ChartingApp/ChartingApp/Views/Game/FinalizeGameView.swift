import SwiftUI

/// Finalization modal that allows the scorer to set manual Runs and Earned Runs
/// for each pitcher before locking the game.
struct FinalizeGameView: View {
    @Bindable var gameStore: GameStore
    let gameId: String
    
    @Environment(\.dismiss) private var dismiss
    
    // Keyed by segment ID
    @State private var runsOverrides: [String: (r: Int, er: Int)] = [:]
    @State private var isSaving = false
    
    var body: some View {
        NavigationStack {
            Form {
                Section(
                    header: Text("Finalize Game"),
                    footer: Text("Finalizing prevents further live edits and pushes the final manual run totals to the server for export.")
                ) {
                    if let errorMessage = gameStore.errorMessage {
                        Text(errorMessage)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }

                    if gameStore.activeSegments.isEmpty {
                        Text("No pitchers charted.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(gameStore.activeSegments, id: \.id) { seg in
                            VStack(alignment: .leading, spacing: 12) {
                                Text(seg.displayName)
                                    .font(.headline)
                                
                                HStack {
                                    Text("Runs")
                                    Spacer()
                                    Stepper("\(runsOverrides[seg.id]?.r ?? 0)", value: Binding(
                                        get: { runsOverrides[seg.id]?.r ?? 0 },
                                        set: { updateOverrides(for: seg.id, r: $0, er: runsOverrides[seg.id]?.er ?? 0) }
                                    ), in: 0...99)
                                    .frame(width: 120)
                                }
                                
                                HStack {
                                    Text("Earned Runs")
                                    Spacer()
                                    Stepper("\(runsOverrides[seg.id]?.er ?? 0)", value: Binding(
                                        get: { runsOverrides[seg.id]?.er ?? 0 },
                                        set: { updateOverrides(for: seg.id, r: runsOverrides[seg.id]?.r ?? 0, er: $0) }
                                    ), in: 0...99)
                                    .frame(width: 120)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
            .navigationTitle("Game Totals")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lock & Finalize") {
                        Task {
                            isSaving = true
                            let didFinalize = await gameStore.finalizeGame(runsOverrides: runsOverrides)
                            isSaving = false
                            if didFinalize {
                                dismiss()
                            }
                        }
                    }
                    .font(.headline)
                    .tint(.red)
                    .disabled(isSaving)
                }
            }
            .overlay {
                if isSaving { ProgressView() }
            }
            .onAppear {
                // Initialize state from existing segment values
                for seg in gameStore.activeSegments {
                    runsOverrides[seg.id] = (r: seg.runsOverride ?? 0, er: seg.earnedRunsOverride ?? 0)
                }
            }
        }
    }
    
    private func updateOverrides(for id: String, r: Int, er: Int) {
        runsOverrides[id] = (r: r, er: er)
    }
}
