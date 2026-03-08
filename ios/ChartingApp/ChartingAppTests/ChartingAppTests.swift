import XCTest
@testable import ChartingApp

// MARK: - Model Round-Trip Tests

final class ModelRoundTripTests: XCTestCase {

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    // MARK: ChartingGame

    func testChartingGameRoundTrip() throws {
        let game = ChartingGame(
            id: "test-game-1",
            opponent: "MIT",
            gameDate: "2026-03-01",
            status: .active,
            revision: 3,
            charter: "Coach T",
            weather: "Clear, 48F",
            homeCatcher: "E. Santos",
            awayCatcher: nil,
            babsonRecord: "2-1",
            standing: "1st NEWMAC",
            tomorrowStarter: "CBurrows1",
            tomorrowOpponent: "WPI",
            notes: "Test notes",
            createdAt: "2026-03-01T12:00:00.000Z",
            updatedAt: "2026-03-01T14:30:00.000Z"
        )

        let data = try encoder.encode(game)
        let decoded = try decoder.decode(ChartingGame.self, from: data)

        XCTAssertEqual(game, decoded)
    }

    func testChartingGameNilFields() throws {
        let game = ChartingGame(
            id: "test-game-nil",
            opponent: "WPI",
            gameDate: "2026-03-02",
            status: .draft,
            revision: 1,
            charter: nil,
            weather: nil,
            homeCatcher: nil,
            awayCatcher: nil,
            babsonRecord: nil,
            standing: nil,
            tomorrowStarter: nil,
            tomorrowOpponent: nil,
            notes: nil,
            createdAt: "2026-03-02T10:00:00.000Z",
            updatedAt: "2026-03-02T10:00:00.000Z"
        )

        let data = try encoder.encode(game)
        let decoded = try decoder.decode(ChartingGame.self, from: data)

        XCTAssertEqual(game, decoded)
        XCTAssertNil(decoded.charter)
        XCTAssertNil(decoded.weather)
    }

    func testChartingGameDecodesFromServerJSON() throws {
        let json = """
        {
            "id": "srv-001",
            "opponent": "Tufts",
            "gameDate": "2026-04-15",
            "status": "final",
            "revision": 5,
            "charter": null,
            "weather": "Rain",
            "homeCatcher": null,
            "awayCatcher": null,
            "babsonRecord": null,
            "standing": null,
            "tomorrowStarter": null,
            "tomorrowOpponent": null,
            "notes": null,
            "createdAt": "2026-04-15T12:00:00.000Z",
            "updatedAt": "2026-04-15T18:00:00.000Z"
        }
        """.data(using: .utf8)!

        let game = try decoder.decode(ChartingGame.self, from: json)

        XCTAssertEqual(game.id, "srv-001")
        XCTAssertEqual(game.status, .final_)
        XCTAssertEqual(game.revision, 5)
        XCTAssertEqual(game.weather, "Rain")
    }

    // MARK: ChartingPitcherSegment

    func testSegmentRoundTrip() throws {
        let seg = ChartingPitcherSegment(
            id: "seg-1",
            gameId: "game-1",
            playerId: "DJames1",
            displayName: "D. James",
            segmentOrder: 0,
            enteredInning: 1,
            exitedInning: 5,
            runsOverride: nil,
            earnedRunsOverride: nil
        )

        let data = try encoder.encode(seg)
        let decoded = try decoder.decode(ChartingPitcherSegment.self, from: data)
        XCTAssertEqual(seg, decoded)
    }

    // MARK: ChartingPlateAppearance

    func testPlateAppearanceRoundTrip() throws {
        let pa = ChartingPlateAppearance(
            id: "pa-1",
            gameId: "game-1",
            segmentId: "seg-1",
            paOrder: 0,
            inning: 1,
            hitterName: "Smith",
            lineupSlot: 3,
            resultCode: "K",
            buntContext: false
        )

        let data = try encoder.encode(pa)
        let decoded = try decoder.decode(ChartingPlateAppearance.self, from: data)
        XCTAssertEqual(pa, decoded)
    }

