import SwiftUI
import SwiftData

/// Game detail view — shows metadata, lineup, pitcher segments.
/// Phase 4 will add the live charting UI below this.
struct GameDetailView: View {
    @Bindable var gameStore: GameStore
    let gameId: String

    @State private var showLineupEditor = false
    @State private var showAddPitcher = false
    @State private var showFinalizeModal = false

    private var game: PersistedGame? {
        gameStore.games.first { $0.id == gameId }
    }

    var body: some View {
        Group {
            if let game = game {
                List {
                    // Header
                    Section("Game Info") {
                        LabeledContent("Opponent", value: game.opponent)
                        LabeledContent("Date", value: game.gameDate)
                        LabeledContent("Status") {
                            StatusBadge(status: game.status)
                        }
                        if let charter = game.charter { LabeledContent("Charter", value: charter) }
                        if let weather = game.weather { LabeledContent("Weather", value: weather) }
                        if let hc = game.homeCatcher { LabeledContent("Home C", value: hc) }
                        if let ac = game.awayCatcher { LabeledContent("Away C", value: ac) }
                        if let rec = game.babsonRecord { LabeledContent("Record", value: rec) }
                        if let st = game.standing { LabeledContent("Standing", value: st) }
                        if let ts = game.tomorrowStarter { LabeledContent("Tomorrow SP", value: ts) }
                        if let to = game.tomorrowOpponent { LabeledContent("Tomorrow Opp", value: to) }
                        if let notes = game.notes {
                            VStack(alignment: .leading) {
                                Text("Notes").font(.caption).foregroundStyle(.secondary)
                                Text(notes)
                            }
                        }
                    }

                    // Lineup
                    Section {
                        if gameStore.activeLineup.isEmpty {
                            Text("No lineup entered")
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(gameStore.activeLineup, id: \.id) { entry in
                                HStack {
                                    Text("#\(entry.lineupSlot)")
                                        .font(.headline)
                                        .frame(width: 32, alignment: .leading)
                                    Text(entry.hitterName)
                                }
                            }
                        }
                    } header: {
                        HStack {
                            Text("Lineup")
                            Spacer()
                            if game.status != "final" {
                                Button("Edit") { showLineupEditor = true }
                                    .font(.caption)
                            }
                        }
                    }

                    // Pitcher Segments
                    Section {
                        if gameStore.activeSegments.isEmpty {
                            Text("No pitchers added")
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(gameStore.activeSegments, id: \.id) { seg in
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(seg.displayName)
                                        .font(.headline)
                                    HStack {
                                        if let inn = seg.enteredInning {
                                            Text("In: \(inn)")
                                        }
                                        if let exit = seg.exitedInning {
                                            Text("Out: \(exit)")
                                        }
                                        Text("(\(seg.playerId))")
                                            .foregroundStyle(.secondary)
                                    }
                                    .font(.caption)
                                }
                            }
                        }
                    } header: {
                        HStack {
                            Text("Pitchers")
                            Spacer()
                            if game.status != "final" {
                                Button("Add") { showAddPitcher = true }
                                    .font(.caption)
                            }
                        }
                    }

                    // Plate Appearances summary
                    if !gameStore.activePlateAppearances.isEmpty {
                        Section("Plate Appearances") {
                            ForEach(gameStore.activePlateAppearances, id: \.id) { pa in
                                HStack {
                                    Text("Inn \(pa.inning)")
                                        .font(.caption)
                                        .frame(width: 48, alignment: .leading)
                                    Text(pa.hitterName)
                                    Spacer()
                                    Text(pa.resultCode ?? "…")
                                        .font(.headline)
                                        .foregroundStyle(pa.resultCode == nil ? .secondary : .primary)
                                }
                            }
                        }
                    }

                    // Pitch count summary
                    if !gameStore.activePitches.isEmpty {
                        Section("Pitch Summary") {
                            LabeledContent("Total Pitches", value: "\(gameStore.activePitches.count)")
                            let strikes = gameStore.activePitches.filter {
                                $0.pitchResult != PitchResultType.ball.rawValue
                            }.count
                            LabeledContent("Strikes", value: "\(strikes)")
                            LabeledContent("Balls", value: "\(gameStore.activePitches.count - strikes)")
                        }
                    }

                    // Live Charting Link or Finalize status
                    Section {
                        if game.status != "final" {
                            if gameStore.activeSegments.isEmpty {
                                Label("Add a starting pitcher above before charting.", systemImage: "exclamationmark.triangle")
                                    .font(.subheadline)
                                    .foregroundStyle(.orange)
                            } else if gameStore.activeLineup.isEmpty {
                                Label("Add the opponent lineup above before charting.", systemImage: "exclamationmark.triangle")
                                    .font(.subheadline)
                                    .foregroundStyle(.orange)
                            } else {
                                NavigationLink {
                                    LiveChartingView(gameStore: gameStore, initialMode: .game)
                                } label: {
                                    Label("Start Charting", systemImage: "play.circle.fill")
                                        .font(.headline)
                                        .foregroundStyle(.blue)
                                }
                            }

                            if let errorMessage = gameStore.errorMessage {
                                Text(errorMessage)
                                    .font(.caption)
                                    .foregroundStyle(.red)
                            }

                            Button(role: .destructive) {
                                showFinalizeModal = true
                            } label: {
                                Text("Finalize Game")
                                    .frame(maxWidth: .infinity, alignment: .center)
                                    .font(.headline)
                            }
                        } else {
                            Text("Game is Finalized")
                                .font(.headline)
                                .foregroundStyle(.green)
                                .frame(maxWidth: .infinity, alignment: .center)

                            if let csvURL = CSVExporter.writeToTempFile(
                                game: game,
                                segments: gameStore.activeSegments,
                                plateAppearances: gameStore.activePlateAppearances,
                                pitches: gameStore.activePitches
                            ) {
                                ShareLink(item: csvURL) {
                                    Label("Export CSV", systemImage: "square.and.arrow.up")
                                        .font(.headline)
                                        .frame(maxWidth: .infinity, alignment: .center)
                                }
                            }
                        }
                    }
                }
                .navigationTitle("vs \(game.opponent)")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    if game.status != "final" {
                        ToolbarItem(placement: .topBarTrailing) {
                            SyncStatusIndicator(status: gameStore.syncStatus)
                        }
                    }
                }
                .sheet(isPresented: $showLineupEditor) {
                    LineupEditorView(gameStore: gameStore, gameId: gameId)
                }
                .sheet(isPresented: $showAddPitcher) {
                    AddPitcherView(gameStore: gameStore, gameId: gameId)
                }
                .sheet(isPresented: $showFinalizeModal) {
                    FinalizeGameView(gameStore: gameStore, gameId: gameId)
                }
            } else {
                ContentUnavailableView("Game Not Found", systemImage: "exclamationmark.triangle")
            }
        }
        .onAppear {
            if game != nil {
                gameStore.setActiveGame(game!)
            }
        }
    }
}

