import Foundation
import SwiftData

// MARK: - SwiftData Persisted Models
// Each @Model class mirrors an API struct and adds a lastSyncedAt timestamp
// for tracking sync state.

@Model
final class PersistedGame {
    @Attribute(.unique) var id: String
    var opponent: String
    var gameDate: String
    var status: String // "draft" | "active" | "final"
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
    var lastSyncedAt: Date?

    init(
        id: String,
        opponent: String,
        gameDate: String,
        status: String = "draft",
        revision: Int = 1,
        charter: String? = nil,
        weather: String? = nil,
        homeCatcher: String? = nil,
        awayCatcher: String? = nil,
        babsonRecord: String? = nil,
        standing: String? = nil,
        tomorrowStarter: String? = nil,
        tomorrowOpponent: String? = nil,
        notes: String? = nil,
        createdAt: String,
        updatedAt: String,
        lastSyncedAt: Date? = nil
    ) {
        self.id = id
        self.opponent = opponent
        self.gameDate = gameDate
        self.status = status
        self.revision = revision
        self.charter = charter
        self.weather = weather
        self.homeCatcher = homeCatcher
        self.awayCatcher = awayCatcher
        self.babsonRecord = babsonRecord
        self.standing = standing
        self.tomorrowStarter = tomorrowStarter
        self.tomorrowOpponent = tomorrowOpponent
        self.notes = notes
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.lastSyncedAt = lastSyncedAt
    }

    /// Convert from API model.
    convenience init(from api: ChartingGame) {
        self.init(
            id: api.id,
            opponent: api.opponent,
            gameDate: api.gameDate,
            status: api.status.rawValue,
            revision: api.revision,
            charter: api.charter,
            weather: api.weather,
            homeCatcher: api.homeCatcher,
            awayCatcher: api.awayCatcher,
            babsonRecord: api.babsonRecord,
            standing: api.standing,
            tomorrowStarter: api.tomorrowStarter,
            tomorrowOpponent: api.tomorrowOpponent,
            notes: api.notes,
            createdAt: api.createdAt,
            updatedAt: api.updatedAt,
            lastSyncedAt: Date()
        )
    }

    /// Convert to API model.
    func toAPIModel() -> ChartingGame {
        ChartingGame(
            id: id,
            opponent: opponent,
            gameDate: gameDate,
            status: GameStatus(rawValue: status) ?? .draft,
            revision: revision,
            charter: charter,
            weather: weather,
            homeCatcher: homeCatcher,
            awayCatcher: awayCatcher,
            babsonRecord: babsonRecord,
            standing: standing,
            tomorrowStarter: tomorrowStarter,
            tomorrowOpponent: tomorrowOpponent,
            notes: notes,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }

    /// Update from a fresh API model (e.g. after sync).
    func update(from api: ChartingGame) {
        opponent = api.opponent
        gameDate = api.gameDate
        status = api.status.rawValue
        revision = api.revision
        charter = api.charter
        weather = api.weather
        homeCatcher = api.homeCatcher
        awayCatcher = api.awayCatcher
        babsonRecord = api.babsonRecord
        standing = api.standing
        tomorrowStarter = api.tomorrowStarter
        tomorrowOpponent = api.tomorrowOpponent
        notes = api.notes
        createdAt = api.createdAt
        updatedAt = api.updatedAt
        lastSyncedAt = Date()
    }
}

@Model
final class PersistedSegment {
    @Attribute(.unique) var id: String
    var gameId: String
    var playerId: String
    var displayName: String
    var segmentOrder: Int
    var enteredInning: Int?
    var exitedInning: Int?
    var runsOverride: Int?
    var earnedRunsOverride: Int?

    init(
        id: String,
        gameId: String,
        playerId: String,
        displayName: String,
        segmentOrder: Int,
        enteredInning: Int? = nil,
        exitedInning: Int? = nil,
        runsOverride: Int? = nil,
        earnedRunsOverride: Int? = nil
    ) {
        self.id = id
        self.gameId = gameId
        self.playerId = playerId
        self.displayName = displayName
        self.segmentOrder = segmentOrder
        self.enteredInning = enteredInning
        self.exitedInning = exitedInning
        self.runsOverride = runsOverride
        self.earnedRunsOverride = earnedRunsOverride
    }

    convenience init(from api: ChartingPitcherSegment) {
        self.init(
            id: api.id,
            gameId: api.gameId,
            playerId: api.playerId,
            displayName: api.displayName,
            segmentOrder: api.segmentOrder,
            enteredInning: api.enteredInning,
            exitedInning: api.exitedInning,
            runsOverride: api.runsOverride,
            earnedRunsOverride: api.earnedRunsOverride
        )
    }

