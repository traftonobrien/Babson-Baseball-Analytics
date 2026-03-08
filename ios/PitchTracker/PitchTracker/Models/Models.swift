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

enum ChartingMode: String, Codable, CaseIterable, Identifiable {
    case game = "Game"
    case liveAB = "Live AB"

    var id: String { rawValue }
}

enum ChartingHalfInning: String, Codable, CaseIterable, Identifiable {
    case top = "Top"
    case bottom = "Bottom"

    var id: String { rawValue }

    var isTopInning: Bool {
        self == .top
    }

    var shortLabel: String {
        switch self {
        case .top:
            return "Top"
        case .bottom:
            return "Bot"
        }
    }
}

struct LiveABSetup: Equatable {
    var pitcherPlayerId: String = ""
    var pitcherName: String = ""
    var pitcherThrowsHand: String = "R"
    var hitterName: String = ""
    var inning: Int = 1
    var halfInning: ChartingHalfInning = .top
    var outs: Int = 0
    var startingBalls: Int = 0
    var startingStrikes: Int = 0

    var isReady: Bool {
        !pitcherPlayerId.isEmpty && !hitterName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var matchupText: String {
        let pitcherLine = pitcherName.isEmpty ? "Pitcher not set" : "P: \(pitcherName) (\(pitcherThrowsHand == "L" ? "LHP" : "RHP"))"
        let hitterLine = hitterName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "H: Hitter not set" : "H: \(hitterName)"
        return "\(pitcherLine)\n\(hitterLine)"
    }

    var inningText: String {
        "\(halfInning.shortLabel) \(inning)"
    }
}

struct LiveABPitchRecord: Identifiable, Equatable {
    let id: String
    var pitchOrder: Int
    var pitchType: PitchType
    var locationCell: Int?
    var pitchResult: PitchResultType
    var ballsBefore: Int
    var strikesBefore: Int
    var buntContext: Bool

    func toChartingPitch(paId: String) -> ChartingPitch {
        ChartingPitch(
            id: id,
            gameId: "live-ab-session",
            paId: paId,
            pitchOrder: pitchOrder,
            pitchType: pitchType,
            locationCell: locationCell,
            pitchResult: pitchResult,
            ballsBefore: ballsBefore,
            strikesBefore: strikesBefore
        )
    }
}

struct PitchHistoryEntry: Identifiable, Equatable {
    let id: String
    var pitchNumber: Int
    var pitchTypeLabel: String
    var resultLabel: String
    var countLabel: String
    var locationLabel: String?
}

struct LiveABSession: Identifiable, Equatable {
    let id: String
    var setup: LiveABSetup
    var pitches: [LiveABPitchRecord] = []
    var result: PAResultType?

    var progress: PAPitchProgress {
        derivePAPitchProgress(
            from: pitches.map { $0.toChartingPitch(paId: id) },
            seedBalls: setup.startingBalls,
            seedStrikes: setup.startingStrikes
        )
    }

    var currentBalls: Int { progress.balls }
    var currentStrikes: Int { progress.strikes }
    var availableResults: [PAResultType] { progress.closureState.availableResults }
    var needsPAClosure: Bool { progress.closureState.requiresClosure }
    var isTopInning: Bool { setup.halfInning.isTopInning }

    var guidanceText: String {
        if result != nil {
            return "Plate appearance saved. Start the next AB."
        }
        if pitches.isEmpty {
            return "Select zone, pitch type, and action, then confirm the pitch."
        }
        return progress.closureState.guidanceText
    }

    var historyEntries: [PitchHistoryEntry] {
        pitches.map {
            PitchHistoryEntry(
                id: $0.id,
                pitchNumber: $0.pitchOrder + 1,
                pitchTypeLabel: $0.pitchType.rawValue,
                resultLabel: $0.pitchResult.displayLabel,
                countLabel: "\($0.ballsBefore)-\($0.strikesBefore)",
                locationLabel: $0.locationCell.map { "Cell \($0)" }
            )
        }
    }
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