    func testPlateAppearanceNilResultCode() throws {
        let pa = ChartingPlateAppearance(
            id: "pa-open",
            gameId: "game-1",
            segmentId: "seg-1",
            paOrder: 5,
            inning: 3,
            hitterName: "Jones",
            lineupSlot: 2,
            resultCode: nil,
            buntContext: true
        )

        let data = try encoder.encode(pa)
        let decoded = try decoder.decode(ChartingPlateAppearance.self, from: data)
        XCTAssertNil(decoded.resultCode)
        XCTAssertTrue(decoded.buntContext)
    }

    // MARK: ChartingPitch

    func testPitchRoundTrip() throws {
        let pitch = ChartingPitch(
            id: "pitch-1",
            gameId: "game-1",
            paId: "pa-1",
            pitchOrder: 0,
            pitchType: .fastball,
            locationCell: 5,
            pitchResult: .calledStrike,
            ballsBefore: 0,
            strikesBefore: 0
        )

        let data = try encoder.encode(pitch)
        let decoded = try decoder.decode(ChartingPitch.self, from: data)
        XCTAssertEqual(pitch, decoded)
    }

    func testPitchNilLocation() throws {
        let pitch = ChartingPitch(
            id: "pitch-noloc",
            gameId: "game-1",
            paId: "pa-1",
            pitchOrder: 2,
            pitchType: .slider,
            locationCell: nil,
            pitchResult: .swingingStrike,
            ballsBefore: 1,
            strikesBefore: 1
        )

        let data = try encoder.encode(pitch)
        let decoded = try decoder.decode(ChartingPitch.self, from: data)
        XCTAssertNil(decoded.locationCell)
    }

    func testPitchDecodesFromServerJSON() throws {
        // Server uses raw strings like "Fastball", "called_strike"
        let json = """
        {
            "id": "pitch-srv-1",
            "gameId": "g1",
            "paId": "pa1",
            "pitchOrder": 0,
            "pitchType": "Split/Cut",
            "locationCell": 14,
            "pitchResult": "bunt_foul",
            "ballsBefore": 2,
            "strikesBefore": 1
        }
        """.data(using: .utf8)!

        let pitch = try decoder.decode(ChartingPitch.self, from: json)
        XCTAssertEqual(pitch.pitchType, .splitCut)
        XCTAssertEqual(pitch.pitchResult, .buntFoul)
        XCTAssertEqual(pitch.locationCell, 14)
    }

    // MARK: ChartingLineupEntry

    func testLineupEntryRoundTrip() throws {
        let entry = ChartingLineupEntry(
            id: "le-1",
            gameId: "game-1",
            lineupSlot: 4,
            hitterName: "Williams"
        )

        let data = try encoder.encode(entry)
        let decoded = try decoder.decode(ChartingLineupEntry.self, from: data)
        XCTAssertEqual(entry, decoded)
    }

    // MARK: BootstrapPitcher & Response

    func testBootstrapPitcherRoundTrip() throws {
        let p = BootstrapPitcher(
            playerId: "DJames1",
            name: "D. James",
            throwsHand: "R",
            arsenalPitchTypes: [.fastball, .slider, .other]
        )
        let data = try encoder.encode(p)
        let decoded = try decoder.decode(BootstrapPitcher.self, from: data)
        XCTAssertEqual(p, decoded)
    }

    func testBootstrapRosterPlayerRoundTrip() throws {
        let player = BootstrapRosterPlayer(
            slug: "miller_wyatt",
            playerId: nil,
            name: "Wyatt Miller",
            positions: ["INF"],
            batsHand: "R",
            throwsHand: "R",
            academicYear: "Sr.",
            isPitcher: false
        )

        let data = try encoder.encode(player)
        let decoded = try decoder.decode(BootstrapRosterPlayer.self, from: data)
        XCTAssertEqual(player, decoded)
    }