    func toAPIModel() -> ChartingPitcherSegment {
        ChartingPitcherSegment(
            id: id,
            gameId: gameId,
            playerId: playerId,
            displayName: displayName,
            segmentOrder: segmentOrder,
            enteredInning: enteredInning,
            exitedInning: exitedInning,
            runsOverride: runsOverride,
            earnedRunsOverride: earnedRunsOverride
        )
    }
}

@Model
final class PersistedPlateAppearance {
    @Attribute(.unique) var id: String
    var gameId: String
    var segmentId: String
    var paOrder: Int
    var inning: Int
    var hitterName: String
    var lineupSlot: Int
    var resultCode: String?
    var buntContext: Bool

    init(
        id: String,
        gameId: String,
        segmentId: String,
        paOrder: Int,
        inning: Int,
        hitterName: String,
        lineupSlot: Int,
        resultCode: String? = nil,
        buntContext: Bool = false
    ) {
        self.id = id
        self.gameId = gameId
        self.segmentId = segmentId
        self.paOrder = paOrder
        self.inning = inning
        self.hitterName = hitterName
        self.lineupSlot = lineupSlot
        self.resultCode = resultCode
        self.buntContext = buntContext
    }

    convenience init(from api: ChartingPlateAppearance) {
        self.init(
            id: api.id,
            gameId: api.gameId,
            segmentId: api.segmentId,
            paOrder: api.paOrder,
            inning: api.inning,
            hitterName: api.hitterName,
            lineupSlot: api.lineupSlot,
            resultCode: api.resultCode,
            buntContext: api.buntContext
        )
    }

    func toAPIModel() -> ChartingPlateAppearance {
        ChartingPlateAppearance(
            id: id,
            gameId: gameId,
            segmentId: segmentId,
            paOrder: paOrder,
            inning: inning,
            hitterName: hitterName,
            lineupSlot: lineupSlot,
            resultCode: resultCode,
            buntContext: buntContext
        )
    }
}

@Model
final class PersistedPitch {
    @Attribute(.unique) var id: String
    var gameId: String
    var paId: String
    var pitchOrder: Int
    var pitchType: String
    var locationCell: Int?
    var pitchResult: String
    var ballsBefore: Int
    var strikesBefore: Int

    init(
        id: String,
        gameId: String,
        paId: String,
        pitchOrder: Int,
        pitchType: String,
        locationCell: Int? = nil,
        pitchResult: String,
        ballsBefore: Int,
        strikesBefore: Int
    ) {
        self.id = id
        self.gameId = gameId
        self.paId = paId
        self.pitchOrder = pitchOrder
        self.pitchType = pitchType
        self.locationCell = locationCell
        self.pitchResult = pitchResult
        self.ballsBefore = ballsBefore
        self.strikesBefore = strikesBefore
    }

    convenience init(from api: ChartingPitch) {
        self.init(
            id: api.id,
            gameId: api.gameId,
            paId: api.paId,
            pitchOrder: api.pitchOrder,
            pitchType: api.pitchType.rawValue,
            locationCell: api.locationCell,
            pitchResult: api.pitchResult.rawValue,
            ballsBefore: api.ballsBefore,
            strikesBefore: api.strikesBefore
        )
    }

    func toAPIModel() -> ChartingPitch? {
        guard let pt = PitchType(rawValue: pitchType),
              let pr = PitchResultType(rawValue: pitchResult) else {
            return nil
        }
        return ChartingPitch(
            id: id,
            gameId: gameId,
            paId: paId,
            pitchOrder: pitchOrder,
            pitchType: pt,
            locationCell: locationCell,
            pitchResult: pr,
            ballsBefore: ballsBefore,
            strikesBefore: strikesBefore
        )
    }
}

@Model
final class PersistedLineupEntry {
    @Attribute(.unique) var id: String
    var gameId: String
    var lineupSlot: Int
    var hitterName: String

    init(id: String, gameId: String, lineupSlot: Int, hitterName: String) {
        self.id = id
        self.gameId = gameId
        self.lineupSlot = lineupSlot
        self.hitterName = hitterName
    }

    convenience init(from api: ChartingLineupEntry) {
        self.init(
            id: api.id,
            gameId: api.gameId,
            lineupSlot: api.lineupSlot,
            hitterName: api.hitterName
        )
    }

    func toAPIModel() -> ChartingLineupEntry {
        ChartingLineupEntry(
            id: id,
            gameId: gameId,
            lineupSlot: lineupSlot,
            hitterName: hitterName
        )
    }
}

@Model
final class PersistedBootstrapPitcher {
    @Attribute(.unique) var playerId: String
    var name: String
    var throwsHand: String // "R" or "L"

    init(playerId: String, name: String, throwsHand: String) {
        self.playerId = playerId
        self.name = name
        self.throwsHand = throwsHand
    }

    convenience init(from api: BootstrapPitcher) {
        self.init(playerId: api.playerId, name: api.name, throwsHand: api.throwsHand)
    }

    func toAPIModel() -> BootstrapPitcher {
        BootstrapPitcher(playerId: playerId, name: name, throwsHand: throwsHand)
    }
}
