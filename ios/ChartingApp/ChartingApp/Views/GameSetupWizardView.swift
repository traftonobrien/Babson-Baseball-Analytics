import SwiftUI
import SwiftData

/// A guided 3-step wizard for creating a new game and setting up the
/// starting pitcher + opponent lineup before charting begins.
///
/// Step 1 — Game Details (opponent, date)
/// Step 2 — Starting Pitcher selection
/// Step 3 — Opponent Lineup entry
///
/// On completion the wizard dismisses and the game is ready to chart.
struct GameSetupWizardView: View {
    @Bindable var gameStore: GameStore
    @Environment(\.dismiss) private var dismiss

    // MARK: - Wizard State
    @State private var currentStep = 1
    @State private var isSaving = false
    @State private var errorMessage: String?

    // Step 1 state
    @State private var eventName = ""
    @State private var charter = ""

    // Step 2 state
    @State private var searchText = ""
    @State private var selectedPitcherId: String?

    // Step 3 state
    @State private var hitters: [String] = Array(repeating: "", count: 9)
    @State private var selectedRosterSlot: Int?

    // Created game
    @State private var createdGameId: String?

    private var gameDateString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    private var filteredPitchers: [PersistedBootstrapPitcher] {
        if searchText.isEmpty { return gameStore.activePitchers }
        return gameStore.activePitchers.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
            || $0.playerId.localizedCaseInsensitiveContains(searchText)
        }
    }

    private var stepTitle: String {
        switch currentStep {
        case 1: return "Game Details"
        case 2: return "Starting Pitcher"
        case 3: return "Opponent Lineup"
        default: return "Setup"
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Progress indicator
                HStack(spacing: 12) {
                    ForEach(1...3, id: \.self) { step in
                        HStack(spacing: 6) {
                            Circle()
                                .fill(step <= currentStep ? Color.blue : Color.gray.opacity(0.3))
                                .frame(width: 28, height: 28)
                                .overlay {
                                    if step < currentStep {
                                        Image(systemName: "checkmark")
                                            .font(.caption.bold())
                                            .foregroundStyle(.white)
                                    } else {
                                        Text("\(step)")
                                            .font(.caption.bold())
                                            .foregroundStyle(step == currentStep ? .white : .secondary)
                                    }
                                }
                            if step < 3 {
                                Rectangle()
                                    .fill(step < currentStep ? Color.blue : Color.gray.opacity(0.3))
                                    .frame(height: 2)
                            }
                        }
                    }
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 12)

                // Step content
                Group {
                    switch currentStep {
                    case 1:
                        step1GameDetails
                    case 2:
                        step2PitcherSelection
                    case 3:
                        step3LineupEntry
                    default:
                        EmptyView()
                    }
                }
            }
            .navigationTitle(stepTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if currentStep > 1 {
                        Button("Back") {
                            withAnimation { currentStep -= 1 }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Step 1: Game Details

    private var step1GameDetails: some View {
        Form {
            Section("Game Details") {
                TextField("Opponent Name", text: $eventName)
                    .textInputAutocapitalization(.words)
                TextField("Charter Name (optional)", text: $charter)
                    .textInputAutocapitalization(.words)

                LabeledContent("Date", value: gameDateString)
            }

            if let error = errorMessage {
                Section {
                    Text(error).foregroundStyle(.red)
                }
            }

            Section {
                Button {
                    createGameAndAdvance()
                } label: {
                    HStack {
                        Spacer()
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("Next: Select Pitcher")
                                .font(.headline)
                        }
                        Spacer()
                    }
                }
                .disabled(eventName.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
            }
        }
    }

    // MARK: - Step 2: Pitcher Selection

    private var step2PitcherSelection: some View {
        VStack(spacing: 0) {
            if gameStore.activePitchers.isEmpty {
                ContentUnavailableView(
                    "No Pitchers",
                    systemImage: "person.slash",
                    description: Text("Refresh bootstrap from Settings.")
                )
            } else {
                List(filteredPitchers, id: \.playerId) { pitcher in
                    Button {
                        selectedPitcherId = pitcher.playerId
                        addPitcherAndAdvance(pitcher)
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(pitcher.name)
                                Text(pitcher.arsenalPitchTypes.map(\.rawValue).joined(separator: " • "))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(pitcher.throwsHand == "L" ? "LHP" : "RHP")
                                .foregroundStyle(.secondary)
                            if selectedPitcherId == pitcher.playerId {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(.blue)
                            }
                        }
                    }
                    .tint(.primary)
                }
                .searchable(text: $searchText, prompt: "Search pitchers")
            }

            if let error = errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.horizontal)
                    .padding(.bottom, 8)
            }

            if isSaving {
                ProgressView()
                    .padding()
            }
        }
    }

    // MARK: - Step 3: Lineup

    private var step3LineupEntry: some View {
        Form {
            ForEach(1...9, id: \.self) { slot in
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("#\(slot)")
                            .font(.headline)
                            .frame(width: 32)
                        TextField("Hitter name", text: $hitters[slot - 1])
                            .textInputAutocapitalization(.words)
                    }

                    if gameStore.rosterPlayers.contains(where: \.canAppearInHitterPicker) {
                        Button {
                            selectedRosterSlot = slot
                        } label: {
                            Label(
                                hitters[slot - 1].trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                    ? "From roster"
                                    : "Replace",
                                systemImage: "person.crop.circle.badge.plus"
                            )
                            .font(.caption)
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }

            if let error = errorMessage {
                Text(error).foregroundStyle(.red)
            }

            Section {
                Button {
                    saveLineupAndFinish()
                } label: {
                    HStack {
                        Spacer()
                        if isSaving {
                            ProgressView()
                        } else {
                            Label("Finish Setup", systemImage: "checkmark.circle.fill")
                                .font(.headline)
                        }
                        Spacer()
                    }
                }
                .disabled(isSaving)

                Button {
                    // Skip lineup — can add later from GameDetailView
                    dismiss()
                } label: {
                    Text("Skip Lineup (add later)")
                        .frame(maxWidth: .infinity, alignment: .center)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .sheet(item: Binding(
            get: { selectedRosterSlot.map { WizardSlotSelection(slot: $0) } },
            set: { selectedRosterSlot = $0?.slot }
        )) { selection in
            LineupRosterPickerSheetForWizard(
                title: "Slot #\(selection.slot)",
                players: gameStore.rosterPlayers.filter(\.canAppearInHitterPicker)
            ) { player in
                hitters[selection.slot - 1] = player.name
            }
        }
    }

    // MARK: - Actions

    private func createGameAndAdvance() {
        isSaving = true
        errorMessage = nil

        Task {
            do {
                let game = try await gameStore.createGame(
                    opponent: eventName.trimmingCharacters(in: .whitespaces),
                    gameDate: gameDateString,
                    charter: charter.trimmingCharacters(in: .whitespaces).isEmpty ? nil : charter.trimmingCharacters(in: .whitespaces)
                )
                createdGameId = game.id
                gameStore.setActiveGame(game)
                withAnimation { currentStep = 2 }
            } catch {
                errorMessage = gameStore.apiClient.userFacingErrorMessage(for: error)
            }
            isSaving = false
        }
    }

    private func addPitcherAndAdvance(_ pitcher: PersistedBootstrapPitcher) {
        guard let gameId = createdGameId else { return }
        isSaving = true
        errorMessage = nil

        Task {
            do {
                try await gameStore.addSegment(
                    gameId: gameId,
                    playerId: pitcher.playerId,
                    displayName: pitcher.name
                )
                withAnimation { currentStep = 3 }
            } catch {
                errorMessage = gameStore.apiClient.userFacingErrorMessage(for: error)
            }
            isSaving = false
        }
    }

    private func saveLineupAndFinish() {
        guard let gameId = createdGameId else { return }
        isSaving = true
        errorMessage = nil

        let entries = hitters.enumerated().compactMap { (idx, name) -> LineupEntryPayload? in
            let trimmed = name.trimmingCharacters(in: .whitespaces)
            guard !trimmed.isEmpty else { return nil }
            return LineupEntryPayload(lineupSlot: idx + 1, hitterName: trimmed)
        }

        Task {
            do {
                if !entries.isEmpty {
                    try await gameStore.replaceLineup(gameId: gameId, entries: entries)
                }
                dismiss()
            } catch {
                errorMessage = gameStore.apiClient.userFacingErrorMessage(for: error)
            }
            isSaving = false
        }
    }
}

// MARK: - Helpers

private struct WizardSlotSelection: Identifiable {
    let slot: Int
    var id: Int { slot }
}

private struct LineupRosterPickerSheetForWizard: View {
    let title: String
    let players: [BootstrapRosterPlayer]
    let onSelect: (BootstrapRosterPlayer) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""

    private var filteredPlayers: [BootstrapRosterPlayer] {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return players }
        return players.filter {
            $0.name.localizedCaseInsensitiveContains(trimmed)
                || $0.positions.joined(separator: " ").localizedCaseInsensitiveContains(trimmed)
                || ($0.academicYear?.localizedCaseInsensitiveContains(trimmed) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            List(filteredPlayers) { player in
                Button {
                    onSelect(player)
                    dismiss()
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(player.name)
                            .foregroundStyle(.primary)
                        HStack(spacing: 8) {
                            if !player.positions.isEmpty {
                                Text(player.positions.joined(separator: " / "))
                            }
                            if let year = player.academicYear, !year.isEmpty {
                                Text(year)
                            }
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                }
                .tint(.primary)
            }
            .searchable(text: $searchText, prompt: "Search roster")
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}