// MARK: - Lineup Editor

struct LineupEditorView: View {
    @Bindable var gameStore: GameStore
    let gameId: String
    @Environment(\.dismiss) private var dismiss

    @State private var hitters: [String] = Array(repeating: "", count: 9)
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var selectedRosterSlot: LineupSlotSelection?

    var body: some View {
        NavigationStack {
            Form {
                ForEach(1...9, id: \.self) { slot in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .firstTextBaseline) {
                            Text("#\(slot)")
                                .font(.headline)
                                .frame(width: 32)

                            TextField("Hitter name", text: $hitters[slot - 1])
                        }

                        Button {
                            selectedRosterSlot = LineupSlotSelection(slot: slot)
                        } label: {
                            Label(
                                hitters[slot - 1].trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                    ? "Choose from Babson roster"
                                    : "Replace from Babson roster",
                                systemImage: "person.crop.circle.badge.plus"
                            )
                            .font(.caption)
                        }
                        .buttonStyle(.bordered)
                        .disabled(!gameStore.rosterPlayers.contains(where: \.canAppearInHitterPicker))
                    }
                }
                if let error = errorMessage {
                    Text(error).foregroundStyle(.red)
                }
                if !gameStore.rosterPlayers.contains(where: \.canAppearInHitterPicker) {
                    Text("No Babson roster loaded yet. Refresh bootstrap from Settings to import hitters.")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
            }
            .navigationTitle("Lineup")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(item: $selectedRosterSlot) { selection in
                LineupRosterPickerSheet(
                    title: "Slot #\(selection.slot)",
                    players: gameStore.rosterPlayers.filter(\.canAppearInHitterPicker)
                ) { player in
                    hitters[selection.slot - 1] = player.name
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { saveLineup() }
                        .disabled(isSaving)
                }
            }
            .onAppear {
                for entry in gameStore.activeLineup {
                    if ChartingConstants.lineupSlotRange.contains(entry.lineupSlot) {
                        hitters[entry.lineupSlot - 1] = entry.hitterName
                    }
                }
            }
        }
    }

    private func saveLineup() {
        isSaving = true
        errorMessage = nil

        let entries = hitters.enumerated().compactMap { (idx, name) -> LineupEntryPayload? in
            let trimmed = name.trimmingCharacters(in: .whitespaces)
            guard !trimmed.isEmpty else { return nil }
            return LineupEntryPayload(lineupSlot: idx + 1, hitterName: trimmed)
        }

        Task {
            do {
                try await gameStore.replaceLineup(gameId: gameId, entries: entries)
                dismiss()
            } catch {
                errorMessage = gameStore.apiClient.userFacingErrorMessage(for: error)
            }
            isSaving = false
        }
    }
}

