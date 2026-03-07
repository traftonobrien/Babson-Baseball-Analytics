import Foundation

// MARK: - Domain Enums

/// Six charting pitch-type families matching the server's PITCH_TYPES constant.
enum PitchType: String, Codable, CaseIterable, Identifiable {
    case fastball    = "Fastball"
    case curveball   = "Curveball"
    case slider      = "Slider"
    case changeup    = "Changeup"
    case splitCut    = "Split/Cut"
    case other       = "Other"

    var id: String { rawValue }
}

/// Seven pitch-result values matching the server's PITCH_RESULTS constant.
enum PitchResultType: String, Codable, CaseIterable, Identifiable {
    case ball           = "ball"
    case calledStrike   = "called_strike"
    case swingingStrike = "swinging_strike"
    case foul           = "foul"
    case buntFoul       = "bunt_foul"
    case inPlay         = "in_play"
    case hitByPitch     = "hit_by_pitch"

    var id: String { rawValue }

    var displayLabel: String {
        switch self {
        case .ball:           return "Ball"
        case .calledStrike:   return "Called Strike"
        case .swingingStrike: return "Swinging Strike"
        case .foul:           return "Foul"
        case .buntFoul:       return "Bunt Foul"
        case .inPlay:         return "In Play"
        case .hitByPitch:     return "HBP"
        }
    }
}

/// Three game lifecycle states matching the server's GAME_STATUSES constant.
enum GameStatus: String, Codable, CaseIterable {
    case draft  = "draft"
    case active = "active"
    case final_ = "final"

    // Custom coding because "final" is a Swift reserved word.
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try container.decode(String.self)
        switch raw {
        case "draft":  self = .draft
        case "active": self = .active
        case "final":  self = .final_
        default:       self = .draft
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .draft:  try container.encode("draft")
        case .active: try container.encode("active")
        case .final_: try container.encode("final")
        }
    }
}

// MARK: - Domain Constants

enum ChartingConstants {
    static let locationCellRange: ClosedRange<Int> = 1...17
    static let lineupSlotRange: ClosedRange<Int> = 1...9
    static let chartingCookie = "pt_charting"
}

enum PAResultFamily {
    case strikeout
    case freePass
    case hit
    case out
    case misc
}

enum PAResultType: String, Codable, CaseIterable, Identifiable {
    case strikeout = "K"
    case walk = "BB"
    case hitByPitch = "HBP"
    case single = "1B"
    case double = "2B"
    case triple = "3B"
    case homeRun = "HR"
    case flyOutCenter = "F8"
    case groundOut63 = "6-3"
    case groundOut53 = "5-3"
    case doublePlay = "DP"
    case error6 = "E6"
    case fieldersChoice = "FC"

    var id: String { rawValue }

    var outsRecorded: Int {
        switch self {
        case .strikeout, .flyOutCenter, .groundOut63, .groundOut53:
            return 1
        case .doublePlay:
            return 2
        case .walk, .hitByPitch, .single, .double, .triple, .homeRun, .error6, .fieldersChoice:
            return 0
        }
    }

    var family: PAResultFamily {
        switch self {
        case .strikeout:
            return .strikeout
        case .walk, .hitByPitch:
            return .freePass
        case .single, .double, .triple, .homeRun:
            return .hit
        case .flyOutCenter, .groundOut63, .groundOut53, .doublePlay:
            return .out
        case .error6, .fieldersChoice:
            return .misc
        }
    }

    static let primaryRow: [PAResultType] = [
        .strikeout,
        .walk,
        .hitByPitch,
        .single,
        .double,
        .triple,
        .homeRun,
    ]

    static let secondaryRow: [PAResultType] = [
        .flyOutCenter,
        .groundOut63,
        .groundOut53,
        .doublePlay,
        .error6,
        .fieldersChoice,
    ]
}

enum PAClosureState: Equatable {
    case none
    case strikeout
    case walk
    case hitByPitch
    case inPlay

