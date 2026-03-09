import Foundation
import SwiftData

enum GameStoreError: LocalizedError {
    case missingActiveSegment
    case closeCurrentPABeforeNextPitch
    case invalidPAResult(String)
    case closeCurrentPABeforeChangingPitcher
    case closeCurrentPABeforeFinalizing

    var errorDescription: String? {
        switch self {
        case .missingActiveSegment:
            return "Add a pitcher before charting the next plate appearance."
        case .closeCurrentPABeforeNextPitch:
            return "Close the current plate appearance before recording another pitch."
        case .invalidPAResult(let guidance):
            return guidance
        case .closeCurrentPABeforeChangingPitcher:
            return "Close the current plate appearance before changing pitchers."
        case .closeCurrentPABeforeFinalizing:
            return "Close the open plate appearance before finalizing the game."
        }
    }
}

/// Central store managing the active game state, SwiftData persistence,
/// and API sync coordination. Every mutation immediately saves to SwiftData.
@Observable
final class GameStore {
    private let rosterPlayersCacheKey = "pt_charting_roster_players"
    private let gameStateOverridesCacheKey = "pt_charting_game_state_overrides"

    private let modelContext: ModelContext
    let apiClient: APIClient
    private let syncQueue: SyncQueueManager

    // MARK: - Sync State
    var syncStatus: SyncStatus = .synced
    
    /// The currently active (in-progress) game, if any.
    var activeGame: PersistedGame?

    /// All locally persisted games.
    var games: [PersistedGame] = []

    /// Cached bootstrap pitchers.
    var pitchers: [PersistedBootstrapPitcher] = []

    /// Available pitchers filtered by `canAppearInPitcherPicker`
    var activePitchers: [PersistedBootstrapPitcher] {
        pitchers.filter { p in
            if let rp = rosterPlayers.first(where: { $0.playerId == p.playerId }) {
                return rp.canAppearInPitcherPicker
            }
            return false
        }
    }

    /// Cached Babson roster players used for hitter selection and live AB setup.
    var rosterPlayers: [BootstrapRosterPlayer] = []

    /// Segments for the active game.
    var activeSegments: [PersistedSegment] = []

    /// Lineup entries for the active game.
    var activeLineup: [PersistedLineupEntry] = []

    /// Plate appearances for the active game.
    var activePlateAppearances: [PersistedPlateAppearance] = []

    /// Pitches for the active game.
    var activePitches: [PersistedPitch] = []

    // MARK: - Live Charting State
    
    var liveState = ChartingLiveState()
    var currentInning: Int = 1
    var isTopInning: Bool = true
    var currentOuts: Int = 0
    var currentBalls: Int = 0
    var currentStrikes: Int = 0
    var currentBatterSlot: Int = 1

    /// Loading / error state.
    var isLoading: Bool = false
    var errorMessage: String?

    private var gameStateOverridesByGameId: [String: GameStateOverride] = [:]

    init(modelContext: ModelContext, apiClient: APIClient = APIClient()) {
        self.modelContext = modelContext
        self.apiClient = apiClient
        self.syncQueue = SyncQueueManager(apiClient: apiClient, modelContainer: modelContext.container)
        
        // Setup sync status observer
        Task {
            await syncQueue.setOnStatusChange { @Sendable [weak self] status in
                Task { @MainActor in
                    self?.syncStatus = status
                }
            }
        }
        
        loadLocalPitchers()
        loadLocalGames()
        loadCachedRosterPlayers()
        loadGameStateOverrides()
        recoverActiveGame()
    }

    // MARK: - Relaunch Recovery

    /// On app launch, look for an active game in SwiftData and restore it.
    func recoverActiveGame() {
        let descriptor = FetchDescriptor<PersistedGame>(
            predicate: #Predicate { $0.status == "active" },
            sortBy: [SortDescriptor(\.updatedAt, order: .reverse)]
        )
        do {
            let activeGames = try modelContext.fetch(descriptor)
            if let game = activeGames.first {
                activeGame = game
                loadGameChildren(gameId: game.id)
                // Attempt to sync immediately in case we were offline when we closed
                enqueueSync(for: game)
            }
            // Drain any persisted sync entries that survived an app kill
            Task {
                await syncQueue.drainPendingEntries()
            }
        } catch {
            print("Failed to recover active game: \(error)")
        }
    }

