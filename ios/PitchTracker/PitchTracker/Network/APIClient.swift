import Foundation

// MARK: - API Client

/// URLSession-based client for all Phase 1-2 charting API routes.
/// Auth is handled via HTTPCookieStorage — once `login()` succeeds the
/// `pt_charting` cookie is stored automatically for subsequent requests.
@Observable
final class APIClient {

    /// Base URL of the Next.js server (e.g. "https://your-app.vercel.app").
    var baseURL: String {
        didSet {
            UserDefaults.standard.set(baseURL, forKey: "pt_api_base_url")
        }
    }

    /// True after a successful `login()` call (cookie is stored).
    var isAuthenticated: Bool = false

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init() {
        let storedURL = UserDefaults.standard.string(forKey: "pt_api_base_url")
        self.baseURL = storedURL ?? "http://localhost:3000"

        let config = URLSessionConfiguration.default
        config.httpCookieAcceptPolicy = .always
        config.httpCookieStorage = HTTPCookieStorage.shared
        self.session = URLSession(configuration: config)

        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()

        // Check if we already have a valid charting cookie
        checkExistingAuth()
    }

    // MARK: - Auth

    /// POST /api/charting-login
    func login(password: String) async throws {
        let url = try makeURL("/api/charting-login")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(["password": password])

        let (data, response) = try await session.data(for: request)
        try validateResponse(response, data: data)
        isAuthenticated = true
    }

    func logout() {
        // Remove charting cookies
        if let url = URL(string: baseURL) {
            let cookies = HTTPCookieStorage.shared.cookies(for: url) ?? []
            for cookie in cookies where cookie.name == ChartingConstants.chartingCookie {
                HTTPCookieStorage.shared.deleteCookie(cookie)
            }
        }
        isAuthenticated = false
    }

    // MARK: - Bootstrap

    /// GET /api/charting/bootstrap
    func fetchBootstrap() async throws -> BootstrapResponse {
        let url = try makeURL("/api/charting/bootstrap")
        let (data, response) = try await session.data(for: URLRequest(url: url))
        try validateResponse(response, data: data)
        return try decoder.decode(BootstrapResponse.self, from: data)
    }

    // MARK: - Games