    var availableResults: [PAResultType] {
        switch self {
        case .none:
            return []
        case .strikeout:
            return [.strikeout]
        case .walk:
            return [.walk]
        case .hitByPitch:
            return [.hitByPitch]
        case .inPlay:
            return [
                .single,
                .double,
                .triple,
                .homeRun,
                .flyOutCenter,
                .groundOut63,
                .groundOut53,
                .doublePlay,
                .error6,
                .fieldersChoice,
            ]
        }
    }

    var guidanceText: String {
        switch self {
        case .none:
            return "Record the next pitch."
        case .strikeout:
            return "Strike three logged. Close the PA with K."
        case .walk:
            return "Ball four logged. Close the PA with BB."
        case .hitByPitch:
            return "Hit by pitch logged. Close the PA with HBP."
        case .inPlay:
            return "Ball in play logged. Choose the plate appearance result."
        }
    }

    var requiresClosure: Bool {
        self != .none
    }
}

struct PAPitchProgress: Equatable {
    var balls: Int = 0
    var strikes: Int = 0
    var closureState: PAClosureState = .none
    var lastPitchResult: PitchResultType?

    var needsTermination: Bool {
        closureState.requiresClosure
    }
}

struct ChartingLiveState: Equatable {
    var inning: Int = 1
    var isTopInning: Bool = true
    var outs: Int = 0
    var balls: Int = 0
    var strikes: Int = 0
    var batterSlot: Int = 1
    var openPAId: String?
    var activeSegmentId: String?
    var closureState: PAClosureState = .none
    var lastPitchResult: PitchResultType?
    var isBetweenInnings: Bool = false

    var availableResults: [PAResultType] {
        closureState.availableResults
    }

    var needsPAClosure: Bool {
        closureState.requiresClosure
    }

    var guidanceText: String {
        if openPAId == nil {
            return "Ready for the next hitter."
        }
        return closureState.guidanceText
    }
}

private func applyPitchResult(to progress: inout PAPitchProgress, result: PitchResultType) {
    progress.lastPitchResult = result

    switch result {
    case .ball:
        if progress.balls >= 3 {
            progress.balls = 4
            progress.closureState = .walk
        } else {
            progress.balls += 1
        }
    case .calledStrike, .swingingStrike:
        if progress.strikes >= 2 {
            progress.strikes = 3
            progress.closureState = .strikeout
        } else {
            progress.strikes += 1
        }
    case .foul:
        if progress.strikes < 2 {
            progress.strikes += 1
        }
    case .buntFoul:
        if progress.strikes >= 2 {
            progress.strikes = 3
            progress.closureState = .strikeout
        } else {
            progress.strikes += 1
        }
    case .inPlay:
        progress.closureState = .inPlay
    case .hitByPitch:
        progress.closureState = .hitByPitch
    }
}

func derivePAPitchProgress(from pitches: [ChartingPitch]) -> PAPitchProgress {
    var progress = PAPitchProgress()
    let orderedPitches = pitches.sorted { lhs, rhs in
        if lhs.pitchOrder == rhs.pitchOrder {
            return lhs.id < rhs.id
        }
        return lhs.pitchOrder < rhs.pitchOrder
    }

    for pitch in orderedPitches {
        if progress.needsTermination {
            break
        }
        applyPitchResult(to: &progress, result: pitch.pitchResult)
    }

    return progress
}