    func testBootstrapResponseRoundTrip() throws {
        let response = BootstrapResponse(
            pitchers: [
                BootstrapPitcher(playerId: "DJames1", name: "D. James", throwsHand: "R", arsenalPitchTypes: [.fastball, .slider, .other]),
                BootstrapPitcher(playerId: "CBurrows1", name: "C. Burrows", throwsHand: "L", arsenalPitchTypes: [.fastball, .changeup, .other]),
            ],
            rosterPlayers: [
                BootstrapRosterPlayer(
                    slug: "miller_wyatt",
                    playerId: nil,
                    name: "Wyatt Miller",
                    positions: ["INF"],
                    batsHand: "R",
                    throwsHand: "R",
                    academicYear: "Sr.",
                    isPitcher: false
                ),
            ],
            recentGames: []
        )

        let data = try encoder.encode(response)
        let decoded = try decoder.decode(BootstrapResponse.self, from: data)
        XCTAssertEqual(decoded.pitchers.count, 2)
        XCTAssertEqual(decoded.rosterPlayers.count, 1)
        XCTAssertTrue(decoded.recentGames.isEmpty)
        XCTAssertEqual(decoded.pitchers[0].arsenalPitchTypes, [.fastball, .slider, .other])
    }

    // MARK: ChartingGameSnapshot

    func testSnapshotRoundTrip() throws {
        let snapshot = ChartingGameSnapshot(
            game: ChartingGame(
                id: "snap-g1",
                opponent: "MIT",
                gameDate: "2026-03-01",
                status: .active,
                revision: 1,
                charter: nil, weather: nil, homeCatcher: nil, awayCatcher: nil,
                babsonRecord: nil, standing: nil, tomorrowStarter: nil,
                tomorrowOpponent: nil, notes: nil,
                createdAt: "2026-03-01T12:00:00.000Z",
                updatedAt: "2026-03-01T12:00:00.000Z"
            ),
            segments: [
                ChartingPitcherSegment(
                    id: "s1", gameId: "snap-g1", playerId: "DJames1",
                    displayName: "D. James", segmentOrder: 0,
                    enteredInning: 1, exitedInning: nil,
                    runsOverride: nil, earnedRunsOverride: nil
                )
            ],
            lineup: [
                ChartingLineupEntry(id: "le1", gameId: "snap-g1", lineupSlot: 1, hitterName: "Smith")
            ],
            plateAppearances: [],
            pitches: []
        )

        let data = try encoder.encode(snapshot)
        let decoded = try decoder.decode(ChartingGameSnapshot.self, from: data)
        XCTAssertEqual(snapshot, decoded)
        XCTAssertEqual(decoded.segments.count, 1)
        XCTAssertEqual(decoded.lineup.count, 1)
    }
}

// MARK: - Domain Validation Tests

final class DomainValidationTests: XCTestCase {

    func testPitchTypeHas6Cases() {
        XCTAssertEqual(PitchType.allCases.count, 6)
    }

    func testPitchTypeCasesMatchServer() {
        let expected = ["Fastball", "Curveball", "Slider", "Changeup", "Split/Cut", "Other"]
        let actual = PitchType.allCases.map(\.rawValue)
        XCTAssertEqual(actual, expected)
    }

    func testPitchResultHas7Cases() {
        XCTAssertEqual(PitchResultType.allCases.count, 7)
    }

    func testPitchResultCasesMatchServer() {
        let expected = [
            "ball", "called_strike", "swinging_strike",
            "foul", "bunt_foul", "in_play", "hit_by_pitch"
        ]
        let actual = PitchResultType.allCases.map(\.rawValue)
        XCTAssertEqual(actual, expected)
    }

    func testGameStatusHas3Cases() {
        XCTAssertEqual(GameStatus.allCases.count, 3)
    }

    func testLocationCellRange() {
        XCTAssertEqual(ChartingConstants.locationCellRange, 1...17)
    }

    func testLineupSlotRange() {
        XCTAssertEqual(ChartingConstants.lineupSlotRange, 1...9)
    }

    func testChartingCookieName() {
        XCTAssertEqual(ChartingConstants.chartingCookie, "pt_charting")
    }

    func testGameStatusFinalEncoding() throws {
        let game = ChartingGame(
            id: "enc-test",
            opponent: "Test",
            gameDate: "2026-01-01",
            status: .final_,
            revision: 1,
            charter: nil, weather: nil, homeCatcher: nil, awayCatcher: nil,
            babsonRecord: nil, standing: nil, tomorrowStarter: nil,
            tomorrowOpponent: nil, notes: nil,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z"
        )

        let data = try JSONEncoder().encode(game)
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        XCTAssertEqual(json["status"] as? String, "final")
    }

func testGameStatusFinalDecoding() throws {
        let json = """
        {
            "id": "dec-test", "opponent": "Test", "gameDate": "2026-01-01",
            "status": "final", "revision": 1,
            "createdAt": "2026-01-01T00:00:00Z",
            "updatedAt": "2026-01-01T00:00:00Z"
        }
        """.data(using: .utf8)!

        let game = try JSONDecoder().decode(ChartingGame.self, from: json)
        XCTAssertEqual(game.status, .final_)
    }
}