    case flyOutPitcher = "F1"
    case flyOutCatcher = "F2"
    case flyOutFirst = "F3"
    case flyOutSecond = "F4"
    case flyOutThird = "F5"
    case flyOutShort = "F6"
    case flyOutLeft = "F7"
    case flyOutCenter = "F8"
    case flyOutRight = "F9"

    case lineOutPitcher = "L1"
    case lineOutCatcher = "L2"
    case lineOutFirst = "L3"
    case lineOutSecond = "L4"
    case lineOutThird = "L5"
    case lineOutShort = "L6"
    case lineOutLeft = "L7"
    case lineOutCenter = "L8"
    case lineOutRight = "L9"

    case popOutPitcher = "P1"
    case popOutCatcher = "P2"
    case popOutFirst = "P3"
    case popOutSecond = "P4"
    case popOutThird = "P5"
    case popOutShort = "P6"
    case popOutLeft = "P7"
    case popOutCenter = "P8"
    case popOutRight = "P9"

    case groundOut13 = "1-3"
    case groundOut23 = "2-3"
    case groundOut43 = "4-3"
    case groundOut53 = "5-3"
    case groundOut63 = "6-3"

    case unassistedPitcher = "1U"
    case unassistedCatcher = "2U"
    case unassistedFirst = "3U"
    case unassistedSecond = "4U"
    case unassistedThird = "5U"
    case unassistedShort = "6U"
    case unassistedLeft = "7U"
    case unassistedCenter = "8U"
    case unassistedRight = "9U"

    case doublePlay = "DP"
    case doublePlay163 = "1-6-3 DP"
    case doublePlay243 = "2-4-3 DP"
    case doublePlay263 = "2-6-3 DP"
    case doublePlay363 = "3-6-3 DP"
    case doublePlay463 = "4-6-3 DP"
    case doublePlay543 = "5-4-3 DP"
    case doublePlay643 = "6-4-3 DP"

    case error1 = "E1"
    case error2 = "E2"
    case error3 = "E3"
    case error4 = "E4"
    case error5 = "E5"
    case error6 = "E6"
    case error7 = "E7"
    case error8 = "E8"
    case error9 = "E9"

    case fieldersChoice = "FC"
    case fieldersChoice12 = "FC 1-2"
    case fieldersChoice16 = "FC 1-6"
    case fieldersChoice24 = "FC 2-4"
    case fieldersChoice25 = "FC 2-5"
    case fieldersChoice36 = "FC 3-6"
    case fieldersChoice46 = "FC 4-6"
    case fieldersChoice52 = "FC 5-2"
    case fieldersChoice54 = "FC 5-4"
    case fieldersChoice64 = "FC 6-4"
    case fieldersChoice65 = "FC 6-5"

    var id: String { rawValue }

    var outsRecorded: Int {
        if self == .strikeout {
            return 1
        }
        if isDoublePlay {
            return 2
        }
        if family == .out {
            return 1
        }
        return 0
    }

    var family: PAResultFamily {
        switch self {
        case .strikeout:
            return .strikeout
        case .walk, .hitByPitch:
            return .freePass
        case .single, .double, .triple, .homeRun:
            return .hit
        case .error1, .error2, .error3, .error4, .error5, .error6, .error7, .error8, .error9,
             .fieldersChoice, .fieldersChoice12, .fieldersChoice16, .fieldersChoice24, .fieldersChoice25,
             .fieldersChoice36, .fieldersChoice46, .fieldersChoice52, .fieldersChoice54,
             .fieldersChoice64, .fieldersChoice65:
            return .misc
        default:
            return .out
        }
    }