    /// POST /api/charting/games
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
    ) async throws -> ChartingGame {
        let url = try makeURL("/api/charting/games")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        var body: [String: Any] = [
            "opponent": opponent,
            "gameDate": gameDate,
        ]
        if let v = charter { body["charter"] = v }
        if let v = weather { body["weather"] = v }
        if let v = homeCatcher { body["homeCatcher"] = v }
        if let v = awayCatcher { body["awayCatcher"] = v }
        if let v = babsonRecord { body["babsonRecord"] = v }
        if let v = standing { body["standing"] = v }
        if let v = tomorrowStarter { body["tomorrowStarter"] = v }
        if let v = tomorrowOpponent { body["tomorrowOpponent"] = v }
        if let v = notes { body["notes"] = v }

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response, data: data)

        let wrapper = try decoder.decode(GameWrapper.self, from: data)
        return wrapper.game
    }

    /// GET /api/charting/games
    func listGames() async throws -> [ChartingGame] {
        let url = try makeURL("/api/charting/games")
        let (data, response) = try await session.data(for: URLRequest(url: url))
        try validateResponse(response, data: data)

        let wrapper = try decoder.decode(GamesListWrapper.self, from: data)
        return wrapper.games
    }

    /// GET /api/charting/games/[id]
    func fetchGameSnapshot(id: String) async throws -> ChartingGameSnapshot {
        let url = try makeURL("/api/charting/games/\(id)")
        let (data, response) = try await session.data(for: URLRequest(url: url))
        try validateResponse(response, data: data)
        return try decoder.decode(ChartingGameSnapshot.self, from: data)
    }

    /// PATCH /api/charting/games/[id]
    func updateGame(id: String, revision: Int, fields: [String: Any]) async throws -> ChartingGame {
        let url = try makeURL("/api/charting/games/\(id)")
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        var body = fields
        body["revision"] = revision
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response, data: data)

        let wrapper = try decoder.decode(GameWrapper.self, from: data)
        return wrapper.game
    }

    // MARK: - Lineup

    /// GET /api/charting/games/[id]/lineup
    func fetchLineup(gameId: String) async throws -> [ChartingLineupEntry] {
        let url = try makeURL("/api/charting/games/\(gameId)/lineup")
        let (data, response) = try await session.data(for: URLRequest(url: url))
        try validateResponse(response, data: data)

        let wrapper = try decoder.decode(LineupWrapper.self, from: data)
        return wrapper.lineup
    }

    /// PUT /api/charting/games/[id]/lineup
    func replaceLineup(gameId: String, entries: [LineupEntryPayload]) async throws -> [ChartingLineupEntry] {
        let url = try makeURL("/api/charting/games/\(gameId)/lineup")
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(["entries": entries])

        let (data, response) = try await session.data(for: request)
        try validateResponse(response, data: data)

        let wrapper = try decoder.decode(LineupWrapper.self, from: data)
        return wrapper.lineup
    }

    /// PATCH /api/charting/games/[id]/lineup/[slot]
    func upsertLineupSlot(gameId: String, slot: Int, hitterName: String) async throws -> ChartingLineupEntry {
        let url = try makeURL("/api/charting/games/\(gameId)/lineup/\(slot)")
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(["hitterName": hitterName])

        let (data, response) = try await session.data(for: request)
        try validateResponse(response, data: data)

        let wrapper = try decoder.decode(LineupEntryWrapper.self, from: data)
        return wrapper.entry
    }

    // MARK: - Segments

    /// POST /api/charting/games/[id]/segments
    func addSegment(
        gameId: String,
        playerId: String,
        displayName: String? = nil,
        enteredInning: Int? = nil
    ) async throws -> ChartingPitcherSegment {
        let url = try makeURL("/api/charting/games/\(gameId)/segments")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        var body: [String: Any] = ["playerId": playerId]
        if let v = displayName { body["displayName"] = v }
        if let v = enteredInning { body["enteredInning"] = v }

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response, data: data)

        let wrapper = try decoder.decode(SegmentWrapper.self, from: data)
        return wrapper.segment
    }

    /// PATCH /api/charting/games/[id]/segments/[segId]
    func updateSegment(
        gameId: String,
        segId: String,
        fields: [String: Any]
    ) async throws -> ChartingPitcherSegment {
        let url = try makeURL("/api/charting/games/\(gameId)/segments/\(segId)")
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: fields)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response, data: data)

        let wrapper = try decoder.decode(SegmentWrapper.self, from: data)
        return wrapper.segment
    }

    // MARK: - Helpers

    private func makeURL(_ path: String) throws -> URL {
        guard let url = URL(string: baseURL + path) else {
            throw APIError.invalidURL(baseURL + path)
        }
        return url
    }

    private func validateResponse(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        switch http.statusCode {
        case 200...299:
            return
        case 401:
            isAuthenticated = false
            throw APIError.unauthorized
        case 409:
            throw APIError.staleRevision
        default:
            let message = (try? decoder.decode(ErrorWrapper.self, from: data))?.error
                ?? "HTTP \(http.statusCode)"
            throw APIError.serverError(statusCode: http.statusCode, message: message)
        }
    }

    private func checkExistingAuth() {
        guard let url = URL(string: baseURL) else { return }
        let cookies = HTTPCookieStorage.shared.cookies(for: url) ?? []
        isAuthenticated = cookies.contains { $0.name == ChartingConstants.chartingCookie }
    }
}

// MARK: - API Error

enum APIError: LocalizedError {
    case invalidURL(String)
    case invalidResponse
    case unauthorized
    case staleRevision
    case serverError(statusCode: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .invalidURL(let url):
            return "Invalid URL: \(url)"
        case .invalidResponse:
            return "Invalid server response"
        case .unauthorized:
            return "Not authenticated — please sign in again"
        case .staleRevision:
            return "Stale revision — another change was made. Please refresh."
        case .serverError(let code, let msg):
            return "Server error (\(code)): \(msg)"
        }
    }
}

// MARK: - Response Wrappers

private struct GameWrapper: Codable { let game: ChartingGame }
private struct GamesListWrapper: Codable { let games: [ChartingGame] }
private struct LineupWrapper: Codable { let lineup: [ChartingLineupEntry] }
private struct LineupEntryWrapper: Codable { let entry: ChartingLineupEntry }
private struct SegmentWrapper: Codable { let segment: ChartingPitcherSegment }
private struct ErrorWrapper: Codable { let error: String }

// MARK: - Payload Types

struct LineupEntryPayload: Codable {
    let lineupSlot: Int
    let hitterName: String
}