    // MARK: - Local Data Loading

    func loadLocalGames() {
        let descriptor = FetchDescriptor<PersistedGame>(
            sortBy: [SortDescriptor(\.gameDate, order: .reverse)]
        )
        do {
            games = try modelContext.fetch(descriptor)
        } catch {
            print("Failed to load local games: \(error)")
        }
    }

    func loadLocalPitchers() {
        let descriptor = FetchDescriptor<PersistedBootstrapPitcher>(
            sortBy: [SortDescriptor(\.name)]
        )
        do {
            pitchers = try modelContext.fetch(descriptor)
        } catch {
            print("Failed to load local pitchers: \(error)")
        }
    }

    func loadCachedRosterPlayers() {
        guard let data = UserDefaults.standard.data(forKey: rosterPlayersCacheKey) else {
            rosterPlayers = []
            return
        }

        do {
            let decoded = try JSONDecoder().decode([BootstrapRosterPlayer].self, from: data)
            rosterPlayers = decoded.sorted {
                $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
            }
        } catch {
            rosterPlayers = []
            print("Failed to load cached roster players: \(error)")
        }
    }

    private func loadGameChildren(gameId: String) {
        do {
            let segDesc = FetchDescriptor<PersistedSegment>(
                predicate: #Predicate { $0.gameId == gameId },
                sortBy: [SortDescriptor(\.segmentOrder)]
            )
            activeSegments = try modelContext.fetch(segDesc)

            let lineupDesc = FetchDescriptor<PersistedLineupEntry>(
                predicate: #Predicate { $0.gameId == gameId },
                sortBy: [SortDescriptor(\.lineupSlot)]
            )
            activeLineup = try modelContext.fetch(lineupDesc)

            let paDesc = FetchDescriptor<PersistedPlateAppearance>(
                predicate: #Predicate { $0.gameId == gameId },
                sortBy: [SortDescriptor(\.paOrder)]
            )
            activePlateAppearances = try modelContext.fetch(paDesc)

            let pitchDesc = FetchDescriptor<PersistedPitch>(
                predicate: #Predicate { $0.gameId == gameId },
                sortBy: [SortDescriptor(\.pitchOrder)]
            )
            activePitches = try modelContext.fetch(pitchDesc)
            
            recalculateChartingState()
        } catch {
            print("Failed to load game children for \(gameId): \(error)")
        }
    }
    
    // MARK: - Charting Mechanics
    
    /// Recalculates the current inning, outs, count, and batter based on the saved PAs and Pitches.
    private func recalculateChartingState() {
        liveState = deriveChartingLiveState(
            segments: activeSegments.map { $0.toAPIModel() },
            plateAppearances: activePlateAppearances.map { $0.toAPIModel() },
            pitches: activePitches.compactMap { $0.toAPIModel() },
            gameStateOverride: activeGameStateOverride
        )
        currentInning = liveState.inning
        isTopInning = liveState.isTopInning
        currentOuts = liveState.outs
        currentBalls = liveState.balls
        currentStrikes = liveState.strikes
        currentBatterSlot = liveState.batterSlot
    }

    private var plateAppearancesById: [String: PersistedPlateAppearance] {
        Dictionary(uniqueKeysWithValues: activePlateAppearances.map { ($0.id, $0) })
    }

    var activePitcherProfile: PersistedBootstrapPitcher? {
        guard let activePlayerId = activeSegments.last?.playerId else {
            return nil
        }
        return pitchers.first(where: { $0.playerId == activePlayerId })
    }

    var currentPitcherPitchTotal: Int {
        guard let activeSegmentId = liveState.activeSegmentId ?? activeSegments.last?.id else {
            return 0
        }
        let paIds = Set(activePlateAppearances.filter { $0.segmentId == activeSegmentId }.map(\.id))
        return activePitches.filter { paIds.contains($0.paId) }.count
    }