// MARK: - Charting Engine Tests

final class ChartingEngineTests: XCTestCase {

    private func makeSegment(
        id: String,
        order: Int,
        enteredInning: Int? = nil,
        exitedInning: Int? = nil
    ) -> ChartingPitcherSegment {
        ChartingPitcherSegment(
            id: id,
            gameId: "game-1",
            playerId: "pitcher-\(order)",
            displayName: "Pitcher \(order)",
            segmentOrder: order,
            enteredInning: enteredInning,
            exitedInning: exitedInning,
            runsOverride: nil,
            earnedRunsOverride: nil
        )
    }

    private func makePA(
        id: String,
        order: Int,
        inning: Int,
        lineupSlot: Int,
        segmentId: String,
        resultCode: String?
    ) -> ChartingPlateAppearance {
        ChartingPlateAppearance(
            id: id,
            gameId: "game-1",
            segmentId: segmentId,
            paOrder: order,
            inning: inning,
            hitterName: "Hitter \(lineupSlot)",
            lineupSlot: lineupSlot,
            resultCode: resultCode,
            buntContext: false
        )
    }

    private func makePitch(
        id: String,
        paId: String,
        order: Int,
        result: PitchResultType,
        ballsBefore: Int,
        strikesBefore: Int
    ) -> ChartingPitch {
        ChartingPitch(
            id: id,
            gameId: "game-1",
            paId: paId,
            pitchOrder: order,
            pitchType: .fastball,
            locationCell: 5,
            pitchResult: result,
            ballsBefore: ballsBefore,
            strikesBefore: strikesBefore
        )
    }

    func testBuntFoulWithTwoStrikesCreatesStrikeoutReadyState() {
        let progress = derivePAPitchProgress(from: [
            makePitch(id: "p1", paId: "pa-1", order: 0, result: .calledStrike, ballsBefore: 0, strikesBefore: 0),
            makePitch(id: "p2", paId: "pa-1", order: 1, result: .swingingStrike, ballsBefore: 0, strikesBefore: 1),
            makePitch(id: "p3", paId: "pa-1", order: 2, result: .buntFoul, ballsBefore: 0, strikesBefore: 2),
        ])

        XCTAssertEqual(progress.strikes, 3)
        XCTAssertEqual(progress.closureState, .strikeout)
    }

    func testWalkProgressCapsAtBallFourAndRequiresBBClosure() {
        let progress = derivePAPitchProgress(from: [
            makePitch(id: "p1", paId: "pa-1", order: 0, result: .ball, ballsBefore: 0, strikesBefore: 0),
            makePitch(id: "p2", paId: "pa-1", order: 1, result: .ball, ballsBefore: 1, strikesBefore: 0),
            makePitch(id: "p3", paId: "pa-1", order: 2, result: .ball, ballsBefore: 2, strikesBefore: 0),
            makePitch(id: "p4", paId: "pa-1", order: 3, result: .ball, ballsBefore: 3, strikesBefore: 0),
        ])

        XCTAssertEqual(progress.balls, 4)
        XCTAssertEqual(progress.closureState, .walk)
    }

    func testPitchProgressSeedsFromStoredCount() {
        let progress = derivePAPitchProgress(from: [
            makePitch(id: "p1", paId: "pa-1", order: 0, result: .foul, ballsBefore: 2, strikesBefore: 1),
        ])

        XCTAssertEqual(progress.balls, 2)
        XCTAssertEqual(progress.strikes, 2)
    }

    func testInningRollsAfterThreeRecordedOuts() {
        let state = deriveChartingLiveState(
            segments: [makeSegment(id: "seg-1", order: 0, enteredInning: 1)],
            plateAppearances: [
                makePA(id: "pa-1", order: 0, inning: 1, lineupSlot: 1, segmentId: "seg-1", resultCode: "K"),
                makePA(id: "pa-2", order: 1, inning: 1, lineupSlot: 2, segmentId: "seg-1", resultCode: "6-3"),
                makePA(id: "pa-3", order: 2, inning: 1, lineupSlot: 3, segmentId: "seg-1", resultCode: "F8"),
            ],
            pitches: []
        )

        XCTAssertEqual(state.inning, 2)
        XCTAssertEqual(state.outs, 0)
        XCTAssertEqual(state.batterSlot, 4)
        XCTAssertTrue(state.isBetweenInnings)
    }

