import SwiftUI
import SwiftData

/// Create a new charting game — opponent, date, and optional metadata fields.
struct GameSetupView: View {
    @Bindable var gameStore: GameStore
    @Environment(\.dismiss) private var dismiss

    @State private var eventName = ""
    @State private var charter = ""

    @State private var isSaving = false
    @State private var errorMessage: String?

    private var gameDateString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Game Details") {
                    TextField("Event Name", text: $eventName)
                    TextField("Charter Name", text: $charter)
                }

                if let error = errorMessage {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("New Game")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                        Button("Create") { createGame() }
                        .disabled(eventName.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
        }
    }

    private func createGame() {
        isSaving = true
        errorMessage = nil

        Task {
            do {
                let game = try await gameStore.createGame(
                    opponent: eventName.trimmingCharacters(in: .whitespaces),
                    gameDate: gameDateString,
                    charter: charter.nilIfEmpty
                )
                gameStore.setActiveGame(game)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
            isSaving = false
        }
    }
}

private extension String {
    var nilIfEmpty: String? {
        let t = trimmingCharacters(in: .whitespaces)
        return t.isEmpty ? nil : t
    }
}