// MARK: - Add Pitcher

struct AddPitcherView: View {
    @Bindable var gameStore: GameStore
    let gameId: String
    @Environment(\.dismiss) private var dismiss

    @State private var searchText = ""
    @State private var enteredInning: Int?
    @State private var isSaving = false
    @State private var errorMessage: String?

    private var filteredPitchers: [PersistedBootstrapPitcher] {
        if searchText.isEmpty { return gameStore.pitchers }
        return gameStore.pitchers.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
            || $0.playerId.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if let errorMessage = errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)
                        .padding(.top, 8)
                }

                List(filteredPitchers, id: \.playerId) { pitcher in
                    Button {
                        addPitcher(pitcher)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(pitcher.name)
                                Spacer()
                                Text(pitcher.throwsHand == "L" ? "LHP" : "RHP")
                                    .foregroundStyle(.secondary)
                            }

                            Text(pitcher.arsenalPitchTypes.map(\.rawValue).joined(separator: " • "))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .tint(.primary)
                }
            }
            .searchable(text: $searchText, prompt: "Search pitchers")
            .navigationTitle("Add Pitcher")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .overlay {
                if isSaving { ProgressView() }
            }
        }
    }

    private func addPitcher(_ pitcher: PersistedBootstrapPitcher) {
        isSaving = true
        errorMessage = nil
        Task {
            do {
                try await gameStore.addSegment(
                    gameId: gameId,
                    playerId: pitcher.playerId,
                    displayName: pitcher.name
                )
                dismiss()
            } catch {
                errorMessage = gameStore.apiClient.userFacingErrorMessage(for: error)
            }
            isSaving = false
        }
    }
}

private struct LineupSlotSelection: Identifiable {
    let slot: Int

    var id: Int { slot }
}

private struct LineupRosterPickerSheet: View {
    let title: String
    let players: [BootstrapRosterPlayer]
    let onSelect: (BootstrapRosterPlayer) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""

    private var filteredPlayers: [BootstrapRosterPlayer] {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return players
        }

        return players.filter { player in
            player.name.localizedCaseInsensitiveContains(trimmed)
                || player.positions.joined(separator: " ").localizedCaseInsensitiveContains(trimmed)
                || (player.academicYear?.localizedCaseInsensitiveContains(trimmed) ?? false)
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
                            if let academicYear = player.academicYear, !academicYear.isEmpty {
                                Text(academicYear)
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