    func testDoublePlayAddsTwoOutsWithoutEndingInningByItself() {
        let state = deriveChartingLiveState(
            segments: [makeSegment(id: "seg-1", order: 0, enteredInning: 1)],
            plateAppearances: [
                makePA(id: "pa-1", order: 0, inning: 1, lineupSlot: 1, segmentId: "seg-1", resultCode: "DP"),
            ],
            pitches: []
        )

        XCTAssertEqual(state.inning, 1)
        XCTAssertEqual(state.outs, 2)
        XCTAssertEqual(state.batterSlot, 2)
    }

    func testOpenPlateAppearanceUsesPitchProgressAndAvailableCloseouts() {
        let state = deriveChartingLiveState(
            segments: [makeSegment(id: "seg-1", order: 0, enteredInning: 1)],
            plateAppearances: [
                makePA(id: "pa-1", order: 0, inning: 1, lineupSlot: 1, segmentId: "seg-1", resultCode: "K"),
                makePA(id: "pa-2", order: 1, inning: 1, lineupSlot: 2, segmentId: "seg-1", resultCode: nil),
            ],
            pitches: [
                makePitch(id: "p1", paId: "pa-2", order: 0, result: .inPlay, ballsBefore: 0, strikesBefore: 0),
            ]
        )

        XCTAssertEqual(state.inning, 1)
        XCTAssertEqual(state.outs, 1)
        XCTAssertEqual(state.batterSlot, 2)
        XCTAssertEqual(state.closureState, .inPlay)
        XCTAssertEqual(state.availableResults, PAResultType.inPlayOptions)
    }

    func testLatestSegmentBecomesActiveBetweenInnings() {
        let state = deriveChartingLiveState(
            segments: [
                makeSegment(id: "seg-1", order: 0, enteredInning: 1, exitedInning: 1),
                makeSegment(id: "seg-2", order: 1, enteredInning: 2),
            ],
            plateAppearances: [
                makePA(id: "pa-1", order: 0, inning: 1, lineupSlot: 1, segmentId: "seg-1", resultCode: "K"),
                makePA(id: "pa-2", order: 1, inning: 1, lineupSlot: 2, segmentId: "seg-1", resultCode: "6-3"),
                makePA(id: "pa-3", order: 2, inning: 1, lineupSlot: 3, segmentId: "seg-1", resultCode: "F8"),
            ],
            pitches: []
        )

        XCTAssertEqual(state.inning, 2)
        XCTAssertEqual(state.activeSegmentId, "seg-2")
        XCTAssertTrue(state.isBetweenInnings)
    }
}

// MARK: - SwiftData Persistence Tests

import SwiftData

final class PersistenceTests: XCTestCase {

    private func makeContainer() throws -> ModelContainer {
        let config = ModelConfiguration(isStoredInMemoryOnly: true)
        return try ModelContainer(
            for: PersistedGame.self,
                 PersistedSegment.self,
                 PersistedPlateAppearance.self,
                 PersistedPitch.self,
                 PersistedLineupEntry.self,
                 PersistedBootstrapPitcher.self,
            configurations: config
        )
    }

