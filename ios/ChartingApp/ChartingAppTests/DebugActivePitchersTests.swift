import XCTest
@testable import ChartingApp

final class DebugActivePitchersTests: XCTestCase {
    func testStaleRosterPayloadWithoutIsHitterStillFiltersPitcherPicker() throws {
        let payload = """
        [
          {
            "slug": "wilson_alexander",
            "playerId": "AWilson1",
            "name": "Alexander Wilson",
            "positions": ["OF"],
            "bats": "R",
            "throws": "R",
            "academicYear": "Jr.",
            "isPitcher": false
          }
        ]
        """.data(using: .utf8)!

        let players = try JSONDecoder().decode([BootstrapRosterPlayer].self, from: payload)

        XCTAssertEqual(players.count, 1)
        XCTAssertNil(players[0].isHitter)
        XCTAssertFalse(players[0].canAppearInPitcherPicker)
        XCTAssertTrue(players[0].canAppearInHitterPicker)
    }
}