func deriveChartingLiveState(
    segments: [ChartingPitcherSegment],
    plateAppearances: [ChartingPlateAppearance],
    pitches: [ChartingPitch]
) -> ChartingLiveState {
    let orderedSegments = segments.sorted { lhs, rhs in
        if lhs.segmentOrder == rhs.segmentOrder {
            return lhs.id < rhs.id
        }
        return lhs.segmentOrder < rhs.segmentOrder
    }
    let orderedPAs = plateAppearances.sorted { lhs, rhs in
        if lhs.paOrder == rhs.paOrder {
            return lhs.id < rhs.id
        }
        return lhs.paOrder < rhs.paOrder
    }

    let pitchesByPA = Dictionary(grouping: pitches) { $0.paId }
    var state = ChartingLiveState()
    state.activeSegmentId = orderedSegments.last?.id

    for pa in orderedPAs {
        state.inning = max(state.inning, pa.inning)

        let paPitches = pitchesByPA[pa.id] ?? []
        if pa.resultCode == nil {
            let progress = derivePAPitchProgress(from: paPitches)
            state.balls = progress.balls
            state.strikes = progress.strikes
            state.batterSlot = pa.lineupSlot
            state.openPAId = pa.id
            state.activeSegmentId = pa.segmentId
            state.closureState = progress.closureState
            state.lastPitchResult = progress.lastPitchResult
            state.isBetweenInnings = false
            return state
        }

        if let result = pa.resultCode.flatMap(PAResultType.init(rawValue:)) {
            state.outs += result.outsRecorded
            while state.outs >= 3 {
                state.outs -= 3
                state.inning += 1
            }
        }

        state.balls = 0
        state.strikes = 0
        state.batterSlot = (pa.lineupSlot % 9) + 1
        state.openPAId = nil
        state.closureState = .none
        state.lastPitchResult = nil
    }

    if let lastPA = orderedPAs.last,
       let resultCode = lastPA.resultCode,
       let result = PAResultType(rawValue: resultCode) {
        state.isBetweenInnings = result.outsRecorded > 0 && state.outs == 0 && state.inning > lastPA.inning
    }

    return state
}

// MARK: - API Model Structs

/// Mirrors the server's `ChartingGame` interface.
struct ChartingGame: Codable, Identifiable, Equatable {
    let id: String
    var opponent: String
    var gameDate: String
    var status: GameStatus
    var revision: Int
    var charter: String?
    var weather: String?
    var homeCatcher: String?
    var awayCatcher: String?
    var babsonRecord: String?
    var standing: String?
    var tomorrowStarter: String?
    var tomorrowOpponent: String?
    var notes: String?
    var createdAt: String
    var updatedAt: String
}

/// Mirrors the server's `ChartingPitcherSegment` interface.
struct ChartingPitcherSegment: Codable, Identifiable, Equatable {
    let id: String
    let gameId: String
    let playerId: String
    var displayName: String
    var segmentOrder: Int
    var enteredInning: Int?
    var exitedInning: Int?
    var runsOverride: Int?
    var earnedRunsOverride: Int?
}

/// Mirrors the server's `ChartingPlateAppearance` interface.
struct ChartingPlateAppearance: Codable, Identifiable, Equatable {
    let id: String
    let gameId: String
    let segmentId: String
    var paOrder: Int
    var inning: Int
    var hitterName: String
    var lineupSlot: Int
    var resultCode: String?
    var buntContext: Bool
}

/// Mirrors the server's `ChartingPitch` interface.
struct ChartingPitch: Codable, Identifiable, Equatable {
    let id: String
    let gameId: String
    let paId: String
    var pitchOrder: Int
    var pitchType: PitchType
    var locationCell: Int?
    var pitchResult: PitchResultType
    var ballsBefore: Int
    var strikesBefore: Int
}

/// Mirrors the server's `ChartingLineupEntry` interface.
struct ChartingLineupEntry: Codable, Identifiable, Equatable {
    let id: String
    let gameId: String
    var lineupSlot: Int
    var hitterName: String
}

/// Full game snapshot returned by GET /api/charting/games/[id].
struct ChartingGameSnapshot: Codable, Equatable {
    let game: ChartingGame
    let segments: [ChartingPitcherSegment]
    let lineup: [ChartingLineupEntry]
    let plateAppearances: [ChartingPlateAppearance]
    let pitches: [ChartingPitch]
}

/// A Babson pitcher from the bootstrap endpoint.
struct BootstrapPitcher: Codable, Identifiable, Equatable {
    let playerId: String
    let name: String
    let throwsHand: String // "R" or "L"

    var id: String { playerId }

    enum CodingKeys: String, CodingKey {
        case playerId
        case name
        case throwsHand = "throws"
    }
}

/// Payload returned by GET /api/charting/bootstrap.
struct BootstrapResponse: Codable {
    let pitchers: [BootstrapPitcher]
    let recentGames: [ChartingGame]
}