    func testPersistedGameSaveAndFetch() throws {
        let container = try makeContainer()
        let context = ModelContext(container)

        let game = PersistedGame(
            id: "persist-g1",
            opponent: "MIT",
            gameDate: "2026-03-01",
            status: "active",
            revision: 1,
            createdAt: "2026-03-01T12:00:00.000Z",
            updatedAt: "2026-03-01T12:00:00.000Z"
        )
        context.insert(game)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<PersistedGame>())
        XCTAssertEqual(fetched.count, 1)
        XCTAssertEqual(fetched[0].id, "persist-g1")
        XCTAssertEqual(fetched[0].opponent, "MIT")
        XCTAssertEqual(fetched[0].status, "active")
    }

    func testPersistedGameFromAPIModel() throws {
        let apiGame = ChartingGame(
            id: "api-g1",
            opponent: "WPI",
            gameDate: "2026-04-01",
            status: .draft,
            revision: 2,
            charter: "Coach",
            weather: "Sunny",
            homeCatcher: nil,
            awayCatcher: nil,
            babsonRecord: "3-1",
            standing: nil,
            tomorrowStarter: nil,
            tomorrowOpponent: nil,
            notes: nil,
            createdAt: "2026-04-01T10:00:00Z",
            updatedAt: "2026-04-01T10:00:00Z"
        )

        let persisted = PersistedGame(from: apiGame)
        XCTAssertEqual(persisted.id, "api-g1")
        XCTAssertEqual(persisted.status, "draft")
        XCTAssertEqual(persisted.charter, "Coach")

        let roundTripped = persisted.toAPIModel()
        XCTAssertEqual(roundTripped, apiGame)
    }

    func testPersistedSegmentSaveAndFetch() throws {
        let container = try makeContainer()
        let context = ModelContext(container)

        let seg = PersistedSegment(
            id: "seg-1",
            gameId: "game-1",
            playerId: "DJames1",
            displayName: "D. James",
            segmentOrder: 0,
            enteredInning: 1
        )
        context.insert(seg)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<PersistedSegment>())
        XCTAssertEqual(fetched.count, 1)
        XCTAssertEqual(fetched[0].playerId, "DJames1")
    }

    func testPersistedPitchSaveAndFetch() throws {
        let container = try makeContainer()
        let context = ModelContext(container)

        let pitch = PersistedPitch(
            id: "p1",
            gameId: "g1",
            paId: "pa1",
            pitchOrder: 0,
            pitchType: "Fastball",
            locationCell: 5,
            pitchResult: "called_strike",
            ballsBefore: 0,
            strikesBefore: 0
        )
        context.insert(pitch)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<PersistedPitch>())
        XCTAssertEqual(fetched.count, 1)
        XCTAssertEqual(fetched[0].pitchType, "Fastball")
        XCTAssertEqual(fetched[0].locationCell, 5)
    }

    func testPersistedLineupEntrySaveAndFetch() throws {
        let container = try makeContainer()
        let context = ModelContext(container)

        let entry = PersistedLineupEntry(
            id: "le1", gameId: "g1", lineupSlot: 3, hitterName: "Williams"
        )
        context.insert(entry)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<PersistedLineupEntry>())
        XCTAssertEqual(fetched.count, 1)
        XCTAssertEqual(fetched[0].lineupSlot, 3)
        XCTAssertEqual(fetched[0].hitterName, "Williams")
    }

    func testPersistedBootstrapPitcherSaveAndFetch() throws {
        let container = try makeContainer()
        let context = ModelContext(container)

        let pitcher = PersistedBootstrapPitcher(
            playerId: "DJames1",
            name: "D. James",
            throwsHand: "R",
            arsenalPitchTypesRaw: "Fastball,Slider,Other"
        )
        context.insert(pitcher)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<PersistedBootstrapPitcher>())
        XCTAssertEqual(fetched.count, 1)
        XCTAssertEqual(fetched[0].playerId, "DJames1")
        XCTAssertEqual(fetched[0].throwsHand, "R")
        XCTAssertEqual(fetched[0].arsenalPitchTypes, [.fastball, .slider, .other])
    }

    // MARK: Relaunch Recovery

    func testActiveGameRecoveryFromSwiftData() throws {
        let container = try makeContainer()
        let context = ModelContext(container)

        // Insert a draft and an active game
        let draft = PersistedGame(
            id: "draft-1", opponent: "A", gameDate: "2026-01-01",
            status: "draft", revision: 1,
            createdAt: "2026-01-01T10:00:00Z", updatedAt: "2026-01-01T10:00:00Z"
        )
        let active = PersistedGame(
            id: "active-1", opponent: "B", gameDate: "2026-01-02",
            status: "active", revision: 2,
            createdAt: "2026-01-02T10:00:00Z", updatedAt: "2026-01-02T12:00:00Z"
        )
        context.insert(draft)
        context.insert(active)
        try context.save()

        // Simulate recovery query
        let descriptor = FetchDescriptor<PersistedGame>(
            predicate: #Predicate { $0.status == "active" },
            sortBy: [SortDescriptor(\.updatedAt, order: .reverse)]
        )
        let recovered = try context.fetch(descriptor)

        XCTAssertEqual(recovered.count, 1)
        XCTAssertEqual(recovered[0].id, "active-1")
        XCTAssertEqual(recovered[0].opponent, "B")
    }

    func testGameUpdateFromAPI() throws {
        let container = try makeContainer()
        let context = ModelContext(container)

        let game = PersistedGame(
            id: "update-test", opponent: "Old", gameDate: "2026-01-01",
            status: "draft", revision: 1,
            createdAt: "2026-01-01T10:00:00Z", updatedAt: "2026-01-01T10:00:00Z"
        )
        context.insert(game)
        try context.save()

        let apiUpdate = ChartingGame(
            id: "update-test",
            opponent: "New",
            gameDate: "2026-01-01",
            status: .active,
            revision: 2,
            charter: "Coach",
            weather: nil, homeCatcher: nil, awayCatcher: nil,
            babsonRecord: nil, standing: nil, tomorrowStarter: nil,
            tomorrowOpponent: nil, notes: nil,
            createdAt: "2026-01-01T10:00:00Z",
            updatedAt: "2026-01-01T14:00:00Z"
        )

        game.update(from: apiUpdate)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<PersistedGame>())
        XCTAssertEqual(fetched.count, 1)
        XCTAssertEqual(fetched[0].opponent, "New")
        XCTAssertEqual(fetched[0].status, "active")
        XCTAssertEqual(fetched[0].revision, 2)
        XCTAssertNotNil(fetched[0].lastSyncedAt)
    }
}

