import Foundation

struct ChartingBootstrapRosterPlayer: Codable {
    let slug: String
    let playerId: String?
    let name: String
    let positions: [String]
    let bats: String?
    let throwsHand: String?
    let academicYear: String?
    let isPitcher: Bool
    let isHitter: Bool?

    enum CodingKeys: String, CodingKey {
        case slug, playerId, name, positions, bats, academicYear, isPitcher, isHitter
        case throwsHand = "throws"
    }
}

func test() async throws {
    guard let url = URL(string: "http://127.0.0.1:3000/api/charting/bootstrap") else { return }
    let data = try Data(contentsOf: url)
    let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
    let rosterData = try JSONSerialization.data(withJSONObject: json["rosterPlayers"]!)
    let rosterPlayers = try JSONDecoder().decode([ChartingBootstrapRosterPlayer].self, from: rosterData)
    
    let pitchersData = try JSONSerialization.data(withJSONObject: json["pitchers"]!)
    let pitchers = try JSONSerialization.jsonObject(with: pitchersData) as! [[String: Any]]
    
    var activePitchers = 0
    for p in pitchers {
        let pId = p["playerId"] as! String
        let name = p["name"] as! String
        
        let rp = rosterPlayers.first(where: { $0.playerId == pId })
        let canAppear = rp?.isPitcher ?? false // My new fallback logic
        
        if canAppear {
            activePitchers += 1
            print("ACTIVE PITCHER: \(name) - \(pId)")
        } else {
            // print("FILTERED PITCHER: \(name) - \(pId) -> rpFound=\(rp != nil), isPitcher=\(rp?.isPitcher ?? false)")
        }
    }
    
    print("TOTAL PITCHERS: \(pitchers.count)")
    print("ACTIVE PITCHERS: \(activePitchers)")
}

Task {
    do {
        try await test()
    } catch {
        print(error)
    }
    exit(0)
}
RunLoop.main.run()
