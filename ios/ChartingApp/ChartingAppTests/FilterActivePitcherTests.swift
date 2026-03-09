import SwiftData
import XCTest
@testable import ChartingApp

@available(iOS 17.0, *)
final class FilterActivePitcherTests: XCTestCase {
    private var container: ModelContainer!
    private var store: GameStore!

    @MainActor
    override func setUp() {
        super.setUp()
        let schema = Schema([
            PersistedGame.self,
            PersistedSegment.self,
            PersistedPlateAppearance.self,
            PersistedPitch.self,
            PersistedLineupEntry.self,
            PersistedBootstrapPitcher.self,
            PersistedSyncEntry.self,
        ])
        let config = ModelConfiguration(isStoredInMemoryOnly: true)
        container = try! ModelContainer(for: schema, configurations: [config])
        store = GameStore(modelContext: ModelContext(container))
    }

    override func tearDown() {
        container = nil
        store = nil
        super.tearDown()
    }

    @MainActor
    func testActivePitchersReturnsFalseForOF() {
        let pitcher = PersistedBootstrapPitcher(playerId: "AWilson1", name: "Alexander Wilson", throwsHand: "R")
        let rosterPlayer = BootstrapRosterPlayer(slug: "wilson_alexander", playerId: "AWilson1", name: "Alexander Wilson", positions: ["OF"], batsHand: "R", throwsHand: "R", academicYear: "Jr.", isPitcher: false, isHitter: true)

        store.pitchers = [pitcher]
        store.rosterPlayers = [rosterPlayer]

        let active = store.activePitchers

        XCTAssertEqual(active.count, 0, "Alexander Wilson should not be in activePitchers")
    }

    @MainActor
    func testActivePitchersRejectsPitchersMissingFromRoster() {
        let pitcher = PersistedBootstrapPitcher(playerId: "Missing1", name: "Missing From Roster", throwsHand: "R")

        store.pitchers = [pitcher]
        store.rosterPlayers = []

        XCTAssertTrue(store.activePitchers.isEmpty)
    }
}