    var currentInningPitchTotal: Int {
        let paIds = Set(activePlateAppearances.filter { $0.inning == currentInning }.map(\.id))
        return activePitches.filter { paIds.contains($0.paId) }.count
    }

    var totalPitchCount: Int {
        activePitches.count
    }

    var canEditGameState: Bool {
        activeGame != nil && liveState.openPAId == nil
    }

    func availablePitchTypesForActivePitcher() -> [PitchType] {
        normalizedPitchTypes(activePitcherProfile?.arsenalPitchTypes ?? PitchType.allCases)
    }

    func applyGameStateOverride(inning: Int, halfInning: ChartingHalfInning, outs: Int) {
        guard let game = activeGame else { return }
        guard liveState.openPAId == nil else {
            errorMessage = "Close the current plate appearance before changing inning or outs."
            return
        }

        gameStateOverridesByGameId[game.id] = GameStateOverride(
            inning: max(1, inning),
            isTopInning: halfInning == .top,
            outs: max(0, min(2, outs)),
            anchorPAOrder: activePlateAppearances.last?.paOrder ?? -1
        )
        persistGameStateOverrides()
        errorMessage = nil
        recalculateChartingState()
    }

    private func normalizedPitchTypes(_ pitchTypes: [PitchType]) -> [PitchType] {
        let uniqueTypes = Set(pitchTypes + [.other])
        return PitchType.allCases.filter { uniqueTypes.contains($0) }
    }
    
    /// Ensures we have an open Plate Appearance for the current batter.
    /// Returns the ID of the open PA.
    func ensureOpenPA(lineupSlotOverride: Int? = nil, hitterNameOverride: String? = nil) -> String {
        guard let game = activeGame else { return "" }
        guard let activeSegmentId = liveState.activeSegmentId ?? activeSegments.last?.id else { return "" }
        
        if let lastPA = activePlateAppearances.last, lastPA.resultCode == nil {
            return lastPA.id
        }

        let resolvedLineupSlot = lineupSlotOverride ?? currentBatterSlot
        let resolvedHitterName = hitterNameOverride
            ?? activeLineup.first(where: { $0.lineupSlot == resolvedLineupSlot })?.hitterName
            ?? "Unknown"
        
        let newPA = PersistedPlateAppearance(
            id: UUID().uuidString,
            gameId: game.id,
            segmentId: activeSegmentId,
            paOrder: activePlateAppearances.count,
            inning: currentInning,
            hitterName: resolvedHitterName,
            lineupSlot: resolvedLineupSlot,
            resultCode: nil,
            buntContext: false
        )
        
        modelContext.insert(newPA)
        activePlateAppearances.append(newPA)
        recalculateChartingState()
        save()
        return newPA.id
    }
    
    /// Records a pitch and updates the count.
    @discardableResult
    func recordPitch(
        type: PitchType,
        location: Int?,
        result: PitchResultType,
        buntContext: Bool,
        velocity: Int? = nil,
        lineupSlotOverride: Int? = nil,
        hitterNameOverride: String? = nil
    ) -> Bool {
        guard let game = activeGame else { return false }
        guard !liveState.needsPAClosure else {
            errorMessage = GameStoreError.closeCurrentPABeforeNextPitch.errorDescription
            return false
        }

        let paId = ensureOpenPA(
            lineupSlotOverride: lineupSlotOverride,
            hitterNameOverride: hitterNameOverride
        )
        guard !paId.isEmpty else {
            errorMessage = GameStoreError.missingActiveSegment.errorDescription
            return false
        }
        if let openPA = activePlateAppearances.last, openPA.id == paId {
            openPA.buntContext = openPA.buntContext || buntContext
        }
        
        let newPitch = PersistedPitch(
            id: UUID().uuidString,
            gameId: game.id,
            paId: paId,
            pitchOrder: activePitches.count,
            pitchType: type.rawValue,
            locationCell: location,
            pitchResult: result.rawValue,
            ballsBefore: currentBalls,
            strikesBefore: currentStrikes,
            velocity: velocity
        )
        
        modelContext.insert(newPitch)
        activePitches.append(newPitch)
        errorMessage = nil
        recalculateChartingState()
        save()
        return true
    }
    
