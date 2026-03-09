import Foundation

/// Generates simplified pitch-level CSV data from charted games or Live AB sessions.
///
/// Game CSV columns (13):
///   inning, pitcher_id, pitcher, hitter_id, hitter, lineup_slot, pitch_number,
///   count, pitch_type, pitch_result, location, velocity, pa_result
///
/// Live AB CSV adds one extra column:
///   initial_count — the LiveABCountPreset ("0-0", "2-1", or "Bunt")
enum CSVExporter {

    // MARK: - Game Export

    /// Build CSV string from a persisted game's full data.
    static func buildGameCSV(
        game: PersistedGame,
        segments: [PersistedSegment],
        plateAppearances: [PersistedPlateAppearance],
        pitches: [PersistedPitch]
    ) -> String {
        let segmentById = Dictionary(uniqueKeysWithValues: segments.map { ($0.id, $0) })
        let pitchesByPA = Dictionary(grouping: pitches) { $0.paId }

        let header = "inning,pitcher_id,pitcher,hitter_id,hitter,lineup_slot,pitch_number,count,pitch_type,pitch_result,location,velocity,pa_result"
        var rows: [String] = [header]

        let sortedPAs = plateAppearances.sorted { $0.paOrder < $1.paOrder }
        for pa in sortedPAs {
            let segment = segmentById[pa.segmentId]
            let paPitches = (pitchesByPA[pa.id] ?? []).sorted { $0.pitchOrder < $1.pitchOrder }
            let lastIndex = paPitches.count - 1

            for (i, pitch) in paPitches.enumerated() {
                let isLast = i == lastIndex && pa.resultCode != nil
                var row = [String]()
                row.append(String(pa.inning))
                row.append(segment?.playerId ?? "")
                row.append(CSVExporter.csvEscape(segment?.displayName ?? ""))
                row.append("") // hitter_id
                row.append(CSVExporter.csvEscape(pa.hitterName))
                row.append(String(pa.lineupSlot))
                row.append(String(i + 1))
                row.append("\(pitch.ballsBefore)-\(pitch.strikesBefore)")
                row.append(CSVExporter.csvEscape(pitch.pitchType))
                row.append(CSVExporter.csvEscape(pitch.pitchResult))
                row.append(pitch.locationCell.map(String.init) ?? "")
                row.append(pitch.velocity.map(String.init) ?? "")
                row.append(isLast ? CSVExporter.csvEscape(pa.resultCode ?? "") : "")

                rows.append(row.joined(separator: ","))
            }
        }

        return rows.joined(separator: "\r\n")
    }

    // MARK: - Live AB Export

    /// Build CSV string from completed Live AB sessions.
    static func buildLiveABCSV(sessions: [LiveABSession]) -> String {
        let header = "inning,pitcher_id,pitcher,hitter_id,hitter,lineup_slot,pitch_number,count,pitch_type,pitch_result,location,velocity,pa_result,initial_count"
        var rows: [String] = [header]

        for session in sessions {
            let lastIndex = session.pitches.count - 1
            for (i, pitch) in session.pitches.enumerated() {
                let isLast = i == lastIndex && session.result != nil
                var row = [String]()
                row.append(String(session.setup.inning))
                row.append(session.setup.pitcherPlayerId)
                row.append(CSVExporter.csvEscape(session.setup.pitcherName))
                row.append("") // hitter_id
                row.append(CSVExporter.csvEscape(session.setup.hitterName))
                row.append("") // lineup_slot
                row.append(String(i + 1))
                row.append("\(pitch.ballsBefore)-\(pitch.strikesBefore)")
                row.append(CSVExporter.csvEscape(pitch.pitchType.rawValue))
                row.append(CSVExporter.csvEscape(pitch.pitchResult.rawValue))
                row.append(pitch.locationCell.map(String.init) ?? "")
                row.append(pitch.velocity.map(String.init) ?? "")
                row.append(isLast ? session.result?.rawValue ?? "" : "")
                row.append(session.setup.countPreset.rawValue)

                rows.append(row.joined(separator: ","))
            }
        }

        return rows.joined(separator: "\r\n")
    }

    // MARK: - File Output

    /// Write game CSV to a temp file and return the URL for ShareLink.
    static func writeToTempFile(
        game: PersistedGame,
        segments: [PersistedSegment],
        plateAppearances: [PersistedPlateAppearance],
        pitches: [PersistedPitch]
    ) -> URL? {
        let csv = buildGameCSV(
            game: game,
            segments: segments,
            plateAppearances: plateAppearances,
            pitches: pitches
        )
        return writeTempFile(csv: csv, name: "charting-\(game.gameDate)-\(slugify(game.opponent))")
    }

    /// Write Live AB CSV to a temp file and return the URL for ShareLink.
    static func writeLiveABToTempFile(sessions: [LiveABSession]) -> URL? {
        guard !sessions.isEmpty else { return nil }
        let csv = buildLiveABCSV(sessions: sessions)
        let dateStr = ISO8601DateFormatter().string(from: Date()).prefix(10)
        return writeTempFile(csv: csv, name: "liveab-\(dateStr)")
    }

    // MARK: - Helpers

    private static func writeTempFile(csv: String, name: String) -> URL? {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(name).csv")
        do {
            try csv.write(to: url, atomically: true, encoding: .utf8)
            return url
        } catch {
            print("[CSVExporter] Failed to write temp file: \(error)")
            return nil
        }
    }

    private static func csvEscape(_ value: String) -> String {
        if value.contains(",") || value.contains("\"") || value.contains("\n") {
            return "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
        }
        return value
    }

    private static func slugify(_ value: String) -> String {
        let slug = value
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        return slug.isEmpty ? "game" : slug
    }
}