final class ChartingStateTests: XCTestCase {

    func testPendingPitchRequiresExplicitAction() {
        let state = ChartingState()
        state.selectedPitchType = .fastball
        state.selectedLocation = 5

        XCTAssertFalse(state.isPendingPitchReady)

        state.selectedPitchResult = .calledStrike

        XCTAssertTrue(state.isPendingPitchReady)
    }

    func testLiveABPitchConfirmationAndUndoLifecycle() {
        let state = ChartingState()
        let setup = LiveABSetup(
            pitcherPlayerId: "DJames1",
            pitcherName: "D. James",
            pitcherThrowsHand: "R",
            hitterName: "Practice Hitter",
            inning: 3,
            halfInning: .top,
            outs: 1,
            countPreset: .twoOne
        )

        state.beginLiveABSession(with: setup)
        state.selectedPitchType = .fastball
        state.selectedLocation = 5
        state.selectedPitchResult = .hitByPitch

        XCTAssertTrue(state.commitLiveABPitch())
        XCTAssertEqual(state.currentLiveABSession?.availableResults, [.hitByPitch])
        XCTAssertEqual(state.liveABPitcherTotal(playerId: "DJames1"), 1)

        XCTAssertTrue(state.closeLiveAB(result: .hitByPitch))
        XCTAssertNil(state.currentLiveABSession)
        XCTAssertEqual(state.completedLiveABSessions.count, 1)

        state.undoLiveABAction()

        XCTAssertNotNil(state.currentLiveABSession)
        XCTAssertNil(state.currentLiveABSession?.result)
        XCTAssertEqual(state.currentLiveABSession?.pitches.count, 1)
    }

    func testBuntPresetFiltersActionsAndMarksCommittedPitchContext() {
        let state = ChartingState()
        state.mode = .liveAB

        let setup = LiveABSetup(
            pitcherPlayerId: "DJames1",
            pitcherName: "D. James",
            pitcherThrowsHand: "R",
            hitterName: "Practice Hitter",
            inning: 1,
            halfInning: .top,
            outs: 0,
            countPreset: .bunt
        )

        state.beginLiveABSession(with: setup)

        XCTAssertEqual(
            state.availablePitchResults,
            [.ball, .calledStrike, .buntFoul, .inPlay, .hitByPitch]
        )

        state.selectedPitchType = .fastball
        state.selectedLocation = 2
        state.selectedPitchResult = .inPlay

        XCTAssertTrue(state.commitLiveABPitch())
        XCTAssertTrue(state.currentLiveABSession?.pitches.last?.buntContext == true)
    }
}