    /// Closes out the current plate appearance with a result code.
    func closePlateAppearance(result: PAResultType) {
        guard let lastPA = activePlateAppearances.last, lastPA.resultCode == nil else { return }
        guard liveState.availableResults.contains(result) else {
            errorMessage = GameStoreError.invalidPAResult(liveState.guidanceText).errorDescription
            return
        }

        lastPA.resultCode = result.rawValue
        errorMessage = nil
        recalculateChartingState()
        save()
    }
    
    /// Undoes the last action (pitch or PA close)
    func undoLastAction() {
        guard activeGame != nil else { return }
        
        if let lastPA = activePlateAppearances.last {
            if lastPA.resultCode != nil {
                // The last action was closing a PA. Re-open it.
                lastPA.resultCode = nil
                save()
                recalculateChartingState()
                return
            }
            
            // The last action was a pitch in the open PA.
            let pitchesForThisPA = activePitches.filter { $0.paId == lastPA.id }
            if let lastPitch = pitchesForThisPA.last {
                modelContext.delete(lastPitch)
                activePitches.removeAll { $0.id == lastPitch.id }
                
                // If that was the only pitch, and the PA has nothing else, maybe delete the PA too
                if pitchesForThisPA.count == 1 {
                    modelContext.delete(lastPA)
                    activePlateAppearances.removeAll { $0.id == lastPA.id }
                }
                
                save()
                recalculateChartingState()
                return
            }
            
            // Empty PA open with no pitches, just delete it
            modelContext.delete(lastPA)
            activePlateAppearances.removeAll { $0.id == lastPA.id }
            save()
            recalculateChartingState()
        }
    }

    // MARK: - Bootstrap

    /// Fetch bootstrap data from the API and cache pitchers locally.
    func fetchBootstrap() async {
        isLoading = true
        errorMessage = nil
        do {
            let response = try await apiClient.fetchBootstrap()

            // Clear old pitchers and save new ones
            let existing = try modelContext.fetch(FetchDescriptor<PersistedBootstrapPitcher>())
            for p in existing { modelContext.delete(p) }

            for pitcher in response.pitchers {
                modelContext.insert(PersistedBootstrapPitcher(from: pitcher))
            }

            // Save recent games from bootstrap
            for apiGame in response.recentGames {
                saveGameLocally(apiGame)
            }

            cacheRosterPlayers(response.rosterPlayers)
            save()
            loadLocalPitchers()
            loadCachedRosterPlayers()
            loadLocalGames()
        } catch {
            errorMessage = apiClient.userFacingErrorMessage(for: error)
        }
        isLoading = false
    }

    // MARK: - Game CRUD

    /// Create a game via the API and persist it locally.
    func createGame(
        opponent: String,
        gameDate: String,
        charter: String? = nil,
        weather: String? = nil,
        homeCatcher: String? = nil,
        awayCatcher: String? = nil,
        babsonRecord: String? = nil,
        standing: String? = nil,
        tomorrowStarter: String? = nil,
        tomorrowOpponent: String? = nil,
        notes: String? = nil
    ) async throws -> PersistedGame {
        let apiGame = try await apiClient.createGame(
            opponent: opponent,
            gameDate: gameDate,
            charter: charter,
            weather: weather,
            homeCatcher: homeCatcher,
            awayCatcher: awayCatcher,
            babsonRecord: babsonRecord,
            standing: standing,
            tomorrowStarter: tomorrowStarter,
            tomorrowOpponent: tomorrowOpponent,
            notes: notes
        )

        let persisted = PersistedGame(from: apiGame)
        modelContext.insert(persisted)
        save()
        loadLocalGames()
        return persisted
    }

