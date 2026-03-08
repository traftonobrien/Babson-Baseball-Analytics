import Foundation

/// Holds the transient selection state and the local practice workflow state
/// used by the live charting screen.
@Observable
final class ChartingState {
    var mode: ChartingMode = .liveAB

    var selectedPitchType: PitchType?
    var selectedLocation: Int?
    var selectedPitchResult: PitchResultType?
    var pendingVelocity: Int?

    var isShowingHistory = false
    var isShowingLiveABSetup = false
    var isShowingGameCorrection = false

    var liveABSetup = LiveABSetup()
    var activeLiveABSession: LiveABSession?
    var completedLiveABSessions: [LiveABSession] = []

    var gameLineupOverrideSlot: Int?
    var gameHitterOverrideName: String = ""

    var requiresLocationForPendingPitch: Bool {
        selectedPitchResult != .hitByPitch
    }

    var isPendingPitchReady: Bool {
        guard selectedPitchType != nil, selectedPitchResult != nil else {
            return false
        }
        return !requiresLocationForPendingPitch || selectedLocation != nil
    }

    var pendingPitchSummary: String {
        let type = selectedPitchType?.rawValue ?? "Pitch type"
        let location = selectedLocation.map { "Cell \($0)" } ?? "Zone"
        let result = selectedPitchResult?.displayLabel(isBuntMode: isBuntModeActive) ?? "Action"
        let contextPrefix = isBuntModeActive ? "Bunt • " : ""
        let veloSuffix = pendingVelocity.map { " • \($0) mph" } ?? ""
        return "\(contextPrefix)\(type) • \(location) • \(result)\(veloSuffix)"
    }

    var currentLiveABSession: LiveABSession? {
        activeLiveABSession
    }

    var liveABHistoryEntries: [PitchHistoryEntry] {
        if let activeLiveABSession {
            return activeLiveABSession.historyEntries
        }
        return completedLiveABSessions.last?.historyEntries ?? []
    }

    var liveABGamePitchTotal: Int {
        allLiveABSessions.reduce(0) { $0 + $1.pitches.count }
    }

    var hasGameCorrection: Bool {
        gameLineupOverrideSlot != nil || !gameHitterOverrideName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var resolvedGameHitterOverrideName: String? {
        let trimmed = gameHitterOverrideName.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    var canStartLiveAB: Bool {
        liveABSetup.isReady
    }

    var currentLiveABCountPreset: LiveABCountPreset {
        activeLiveABSession?.setup.countPreset ?? liveABSetup.countPreset
    }

    var isBuntModeActive: Bool {
        mode == .liveAB && currentLiveABCountPreset.isBuntMode
    }

    var availablePitchResults: [PitchResultType] {
        if isBuntModeActive {
            return [.inPlay, .foul, .ball]
        }
        return [.ball, .calledStrike, .swingingStrike, .foul, .inPlay, .hitByPitch]
    }

    func liveABPitcherTotal(playerId: String) -> Int {
        allLiveABSessions
            .filter { $0.setup.pitcherPlayerId == playerId }
            .reduce(0) { $0 + $1.pitches.count }
    }

    func liveABInningTotal(inning: Int, halfInning: ChartingHalfInning) -> Int {
        allLiveABSessions
            .filter { $0.setup.inning == inning && $0.setup.halfInning == halfInning }
            .reduce(0) { $0 + $1.pitches.count }
    }

    func clearPitchDraft() {
        selectedPitchType = nil
        selectedLocation = nil
        selectedPitchResult = nil
        pendingVelocity = nil
    }

    func resetForModeChange() {
        clearPitchDraft()
    }

    func beginLiveABSession(with setup: LiveABSetup) {
        liveABSetup = setup
        activeLiveABSession = LiveABSession(
            id: UUID().uuidString,
            setup: setup,
            pitches: [],
            result: nil
        )
        liveABSetup.countPreset = .zeroZero
        clearPitchDraft()
    }

    func setLiveABPitcher(playerId: String, name: String, throwsHand: String) {
        liveABSetup.pitcherPlayerId = playerId
        liveABSetup.pitcherName = name
        liveABSetup.pitcherThrowsHand = throwsHand

        guard var session = activeLiveABSession else {
            return
        }
        session.setup.pitcherPlayerId = playerId
        session.setup.pitcherName = name
        session.setup.pitcherThrowsHand = throwsHand
        activeLiveABSession = session
    }

    func setLiveABCountPreset(_ preset: LiveABCountPreset) {
        if var session = activeLiveABSession {
            session.setup.countPreset = preset
            activeLiveABSession = session
        } else {
            liveABSetup.countPreset = preset
        }

        guard let selectedPitchResult, !availablePitchResults.contains(selectedPitchResult) else {
            return
        }
        self.selectedPitchResult = nil
    }

    func setLiveABHitter(name: String) {
        liveABSetup.hitterName = name

        guard var session = activeLiveABSession else {
            guard liveABSetup.isReady else {
                return
            }
            beginLiveABSession(with: liveABSetup)
            return
        }
        session.setup.hitterName = name
        activeLiveABSession = session
    }

    @discardableResult
    func commitLiveABPitch() -> Bool {
        guard isPendingPitchReady,
              let type = selectedPitchType,
              let selectedResult = selectedPitchResult,
              var session = activeLiveABSession else {
            return false
        }

        let result = normalizedCommittedResult(from: selectedResult)

        let newPitch = LiveABPitchRecord(
            id: UUID().uuidString,
            pitchOrder: session.pitches.count,
            pitchType: type,
            locationCell: selectedLocation,
            pitchResult: result,
            ballsBefore: session.currentBalls,
            strikesBefore: session.currentStrikes,
            buntContext: session.setup.isBuntMode || result == .buntFoul,
            velocity: pendingVelocity
        )

        session.pitches.append(newPitch)
        activeLiveABSession = session
        clearPitchDraft()
        return true
    }

    @discardableResult
    func closeLiveAB(result: PAResultType) -> Bool {
        guard var session = activeLiveABSession,
              session.availableResults.contains(result) else {
            return false
        }

        session.result = result
        completedLiveABSessions.append(session)
        activeLiveABSession = nil
        liveABSetup.hitterName = ""
        liveABSetup.countPreset = .zeroZero
        clearPitchDraft()
        return true
    }

    func undoLiveABAction() {
        if var session = activeLiveABSession {
            if !session.pitches.isEmpty {
                session.pitches.removeLast()
                activeLiveABSession = session
            } else {
                activeLiveABSession = nil
                liveABSetup.countPreset = .zeroZero
            }
            return
        }

        guard var lastSession = completedLiveABSessions.popLast() else {
            return
        }
        lastSession.result = nil
        activeLiveABSession = lastSession
    }

    func applyGameCorrection(slot: Int?, hitterName: String?) {
        gameLineupOverrideSlot = slot
        gameHitterOverrideName = hitterName ?? ""
    }

    func clearGameCorrection() {
        gameLineupOverrideSlot = nil
        gameHitterOverrideName = ""
    }

    private var allLiveABSessions: [LiveABSession] {
        if let activeLiveABSession {
            return completedLiveABSessions + [activeLiveABSession]
        }
        return completedLiveABSessions
    }

    private func normalizedCommittedResult(from selectedResult: PitchResultType) -> PitchResultType {
        if isBuntModeActive && selectedResult == .foul {
            return .buntFoul
        }
        return selectedResult
    }
}