    var isFlyOut: Bool { rawValue.count == 2 && rawValue.first == "F" }
    var isLineOut: Bool { rawValue.count == 2 && rawValue.first == "L" }
    var isPopOut: Bool { rawValue.count == 2 && rawValue.first == "P" }
    var isGroundOut: Bool { rawValue.contains("-") && !rawValue.hasPrefix("FC ") && !rawValue.hasSuffix(" DP") }
    var isUnassistedOut: Bool { rawValue.count == 2 && rawValue.hasSuffix("U") }
    var isDoublePlay: Bool { rawValue == "DP" || rawValue.hasSuffix(" DP") }
    var isError: Bool { rawValue.count == 2 && rawValue.first == "E" }
    var isFieldersChoice: Bool { rawValue == "FC" || rawValue.hasPrefix("FC ") }

    var detailText: String {
        switch self {
        case .strikeout:
            return "Strikeout"
        case .walk:
            return "Walk"
        case .hitByPitch:
            return "Hit by pitch"
        case .single:
            return "Single"
        case .double:
            return "Double"
        case .triple:
            return "Triple"
        case .homeRun:
            return "Home run"
        case .doublePlay:
            return "Double play"
        case .fieldersChoice:
            return "Fielder's choice"
        default:
            if isFlyOut, let position = trailingPositionLabel {
                return "Fly out to \(position)"
            }
            if isLineOut, let position = trailingPositionLabel {
                return "Line out to \(position)"
            }
            if isPopOut, let position = trailingPositionLabel {
                return "Pop out to \(position)"
            }
            if isGroundOut {
                return "Ground out, \(rawValue)"
            }
            if isUnassistedOut, let position = leadingPositionLabel {
                return "Unassisted out by \(position)"
            }
            if isDoublePlay {
                return "Double play, \(rawValue.replacingOccurrences(of: " DP", with: ""))"
            }
            if isError, let position = trailingPositionLabel {
                return "Reached on error by \(position)"
            }
            if isFieldersChoice {
                let scoring = rawValue.replacingOccurrences(of: "FC ", with: "")
                return scoring == "FC" ? "Fielder's choice" : "Fielder's choice, \(scoring)"
            }
            return rawValue
        }
    }

    static let hitOptions: [PAResultType] = [
        .single,
        .double,
        .triple,
        .homeRun,
    ]

    static let flyOutOptions: [PAResultType] = [
        .flyOutPitcher,
        .flyOutCatcher,
        .flyOutFirst,
        .flyOutSecond,
        .flyOutThird,
        .flyOutShort,
        .flyOutLeft,
        .flyOutCenter,
        .flyOutRight,
    ]

    static let lineOutOptions: [PAResultType] = [
        .lineOutPitcher,
        .lineOutCatcher,
        .lineOutFirst,
        .lineOutSecond,
        .lineOutThird,
        .lineOutShort,
        .lineOutLeft,
        .lineOutCenter,
        .lineOutRight,
    ]

    static let popOutOptions: [PAResultType] = [
        .popOutPitcher,
        .popOutCatcher,
        .popOutFirst,
        .popOutSecond,
        .popOutThird,
        .popOutShort,
        .popOutLeft,
        .popOutCenter,
        .popOutRight,
    ]

    static let groundOutOptions: [PAResultType] = [
        .groundOut13,
        .groundOut23,
        .groundOut43,
        .groundOut53,
        .groundOut63,
    ]

    static let unassistedOutOptions: [PAResultType] = [
        .unassistedPitcher,
        .unassistedCatcher,
        .unassistedFirst,
        .unassistedSecond,
        .unassistedThird,
        .unassistedShort,
        .unassistedLeft,
        .unassistedCenter,
        .unassistedRight,
    ]

    static let doublePlayOptions: [PAResultType] = [
        .doublePlay163,
        .doublePlay243,
        .doublePlay263,
        .doublePlay363,
        .doublePlay463,
        .doublePlay543,
        .doublePlay643,
    ]

    static let errorOptions: [PAResultType] = [
        .error1,
        .error2,
        .error3,
        .error4,
        .error5,
        .error6,
        .error7,
        .error8,
        .error9,
    ]