    /// Open a game: fetch the latest snapshot from the API and store locally.
    func openGame(id: String) async throws {
        isLoading = true
        errorMessage = nil
        do {
            let snapshot = try await apiClient.fetchGameSnapshot(id: id)
            saveSnapshotLocally(snapshot)
            save()

            activeGame = try modelContext.fetch(
                FetchDescriptor<PersistedGame>(predicate: #Predicate { $0.id == id })
            ).first
            loadGameChildren(gameId: id)
        } catch {
            errorMessage = apiClient.userFacingErrorMessage(for: error)
        }
        isLoading = false
    }

    /// Set a game as the active game (for local-only state transitions).
    func setActiveGame(_ game: PersistedGame) {
        activeGame = game
        loadGameChildren(gameId: game.id)
    }

    // MARK: - Lineup

    /// Replace the full lineup via API and persist locally.
    func replaceLineup(gameId: String, entries: [LineupEntryPayload]) async throws {
        let apiEntries = try await apiClient.replaceLineup(gameId: gameId, entries: entries)

        // Remove old local entries for this game
        let existing = try modelContext.fetch(
            FetchDescriptor<PersistedLineupEntry>(predicate: #Predicate { $0.gameId == gameId })
        )
        for e in existing { modelContext.delete(e) }

        // Insert new entries
        for entry in apiEntries {
            modelContext.insert(PersistedLineupEntry(from: entry))
        }
        save()
        activeLineup = try modelContext.fetch(
            FetchDescriptor<PersistedLineupEntry>(
                predicate: #Predicate { $0.gameId == gameId },
                sortBy: [SortDescriptor(\.lineupSlot)]
            )
        )
    }

    // MARK: - Segments

    /// Add a pitcher segment via API and persist locally.
    func addSegment(gameId: String, playerId: String, displayName: String? = nil, enteredInning: Int? = nil) async throws {
        if let lastPA = activePlateAppearances.last,
           lastPA.resultCode == nil {
            throw GameStoreError.closeCurrentPABeforeChangingPitcher
        }

        if let previous = activeSegments.last,
           previous.exitedInning == nil {
            let exitInning = liveState.isBetweenInnings ? max(currentInning - 1, 1) : currentInning
            let updated = try await apiClient.updateSegment(
                gameId: gameId,
                segId: previous.id,
                fields: ["exitedInning": exitInning]
            )
            previous.exitedInning = updated.exitedInning
        }

        let apiSeg = try await apiClient.addSegment(
            gameId: gameId,
            playerId: playerId,
            displayName: displayName,
            enteredInning: enteredInning ?? currentInning
        )
        modelContext.insert(PersistedSegment(from: apiSeg))
        errorMessage = nil
        save()
        loadGameChildren(gameId: gameId)
    }

    // MARK: - Finalization
    
    /// Apply manual run overrides to pitchers, mark the game as final, and save/sync.
    func finalizeGame(runsOverrides: [String: (r: Int, er: Int)]) async -> Bool {
        guard let game = activeGame else { return false }
        guard liveState.openPAId == nil else {
            errorMessage = GameStoreError.closeCurrentPABeforeFinalizing.errorDescription
            return false
        }
        
        // 1. Update segment overrides
        for seg in activeSegments {
            if let override = runsOverrides[seg.id] {
                seg.runsOverride = override.r
                seg.earnedRunsOverride = override.er
            }
        }
        
        // 2. Mark game status as final
        game.status = GameStatus.final_.rawValue
        
        // 3. Save to trigger SwiftData flush and background sync queue
        save()
        errorMessage = nil
        
        // 4. Detach active game to send user back to the list
        Task { @MainActor in
            self.activeGame = nil
        }
        return true
    }

    // MARK: - Local Persistence Helpers

    /// Immediately save the SwiftData context and trigger an offline sync queue evaluation if requested.
    func save(triggerSync: Bool = true) {
        do {
            try modelContext.save()
            
            if triggerSync, let game = activeGame {
                enqueueSync(for: game)
            }
        } catch {
            print("SwiftData save failed: \(error)")
        }
    }
    
    private func enqueueSync(for game: PersistedGame) {
        // Build the payload snapshot
        let payload = ChartingGameSnapshot(
            game: game.toAPIModel(),
            segments: activeSegments.map { $0.toAPIModel() },
            lineup: activeLineup.map { $0.toAPIModel() },
            plateAppearances: activePlateAppearances.map { $0.toAPIModel() },
            pitches: activePitches.compactMap { $0.toAPIModel() }
        )
        
        Task {
            await syncQueue.enqueueSync(gameId: game.id, revision: game.revision, payload: payload)
        }
    }

    private func saveGameLocally(_ apiGame: ChartingGame) {
        // Upsert: update if exists, insert if new
        let id = apiGame.id
        let descriptor = FetchDescriptor<PersistedGame>(predicate: #Predicate { $0.id == id })
        if let existing = try? modelContext.fetch(descriptor).first {
            existing.update(from: apiGame)
        } else {
            modelContext.insert(PersistedGame(from: apiGame))
        }
    }

    private func cacheRosterPlayers(_ players: [BootstrapRosterPlayer]) {
        do {
            let sortedPlayers = players.sorted {
                $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
            }
            let data = try JSONEncoder().encode(sortedPlayers)
            UserDefaults.standard.set(data, forKey: rosterPlayersCacheKey)
            rosterPlayers = sortedPlayers
        } catch {
            print("Failed to cache roster players: \(error)")
        }
    }

    private func saveSnapshotLocally(_ snapshot: ChartingGameSnapshot) {
        let gameId = snapshot.game.id

        // Save the game
        saveGameLocally(snapshot.game)

        // Replace segments
        if let old = try? modelContext.fetch(
            FetchDescriptor<PersistedSegment>(predicate: #Predicate { $0.gameId == gameId })
        ) {
            for s in old { modelContext.delete(s) }
        }
        for seg in snapshot.segments {
            modelContext.insert(PersistedSegment(from: seg))
        }

        // Replace lineup
        if let old = try? modelContext.fetch(
            FetchDescriptor<PersistedLineupEntry>(predicate: #Predicate { $0.gameId == gameId })
        ) {
            for e in old { modelContext.delete(e) }
        }
        for entry in snapshot.lineup {
            modelContext.insert(PersistedLineupEntry(from: entry))
        }

        // Replace PAs
        if let old = try? modelContext.fetch(
            FetchDescriptor<PersistedPlateAppearance>(predicate: #Predicate { $0.gameId == gameId })
        ) {
            for pa in old { modelContext.delete(pa) }
        }
        for pa in snapshot.plateAppearances {
            modelContext.insert(PersistedPlateAppearance(from: pa))
        }

        // Replace pitches
        if let old = try? modelContext.fetch(
            FetchDescriptor<PersistedPitch>(predicate: #Predicate { $0.gameId == gameId })
        ) {
            for p in old { modelContext.delete(p) }
        }
        for pitch in snapshot.pitches {
            modelContext.insert(PersistedPitch(from: pitch))
        }
    }

    private var activeGameStateOverride: GameStateOverride? {
        guard let gameId = activeGame?.id else {
            return nil
        }
        return gameStateOverridesByGameId[gameId]
    }

    private func loadGameStateOverrides() {
        guard let data = UserDefaults.standard.data(forKey: gameStateOverridesCacheKey) else {
            gameStateOverridesByGameId = [:]
            return
        }

        do {
            gameStateOverridesByGameId = try JSONDecoder().decode([String: GameStateOverride].self, from: data)
        } catch {
            gameStateOverridesByGameId = [:]
            print("Failed to load cached game state overrides: \(error)")
        }
    }

    private func persistGameStateOverrides() {
        do {
            let data = try JSONEncoder().encode(gameStateOverridesByGameId)
            UserDefaults.standard.set(data, forKey: gameStateOverridesCacheKey)
        } catch {
            print("Failed to cache game state overrides: \(error)")
        }
    }
}