    static let fieldersChoiceOptions: [PAResultType] = [
        .fieldersChoice12,
        .fieldersChoice16,
        .fieldersChoice24,
        .fieldersChoice25,
        .fieldersChoice36,
        .fieldersChoice46,
        .fieldersChoice52,
        .fieldersChoice54,
        .fieldersChoice64,
        .fieldersChoice65,
    ]

    static let inPlayOptions: [PAResultType] =
        hitOptions
        + flyOutOptions
        + lineOutOptions
        + popOutOptions
        + groundOutOptions
        + unassistedOutOptions
        + doublePlayOptions
        + errorOptions
        + fieldersChoiceOptions

    private var trailingPositionLabel: String? {
        guard let value = rawValue.last?.wholeNumberValue else {
            return nil
        }
        return Self.positionLabel(for: value)
    }

    private var leadingPositionLabel: String? {
        guard let value = rawValue.first?.wholeNumberValue else {
            return nil
        }
        return Self.positionLabel(for: value)
    }

    private static func positionLabel(for value: Int) -> String? {
        switch value {
        case 1: return "P"
        case 2: return "C"
        case 3: return "1B"
        case 4: return "2B"
        case 5: return "3B"
        case 6: return "SS"
        case 7: return "LF"
        case 8: return "CF"
        case 9: return "RF"
        default: return nil
        }
    }
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
            return PAResultType.inPlayOptions
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

func derivePAPitchProgress(
    from pitches: [ChartingPitch],
    seedBalls: Int? = nil,
    seedStrikes: Int? = nil
) -> PAPitchProgress {
    let orderedPitches = pitches.sorted { lhs, rhs in
        if lhs.pitchOrder == rhs.pitchOrder {
            return lhs.id < rhs.id
        }
        return lhs.pitchOrder < rhs.pitchOrder
    }
    let initialBalls = orderedPitches.first?.ballsBefore ?? seedBalls ?? 0
    let initialStrikes = orderedPitches.first?.strikesBefore ?? seedStrikes ?? 0
    var progress = PAPitchProgress(
        balls: max(0, min(3, initialBalls)),
        strikes: max(0, min(2, initialStrikes))
    )

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
    let arsenalPitchTypes: [PitchType]

    var id: String { playerId }

    enum CodingKeys: String, CodingKey {
        case playerId
        case name
        case throwsHand = "throws"
        case arsenalPitchTypes
    }

    init(playerId: String, name: String, throwsHand: String, arsenalPitchTypes: [PitchType] = PitchType.allCases) {
        self.playerId = playerId
        self.name = name
        self.throwsHand = throwsHand
        self.arsenalPitchTypes = arsenalPitchTypes
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        playerId = try container.decode(String.self, forKey: .playerId)
        name = try container.decode(String.self, forKey: .name)
        throwsHand = try container.decode(String.self, forKey: .throwsHand)
        arsenalPitchTypes = try container.decodeIfPresent([PitchType].self, forKey: .arsenalPitchTypes) ?? PitchType.allCases
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(playerId, forKey: .playerId)
        try container.encode(name, forKey: .name)
        try container.encode(throwsHand, forKey: .throwsHand)
        try container.encode(arsenalPitchTypes, forKey: .arsenalPitchTypes)
    }
}

/// Full Babson roster player returned by the bootstrap endpoint.
struct BootstrapRosterPlayer: Codable, Identifiable, Equatable {
    let slug: String
    let playerId: String?
    let name: String
    let positions: [String]
    let batsHand: String?
    let throwsHand: String?
    let academicYear: String?
    let isPitcher: Bool

    var id: String { playerId ?? slug }

    enum CodingKeys: String, CodingKey {
        case slug
        case playerId
        case name
        case positions
        case batsHand = "bats"
        case throwsHand = "throws"
        case academicYear
        case isPitcher
    }
}

/// Payload returned by GET /api/charting/bootstrap.
struct BootstrapResponse: Codable {
    let pitchers: [BootstrapPitcher]
    let rosterPlayers: [BootstrapRosterPlayer]
    let recentGames: [ChartingGame]
}
